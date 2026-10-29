import { computePrizes, prizePoolWei, seasonResetTrophies, type PlayerState } from '@wyrmhaven/game-core'
import { and, asc, eq, isNull, lte, sql } from 'drizzle-orm'
import type { Clock } from '../clock'
import type { Db, Tx } from '../db/client'
import { players, seasonPrizes, seasons } from '../db/schema'
import { seasonInflows } from '../services/inflows'
import { creditEarned } from '../services/ledger'
import { standings } from '../services/standings'

/** Postgres advisory lock id: one close run at a time (scheduler and admin trigger). */
const CLOSE_LOCK_ID = 7_302
/**
 * Actions pick their season when their transaction starts, so one that began just before `endsAt`
 * may commit SP and inflows a little after it. Closing waits this long past `endsAt` so they count.
 */
export const CLOSE_GRACE_MS = 5 * 60_000

/**
 * Spec §12: when a season ends, 30% of its vault inflows is paid out as prizes to in-game balances,
 * the secret is revealed (§17) and trophies above 1,000 are halved towards 1,000 (§11). Each ended,
 * unclosed season is closed in its own transaction; standings are read inside it under the lock, so
 * SP written by a concurrent action lands either in this season's snapshot or not at all for prizes.
 * Returns the ids closed in this run.
 */
export async function closeSeasons(deps: { db: Db; clock: Clock }): Promise<number[]> {
  const { db, clock } = deps
  const closed: number[] = []
  for (;;) {
    const id = await db.transaction(async tx => {
      const locked = await tx.execute(sql`select pg_try_advisory_xact_lock(${CLOSE_LOCK_ID}) as ok`)
      if (!(locked as unknown as { rows: { ok: boolean }[] }).rows[0]?.ok) return null
      const cutoff = new Date(clock() - CLOSE_GRACE_MS)
      const [season] = await tx
        .select()
        .from(seasons)
        .where(and(isNull(seasons.closedAt), lte(seasons.endsAt, cutoff)))
        .orderBy(asc(seasons.id))
        .limit(1)
        .for('update')
      if (!season) return null
      await closeOne(tx, season.id, clock)
      return season.id
    })
    if (id === null) return closed
    closed.push(id)
  }
}

async function closeOne(tx: Tx, seasonId: number, clock: Clock): Promise<void> {
  const now = new Date(clock())
  const { totalWei } = await seasonInflows(tx, seasonId)
  const { awards } = computePrizes(prizePoolWei(totalWei), await standings(tx, seasonId))
  for (const a of awards) {
    await tx.select({ id: players.id }).from(players).where(eq(players.id, a.playerId)).for('update')
    await creditEarned(tx, a.playerId, a.wei, `prize:${seasonId}`)
    await tx.insert(seasonPrizes).values({ seasonId, playerId: a.playerId, wei: a.wei, tier: a.tier, rank: a.rank, createdAt: now })
  }
  // Trophy reset on both copies: the matchmaking column and the state the client renders.
  const high = await tx.select({ id: players.id, trophies: players.trophies, state: players.state }).from(players).where(sql`${players.trophies} > 1000`).for('update')
  for (const p of high) {
    const reset = seasonResetTrophies(p.trophies)
    const state = p.state as PlayerState
    await tx.update(players).set({ trophies: reset, state: { ...state, trophies: seasonResetTrophies(state.trophies) }, updatedAt: now }).where(eq(players.id, p.id))
  }
  await tx.update(seasons).set({ revealed: true, closedAt: now }).where(eq(seasons.id, seasonId))
}
