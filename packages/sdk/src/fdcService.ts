import { FdcPaymentAttestationProof } from './types.js';

export interface FdcServiceConfig {
  /**
   * Flare FDC Verifier API endpoint URL
   * Coston2 Testnet: https://fdc-verifiers-coston2.flare.network/
   * Flare Mainnet:   https://fdc-verifiers.flare.network/
   */
  fdcApiUrl: string;
}

export class FdcService {
  private fdcApiUrl: string;

  constructor(config?: FdcServiceConfig) {
    this.fdcApiUrl =
      config?.fdcApiUrl || 'https://fdc-verifiers-coston2.flare.network';
  }

  /**
   * Fetches official cryptographic FDC Payment attestation Merkle proof from live Flare FDC verifiers
   */
  public async fetchPaymentProof(
    xrplTxHash: string,
    invoiceId: string,
    receivingAddress: string,
    amountDrops: string,
    blockTimestamp: number
  ): Promise<FdcPaymentAttestationProof> {
    const requestPayload = {
      attestationType: '0x5061796d656e7400000000000000000000000000000000000000000000000000',
      sourceId: '0x5852500000000000000000000000000000000000000000000000000000000000',
      messageIntegrityCode: '0x0000000000000000000000000000000000000000000000000000000000000000',
      requestBody: {
        transactionId: xrplTxHash.startsWith('0x') ? xrplTxHash : `0x${xrplTxHash}`,
        inUtxo: 0,
        utxo: 0,
      },
    };

    const response = await fetch(`${this.fdcApiUrl}/api/v1/fdc/prepare-attestation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestPayload),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(
        `RelayPay FDC Error: Flare FDC Verifier API failed (${response.status}): ${errText}`
      );
    }

    const data = (await response.json()) as FdcPaymentAttestationProof;
    if (!data.merkleProof || !data.response) {
      throw new Error('RelayPay FDC Error: Invalid Merkle proof payload returned by Flare FDC verifier');
    }

    return data;
  }
}
