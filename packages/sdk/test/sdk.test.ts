import test from 'node:test';
import assert from 'node:assert';
import { dropsToXrp, xrpToDrops, formatXrplPayUrl, hashMetadata } from '../src/utils.js';
import { FdcService } from '../src/fdcService.js';

test('dropsToXrp handles exact and fractional drop amounts', () => {
  assert.strictEqual(dropsToXrp(0n), '0');
  assert.strictEqual(dropsToXrp(500n), '0.0005');
  assert.strictEqual(dropsToXrp(50000000n), '50');
  assert.strictEqual(dropsToXrp('78268350'), '78.26835');
});

test('xrpToDrops handles integer and decimal XRP representations', () => {
  assert.strictEqual(xrpToDrops(0), 0n);
  assert.strictEqual(xrpToDrops(50), 50000000n);
  assert.strictEqual(xrpToDrops('78.26835'), 78268350n);
  assert.strictEqual(xrpToDrops('0.0005'), 500n);
});

test('formatXrplPayUrl constructs valid XRPL payment URI', () => {
  const url = formatXrplPayUrl('rMerchantAddress123', 50000000n, '0xInvoiceMemo123');
  assert.strictEqual(url, 'xrp:rMerchantAddress123?amount=50&memo=0xInvoiceMemo123');
});

test('hashMetadata computes deterministic keccak256 hash across property order', () => {
  const hash1 = hashMetadata({ orderId: 'ORD-1', sku: 'SKU-A' });
  const hash2 = hashMetadata({ sku: 'SKU-A', orderId: 'ORD-1' });
  assert.strictEqual(hash1, hash2);
  assert.match(hash1, /^0x[a-fA-F0-9]{64}$/);
});

test('fdcService initializes with real Flare Coston2 verifier endpoint', () => {
  const fdc = new FdcService({ fdcApiUrl: 'https://fdc-verifiers-coston2.flare.network' });
  assert.ok(fdc);
});
