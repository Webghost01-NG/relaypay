// SPDX-License-Identifier: MIT

import { loadRelayerConfig } from './config.js';
import { XrplMonitor, DetectedXrplTx } from './xrplMonitor.js';
import { FdcVerifierClient } from './fdcVerifierClient.js';
import { FlareRelayer } from './flareRelayer.js';

export { loadRelayerConfig } from './config.js';
export { XrplMonitor } from './xrplMonitor.js';
export { FdcVerifierClient } from './fdcVerifierClient.js';
export { FlareRelayer } from './flareRelayer.js';

interface PendingTx {
  tx: DetectedXrplTx;
  attempts: number;
  lastAttemptTime: number;
}

export class RelayPayDaemon {
  private config = loadRelayerConfig();
  private fdcClient: FdcVerifierClient;
  private flareRelayer: FlareRelayer;
  private monitor: XrplMonitor | null = null;
  private pendingQueue: Map<string, PendingTx> = new Map();
  private retryTimer: ReturnType<typeof setInterval> | null = null;

  // Retry settings
  private static readonly MAX_RETRY_ATTEMPTS = 20;
  private static readonly RETRY_INTERVAL_MS = 15_000; // 15 seconds
  private static readonly FDC_POLL_MAX_RETRIES = 12;
  private static readonly FDC_POLL_INTERVAL_MS = 15_000;

  constructor() {
    this.fdcClient = new FdcVerifierClient(this.config.fdcApiUrl);
    this.flareRelayer = new FlareRelayer(
      this.config.flareRpcUrl,
      this.config.registryAddress,
      this.config.relayerPrivateKey
    );
  }

  public start(): void {
    console.log('⚡ RelayPay FDC Relayer Daemon v1.0');
    console.log(`   XRPL WSS: ${this.config.xrplWssUrl}`);
    console.log(`   Flare RPC: ${this.config.flareRpcUrl}`);
    console.log(`   Registry: ${this.config.registryAddress}`);
    console.log(`   FDC API: ${this.config.fdcApiUrl}`);
    console.log(`   Monitored accounts: ${(this.config.monitoredAccounts || []).join(', ') || 'ALL'}`);
    console.log('');

    this.monitor = new XrplMonitor({
      wssUrl: this.config.xrplWssUrl,
      accounts: this.config.monitoredAccounts || [],
      onPaymentDetected: (tx: DetectedXrplTx) => this.handleDetectedPayment(tx),
      onError: (err) => {
        console.error('[XRPL MONITOR ERROR]:', err.message);
      },
    });

    this.monitor.start();

    // Start retry queue processor
    this.retryTimer = setInterval(() => this.processRetryQueue(), RelayPayDaemon.RETRY_INTERVAL_MS);

    console.log('[DAEMON] Listening for XRPL payments...\n');
  }

  private async handleDetectedPayment(tx: DetectedXrplTx): Promise<void> {
    console.log(`\n[XRPL] ─── Payment Detected ───`);
    console.log(`   Tx Hash: ${tx.txHash}`);
    console.log(`   From: ${tx.sourceAddress}`);
    console.log(`   To: ${tx.destinationAddress}`);
    console.log(`   Amount: ${tx.amountDrops} drops`);
    console.log(`   Invoice Memo: ${tx.memoInvoiceId}`);

    // Add to pending queue for processing
    if (this.pendingQueue.has(tx.txHash)) {
      console.log(`[QUEUE] Already in queue, skipping duplicate`);
      return;
    }

    this.pendingQueue.set(tx.txHash, { tx, attempts: 0, lastAttemptTime: 0 });
    await this.processTransaction(tx.txHash);
  }

  private async processTransaction(txHash: string): Promise<void> {
    const pending = this.pendingQueue.get(txHash);
    if (!pending) return;

    pending.attempts++;
    pending.lastAttemptTime = Date.now();

    const { tx } = pending;
    console.log(`\n[PROCESS] Attempt ${pending.attempts}/${RelayPayDaemon.MAX_RETRY_ATTEMPTS} for ${txHash.slice(0, 16)}...`);

    try {
      // Step 1: Fetch FDC Merkle Proof (includes internal retry/polling for voting round)
      console.log(`[FDC] Fetching attestation proof...`);
      const proof = await this.fdcClient.fetchProof(
        tx.txHash,
        tx.memoInvoiceId,
        tx.destinationAddress,
        tx.amountDrops,
        tx.blockNumber,
        tx.blockTimestamp,
        RelayPayDaemon.FDC_POLL_MAX_RETRIES,
        RelayPayDaemon.FDC_POLL_INTERVAL_MS
      );

      console.log(`[FDC] ✓ Proof retrieved (${proof.merkleProof.length} proof nodes)`);

      // Step 2: Submit fulfillment to Flare EVM
      if (this.config.relayerPrivateKey) {
        console.log(`[FLARE] Submitting verifyAndFulfill...`);
        const evmTxHash = await this.flareRelayer.submitFulfillment(tx.memoInvoiceId, proof);

        if (evmTxHash === 'SKIPPED_NOT_PAYABLE') {
          console.log(`[FLARE] Invoice already fulfilled or not in payable state. Removing from queue.`);
        } else {
          console.log(`[FLARE] ✓ Invoice fulfilled! EVM Tx: ${evmTxHash}`);
        }

        // Success — remove from retry queue
        this.pendingQueue.delete(txHash);
      } else {
        console.warn(`[FLARE] No RELAYER_PRIVATE_KEY configured. Proof obtained but not submitted.`);
        this.pendingQueue.delete(txHash);
      }
    } catch (err: any) {
      console.error(`[ERROR] Attempt ${pending.attempts} failed: ${err.message}`);

      if (pending.attempts >= RelayPayDaemon.MAX_RETRY_ATTEMPTS) {
        console.error(`[QUEUE] Max retries reached for ${txHash.slice(0, 16)}. Giving up.`);
        this.pendingQueue.delete(txHash);
      } else {
        console.log(`[QUEUE] Will retry in ${RelayPayDaemon.RETRY_INTERVAL_MS / 1000}s...`);
      }
    }
  }

  private async processRetryQueue(): Promise<void> {
    const now = Date.now();
    for (const [txHash, pending] of this.pendingQueue) {
      // Only retry if enough time has passed since last attempt
      if (now - pending.lastAttemptTime >= RelayPayDaemon.RETRY_INTERVAL_MS) {
        await this.processTransaction(txHash);
      }
    }
  }

  public stop(): void {
    if (this.monitor) {
      this.monitor.stop();
    }
    if (this.retryTimer) {
      clearInterval(this.retryTimer);
    }
    console.log('[DAEMON] Stopped.');
  }
}
