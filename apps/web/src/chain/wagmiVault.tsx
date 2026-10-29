import { erc20Abi, drisVaultAbi } from '@wyrmhaven/shared'
import type { ReactNode } from 'react'
import type { Address, Hex } from 'viem'
import { useAccount, useConfig, useReadContract, useWriteContract } from 'wagmi'
import { waitForTransactionReceipt } from 'wagmi/actions'
import { VaultProvider, type VaultAdapter } from './vault'

const VAULT = (import.meta.env.VITE_VAULT_ADDRESS || undefined) as Address | undefined
const TOKEN = (import.meta.env.VITE_TOKEN_ADDRESS || undefined) as Address | undefined
const CHAIN_ID = Number(import.meta.env.VITE_CHAIN_ID ?? 46630)

/** Production VaultAdapter over wagmi reads/writes; every write is pinned to the testnet chain id. */
export function WagmiVaultProvider({ children }: { children: ReactNode }) {
  const { address } = useAccount()
  const configured = Boolean(VAULT && TOKEN)
  const { writeContractAsync } = useWriteContract()
  const wagmiConfig = useConfig()
  const enabled = configured && Boolean(address)

  const fee = useReadContract({ address: VAULT, abi: drisVaultAbi, functionName: 'entryFeeWei', chainId: CHAIN_ID, query: { enabled } })
  const remaining = useReadContract({ address: VAULT, abi: drisVaultAbi, functionName: 'remainingPayoutToday', chainId: CHAIN_ID, query: { enabled } })
  const balance = useReadContract({ address: TOKEN, abi: erc20Abi, functionName: 'balanceOf', args: address ? [address] : undefined, chainId: CHAIN_ID, query: { enabled } })
  const allowance = useReadContract({ address: TOKEN, abi: erc20Abi, functionName: 'allowance', args: address && VAULT ? [address, VAULT] : undefined, chainId: CHAIN_ID, query: { enabled } })

  const adapter: VaultAdapter = {
    configured,
    entryFeeWei: (fee.data as bigint | undefined) ?? null,
    remainingPayoutWei: (remaining.data as bigint | undefined) ?? null,
    walletBalanceWei: (balance.data as bigint | undefined) ?? null,
    allowanceWei: (allowance.data as bigint | undefined) ?? null,
    enter: feeWei => writeContractAsync({ address: VAULT!, abi: drisVaultAbi, functionName: 'enter', value: feeWei, chainId: CHAIN_ID }),
    approve: amount => writeContractAsync({ address: TOKEN!, abi: erc20Abi, functionName: 'approve', args: [VAULT!, amount], chainId: CHAIN_ID }),
    deposit: amount => writeContractAsync({ address: VAULT!, abi: drisVaultAbi, functionName: 'deposit', args: [amount], chainId: CHAIN_ID }),
    claim: (cumulative, deadline, signature: Hex) =>
      writeContractAsync({ address: VAULT!, abi: drisVaultAbi, functionName: 'claim', args: [cumulative, deadline, signature], chainId: CHAIN_ID }),
    waitForTx: async hash => (await waitForTransactionReceipt(wagmiConfig, { hash, chainId: CHAIN_ID })).status,
    refetch: async () => { await Promise.all([fee.refetch(), remaining.refetch(), balance.refetch(), allowance.refetch()]) },
  }
  return <VaultProvider adapter={adapter}>{children}</VaultProvider>
}
