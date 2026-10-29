import type { Standing } from '@wyrmhaven/game-core'
import { and, eq, isNull, sql } from 'drizzle-orm'
import type { Db, Tx } from '../db/client'
import { players, spLedger } from '../db/schema'

/**
 * Season standings: eligible players (earning unlocked, not banned) with SP > 0, ordered by SP desc
 * then player id asc, the same order `computePrizes` ranks them in.
 */
export async function standings(db: Db | Tx, seasonId: number, limit?: number): Promise<Standing[]> {
  const q = db
    .select({ playerId: spLedger.playerId, sp: sql<number>`sum(${spLedger.points})::int` })
    .from(spLedger)
    .innerJoin(players, eq(players.id, spLedger.playerId))
    .where(and(eq(spLedger.seasonId, seasonId), eq(players.earningUnlocked, true), isNull(players.bannedAt)))
    .groupBy(spLedger.playerId)
    .having(sql`sum(${spLedger.points}) > 0`)
    .orderBy(sql`sum(${spLedger.points}) desc`, spLedger.playerId)
  const rows = limit === undefined ? await q : await q.limit(limit)
  return rows.map(r => ({ playerId: r.playerId, sp: Number(r.sp) }))
}

/** The player's rank among the eligible standings (null when not ranked) and their SP. */
export async function playerRank(db: Db | Tx, seasonId: number, playerId: string): Promise<{ rank: number | null; sp: number }> {
  const all = await standings(db, seasonId)
  const i = all.findIndex(s => s.playerId === playerId)
  if (i >= 0) return { rank: i + 1, sp: all[i]!.sp }
  const [row] = await db
    .select({ sp: sql<number>`coalesce(sum(${spLedger.points}), 0)::int` })
    .from(spLedger)
    .where(and(eq(spLedger.seasonId, seasonId), eq(spLedger.playerId, playerId)))
  return { rank: null, sp: Number(row?.sp ?? 0) }
}
