import { Contract, JsonRpcProvider, Signer } from 'ethers';
import {
  RelayPayConfig,
  CreateInvoiceOptions,
  RelayPayInvoice,
  InvoiceStatus,
  FdcPaymentAttestationProof,
  PaymentLifecycleHandler,
} from './types.js';
import { dropsToXrp, formatXrplPayUrl, hashMetadata } from './utils.js';
import { XRPLPaymentListener } from './xrplListener.js';
import { FdcService } from './fdcService.js';

const REGISTRY_ABI = [
  'event InvoiceCreated(bytes32 indexed invoiceId, address indexed merchant, address indexed allowedBuyer, uint256 requiredAmountDrops, uint64 expirationTimestamp, string xrplDestinationAddress)',
  'function createInvoice(uint256 amountInUsdCents, uint64 durationSeconds, string xrplDestinationAddress, address allowedBuyer, bytes32 fulfillmentPayloadHash) returns (bytes32 invoiceId)',
  'function createInvoiceFixedXrp(uint256 requiredAmountDrops, uint64 durationSeconds, string xrplDestinationAddress, address allowedBuyer, bytes32 fulfillmentPayloadHash) returns (bytes32 invoiceId)',
  'function verifyAndFulfill(bytes32 invoiceId, tuple(bytes32[] merkleProof, tuple(bytes32 attestationType, bytes32 sourceId, uint64 votingRound, uint64 lowestUsedTimestamp, tuple(uint64 blockNumber, uint64 blockTimestamp, bytes32 sourceAddressHash, bytes32 receivingAddressHash, int256 spentAmount, int256 receivedAmount, bytes32 standardPaymentReference, bool status) body) response) attestationProof) returns (bool success)',
  'function getInvoice(bytes32 invoiceId) view returns (tuple(bytes32 invoiceId, address merchant, address allowedBuyer, string xrplDestinationAddress, bytes32 receivingAddressHash, uint256 requiredAmountDrops, uint256 paidAmountDrops, uint64 creationTimestamp, uint64 expirationTimestamp, uint8 status, bytes32 fulfillmentPayloadHash, uint256 receiptTokenId))',
];

export class RelayPayClient {
  private provider: JsonRpcProvider;
  private registryContract: Contract;
  private fdcService: FdcService;

  constructor(private config: RelayPayConfig) {
    this.provider = new JsonRpcProvider(config.flareRpcUrl);
    this.registryContract = new Contract(config.registryAddress, REGISTRY_ABI, this.provider);
    this.fdcService = new FdcService(config.fdcApiUrl);
  }

  /**
   * Creates an expiring invoice on Flare EVM with optional dynamic FTSO XRP/USD rate locking
   */
  public async createInvoice(
    signer: Signer,
    options: CreateInvoiceOptions
  ): Promise<RelayPayInvoice> {
    const contractWithSigner = this.registryContract.connect(signer) as Contract;
    const payloadHash = hashMetadata(options.metadata);
    const allowedBuyer = options.allowedBuyer || '0x0000000000000000000000000000000000000000';

    let tx;
    if (options.amountInUsdCents !== undefined) {
      tx = await contractWithSigner.getFunction('createInvoice')(
        options.amountInUsdCents,
        options.durationSeconds,
        options.xrplDestinationAddress,
        allowedBuyer,
        payloadHash
      );
    } else if (options.requiredAmountDrops !== undefined) {
      tx = await contractWithSigner.getFunction('createInvoiceFixedXrp')(
        options.requiredAmountDrops,
        options.durationSeconds,
        options.xrplDestinationAddress,
        allowedBuyer,
        payloadHash
      );
    } else {
      throw new Error('RelayPay: Must specify amountInUsdCents or requiredAmountDrops');
    }

    const receipt = await tx.wait();

    // Parse the actual invoiceId from the InvoiceCreated event emitted on-chain
    let invoiceId: string | null = null;
    for (const log of receipt.logs) {
      try {
        const parsed = this.registryContract.interface.parseLog(log);
        if (parsed && parsed.name === 'InvoiceCreated') {
          invoiceId = parsed.args.invoiceId;
          break;
        }
      } catch {
        // Log is from a different contract event
      }
    }

    if (!invoiceId) {
      throw new Error('RelayPay: Failed to extract invoiceId from InvoiceCreated event');
    }

    return this.getInvoice(invoiceId);
  }

  /**
   * Fetches invoice state from RelayPayInvoiceRegistry on Flare
   */
  public async getInvoice(invoiceId: string): Promise<RelayPayInvoice> {
    const inv = await this.registryContract.getFunction('getInvoice')(invoiceId);
    
    const requiredAmountDrops = inv.requiredAmountDrops.toString();
    const paidAmountDrops = inv.paidAmountDrops.toString();

    return {
      invoiceId: inv.invoiceId,
      merchant: inv.merchant,
      allowedBuyer: inv.allowedBuyer,
      xrplDestinationAddress: inv.xrplDestinationAddress,
      requiredAmountDrops,
      requiredXrpFormatted: dropsToXrp(requiredAmountDrops),
      paidAmountDrops,
      creationTimestamp: Number(inv.creationTimestamp),
      expirationTimestamp: Number(inv.expirationTimestamp),
      status: Number(inv.status) as InvoiceStatus,
      fulfillmentPayloadHash: inv.fulfillmentPayloadHash,
      xrplPayUrl: formatXrplPayUrl(inv.xrplDestinationAddress, requiredAmountDrops, inv.invoiceId),
      receiptTokenId: Number(inv.receiptTokenId),
    };
  }

  /**
   * Listens for native XRPL payment, fetches FDC proof, and fulfills purchase on Flare
   */
  public watchAndAutoFulfill(
    signer: Signer,
    invoiceId: string,
    onStatusChange: PaymentLifecycleHandler
  ): () => void {
    let listener: XRPLPaymentListener | null = null;

    this.getInvoice(invoiceId).then((invoice) => {
      listener = new XRPLPaymentListener({
        wssUrl: this.config.xrplWssUrl || 'wss://s.altnet.rippletest.net:51233',
        destinationAddress: invoice.xrplDestinationAddress,
        memoInvoiceId: invoice.invoiceId,
        onPaymentDetected: async (txEvent) => {
          onStatusChange({ status: 'XRPL_TX_DETECTED', data: txEvent });

          try {
            // Fetch FDC Attestation Proof
            const proof = await this.fdcService.fetchPaymentProof(
              txEvent.txHash,
              invoiceId,
              invoice.xrplDestinationAddress,
              txEvent.amountDrops,
              txEvent.blockTimestamp
            );

            onStatusChange({ status: 'FDC_PROOF_READY', data: proof });

            // Fulfill on Flare EVM
            const contractWithSigner = this.registryContract.connect(signer) as Contract;
            const fulfillTx = await contractWithSigner.getFunction('verifyAndFulfill')(invoiceId, proof);
            const fulfillReceipt = await fulfillTx.wait();

            onStatusChange({ status: 'FULFILLED', data: fulfillReceipt });
          } catch (err: any) {
            onStatusChange({ status: 'ERROR', error: err.message });
          }
        },
        onError: (err) => {
          onStatusChange({ status: 'ERROR', error: err.message });
        },
      });

      listener.start();
    });

    return () => {
      if (listener) listener.stop();
    };
  }
}
