import { FdcPaymentAttestationProof } from './types.js';

export interface FdcServiceConfig {
  /**
   * Flare FDC Verifier API endpoint URL
   * Coston2 Testnet: https://fdc-verifiers-coston2.flare.network/
   * Flare Mainnet:   https://fdc-verifiers.flare.network/
   */
  fdcApiUrl: string;
}

// Attestation type "Payment" in bytes32 hex
const PAYMENT_ATTESTATION_TYPE = '0x5061796d656e7400000000000000000000000000000000000000000000000000';
// Source ID "XRP" in bytes32 hex
const XRP_SOURCE_ID = '0x5852500000000000000000000000000000000000000000000000000000000000';

export class FdcService {
  private fdcApiUrl: string;

  constructor(config?: FdcServiceConfig) {
    this.fdcApiUrl =
      config?.fdcApiUrl || 'https://fdc-verifiers-coston2.flare.network';
  }

  /**
   * Fetches FDC Payment attestation Merkle proof from Flare FDC verifiers.
   * Implements the full prepare → poll → retrieve flow with retry for delayed attestations.
   */
  public async fetchPaymentProof(
    xrplTxHash: string,
    invoiceId: string,
    receivingAddress: string,
    amountDrops: string,
    blockTimestamp: number,
    maxRetries: number = 12,
    retryIntervalMs: number = 15000
  ): Promise<FdcPaymentAttestationProof> {
    const txId = xrplTxHash.startsWith('0x') ? xrplTxHash : `0x${xrplTxHash}`;

    const requestPayload = {
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
    const prepareResponse = await fetch(`${this.fdcApiUrl}/api/v1/fdc/prepare-attestation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestPayload),
    });

    if (!prepareResponse.ok) {
      const errText = await prepareResponse.text();
      throw new Error(
        `RelayPay FDC Error: prepare-attestation failed (${prepareResponse.status}): ${errText}`
      );
    }

    const prepareData = await prepareResponse.json();

    // If prepare response already contains a complete proof, return it
    if (prepareData.merkleProof && prepareData.merkleProof.length > 0 && prepareData.response) {
      return prepareData as FdcPaymentAttestationProof;
    }

    // Step 2: Poll for finalized proof (FDC voting rounds take ~90 seconds)
    const roundId = prepareData.roundId || prepareData.votingRound;
    const encodedRequest = prepareData.encodedRequest || prepareData.abiEncodedRequest;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      await this.sleep(retryIntervalMs);

      try {
        // Try GET endpoint
        const proofUrl = roundId
          ? `${this.fdcApiUrl}/api/v1/fdc/get-proof?roundId=${roundId}&requestBytes=${encodedRequest || ''}`
          : `${this.fdcApiUrl}/api/v1/fdc/get-proof?transactionId=${txId}`;

        const proofRes = await fetch(proofUrl);

        if (proofRes.ok) {
          const proofData = await proofRes.json();
          if (proofData.merkleProof && proofData.merkleProof.length > 0) {
            return proofData as FdcPaymentAttestationProof;
          }
        }

        // Try POST endpoint (some FDC verifiers use this)
        const postRes = await fetch(`${this.fdcApiUrl}/api/v1/fdc/get-proof`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            attestationType: PAYMENT_ATTESTATION_TYPE,
            sourceId: XRP_SOURCE_ID,
            requestBody: requestPayload.requestBody,
            roundId,
          }),
        });

        if (postRes.ok) {
          const postData = await postRes.json();
          if (postData.merkleProof && postData.merkleProof.length > 0) {
            return postData as FdcPaymentAttestationProof;
          }
        }
      } catch {
        // Continue polling
      }
    }

    throw new Error(
      `RelayPay FDC Error: Proof not available after ${maxRetries} attempts. ` +
      `Voting round may not be finalized. Tx: ${txId}`
    );
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
