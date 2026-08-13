export interface RelayerConfig {
  relayerPrivateKey?: string;
  flareRpcUrl: string;
  registryAddress: string;
  xrplWssUrl: string;
  fdcApiUrl: string;
  monitoredAccounts?: string[];
}

export function loadRelayerConfig(): RelayerConfig {
  return {
    relayerPrivateKey: process.env.RELAYER_PRIVATE_KEY,
    flareRpcUrl: process.env.FLARE_RPC_URL || 'https://coston2-api.flare.network/ext/C/rpc',
    registryAddress: process.env.REGISTRY_ADDRESS || '0x0000000000000000000000000000000000000000',
    xrplWssUrl: process.env.XRPL_WSS_URL || 'wss://s.altnet.rippletest.net:51233',
    fdcApiUrl: process.env.FDC_API_URL || 'https://fdc-verifiers-coston2.flare.network',
    monitoredAccounts: process.env.MONITORED_XRPL_ACCOUNTS
      ? process.env.MONITORED_XRPL_ACCOUNTS.split(',')
      : [],
  };
}
