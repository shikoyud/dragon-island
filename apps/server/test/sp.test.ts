import { MS_PER_DAY, type Action, type ActionResult, type BattleReport, type PlayerState } from '@wyrmhaven/game-core'
import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { players, spLedger } from '../src/db/schema'
import { ensureCurrentSeason } from '../src/services/season'
import { awardSp, DAILY_QUESTS, SP, spForAction, spTotals } from '../src/services/sp'
import { bearer, testApp, type TestApp } from './helpers/testApp'
import { TEST_KEYS, wallet } from './helpers/wallet'

let t: TestApp
let token: string
let playerId: string
let seasonId: number

beforeEach(async () => {
  t = await testApp({}, 10 * MS_PER_DAY)
  ;({ token, playerId } = await t.login(wallet(TEST_KEYS.alice)))
  seasonId = (await ensureCurrentSeason(t.db, t.clock)).id
  await t.db.update(players).set({ earningUnlocked: true }).where(eq(players.id, playerId))
})
afterEach(async () => {
  await t.close()
})

const win: BattleReport = { ok: true, winner: 'attacker', rounds: 1, log: [], attacker: [1, 1, 1], defender: [0, 0, 0] }
const loss: BattleReport = { ...win, winner: 'defender' }
const okResult = (state: PlayerState, battle?: BattleReport): Extract<ActionResult, { ok: true }> =>
  battle ? { ok: true, state, effects: [], battle } : { ok: true, state, effects: [] }

async function player() {
  const [p] = await t.db.select().from(players).where(eq(players.id, playerId))
  return p!
}

/** Runs spForAction the way runAction does, inside a transaction. */
async function award(action: Action, battle?: BattleReport, opponent: { playerId: string | null; offerId: string } | null = null, dayOffset = 0) {
  const p = await player()
  const day = 10 + dayOffset
  return t.db.transaction(tx => spForAction(tx, {
    player: p, seasonId, day, action, result: okResult(p.state as PlayerState, battle), opponent,
  }, t.clock))
}

const pvp: Action = { type: 'pvpBattle', team: ['d1', 'd2', 'd3'], opponent: { playerId: null, trophies: 0, level: 8, team: [] }, moves: [] }
const pve = (stage: number): Action => ({ type: 'pveBattle', stage, team: ['d1', 'd2', 'd3'], moves: [] })

describe('season points', () => {
  it('has the launch quest set and caps', () => {
    expect(DAILY_QUESTS).toEqual(['breedOnce', 'harvestThree', 'winOneBattle'])
    expect(SP.questEach.reduce((a, b) => a + b, 0)).toBe(20)
    expect(SP.dailyCap).toBe(150)
  })

  it('awards nothing to players who have not unlocked earning', async () => {
    await t.db.update(players).set({ earningUnlocked: false }).where(eq(players.id, playerId))
    expect(await award(pvp, win, { playerId: null, offerId: 'o1' })).toBeNull()
  })

  it('awards pvp wins once per human opponent per day, and per bot offer', async () => {
    const bob = await t.login(wallet(TEST_KEYS.bob))
    await t.db.update(players).set({ earningUnlocked: true }).where(eq(players.id, bob.playerId))
    // The first win of a day also completes the winOneBattle quest (+6).
    expect(await award(pvp, win, { playerId: bob.playerId, offerId: 'o1' })).toMatchObject({ awarded: 16 })
    expect(await award(pvp, win, { playerId: bob.playerId, offerId: 'o2' })).toMatchObject({ awarded: 0 })
    expect(await award(pvp, win, { playerId: bob.playerId, offerId: 'o3' }, 1)).toMatchObject({ awarded: 16 })
    expect(await award(pvp, loss, { playerId: bob.playerId, offerId: 'o4' }, 1)).toMatchObject({ awarded: 0 })

    const carol = await t.login(wallet(TEST_KEYS.carol)) // earning locked
    expect(await award(pvp, win, { playerId: carol.playerId, offerId: 'o5' })).toMatchObject({ awarded: 0 })

    expect(await award(pvp, win, { playerId: null, offerId: 'bot1' })).toMatchObject({ awarded: 10 })
    expect(await award(pvp, win, { playerId: null, offerId: 'bot2' })).toMatchObject({ awarded: 10 })
    expect(await award(pvp, win, { playerId: null, offerId: 'bot2' })).toMatchObject({ awarded: 0 })
  })

  it('awards pve first clears only', async () => {
    const p = await player()
    const cleared = { ...(p.state as PlayerState), pve: { cleared: 1, replays: { day: 10, count: 0 } } }
    const first = await t.db.transaction(tx => spForAction(tx, {
      player: p, seasonId, day: 10, action: pve(1), result: okResult(cleared, win), opponent: null,
    }, t.clock))
    expect(first).toMatchObject({ awarded: 11 }) // 5 first clear + 6 winOneBattle quest
    const replay = await t.db.transaction(tx => spForAction(tx, {
      player: { ...p, state: cleared }, seasonId, day: 10, action: pve(1), result: okResult(cleared, win), opponent: null,
    }, t.clock))
    expect(replay).toMatchObject({ awarded: 0 })
  })

  it('awards the three daily quests through real actions', async () => {
    const post = (action: unknown) =>
      t.app.inject({ method: 'POST', url: '/actions', headers: bearer(token), payload: { action, idempotencyKey: crypto.randomUUID() } })
    const p = await player()
    await t.db.update(players).set({
      state: { ...(p.state as PlayerState), dragons: (p.state as PlayerState).dragons.map(d => ({ ...d, level: 4 })), gold: 10_000, food: 500 },
    }).where(eq(players.id, playerId))

    const breed = await post({ type: 'startBreed', parentA: 'd1', parentB: 'd2' })
    expect(breed.statusCode).toBe(200)
    expect(breed.json().sp).toEqual({ awarded: 7, today: 7 })

    for (const plot of [0, 1]) expect((await post({ type: 'plant', plot, crop: 'sprout' })).statusCode).toBe(200)
    t.clock.advance(60_000)
    expect((await post({ type: 'harvest', plot: 0 })).json().sp).toEqual({ awarded: 0, today: 7 })
    expect((await post({ type: 'harvest', plot: 1 })).json().sp).toEqual({ awarded: 0, today: 7 })
    expect((await post({ type: 'plant', plot: 0, crop: 'sprout' })).statusCode).toBe(200)
    t.clock.advance(60_000)
    expect((await post({ type: 'harvest', plot: 0 })).json().sp).toEqual({ awarded: 7, today: 14 })

    expect(await award(pvp, win, { playerId: null, offerId: 'b' })).toMatchObject({ awarded: 16, today: 30 }) // 10 win + 6 quest
    const sp = await t.app.inject({ method: 'GET', url: '/sp', headers: bearer(token) })
    expect(sp.json()).toEqual({ seasonId, total: 30, today: 30, cap: 150 })
  })

  it('caps at 150 per UTC day with a partial award', async () => {
    await t.db.insert(spLedger).values({ playerId, seasonId, day: 10, source: 'seed', points: 145, ref: '' })
    expect(await award(pvp, win, { playerId: null, offerId: 'x' })).toEqual({ awarded: 5, today: 150 })
    expect(await award(pvp, win, { playerId: null, offerId: 'y' })).toEqual({ awarded: 0, today: 150 })
    expect(await t.db.transaction(tx => awardSp(tx, playerId, seasonId, 11, 'pvpWin', 10, 'z', t.clock))).toBe(10)
    expect((await spTotals(t.db, playerId, seasonId, 11))).toEqual({ total: 160, today: 10 })
  })
})
