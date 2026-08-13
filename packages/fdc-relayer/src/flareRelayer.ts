import { Contract, JsonRpcProvider, Wallet } from 'ethers';
import { FdcProofResult } from './fdcVerifierClient.js';

const REGISTRY_ABI = [
  'function verifyAndFulfill(bytes32 invoiceId, tuple(bytes32[] merkleProof, tuple(bytes32 attestationType, bytes32 sourceId, uint64 votingRound, uint64 lowestUsedTimestamp, tuple(uint64 blockNumber, uint64 blockTimestamp, bytes32 sourceAddressHash, bytes32 receivingAddressHash, int256 spentAmount, int256 receivedAmount, bytes32 standardPaymentReference, bool status) body) response) attestationProof) returns (bool success)',
  'function getInvoice(bytes32 invoiceId) view returns (tuple(bytes32 invoiceId, address merchant, address allowedBuyer, string xrplDestinationAddress, bytes32 receivingAddressHash, uint256 requiredAmountDrops, uint256 paidAmountDrops, uint64 creationTimestamp, uint64 expirationTimestamp, uint8 status, bytes32 fulfillmentPayloadHash, uint256 receiptTokenId))',
];

export class FlareRelayer {
  private provider: JsonRpcProvider;
  private wallet: Wallet | null = null;
  private registryContract: Contract;

  constructor(
    flareRpcUrl: string,
    registryAddress: string,
    private relayerPrivateKey?: string
  ) {
    this.provider = new JsonRpcProvider(flareRpcUrl);
    this.registryContract = new Contract(registryAddress, REGISTRY_ABI, this.provider);

    if (relayerPrivateKey) {
      this.wallet = new Wallet(relayerPrivateKey, this.provider);
      this.registryContract = this.registryContract.connect(this.wallet) as Contract;
    }
  }

  /**
   * Submits FDC attestation proof to RelayPayInvoiceRegistry on Flare EVM
   */
  public async submitFulfillment(
    invoiceId: string,
    proof: FdcProofResult
  ): Promise<string> {
    if (!this.wallet) {
      throw new Error('RelayPay Relayer: No relayer private key provided for automated submission');
    }

    // Check if invoice is in payable state
    const inv = await this.registryContract.getFunction('getInvoice')(invoiceId);
    const status = Number(inv.status);
    
    // Status 0: PENDING, Status 2: UNDERPAID
    if (status !== 0 && status !== 2) {
      return 'SKIPPED_NOT_PAYABLE';
    }

    const tx = await this.registryContract.getFunction('verifyAndFulfill')(invoiceId, proof);
    const receipt = await tx.wait();

    return receipt.hash;
  }
}
