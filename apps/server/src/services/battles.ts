import {
  applyTrophies, createRng, pickOpponents, PVP_MIN_PLAYER_LEVEL, type BattleDragonSpec, type Catalog,
  type OpponentSnapshot, type PlayerState, type Seeker,
} from '@wyrmhaven/game-core'
import type { Offer } from '@wyrmhaven/shared'
import { and, eq, isNotNull, isNull, ne, sql } from 'drizzle-orm'
import { hexToBytes } from 'viem'
import type { Clock } from '../clock'
import type { Db, Tx } from '../db/client'
import { battleOffers, players } from '../db/schema'
import { AppError } from '../plugins/errors'
import type { ResolvedOffer } from './actions'
import { ensureCurrentSeason } from './season'
import { battleSeed, secretFromHex } from './seed'
import { migrateState } from './stateMigration'

export const OFFER_TTL_MS = 10 * 60_000
const CANDIDATE_LIMIT = 50
const TROPHY_RANGE = 100
const LEVEL_RANGE = 5

type PlayerRow = typeof players.$inferSelect

/** Mean level of the three highest-level dragons, rounded; what bot strength is based on. */
export function teamLevelOf(state: PlayerState): number {
  const top = state.dragons.map(d => d.level).sort((a, b) => b - a).slice(0, 3)
  if (top.length === 0) return 1
  return Math.max(1, Math.round(top.reduce((a, b) => a + b, 0) / top.length))
}

/** The saved defence team as battle specs, or null if any member is gone. */
export function defenceSpecs(state: PlayerState): BattleDragonSpec[] | null {
  if (!state.defenceTeam) return null
  const specs: BattleDragonSpec[] = []
  for (const id of state.defenceTeam) {
    const d = state.dragons.find(x => x.id === id)
    if (!d) return null
    specs.push({ speciesId: d.speciesId, level: d.level })
  }
  return specs
}

const seed32Of = (seedHex: string): number => Buffer.from(hexToBytes(seedHex as `0x${string}`)).readUInt32BE(0)

/**
 * Builds three offers for the seeker (spec §11): other players with a saved defence team inside the
 * ±100 trophy / ±5 level window, bots to fill. Each offer carries its battle seed, revealed now so the
 * client can simulate turn by turn (Phase 2 ruling); the seed is still bound to the season secret.
 */
export async function createOffers(deps: { db: Db; clock: Clock; catalog: Catalog }, seeker: PlayerRow): Promise<Offer[]> {
  const { db, clock, catalog } = deps
  const nowMs = clock()
  const state = migrateState(seeker.state, nowMs)
  if (state.level < PVP_MIN_PLAYER_LEVEL) throw new AppError(422, 'LEVEL_TOO_LOW')
  const season = await ensureCurrentSeason(db, clock)
  const secret = secretFromHex(season.secretHex)

  const rows = await db
    .select()
    .from(players)
    .where(and(
      ne(players.id, seeker.id),
      isNull(players.bannedAt),
      isNotNull(players.defenceTeam),
      sql`abs(${players.trophies} - ${state.trophies}) <= ${TROPHY_RANGE}`,
      sql`abs(${players.level} - ${state.level}) <= ${LEVEL_RANGE}`,
    ))
    .orderBy(sql`abs(${players.trophies} - ${state.trophies})`, players.id)
    .limit(CANDIDATE_LIMIT)

  const candidates: OpponentSnapshot[] = []
  for (const r of rows) {
    const team = defenceSpecs(migrateState(r.state, nowMs))
    if (team) candidates.push({ playerId: r.id, trophies: r.trophies, level: r.level, team })
  }
  const me: Seeker = { trophies: state.trophies, level: state.level, teamLevel: teamLevelOf(state) }
  const rng = createRng(battleSeed(secret, `offers:${seeker.id}:${nowMs}`).seed32)
  const picked = pickOpponents(me, candidates, catalog, rng)

  const offers: Offer[] = []
  for (const opponent of picked) {
    const id = crypto.randomUUID()
    const { seedHex } = battleSeed(secret, id)
    await db.insert(battleOffers).values({
      id, playerId: seeker.id, opponentPlayerId: opponent.playerId, opponent, seedHex,
      expiresAt: new Date(nowMs + OFFER_TTL_MS), createdAt: new Date(nowMs),
    })
    offers.push({ offerId: id, opponent, seedHex })
  }
  return offers
}

/** Who the offer is against, read before locking so rows can be locked in id order. */
export async function peekOfferOpponent(tx: Tx, offerId: string): Promise<string | null> {
  const [o] = await tx.select({ opp: battleOffers.opponentPlayerId }).from(battleOffers).where(eq(battleOffers.id, offerId))
  return o?.opp ?? null
}

/** Consumes the seeker's own, unused, unexpired offer and returns what the battle needs. */
export async function resolveOffer(tx: Tx, playerId: string, offerId: string, nowMs: number): Promise<ResolvedOffer> {
  const [o] = await tx.select().from(battleOffers).where(eq(battleOffers.id, offerId)).for('update')
  if (!o || o.playerId !== playerId || o.usedAt) throw new AppError(409, 'OFFER_NOT_FOUND')
  if (o.expiresAt.getTime() < nowMs) throw new AppError(409, 'OFFER_EXPIRED')
  await tx.update(battleOffers).set({ usedAt: new Date(nowMs) }).where(eq(battleOffers.id, offerId))
  return { opponent: o.opponent as OpponentSnapshot, opponentPlayerId: o.opponentPlayerId, seed32: seed32Of(o.seedHex) }
}

/** Applies a defenceResult effect to the other player (locked in the caller's transaction). */
export async function settleDefence(tx: Tx, defenderId: string, trophyDelta: number, nowMs: number): Promise<void> {
  const [d] = await tx.select().from(players).where(eq(players.id, defenderId)).for('update')
  if (!d) return
  const state = migrateState(d.state, nowMs)
  const trophies = applyTrophies(state.trophies, trophyDelta)
  await tx
    .update(players)
    .set({ state: { ...state, trophies }, trophies, updatedAt: new Date(nowMs) })
    .where(eq(players.id, defenderId))
}
