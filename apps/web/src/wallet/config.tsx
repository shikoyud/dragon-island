import { createAppKit, useAppKit } from '@reown/appkit/react'
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'
import { QueryClient } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { defineChain } from 'viem'
import { WagmiProvider, useAccount, useSignMessage, useSwitchChain, type Config } from 'wagmi'
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

export const wagmiAdapter = new WagmiAdapter({
  networks: [robinhoodTestnet],
  projectId: import.meta.env.VITE_REOWN_PROJECT_ID ?? 'missing-project-id',
})

export const wagmiConfig: Config = wagmiAdapter.wagmiConfig

createAppKit({
  adapters: [wagmiAdapter],
  networks: [robinhoodTestnet],
  projectId: import.meta.env.VITE_REOWN_PROJECT_ID ?? 'missing-project-id',
  metadata: { name: 'Dragon Island', description: 'Breed dragons. Build your island. Battle for the season.', url: location.origin, icons: [] },
  features: { analytics: false, email: false, socials: false },
})

/** Bridges wagmi + AppKit into the WalletAdapter the app consumes. */
function WagmiWalletAdapter({ children }: { children: ReactNode }) {
  const { address, chainId, isConnected } = useAccount()
  const { signMessageAsync } = useSignMessage()
  const { switchChainAsync } = useSwitchChain()
  const appKit = useAppKit()
  const adapter: WalletAdapter = {
    address: address ?? null,
    chainId: chainId ?? null,
    isConnected,
    connect: async () => { await appKit.open() },
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
