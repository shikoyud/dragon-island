import type { ReactNode } from 'react'
import { privateKeyToAccount } from 'viem/accounts'
import type { Hex } from 'viem'
import { VaultProvider, type VaultAdapter } from '../chain/vault'
import { WalletProvider, type WalletAdapter } from './WalletProvider'

/** Anvil dev account 0: a public test key, used only when VITE_TEST_WALLET=1 (Playwright). */
export const E2E_KEY: Hex = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'
const account = privateKeyToAccount(E2E_KEY)

const adapter: WalletAdapter = {
  address: account.address,
  chainId: Number(import.meta.env.VITE_CHAIN_ID ?? 46630),
  isConnected: true,
  connect: async () => {},
  switchChain: async () => {},
  signMessage: message => account.signMessage({ message }),
}

/** No chain in e2e unless an RPC is configured; deposit/claim specs skip with a reason. */
const vault: VaultAdapter = {
  configured: false,
  entryFeeWei: null, walletBalanceWei: null, allowanceWei: null, remainingPayoutWei: null,
  enter: async () => { throw new Error('no chain in e2e') },
  approve: async () => { throw new Error('no chain in e2e') },
  deposit: async () => { throw new Error('no chain in e2e') },
  claim: async () => { throw new Error('no chain in e2e') },
  waitForTx: async () => { throw new Error('no chain in e2e') },
  refetch: async () => {},
}

export function TestWalletRoot({ children }: { children: ReactNode }) {
  return <WalletProvider adapter={adapter}><VaultProvider adapter={vault}>{children}</VaultProvider></WalletProvider>
}
