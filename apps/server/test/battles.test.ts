import {
  createRng, newPlayer, simulateBattle, type BattleDragonSpec, type OpponentSnapshot, type PlayerState,
} from '@wyrmhaven/game-core'
import type { Offer } from '@wyrmhaven/shared'
import { eq } from 'drizzle-orm'
import { hexToBytes } from 'viem'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { battleOffers, players } from '../src/db/schema'
import { OFFER_TTL_MS } from '../src/services/battles'
import { bearer, testApp, type TestApp } from './helpers/testApp'
import { TEST_KEYS, wallet } from './helpers/wallet'

const TEAM: [string, string, string] = ['d1', 'd2', 'd3']
const SWEEP = [{ move: 0, target: 0 }, { move: 0, target: 1 }, { move: 0, target: 2 }]
let t: TestApp
let A: { token: string; playerId: string }
let B: { token: string; playerId: string }
let C: { token: string; playerId: string }

async function setup(playerId: string, patch: Partial<PlayerState>, columns: Partial<typeof players.$inferInsert> = {}) {
  const base = newPlayer(0)
  const state: PlayerState = {
    ...base,
    dragons: [...base.dragons, { id: 'd3', speciesId: 'flame', level: 1, feeds: 0, habitatId: 'h1' }],
    ...patch,
  }
  await t.db.update(players).set({
    state, trophies: state.trophies, defenceTeam: state.defenceTeam, level: state.level, ...columns,
  }).where(eq(players.id, playerId))
}

beforeEach(async () => {
  t = await testApp({}, 1_000)
  A = await t.login(wallet(TEST_KEYS.alice))
  B = await t.login(wallet(TEST_KEYS.bob))
  C = await t.login(wallet(TEST_KEYS.carol))
  // A: sea L20 ×3 (sea is ×2 vs flame, so SWEEP one-shots B's 120-hp flame dragons). B: flame L1 ×3.
  await setup(A.playerId, { level: 8, dragons: seaTeam(20), defenceTeam: TEAM })
  await setup(B.playerId, { level: 8, dragons: flameTeam(1), defenceTeam: TEAM })
  await setup(C.playerId, { level: 8 }) // no defence team
})
afterEach(async () => {
  await t.close()
})

const offers = async (tok: string) => {
  const r = await t.app.inject({ method: 'GET', url: '/pvp/offers', headers: bearer(tok) })
  expect(r.statusCode).toBe(200)
  return r.json<{ offers: Offer[] }>().offers
}
const post = (tok: string, action: unknown) =>
  t.app.inject({ method: 'POST', url: '/actions', headers: bearer(tok), payload: { action, idempotencyKey: crypto.randomUUID() } })
const seaTeam = (level: number) => TEAM.map(id => ({ id, speciesId: 'sea', level, feeds: 0, habitatId: 'h2' }))
const flameTeam = (level: number) => TEAM.map(id => ({ id, speciesId: 'flame', level, feeds: 0, habitatId: 'h1' }))
const row = async (id: string) => (await t.db.select().from(players).where(eq(players.id, id)))[0]!

describe('GET /pvp/offers', () => {
  it('offers B (has a defence team) but never C or the seeker, and stores seeded offers', async () => {
    const list = await offers(A.token)
    expect(list).toHaveLength(3)
    const ids = list.map(o => o.opponent.playerId)
    expect(ids).toContain(B.playerId)
    expect(ids).not.toContain(C.playerId)
    expect(ids).not.toContain(A.playerId)
    expect(ids.filter(id => id === null)).toHaveLength(2) // bots fill the rest
    for (const o of list) expect(o.seedHex).toMatch(/^0x[0-9a-f]{64}$/)
    const stored = await t.db.select().from(battleOffers).where(eq(battleOffers.playerId, A.playerId))
    expect(stored).toHaveLength(3)
    expect(stored[0]!.expiresAt.getTime()).toBe(1_000 + OFFER_TTL_MS)
    const b = list.find(o => o.opponent.playerId === B.playerId)!
    expect(b.opponent.team).toEqual([{ speciesId: 'flame', level: 1 }, { speciesId: 'flame', level: 1 }, { speciesId: 'flame', level: 1 }])
  })

  it('needs player level 8', async () => {
    await setup(A.playerId, { level: 7, dragons: seaTeam(20), defenceTeam: TEAM })
    expect((await t.app.inject({ method: 'GET', url: '/pvp/offers', headers: bearer(A.token) })).statusCode).toBe(422)
  })
})

