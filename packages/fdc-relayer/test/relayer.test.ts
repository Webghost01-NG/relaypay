import test from 'node:test';
import assert from 'node:assert';
import { loadRelayerConfig } from '../src/config.js';
import { FdcVerifierClient } from '../src/fdcVerifierClient.js';
import { FlareRelayer } from '../src/flareRelayer.js';

test('loadRelayerConfig provides default Flare and XRPL endpoints', () => {
  const config = loadRelayerConfig();
  assert.strictEqual(config.flareRpcUrl, 'https://coston2-api.flare.network/ext/C/rpc');
  assert.strictEqual(config.xrplWssUrl, 'wss://s.altnet.rippletest.net:51233');
});

test('FdcVerifierClient constructs valid proof payload structure', async () => {
  const client = new FdcVerifierClient('https://fdc-verifiers-coston2.flare.network');
  const proof = await client.fetchProof(
    '0xTestTxHash',
    '0xTestInvoiceId',
    'rTestDestination',
    '50000000',
    1000,
    1700000000
  );
  assert.strictEqual(proof.response.body.status, true);
  assert.strictEqual(proof.response.body.standardPaymentReference, '0xTestInvoiceId');
});

test('FlareRelayer initializes with provider and registry contract', () => {
  const relayer = new FlareRelayer(
    'https://coston2-api.flare.network/ext/C/rpc',
    '0x1000000000000000000000000000000000000001'
  );
  assert.ok(relayer);
});
