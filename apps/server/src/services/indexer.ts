import { and, eq, sql } from 'drizzle-orm'
import type { ChainClient, VaultLog } from '../chain/client'
import type { Clock } from '../clock'
import type { Db, Tx } from '../db/client'
import { chainEvents, indexerState, players, vouchers } from '../db/schema'
import { recordInflow } from './inflows'
import { creditDeposit, forceDebit } from './ledger'

const KEY = 'vault'

export interface IndexerDeps {
  db: Db
  chain: ChainClient
  confirmations: number
  clock: Clock
  /** The vault's deployment block; nothing before it is scanned. */
  startBlock: bigint
  /** Max block range per getLogs call (public RPCs cap it). */
  chunk: bigint
  log?: (message: string, extra?: unknown) => void
}

/**
 * Pulls vault events up to `head − confirmations` in chunks and applies each once: Entered unlocks
 * earning, Deposited credits `credited` (not `amount`), Claimed closes the matching voucher (and takes
 * the tokens back if the server had already refunded it). Events for wallets with no player yet are
 * stored unapplied and replayed on that wallet's first sign-in. The (txHash, logIndex) key makes
 * replays after a restart or a same-tx reorg no-ops; each chunk commits with its lastBlock.
 */
export async function runIndexer(deps: IndexerDeps): Promise<{ processed: number }> {
  const { db, chain, confirmations, clock, startBlock, chunk } = deps
  const head = await chain.blockNumber()
  const to = head - BigInt(confirmations)
  const [state] = await db.select().from(indexerState).where(eq(indexerState.key, KEY))
  let from = (state?.lastBlock ?? startBlock - 1n) + 1n
  if (from < startBlock) from = startBlock
  let processed = 0
  while (from <= to) {
    const end = from + chunk - 1n < to ? from + chunk - 1n : to
    const logs = await chain.vaultLogs(from, end)
    await db.transaction(async tx => {
      for (const log of logs) {
        const [seen] = await tx
          .select({ txHash: chainEvents.txHash })
          .from(chainEvents)
          .where(and(eq(chainEvents.txHash, log.txHash), eq(chainEvents.logIndex, log.logIndex)))
        if (seen) continue
        const applied = await applyLog(tx, log, clock, deps.log)
        await tx.insert(chainEvents).values({
          txHash: log.txHash, logIndex: log.logIndex, blockNumber: log.blockNumber, name: log.name, args: log.args,
          applied, processedAt: new Date(clock()),
        })
        processed++
      }
      await tx
        .insert(indexerState)
        .values({ key: KEY, lastBlock: end })
        .onConflictDoUpdate({ target: indexerState.key, set: { lastBlock: end } })
    })
    from = end + 1n
  }
  return { processed }
}

/** Applies one event to its player; returns false when the wallet has no player yet. */
async function applyLog(tx: Tx, log: VaultLog, clock: Clock, warn?: (m: string, extra?: unknown) => void): Promise<boolean> {
  const address = (log.args['player'] ?? '').toLowerCase()
  if (log.name === 'PayoutDayStarted') return true
  const [player] = await tx.select().from(players).where(eq(players.address, address)).for('update')
  if (!player) return false
  await applyToPlayer(tx, player.id, log, clock, warn)
  return true
}

async function applyToPlayer(tx: Tx, playerId: string, log: VaultLog, clock: Clock, warn?: (m: string, extra?: unknown) => void): Promise<void> {
  switch (log.name) {
    case 'Entered':
      await tx.update(players).set({ earningUnlocked: true, updatedAt: new Date(clock()) }).where(eq(players.id, playerId))
      return
    case 'Deposited': {
      const n = (k: string) => BigInt(log.args[k] ?? '0')
      await creditDeposit(tx, playerId, n('credited'), log.txHash)
      // Spec §13: 2% fee, 1% burned and 1% kept by the vault = amount − credited − burned.
      await recordInflow(tx, clock, 'depositFee', n('amount') - n('credited') - n('burned'), `${log.txHash}:${log.logIndex}`)
      return
    }
    case 'Claimed': {
      const n = (k: string) => BigInt(log.args[k] ?? '0')
      // Spec §13: 5% fee, 2.5% burned and 2.5% kept = gross − net − burned.
      await recordInflow(tx, clock, 'claimFee', n('gross') - n('net') - n('burned'), `${log.txHash}:${log.logIndex}`)
      const cumulative = n('cumulative')
      const [v] = await tx
        .select()
        .from(vouchers)
        .where(and(eq(vouchers.playerId, playerId), eq(vouchers.cumulativeWei, cumulative)))
        .for('update')
      if (!v || v.claimedAt) return
      await tx.update(vouchers).set({ claimedAt: new Date(clock()) }).where(eq(vouchers.id, v.id))
      if (v.expiredAt) {
        // The server refunded this voucher before the claim was indexed: take the tokens back.
        const { shortfall } = await forceDebit(tx, playerId, v.grossWei)
        if (shortfall > 0n) warn?.('late claim after refund: balance short', { playerId, voucherId: v.id, shortfall: shortfall.toString() })
      }
      return
    }
    case 'PayoutDayStarted':
      return
  }
}

/** On a wallet's first sign-in, applies the events that arrived before the player existed. */
export async function applyPendingEvents(tx: Tx, playerId: string, address: string, clock: Clock): Promise<number> {
  const pending = await tx
    .select()
    .from(chainEvents)
    .where(and(eq(chainEvents.applied, false), sql`lower(${chainEvents.args}->>'player') = ${address.toLowerCase()}`))
    .orderBy(chainEvents.blockNumber, chainEvents.logIndex)
  for (const ev of pending) {
    await applyToPlayer(tx, playerId, ev as unknown as VaultLog, clock)
    await tx
      .update(chainEvents)
      .set({ applied: true })
      .where(and(eq(chainEvents.txHash, ev.txHash), eq(chainEvents.logIndex, ev.logIndex)))
  }
  return pending.length
}
