import type { Address, Hex } from 'viem'
import type { ChainClient, VaultLog } from './client'

/** In-memory chain for tests and local development: push logs, move the head, inspect burns. */
export class FakeChainClient implements ChainClient {
  head = 0n
  logs: VaultLog[] = []
  remainingPayout = 0n
  remainingBurn = 0n
  entryFee = 500_000_000_000_000n
  claimedMap = new Map<string, bigint>()
  burns: bigint[] = []
  /** Status the next burn's receipt will report; resets to success after each burn. */
  nextTxStatus: 'success' | 'reverted' = 'success'
  txStatus = new Map<string, 'success' | 'reverted'>()

  async blockNumber(): Promise<bigint> {
    return this.head
  }
  async vaultLogs(fromBlock: bigint, toBlock: bigint): Promise<VaultLog[]> {
    return this.logs.filter(l => l.blockNumber >= fromBlock && l.blockNumber <= toBlock)
  }
  async remainingPayoutToday(): Promise<bigint> {
    return this.remainingPayout
  }
  async claimed(player: Address): Promise<bigint> {
    return this.claimedMap.get(player.toLowerCase()) ?? 0n
  }
  async entryFeeWei(): Promise<bigint> {
    return this.entryFee
  }
  async burn(amountWei: bigint): Promise<Hex> {
    this.burns.push(amountWei)
    const hash = `0x${(this.txStatus.size + 1).toString(16).padStart(64, '0')}` as Hex
    this.txStatus.set(hash, this.nextTxStatus)
    if (this.nextTxStatus === 'success') this.remainingBurn -= amountWei
    this.nextTxStatus = 'success'
    return hash
  }
  async waitForTx(hash: Hex): Promise<'success' | 'reverted'> {
    return this.txStatus.get(hash) ?? 'success'
  }
  async remainingBurnToday(): Promise<bigint> {
    return this.remainingBurn
  }
}
