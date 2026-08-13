import { keccak256, toUtf8Bytes } from 'ethers';

export interface FdcProofResult {
  merkleProof: string[];
  response: {
    attestationType: string;
    sourceId: string;
    votingRound: number;
    lowestUsedTimestamp: number;
    body: {
      blockNumber: number;
      blockTimestamp: number;
      sourceAddressHash: string;
      receivingAddressHash: string;
      spentAmount: string;
      receivedAmount: string;
      standardPaymentReference: string;
      status: boolean;
    };
  };
}

// Attestation type "Payment" in bytes32 hex
const PAYMENT_ATTESTATION_TYPE = '0x5061796d656e7400000000000000000000000000000000000000000000000000';
// Source ID "XRP" in bytes32 hex
const XRP_SOURCE_ID = '0x5852500000000000000000000000000000000000000000000000000000000000';

export class FdcVerifierClient {
  constructor(private fdcApiUrl: string) {}

  /**
   * Requests FDC Payment attestation proof from Flare FDC verifiers.
   * Implements retry logic for delayed attestations (~90s per voting round).
   *
   * Flow:
   * 1. POST /api/v1/fdc/prepare-attestation → prepare the request
   * 2. Poll /api/v1/fdc/get-proof until proof is available (voting round finalization)
   */
  public async fetchProof(
    xrplTxHash: string,
    invoiceId: string,
    receivingAddress: string,
    amountDrops: string,
    blockNumber: number,
    blockTimestamp: number,
    maxRetries: number = 12,
    retryIntervalMs: number = 15000
  ): Promise<FdcProofResult> {
    const txId = xrplTxHash.startsWith('0x') ? xrplTxHash : `0x${xrplTxHash}`;

    const payload = {
      attestationType: PAYMENT_ATTESTATION_TYPE,
      sourceId: XRP_SOURCE_ID,
      messageIntegrityCode: '0x0000000000000000000000000000000000000000000000000000000000000000',
      requestBody: {
        transactionId: txId,
        inUtxo: 0,
        utxo: 0,
      },
    };

    // Step 1: Prepare attestation request
    console.log(`[FDC] Preparing attestation for XRPL Tx: ${txId}`);
    const prepareRes = await fetch(`${this.fdcApiUrl}/api/v1/fdc/prepare-attestation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!prepareRes.ok) {
      const errText = await prepareRes.text();
      throw new Error(`FDC prepare-attestation failed (${prepareRes.status}): ${errText}`);
    }

    const prepareData = await prepareRes.json();

    // If the prepare response already contains a full proof with merkleProof, return it
    if (prepareData.merkleProof && prepareData.merkleProof.length > 0 && prepareData.response) {
      console.log('[FDC] Full proof returned in prepare response');
      return prepareData as FdcProofResult;
    }

    // Step 2: Poll for the proof with retry logic (attestation takes ~90s per voting round)
    const roundId = prepareData.roundId || prepareData.votingRound;
    const encodedRequest = prepareData.encodedRequest || prepareData.abiEncodedRequest;

    console.log(`[FDC] Attestation submitted. Polling for proof (roundId: ${roundId})...`);

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      console.log(`[FDC] Poll attempt ${attempt}/${maxRetries} — waiting ${retryIntervalMs / 1000}s...`);
      await this.sleep(retryIntervalMs);

      try {
        // Try retrieving the finalized proof
        const proofUrl = roundId
          ? `${this.fdcApiUrl}/api/v1/fdc/get-proof?roundId=${roundId}&requestBytes=${encodedRequest || ''}`
          : `${this.fdcApiUrl}/api/v1/fdc/get-proof?transactionId=${txId}`;

        const proofRes = await fetch(proofUrl, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });

        if (proofRes.ok) {
          const proofData = await proofRes.json();
          if (proofData.merkleProof && proofData.merkleProof.length > 0) {
            console.log(`[FDC] Proof retrieved after ${attempt} attempts`);
            return proofData as FdcProofResult;
          }
        }

        // Also try POST endpoint for proof retrieval (some FDC verifiers use this)
        const proofPostRes = await fetch(`${this.fdcApiUrl}/api/v1/fdc/get-proof`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            attestationType: PAYMENT_ATTESTATION_TYPE,
            sourceId: XRP_SOURCE_ID,
            requestBody: payload.requestBody,
            roundId,
          }),
        });

        if (proofPostRes.ok) {
          const postProofData = await proofPostRes.json();
          if (postProofData.merkleProof && postProofData.merkleProof.length > 0) {
            console.log(`[FDC] Proof retrieved via POST after ${attempt} attempts`);
            return postProofData as FdcProofResult;
          }
        }
      } catch (e: any) {
        console.warn(`[FDC] Poll attempt ${attempt} failed: ${e.message}`);
      }
    }

    throw new Error(
      `FDC proof not available after ${maxRetries} attempts (${(maxRetries * retryIntervalMs) / 1000}s). ` +
      `The voting round may not have finalized yet. Transaction: ${txId}`
    );
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