describe('pvpBattle via offers', () => {
  it('uses the stored opponent and seed, ignores a client opponent, and settles the defender', async () => {
    const offer = (await offers(A.token)).find(o => o.opponent.playerId === B.playerId)!
    const fake: OpponentSnapshot = { playerId: null, trophies: 0, level: 1, team: [] }
    const r = await post(A.token, { type: 'pvpBattle', offerId: offer.offerId, team: TEAM, moves: SWEEP, opponent: fake })
    expect(r.statusCode).toBe(200)
    const body = r.json()
    const seed32 = Buffer.from(hexToBytes(offer.seedHex)).readUInt32BE(0)
    const local = simulateBattle(
      TEAM.map((): BattleDragonSpec => ({ speciesId: 'sea', level: 20 })), offer.opponent.team, SWEEP, createRng(seed32), t.deps.catalog!,
    )
    expect(body.battle).toEqual(local)
    expect(body.battle.winner).toBe('attacker')
    expect(body.state.trophies).toBe(30)
    expect(body.effects).toEqual([{ type: 'defenceResult', playerId: B.playerId, trophyDelta: -10 }])

    const a = await row(A.playerId)
    expect(a.trophies).toBe(30)
    const b = await row(B.playerId)
    expect(b.trophies).toBe(0)
    expect((b.state as PlayerState).trophies).toBe(0)
  })

  it('rejects used, foreign and expired offers without counting an attempt', async () => {
    const mine = (await offers(A.token))[0]!
    expect((await post(A.token, { type: 'pvpBattle', offerId: mine.offerId, team: TEAM, moves: SWEEP })).statusCode).toBe(200)
    const again = await post(A.token, { type: 'pvpBattle', offerId: mine.offerId, team: TEAM, moves: SWEEP })
    expect(again.statusCode).toBe(409)
    expect(again.json()).toEqual({ error: 'OFFER_NOT_FOUND' })
    expect((await row(A.playerId)).state).toMatchObject({ pvp: { count: 1 } })

    const bobs = (await offers(B.token))[0]!
    const foreign = await post(A.token, { type: 'pvpBattle', offerId: bobs.offerId, team: TEAM, moves: SWEEP })
    expect(foreign.statusCode).toBe(409)

    const fresh = (await offers(A.token))[0]!
    t.clock.advance(OFFER_TTL_MS + 1)
    const late = await post(A.token, { type: 'pvpBattle', offerId: fresh.offerId, team: TEAM, moves: SWEEP })
    expect(late.statusCode).toBe(409)
    expect(late.json()).toEqual({ error: 'OFFER_EXPIRED' })
    expect((await row(A.playerId)).state).toMatchObject({ pvp: { count: 1 } })
  })

  it('settles both directions concurrently without deadlock', async () => {
    const aOffer = (await offers(A.token)).find(o => o.opponent.playerId === B.playerId)!
    const bOffer = (await offers(B.token)).find(o => o.opponent.playerId === A.playerId)!
    const [ra, rb] = await Promise.all([
      post(A.token, { type: 'pvpBattle', offerId: aOffer.offerId, team: TEAM, moves: SWEEP }),
      post(B.token, { type: 'pvpBattle', offerId: bOffer.offerId, team: TEAM, moves: SWEEP }),
    ])
    expect([ra.statusCode, rb.statusCode]).toEqual([200, 200])
    const a = await row(A.playerId), b = await row(B.playerId)
    // A beats B (+30 / B −10 → 0); B's flame L1 attack on A's sea L20 forfeits: B −15 → 0, A +5.
    expect(a.trophies).toBe(35)
    expect(b.trophies).toBe(0)
    expect((a.state as PlayerState).trophies).toBe(35)
  })
})

describe('pveBattle seeding', () => {
  it('is deterministic from the game secret and the action nonce', async () => {
    const run = async () => {
      const r = await post(A.token, { type: 'pveBattle', stage: 1, team: TEAM, moves: SWEEP })
      expect(r.statusCode).toBe(200)
      return r.json().battle
    }
    const first = await run()
    // Rebuild the same player on a fresh offer list: same secret, same nonce → same battle.
    const [p] = await t.db.select().from(players).where(eq(players.id, A.playerId))
    await t.db.update(players).set({ actionNonce: p!.actionNonce - 1n }).where(eq(players.id, A.playerId))
    await setup(A.playerId, { level: 8, dragons: seaTeam(20), defenceTeam: TEAM })
    const second = await run()
    expect(second).toEqual(first)
  })
})
