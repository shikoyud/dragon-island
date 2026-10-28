import { createContext, createElement, useContext, type ReactNode } from 'react'
import type { Hex } from 'viem'

/**
 * What the chain panels need from the vault and token contracts, independent of wagmi so tests
 * inject a fake. The wagmi-backed adapter lives in chain/wagmiVault.tsx.
 */
export interface VaultAdapter {
  /** False when VITE_VAULT_ADDRESS / VITE_TOKEN_ADDRESS are missing: chain actions stay disabled. */
  configured: boolean
  entryFeeWei: bigint | null
  walletBalanceWei: bigint | null
  allowanceWei: bigint | null
  remainingPayoutWei: bigint | null
  enter(feeWei: bigint): Promise<Hex>
  approve(amountWei: bigint): Promise<Hex>
  deposit(amountWei: bigint): Promise<Hex>
  claim(cumulativeWei: bigint, deadlineSec: bigint, signature: Hex): Promise<Hex>
  refetch(): Promise<void>
}

const VaultContext = createContext<VaultAdapter | null>(null)

export function VaultProvider({ adapter, children }: { adapter: VaultAdapter; children: ReactNode }) {
  return createElement(VaultContext.Provider, { value: adapter }, children)
}

export function useVault(): VaultAdapter {
  const v = useContext(VaultContext)
  if (!v) throw new Error('useVault outside <VaultProvider>')
  return v
}

/** Spec §13 deposit fee: 2% (1% burned, 1% kept), 98% credited. */
export const depositCredited = (amountWei: bigint): bigint => amountWei - (amountWei * 100n) / 10_000n - (amountWei * 100n) / 10_000n

/** "1.5" → wei; rejects negatives, more than 18 decimals and junk. */
export function parseTokenAmount(input: string, decimals = 18): bigint | null {
  const m = /^\s*(\d+)(?:\.(\d{1,18}))?\s*$/.exec(input)
  if (!m) return null
  const whole = BigInt(m[1]!)
  const frac = (m[2] ?? '').padEnd(decimals, '0')
  const wei = whole * 10n ** BigInt(decimals) + BigInt(frac)
  return wei
}
