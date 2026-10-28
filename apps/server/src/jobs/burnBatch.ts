import { utcDay } from '@wyrmhaven/game-core'
import { asc, eq, lt, sql } from 'drizzle-orm'
import type { Hex } from 'viem'
import type { ChainClient } from '../chain/client'
import type { Clock } from '../clock'
import type { Db, Tx } from '../db/client'
import { burnAttempts, spendBatches } from '../db/schema'

/** Postgres advisory lock id shared by the scheduler and the admin trigger: one burn run at a time. */
const BURN_LOCK_ID = 7_301

/**
 * Spec §13: 50% of every spend is burned in a daily batch; the other 50% simply stays in the vault.
 * Every burn is recorded as a pending attempt *before* it is sent and only counted once its receipt
 * says success, so a crash between send and record cannot burn the same batch twice and a reverted
 * transaction is never booked. Burns are bounded by the vault's operator daily limit, so a batch may
 * complete over several runs. Returns the amount confirmed in this run and the transactions sent.
 */
export async function runBurnBatch(deps: { db: Db; chain: ChainClient; clock: Clock }): Promise<{ burnedWei: bigint; txs: number }> {
  const { db, chain, clock } = deps
  return db.transaction(async tx => {
    const locked = await tx.execute(sql`select pg_try_advisory_xact_lock(${BURN_LOCK_ID}) as ok`)
    if (!(locked as unknown as { rows: { ok: boolean }[] }).rows[0]?.ok) return { burnedWei: 0n, txs: 0 }

    let burnedWei = 0n
    let txs = 0
    // 1. Resolve attempts a previous run sent but never recorded the outcome of.
    const pending = await tx.select().from(burnAttempts).where(eq(burnAttempts.status, 'pending'))
    for (const attempt of pending) {
      if (!attempt.txHash) {
        await tx.update(burnAttempts).set({ status: 'reverted', updatedAt: new Date(clock()) }).where(eq(burnAttempts.id, attempt.id))
        continue
      }
      burnedWei += await settle(tx, attempt.id, attempt.day, attempt.amountWei, attempt.txHash as Hex, chain, clock)
    }

    // 2. Burn what past days still owe, within today's operator allowance.
    const today = utcDay(clock())
    const owedBatches = await tx.select().from(spendBatches).where(lt(spendBatches.day, today)).orderBy(asc(spendBatches.day))
    let allowance = await chain.remainingBurnToday()
    for (const batch of owedBatches) {
      const target = batch.spentWei / 2n
      const owed = target > batch.burnedWei ? target - batch.burnedWei : 0n
      if (owed === 0n) continue
      if (allowance <= 0n) break
      const amount = owed < allowance ? owed : allowance
      const [attempt] = await tx
        .insert(burnAttempts)
        .values({ day: batch.day, amountWei: amount, createdAt: new Date(clock()), updatedAt: new Date(clock()) })
        .returning()
      const hash = await chain.burn(amount)
      await tx.update(burnAttempts).set({ txHash: hash, updatedAt: new Date(clock()) }).where(eq(burnAttempts.id, attempt!.id))
      txs++
      const confirmed = await settle(tx, attempt!.id, batch.day, amount, hash, chain, clock)
      burnedWei += confirmed
      allowance -= confirmed
    }
    return { burnedWei, txs }
  })
}

/** Waits for the receipt and books the burn on success. Returns the confirmed amount (0 on revert). */
async function settle(tx: Tx, attemptId: bigint, day: number, amount: bigint, hash: Hex, chain: ChainClient, clock: Clock): Promise<bigint> {
  const status = await chain.waitForTx(hash)
  await tx.update(burnAttempts).set({ status: status === 'success' ? 'confirmed' : 'reverted', updatedAt: new Date(clock()) }).where(eq(burnAttempts.id, attemptId))
  if (status !== 'success') return 0n
  await tx
    .update(spendBatches)
    .set({ burnedWei: sql`${spendBatches.burnedWei} + ${amount.toString()}::numeric`, burnTx: hash, updatedAt: new Date(clock()) })
    .where(eq(spendBatches.day, day))
  return amount
}
