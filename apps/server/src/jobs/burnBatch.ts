import { utcDay } from '@wyrmhaven/game-core'
import { asc, eq, lt, sql } from 'drizzle-orm'
import type { ChainClient } from '../chain/client'
import type { Clock } from '../clock'
import type { Db } from '../db/client'
import { spendBatches } from '../db/schema'

/**
 * Spec §13: 50% of every spend is burned in a daily batch; the other 50% simply stays in the vault.
 * Burns are bounded by the vault's operator daily limit, so a batch may complete over several runs.
 */
export async function runBurnBatch(deps: { db: Db; chain: ChainClient; clock: Clock }): Promise<{ burnedWei: bigint; txs: number }> {
  const { db, chain, clock } = deps
  const today = utcDay(clock())
  const pending = await db
    .select()
    .from(spendBatches)
    .where(lt(spendBatches.day, today))
    .orderBy(asc(spendBatches.day))
  let burnedWei = 0n
  let txs = 0
  let allowance = await chain.remainingBurnToday()
  for (const batch of pending) {
    const target = batch.spentWei / 2n
    const owed = target > batch.burnedWei ? target - batch.burnedWei : 0n
    if (owed === 0n) continue
    if (allowance <= 0n) break
    const amount = owed < allowance ? owed : allowance
    const tx = await chain.burn(amount)
    await db
      .update(spendBatches)
      .set({ burnedWei: sql`${spendBatches.burnedWei} + ${amount.toString()}::numeric`, burnTx: tx, updatedAt: new Date(clock()) })
      .where(eq(spendBatches.day, batch.day))
    allowance -= amount
    burnedWei += amount
    txs++
  }
  return { burnedWei, txs }
}
