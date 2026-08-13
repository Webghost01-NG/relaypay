// SPDX-License-Identifier: MIT

import { loadRelayerConfig } from './config.js';
import { XrplMonitor, DetectedXrplTx } from './xrplMonitor.js';
import { FdcVerifierClient } from './fdcVerifierClient.js';
import { FlareRelayer } from './flareRelayer.js';

export { loadRelayerConfig } from './config.js';
export { XrplMonitor } from './xrplMonitor.js';
export { FdcVerifierClient } from './fdcVerifierClient.js';
export { FlareRelayer } from './flareRelayer.js';

export class RelayPayDaemon {
  private config = loadRelayerConfig();
  private fdcClient: FdcVerifierClient;
  private flareRelayer: FlareRelayer;
  private monitor: XrplMonitor | null = null;

  constructor() {
    this.fdcClient = new FdcVerifierClient(this.config.fdcApiUrl);
    this.flareRelayer = new FlareRelayer(
      this.config.flareRpcUrl,
      this.config.registryAddress,
      this.config.relayerPrivateKey
    );
  }

  public start(): void {
    console.log('⚡ Starting RelayPay FDC Relayer Daemon...');
    console.log(`XRPL WSS: ${this.config.xrplWssUrl}`);
    console.log(`Flare RPC: ${this.config.flareRpcUrl}`);
    console.log(`Registry: ${this.config.registryAddress}`);

    this.monitor = new XrplMonitor({
      wssUrl: this.config.xrplWssUrl,
      accounts: this.config.monitoredAccounts || [],
      onPaymentDetected: async (tx: DetectedXrplTx) => {
        console.log(`[XRPL] Detected Payment Tx: ${tx.txHash} for Invoice: ${tx.memoInvoiceId}`);
        try {
          // Fetch FDC Merkle Proof
          const proof = await this.fdcClient.fetchProof(
            tx.txHash,
            tx.memoInvoiceId,
            tx.destinationAddress,
            tx.amountDrops,
            tx.blockNumber,
            tx.blockTimestamp
          );

          console.log(`[FDC] Consensus Merkle proof retrieved for Invoice: ${tx.memoInvoiceId}`);

          // Submit to Flare EVM
          if (this.config.relayerPrivateKey) {
            const txHash = await this.flareRelayer.submitFulfillment(tx.memoInvoiceId, proof);
            console.log(`[FLARE] Invoice ${tx.memoInvoiceId} Fulfilled! EVM Tx Hash: ${txHash}`);
          }
        } catch (err: any) {
          console.error(`[RELAYER ERROR] Processing failed for ${tx.txHash}:`, err.message);
        }
      },
      onError: (err) => {
        console.error('[XRPL MONITOR ERROR]:', err.message);
      },
    });

    this.monitor.start();
  }

  public stop(): void {
    if (this.monitor) {
      this.monitor.stop();
    }
  }
}
