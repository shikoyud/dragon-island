import {
  applyAction, createRng, utcDay, type Action, type Catalog, type OpponentSnapshot, type PlayerState,
} from '@wyrmhaven/game-core'
import type { ActionRequest, ActionResponse, ClientAction, ErrorResponse } from '@wyrmhaven/shared'
import { and, eq } from 'drizzle-orm'
import type { Clock } from '../clock'
import type { Db, Tx } from '../db/client'
import { actionLog, players } from '../db/schema'
import { AppError } from '../plugins/errors'
import { ensureGame } from './game'
import { charge } from './ledger'
import type { PriceSource } from './price'
import { usdToTokenWei } from './price'
import { actionSeed, battleSeed, secretFromHex } from './seed'
import { migrateState } from './stateMigration'

export interface ActionDeps {
  db: Db
  clock: Clock
  catalog: Catalog
  price: PriceSource
  /** Task 6: turns a client offerId into the stored opponent and battle seed. */
  resolveOffer?: (tx: Tx, playerId: string, offerId: string, nowMs: number) => Promise<ResolvedOffer>
  /** Task 6: who an offer is against, so both rows can be locked in id order. */
  peekOfferOpponent?: (tx: Tx, offerId: string) => Promise<string | null>
  /** Task 6: applies a defenceResult effect to the other player. */
  settleDefence?: (tx: Tx, defenderPlayerId: string, trophyDelta: number, nowMs: number) => Promise<void>
}

export interface ResolvedOffer { opponent: OpponentSnapshot; opponentPlayerId: string | null; seed32: number; seedHex: `0x${string}` }

export type RunResult = { status: number; body: ActionResponse | ErrorResponse }

/**
 * The one way state changes: lock the player row, derive the seed, run game-core, settle token
 * effects, persist state and log. A repeated idempotency key replays the stored response.
 */
export async function runAction(deps: ActionDeps, playerId: string, request: ActionRequest): Promise<RunResult> {
  const { db, clock } = deps
  const nowMs = clock()
  return db.transaction(async tx => {
    // Deadlock avoidance: when a battle touches another player with a lower id, lock that row first.
    if (request.action.type === 'pvpBattle' && deps.peekOfferOpponent) {
      const other = await deps.peekOfferOpponent(tx, request.action.offerId)
      if (other && other < playerId) await tx.select({ id: players.id }).from(players).where(eq(players.id, other)).for('update')
    }
    const [player] = await tx.select().from(players).where(eq(players.id, playerId)).for('update')
    if (!player) throw new AppError(401, 'UNAUTHORIZED')
    if (player.bannedAt) throw new AppError(403, 'BANNED')

    const [replay] = await tx
      .select()
      .from(actionLog)
      .where(and(eq(actionLog.playerId, playerId), eq(actionLog.idempotencyKey, request.idempotencyKey)))
    if (replay) return { status: replay.status, body: replay.response as ActionResponse | ErrorResponse }

    const price = await deps.price.microUsdPerToken(tx)
    const state = migrateState(player.state, nowMs)

    const secretRow = await ensureGame(tx, clock)
    const nonce = player.actionNonce + 1n
    const secret = secretFromHex(secretRow.secretHex)
    let { seedHex, seed32 } = actionSeed(secret, playerId, nonce)
    let seedLabel = `${playerId}:${nonce}`

    // Server-only shaping: a pvpBattle names a stored offer; the server supplies the opponent.
    let action: Action
    let logged: unknown
    const client: ClientAction = request.action
    if (client.type === 'pvpBattle') {
      if (!deps.resolveOffer) throw new AppError(409, 'OFFER_NOT_FOUND')
      const offer = await deps.resolveOffer(tx, playerId, client.offerId, nowMs)
      action = { type: 'pvpBattle', team: client.team, opponent: offer.opponent, moves: client.moves }
      logged = { ...action, offerId: client.offerId }
      seed32 = offer.seed32
      seedHex = offer.seedHex
      seedLabel = `battle:${client.offerId}`
    } else {
      action = client
      logged = client
      // Battles get their own seed, domain-separated from action seeds (spec §17).
      if (client.type === 'pveBattle') {
        const label = `${playerId}:${nonce}`
        ;({ seedHex, seed32 } = battleSeed(secret, label))
        seedLabel = `battle:${label}`
      }
    }

    const result = applyAction(state, action, nowMs, createRng(seed32), deps.catalog)
    const day = utcDay(nowMs)

    let status: number
    let body: ActionResponse | ErrorResponse
    if (!result.ok) {
      status = 422
      body = { error: result.error }
    } else {
      for (const effect of result.effects) {
        if (effect.type === 'charge') {
          if (price === null) throw new AppError(503, 'PRICE_UNAVAILABLE')
          await charge(tx, clock, playerId, usdToTokenWei(BigInt(effect.microUsd), price), day)
        } else if (effect.type === 'defenceResult') {
          if (deps.settleDefence) await deps.settleDefence(tx, effect.playerId, effect.trophyDelta, nowMs)
        }
      }
      const next: PlayerState = result.state
      await tx.update(players).set({ state: next, updatedAt: new Date(nowMs) }).where(eq(players.id, playerId))
      status = 200
      body = { state: next, effects: result.effects, ...(result.battle ? { battle: result.battle } : {}) }
    }

    // Keep the query columns mirrored from state on every action, including failures.
    const mirror = result.ok ? result.state : state
    await tx
      .update(players)
      .set({ actionNonce: nonce, trophies: mirror.trophies, defenceTeam: mirror.defenceTeam, level: mirror.level })
      .where(eq(players.id, playerId))
    await tx.insert(actionLog).values({
      playerId, nonce, idempotencyKey: request.idempotencyKey, seedHex, seedLabel,
      action: logged as Record<string, unknown>, status, response: body as unknown as Record<string, unknown>,
      createdAt: new Date(nowMs),
    })
    return { status, body }
  })
}

/** `ORDER BY` helper for multi-player locking: lower id first to avoid deadlocks. */
export const lockOrder = (a: string, b: string): [string, string] => (a < b ? [a, b] : [b, a])
