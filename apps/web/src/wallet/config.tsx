import { createAppKit, useAppKit } from '@reown/appkit/react'
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'
import { QueryClient } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { defineChain, type Hex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { WagmiProvider, useAccount, useSignMessage, useSwitchChain, type Config } from 'wagmi'
import { mock } from 'wagmi/connectors'
import { WalletProvider, type WalletAdapter } from './WalletProvider'

export const CHAIN_ID = Number(import.meta.env.VITE_CHAIN_ID ?? 46630)

/** Robinhood Chain testnet (verify RPC/explorer at docs.robinhood.com/chain). */
export const robinhoodTestnet = defineChain({
  id: CHAIN_ID,
  name: 'Robinhood Chain Testnet',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [import.meta.env.VITE_RPC_URL ?? 'https://rpc.testnet.chain.robinhood.com'] } },
  blockExplorers: { default: { name: 'Explorer', url: 'https://explorer.testnet.chain.robinhood.com' } },
  testnet: true,
})

/** Playwright only: a deterministic wallet (anvil account 0) so e2e runs need no browser extension. */
const E2E_KEY: Hex = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'
const testWallet = import.meta.env.VITE_TEST_WALLET === '1'

export const wagmiAdapter = new WagmiAdapter({
  networks: [robinhoodTestnet],
  projectId: import.meta.env.VITE_REOWN_PROJECT_ID ?? 'missing-project-id',
  connectors: testWallet ? [mock({ accounts: [privateKeyToAccount(E2E_KEY).address], features: { defaultConnected: true } })] : [],
})

export const wagmiConfig: Config = wagmiAdapter.wagmiConfig

if (!testWallet) {
  createAppKit({
    adapters: [wagmiAdapter],
    networks: [robinhoodTestnet],
    projectId: import.meta.env.VITE_REOWN_PROJECT_ID ?? 'missing-project-id',
    metadata: { name: 'Wyrmhaven', description: 'Breed dragons. Build your island. Battle for the season.', url: location.origin, icons: [] },
    features: { analytics: false, email: false, socials: false },
  })
}

/** Bridges wagmi + AppKit into the WalletAdapter the app consumes. */
function WagmiWalletAdapter({ children }: { children: ReactNode }) {
  const { address, chainId, isConnected } = useAccount()
  const { signMessageAsync } = useSignMessage()
  const { switchChainAsync } = useSwitchChain()
  const appKit = testWallet ? null : useAppKit()
  const adapter: WalletAdapter = {
    address: address ?? null,
    chainId: chainId ?? null,
    isConnected,
    connect: async () => { await appKit?.open() },
    switchChain: async id => { await switchChainAsync({ chainId: id }) },
    signMessage: message => signMessageAsync({ message }),
  }
  return <WalletProvider adapter={adapter}>{children}</WalletProvider>
}

export function WalletRoot({ children, queryClient }: { children: ReactNode; queryClient: QueryClient }) {
  void queryClient
  return (
    <WagmiProvider config={wagmiConfig}>
      <WagmiWalletAdapter>{children}</WagmiWalletAdapter>
    </WagmiProvider>
  )
}
