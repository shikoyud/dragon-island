import { and, eq, isNull } from 'drizzle-orm'
import type { ChainClient, VaultLog } from '../chain/client'
import type { Clock } from '../clock'
import type { Db, Tx } from '../db/client'
import { chainEvents, indexerState, players, vouchers } from '../db/schema'
import { creditDeposit } from './ledger'

const KEY = 'vault'

export interface IndexerDeps { db: Db; chain: ChainClient; confirmations: number; clock: Clock }

/**
 * Pulls vault events up to `head − confirmations` and applies them once each: Entered unlocks
 * earning, Deposited credits `credited` (not `amount`), Claimed marks the matching voucher.
 * The (txHash, logIndex) primary key makes replays after a restart or a same-tx reorg no-ops.
 */
export async function runIndexer(deps: IndexerDeps): Promise<{ processed: number }> {
  const { db, chain, confirmations, clock } = deps
  const head = await chain.blockNumber()
  const to = head - BigInt(confirmations)
  const [state] = await db.select().from(indexerState).where(eq(indexerState.key, KEY))
  const from = (state?.lastBlock ?? -1n) + 1n
  if (to < from) return { processed: 0 }

  const logs = await chain.vaultLogs(from, to)
  let processed = 0
  await db.transaction(async tx => {
    for (const log of logs) {
      const [seen] = await tx
        .select({ txHash: chainEvents.txHash })
        .from(chainEvents)
        .where(and(eq(chainEvents.txHash, log.txHash), eq(chainEvents.logIndex, log.logIndex)))
      if (seen) continue
      await applyLog(tx, log, clock)
      await tx.insert(chainEvents).values({
        txHash: log.txHash, logIndex: log.logIndex, blockNumber: log.blockNumber, name: log.name, args: log.args,
        processedAt: new Date(clock()),
      })
      processed++
    }
    await tx
      .insert(indexerState)
      .values({ key: KEY, lastBlock: to })
      .onConflictDoUpdate({ target: indexerState.key, set: { lastBlock: to } })
  })
  return { processed }
}

async function applyLog(tx: Tx, log: VaultLog, clock: Clock): Promise<void> {
  const address = (log.args['player'] ?? '').toLowerCase()
  const [player] = await tx.select().from(players).where(eq(players.address, address)).for('update')
  if (!player) return // unknown wallet: recorded in chain_events, nothing to credit
  switch (log.name) {
    case 'Entered':
      await tx.update(players).set({ earningUnlocked: true, updatedAt: new Date(clock()) }).where(eq(players.id, player.id))
      return
    case 'Deposited':
      await creditDeposit(tx, player.id, BigInt(log.args['credited'] ?? '0'), log.txHash)
      return
    case 'Claimed':
      await tx
        .update(vouchers)
        .set({ claimedAt: new Date(clock()) })
        .where(and(
          eq(vouchers.playerId, player.id),
          eq(vouchers.cumulativeWei, BigInt(log.args['cumulative'] ?? '0')),
          isNull(vouchers.claimedAt),
        ))
      return
    case 'PayoutDayStarted':
      return
  }
}
