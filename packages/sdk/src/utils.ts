import { keccak256, toUtf8Bytes } from 'ethers';

/**
 * Convert XRP drops (bigint or string) to formatted XRP string (1 XRP = 1,000,000 drops)
 */
export function dropsToXrp(drops: bigint | string): string {
  const bDrops = typeof drops === 'string' ? BigInt(drops) : drops;
  const whole = bDrops / 1000000n;
  const frac = bDrops % 1000000n;
  const paddedFrac = frac.toString().padStart(6, '0').replace(/0+$/, '');
  return paddedFrac ? `${whole}.${paddedFrac}` : `${whole}`;
}

/**
 * Convert XRP float/string to drops bigint
 */
export function xrpToDrops(xrp: number | string): bigint {
  const parts = xrp.toString().split('.');
  const whole = BigInt(parts[0] || '0') * 1000000n;
  let fracStr = (parts[1] || '').slice(0, 6).padEnd(6, '0');
  const frac = BigInt(fracStr || '0');
  return whole + frac;
}

/**
 * Generates an XRPL Payment URI for QR code generation
 */
export function formatXrplPayUrl(
  destination: string,
  requiredAmountDrops: bigint | string,
  memoInvoiceId: string
): string {
  const xrpAmount = dropsToXrp(requiredAmountDrops);
  return `xrp:${destination}?amount=${xrpAmount}&memo=${memoInvoiceId}`;
}

/**
 * Computes deterministic Keccak256 payload hash from order metadata object
 */
export function hashMetadata(metadata?: Record<string, any>): string {
  if (!metadata || Object.keys(metadata).length === 0) {
    return '0x0000000000000000000000000000000000000000000000000000000000000000';
  }
  const jsonStr = JSON.stringify(metadata, Object.keys(metadata).sort());
  return keccak256(toUtf8Bytes(jsonStr));
}
