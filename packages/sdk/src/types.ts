// SPDX-License-Identifier: MIT

export enum Network {
  FLARE_MAINNET = 14,
  FLARE_COSTON2 = 114,
}

export interface RelayPayConfig {
  network?: Network;
  flareRpcUrl: string;
  registryAddress: string;
  xrplWssUrl?: string;
  fdcApiUrl?: string;
}

export interface CreateInvoiceOptions {
  amountInUsdCents?: number;
  requiredAmountDrops?: bigint | string;
  durationSeconds: number;
  xrplDestinationAddress: string;
  allowedBuyer?: string;
  metadata?: Record<string, any>;
}

export interface RelayPayInvoice {
  invoiceId: string;
  merchant: string;
  allowedBuyer: string;
  xrplDestinationAddress: string;
  requiredAmountDrops: string;
  requiredXrpFormatted: string;
  paidAmountDrops: string;
  creationTimestamp: number;
  expirationTimestamp: number;
  status: InvoiceStatus;
  fulfillmentPayloadHash: string;
  xrplPayUrl: string;
  receiptTokenId?: number;
}

export enum InvoiceStatus {
  PENDING = 0,
  FULFILLED = 1,
  UNDERPAID = 2,
  OVERPAID_FULFILLED = 3,
  EXPIRED = 4,
  EXPIRED_PAID = 5,
  CANCELLED = 6,
}

export interface PaymentResponseBody {
  blockNumber: number;
  blockTimestamp: number;
  sourceAddressHash: string;
  receivingAddressHash: string;
  spentAmount: string;
  receivedAmount: string;
  standardPaymentReference: string;
  status: boolean;
}

export interface PaymentResponse {
  attestationType: string;
  sourceId: string;
  votingRound: number;
  lowestUsedTimestamp: number;
  body: PaymentResponseBody;
}

export interface FdcPaymentAttestationProof {
  merkleProof: string[];
  response: PaymentResponse;
}

export interface XRPLTransactionEvent {
  txHash: string;
  sourceAddress: string;
  destinationAddress: string;
  amountDrops: string;
  memoInvoiceId: string;
  blockTimestamp: number;
}

export type PaymentLifecycleHandler = (event: {
  status: 'XRPL_TX_DETECTED' | 'FDC_PROOF_READY' | 'FULFILLED' | 'ERROR';
  data?: any;
  error?: string;
}) => void;
