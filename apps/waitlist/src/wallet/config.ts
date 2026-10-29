import { createAppKit, type AppKit } from '@reown/appkit/react'
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'
import { createConfig, http, type Config } from 'wagmi'
import { robinhoodTestnet } from './chain'

const projectId = process.env.NEXT_PUBLIC_REOWN_PROJECT_ID ?? ''

/** False when NEXT_PUBLIC_REOWN_PROJECT_ID is unset: the wallet step says so instead of crashing. */
export const walletConfigured = projectId !== ''

if (!walletConfigured && typeof window !== 'undefined') {
  console.warn('[dragon-island] NEXT_PUBLIC_REOWN_PROJECT_ID is not set: wallet connect is disabled.')
}

const adapter = walletConfigured ? new WagmiAdapter({ networks: [robinhoodTestnet], projectId, ssr: true }) : null

/** Without a project id, a connector-less config keeps wagmi hooks working. */
export const wagmiConfig: Config =
  adapter?.wagmiConfig ??
  createConfig({
    chains: [robinhoodTestnet],
    transports: { [robinhoodTestnet.id]: http() },
    connectors: [],
    ssr: true,
  })

let appKit: AppKit | null = null

/** Create the AppKit modal once, in the browser. Safe to call repeatedly. */
export function initWallet(): AppKit | null {
  if (!adapter || typeof window === 'undefined') return null
  appKit ??= createAppKit({
    adapters: [adapter],
    networks: [robinhoodTestnet],
    projectId,
    metadata: {
      name: 'Dragon Island',
      description: 'Breed dragons. Build your island. Battle for the season.',
      url: window.location.origin,
      icons: [],
    },
    features: { analytics: false, email: false, socials: false, swaps: false, onramp: false },
    themeMode: 'dark',
  })
  return appKit
}

/** Open the AppKit connect modal. Only signing is needed: no chain switch, no transactions. */
export function openWalletModal(): void {
  void initWallet()?.open()
}
