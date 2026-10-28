import { defineChain } from 'viem'

/** Default public RPC. Verify against docs.robinhood.com/chain; override with NEXT_PUBLIC_RH_TESTNET_RPC. */
const DEFAULT_RPC = 'https://rpc.testnet.chain.robinhood.com'

export const robinhoodTestnet = defineChain({
  id: 46630,
  name: 'Robinhood Chain Testnet',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [process.env.NEXT_PUBLIC_RH_TESTNET_RPC || DEFAULT_RPC] } },
  testnet: true,
})
