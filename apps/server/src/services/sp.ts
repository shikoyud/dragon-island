import type { PlayerState } from '@wyrmhaven/game-core'
import { and, eq, sql } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import type { AppDeps } from '../app'
import type { Clock } from '../clock'
import type { Db, Tx } from '../db/client'
import { actionLog, players, spLedger } from '../db/schema'
import { requireSession } from '../plugins/session'
import type { SpArgs } from './actions'
import { ensureCurrentSeason } from './season'

/** Spec §12: PvP win vs eligible opponent +10, PvE first clear +5, 3 daily quests +20 total, 150/day. */
export const SP = { pvpWin: 10, pveFirstClear: 5, questEach: [7, 7, 6] as const, dailyCap: 150 }
/** Ruling: the spec names three daily quests worth 20 without defining them; this is the launch set. */
export const DAILY_QUESTS = ['breedOnce', 'harvestThree', 'winOneBattle'] as const
export type SpSource = 'pvpWin' | 'pveFirstClear' | `quest:${(typeof DAILY_QUESTS)[number]}` | (string & {})

async function todayPoints(tx: Tx | Db, playerId: string, seasonId: number, day: number): Promise<number> {
  const [row] = await tx
    .select({ sum: sql<number>`coalesce(sum(${spLedger.points}), 0)::int` })
    .from(spLedger)
    .where(and(eq(spLedger.playerId, playerId), eq(spLedger.seasonId, seasonId), eq(spLedger.day, day)))
  return Number(row?.sum ?? 0)
}

/**
 * Credits points once per (day, source, ref), truncated to the daily cap. Returns points awarded.
 * Safe under the caller's player row lock; the unique index is the backstop.
 */
export async function awardSp(
  tx: Tx, playerId: string, seasonId: number, day: number, source: SpSource, points: number, ref: string | null, clock: Clock,
): Promise<number> {
  const key = ref ?? ''
  const [dup] = await tx
    .select({ id: spLedger.id })
    .from(spLedger)
    .where(and(eq(spLedger.playerId, playerId), eq(spLedger.seasonId, seasonId), eq(spLedger.day, day), eq(spLedger.source, source), eq(spLedger.ref, key)))
  if (dup) return 0
  const today = await todayPoints(tx, playerId, seasonId, day)
  const awarded = Math.max(0, Math.min(points, SP.dailyCap - today))
  if (awarded === 0) return 0
  await tx.insert(spLedger).values({ playerId, seasonId, day, source, points: awarded, ref: key, createdAt: new Date(clock()) })
  return awarded
}

export async function spTotals(db: Db | Tx, playerId: string, seasonId: number, day: number): Promise<{ total: number; today: number }> {
  const [row] = await db
    .select({ sum: sql<number>`coalesce(sum(${spLedger.points}), 0)::int` })
    .from(spLedger)
    .where(and(eq(spLedger.playerId, playerId), eq(spLedger.seasonId, seasonId)))
  return { total: Number(row?.sum ?? 0), today: await todayPoints(db, playerId, seasonId, day) }
}

/** Number of successful actions of a type by this player on a UTC day (for counting quests). */
async function successfulActionsToday(tx: Tx, playerId: string, type: string, dayStartMs: number, dayEndMs: number): Promise<number> {
  const [row] = await tx
    .select({ n: sql<number>`count(*)::int` })
    .from(actionLog)
    .where(and(
      eq(actionLog.playerId, playerId),
      eq(actionLog.status, 200),
      sql`${actionLog.action}->>'type' = ${type}`,
      sql`${actionLog.createdAt} >= ${new Date(dayStartMs)} and ${actionLog.createdAt} < ${new Date(dayEndMs)}`,
    ))
  return Number(row?.n ?? 0)
}

/**
 * SP for a successful action. Only earning-unlocked players score; a PvP win counts once per
 * human opponent per day (and only vs eligible opponents) or once per bot offer.
 */
export async function spForAction(tx: Tx, args: SpArgs, clock: Clock): Promise<{ awarded: number; today: number } | null> {
  const { player, seasonId, day, action, result, opponent } = args
  if (!player.earningUnlocked) return null
  const playerId = player.id
  let awarded = 0
  const give = async (source: SpSource, points: number, ref: string | null) => {
    awarded += await awardSp(tx, playerId, seasonId, day, source, points, ref, clock)
  }
  const won = result.battle?.winner === 'attacker'

  if (action.type === 'pvpBattle' && won && opponent) {
    if (opponent.playerId === null) {
      await give('pvpWin', SP.pvpWin, `bot:${opponent.offerId}`)
    } else {
      const [other] = await tx.select({ unlocked: players.earningUnlocked }).from(players).where(eq(players.id, opponent.playerId))
      if (other?.unlocked) await give('pvpWin', SP.pvpWin, opponent.playerId)
    }
  }
  if (action.type === 'pveBattle' && won) {
    const before = (player.state as PlayerState).pve.cleared
    if (result.state.pve.cleared > before) await give('pveFirstClear', SP.pveFirstClear, String(action.stage))
  }

  // Daily quests
  if (action.type === 'startBreed') await give('quest:breedOnce', SP.questEach[0], null)
  if (action.type === 'harvest') {
    const dayStart = day * 86_400_000
    // This action is not in the log yet, so two earlier harvests make this the third.
    const earlier = await successfulActionsToday(tx, playerId, 'harvest', dayStart, dayStart + 86_400_000)
    if (earlier >= 2) await give('quest:harvestThree', SP.questEach[1], null)
  }
  if ((action.type === 'pvpBattle' || action.type === 'pveBattle') && won) await give('quest:winOneBattle', SP.questEach[2], null)

  const today = await todayPoints(tx, playerId, seasonId, day)
  return { awarded, today }
}

export function spRoutes(app: FastifyInstance, deps: AppDeps): void {
  const { db, clock } = deps
  app.get('/sp', { preHandler: requireSession(db, clock) }, async req => {
    const season = await ensureCurrentSeason(db, clock)
    const day = Math.floor(clock() / 86_400_000)
    const totals = await spTotals(db, req.player!.id, season.id, day)
    return { seasonId: season.id, ...totals, cap: SP.dailyCap }
  })
}
