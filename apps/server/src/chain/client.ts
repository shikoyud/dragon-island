import { createPublicClient, createWalletClient, defineChain, http, parseEventLogs, type Address, type Hex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { drisVaultAbi } from './abi'

export type VaultEventName = 'Entered' | 'Deposited' | 'Claimed' | 'PayoutDayStarted'

/** A vault event, with bigint args stringified so it can be stored as jsonb. */
export interface VaultLog {
  txHash: Hex
  logIndex: number
  blockNumber: bigint
  name: VaultEventName
  args: Record<string, string>
}

/** Everything the server needs from the chain; the fake in ./fake.ts implements the same surface. */
export interface ChainClient {
  blockNumber(): Promise<bigint>
  vaultLogs(fromBlock: bigint, toBlock: bigint): Promise<VaultLog[]>
  remainingPayoutToday(): Promise<bigint>
  claimed(player: Address): Promise<bigint>
  entryFeeWei(): Promise<bigint>
  /** Operator burn of the spend batch; returns the tx hash. */
  burn(amountWei: bigint): Promise<Hex>
  remainingBurnToday(): Promise<bigint>
  /** Resolves once the transaction is mined. */
  waitForTx(hash: Hex): Promise<'success' | 'reverted'>
}

export const robinhoodTestnet = defineChain({
  id: 46630,
  name: 'Robinhood Chain Testnet',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc.testnet.chain.robinhood.com'] } },
  testnet: true,
})

const EVENT_NAMES: VaultEventName[] = ['Entered', 'Deposited', 'Claimed', 'PayoutDayStarted']

export function createViemChainClient(opts: { rpcUrl: string; vault: Address; operatorKey?: Hex }): ChainClient {
  const chain = { ...robinhoodTestnet, rpcUrls: { default: { http: [opts.rpcUrl] } } }
  const pub = createPublicClient({ chain, transport: http(opts.rpcUrl) })
  const operator = opts.operatorKey ? privateKeyToAccount(opts.operatorKey) : null
  const wallet = operator ? createWalletClient({ account: operator, chain, transport: http(opts.rpcUrl) }) : null
  const read = <T>(functionName: string, args: unknown[] = []) =>
    pub.readContract({ address: opts.vault, abi: drisVaultAbi, functionName, args } as never) as Promise<T>

  return {
    blockNumber: () => pub.getBlockNumber(),
    async vaultLogs(fromBlock, toBlock) {
      const raw = await pub.getLogs({ address: opts.vault, fromBlock, toBlock })
      const parsed = parseEventLogs({ abi: drisVaultAbi, logs: raw })
      return parsed
        .filter(l => EVENT_NAMES.includes(l.eventName as VaultEventName))
        .map(l => ({
          txHash: l.transactionHash,
          logIndex: l.logIndex,
          blockNumber: l.blockNumber,
          name: l.eventName as VaultEventName,
          args: Object.fromEntries(Object.entries(l.args as Record<string, unknown>).map(([k, v]) => [k, String(v)])),
        }))
    },
    remainingPayoutToday: () => read<bigint>('remainingPayoutToday'),
    claimed: player => read<bigint>('claimed', [player]),
    entryFeeWei: () => read<bigint>('entryFeeWei'),
    async burn(amountWei) {
      if (!wallet || !operator) throw new Error('OPERATOR_KEY_MISSING')
      return wallet.writeContract({ address: opts.vault, abi: drisVaultAbi, functionName: 'burn', args: [amountWei], account: operator, chain })
    },
    remainingBurnToday: () => read<bigint>('remainingBurnToday'),
    async waitForTx(hash) {
      const receipt = await pub.waitForTransactionReceipt({ hash })
      return receipt.status === 'success' ? 'success' : 'reverted'
    },
  }
}
