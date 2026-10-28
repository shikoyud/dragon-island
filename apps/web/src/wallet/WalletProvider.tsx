import { createContext, useContext, type ReactNode } from 'react'

/**
 * What the app needs from a wallet, independent of wagmi so tests and the e2e mock can supply it.
 * The production adapter (wallet/config.tsx) wraps wagmi + Reown AppKit.
 */
export interface WalletAdapter {
  address: `0x${string}` | null
  chainId: number | null
  isConnected: boolean
  connect(): Promise<void>
  switchChain(chainId: number): Promise<void>
  signMessage(message: string): Promise<`0x${string}`>
}

const WalletContext = createContext<WalletAdapter | null>(null)

export function WalletProvider({ adapter, children }: { adapter: WalletAdapter; children: ReactNode }) {
  return <WalletContext.Provider value={adapter}>{children}</WalletContext.Provider>
}

export function useWallet(): WalletAdapter {
  const w = useContext(WalletContext)
  if (!w) throw new Error('useWallet outside <WalletProvider>')
  return w
}
