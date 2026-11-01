// Review Focus 2 on the real path: rerolling a seed. A8, R69, R70.
import {
  battlePreview, battleSeed32, createRng, LAUNCH_CATALOG, legalMoves, newPlayer, nodeTeam, simulateBattle, type ActiveTrial, type Dragon, type PlayerMove, type PlayerState,
} from '@wyrmhaven/game-core'
import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { actionLog, balances, players } from '../src/db/schema'
import { ensureGame } from '../src/services/game'
import { FixedPriceSource } from '../src/services/price'
import { battleSeed, secretFromHex } from '../src/services/seed'
import { bearer, testApp, type TestApp } from './helpers/testApp'
import { TEST_KEYS, wallet } from './helpers/wallet'

const C = LAUNCH_CATALOG
const TEAM: [string, string, string] = ['d1', 'd2', 'd3']
const E18 = 10n ** 18n
const sea = (level: number, over: Partial<Dragon> = {}): Dragon[] => TEAM.map(id => ({ id, speciesId: 'sea', level, feeds: 0, habitatId: 'h2', ...over }))
const START = { type: 'startTrial', chapter: 1, node: 1, team: TEAM }
let t: TestApp
let A: { token: string; playerId: string }
let B: { token: string; playerId: string }

async function setup(playerId: string, patch: Partial<PlayerState>) {
  const state: PlayerState = { ...newPlayer(0), level: 4, dragons: sea(20), ...patch }
  await t.db.update(players).set({ state, level: state.level }).where(eq(players.id, playerId))
}
const stateOf = async (playerId: string) => (await t.db.select().from(players).where(eq(players.id, playerId)))[0]!.state as PlayerState
const post = (token: string, action: unknown, key: string = crypto.randomUUID()) =>
  t.app.inject({ method: 'POST', url: '/actions', headers: bearer(token), payload: { action, idempotencyKey: key } })
const seed = (token: string) => t.app.inject({ method: 'GET', url: '/pve/seed', headers: bearer(token) })
const secret = async () => secretFromHex((await ensureGame(t.db, t.clock)).secretHex)

/** Plays as the client does: legal moves from the preview on the revealed seed, Strike or the first replacement. */
function play(a: ActiveTrial, seedHex: string): PlayerMove[] {
  const moves: PlayerMove[] = []
  const enemies = nodeTeam(a.chapter, a.node, C)
  for (;;) {
    const p = battlePreview(a.specs, enemies, moves, createRng(battleSeed32(seedHex)), C)
    if (p.done) return moves
    const legal = legalMoves(p.state, 'attacker')
    moves.push(legal.find(m => m.kind === 'attack' && m.move === 0) ?? legal[0]!)
  }
}

beforeEach(async () => {
  t = await testApp({ price: new FixedPriceSource(50_000n) }, 1_000)
  A = await t.login(wallet(TEST_KEYS.alice))
  B = await t.login(wallet(TEST_KEYS.bob))
  await setup(A.playerId, {})
  await setup(B.playerId, {})
})
afterEach(async () => { await t.close() })

describe('GET /pve/seed', () => {
  it('needs a session', async () => {
    expect((await t.app.inject({ method: 'GET', url: '/pve/seed' })).statusCode).toBe(401)
  })

  it('is 409 NO_ACTIVE_TRIAL with no active Trial, so a seed is never readable before the start', async () => {
    const r = await seed(A.token)
    expect(r.statusCode).toBe(409)
    expect(r.json()).toEqual({ error: 'NO_ACTIVE_TRIAL' })
  })

  it('returns the seed named by pve:playerId:index, changing with `battles` and never for another player', async () => {
    expect((await post(A.token, START)).statusCode).toBe(200)
    expect((await post(B.token, START)).statusCode).toBe(200)
    const first = (await seed(A.token)).json().seedHex as string
    // The index names the Trial the seed belongs to, so a client can tell it from a later one.
    expect((await seed(A.token)).json().index).toBe(0)
    expect(first).toBe(battleSeed(await secret(), `pve:${A.playerId}:0`).seedHex)
    expect((await seed(B.token)).json().seedHex).not.toBe(first)
    expect((await seed(A.token)).json().seedHex).toBe(first)

    // Reroll attempt: abandon, rest, start again.
    expect((await post(A.token, { type: 'abandonTrial' })).statusCode).toBe(200)
    expect((await seed(A.token)).statusCode).toBe(409)
    const after = await stateOf(A.playerId)
    await setup(A.playerId, { pve: after.pve })
    expect((await post(A.token, START)).statusCode).toBe(200)
    const second = (await seed(A.token)).json().seedHex as string
    expect(second).toBe(battleSeed(await secret(), `pve:${A.playerId}:1`).seedHex)
    expect(second).not.toBe(first)
    expect((await seed(A.token)).json().index).toBe(1)
  })
})

describe('startTrial', () => {
  it('replaying the same key answers the same and starts one Trial', async () => {
    const first = await post(A.token, START, 'start-key')
    const before = await stateOf(A.playerId)
    const again = await post(A.token, START, 'start-key')
    expect(first.statusCode).toBe(200)
    expect(again.statusCode).toBe(200)
    expect(again.json()).toEqual(first.json())
    expect(await stateOf(A.playerId)).toEqual(before)
    const logs = await t.db.select().from(actionLog).where(eq(actionLog.playerId, A.playerId))
    expect(logs.filter(l => (l.action as { type: string }).type === 'startTrial')).toHaveLength(1)
  })
})

describe('a stale tab names its Trial by index', () => {
  const ABANDON_OR_FINISH = [(i: number) => ({ type: 'abandonTrial', index: i }), (i: number) => ({ type: 'finishTrial', moves: [], index: i })]

  it.each(ABANDON_OR_FINISH.map((make, n) => [n === 0 ? 'abandonTrial' : 'finishTrial', make] as const))(
    '%s with another index is NO_ACTIVE_TRIAL and settles nothing',
    async (_name, make) => {
      await post(A.token, START)
      const before = await stateOf(A.playerId)
      const r = await post(A.token, make(before.pve.active!.index + 1))
      expect(r.statusCode).toBe(422)
      expect(r.json()).toEqual({ error: 'NO_ACTIVE_TRIAL' })
      expect(await stateOf(A.playerId)).toEqual(before)
    },
  )

  it('the matching index settles, and so does no index at all', async () => {
    await post(A.token, START)
    expect((await post(A.token, { type: 'abandonTrial', index: 0 })).statusCode).toBe(200)
    await setup(A.playerId, { pve: (await stateOf(A.playerId)).pve })
    expect((await post(A.token, START)).statusCode).toBe(200)
    expect((await post(A.token, { type: 'abandonTrial' })).statusCode).toBe(200)
  })

  it('a non-integer or negative index is a wire error', async () => {
    for (const index of [-1, 1.5, '0']) expect((await post(A.token, { type: 'abandonTrial', index })).statusCode).toBe(400)
  })
})

describe('finishTrial', () => {
  it('on the revealed seed gives exactly the client-side simulateBattle outcome, and logs the label', async () => {
    const started = await post(A.token, START)
    const active = started.json().state.pve.active as ActiveTrial
    const { seedHex } = (await seed(A.token)).json() as { seedHex: string }
    const moves = play(active, seedHex)
    const local = simulateBattle(active.specs, nodeTeam(1, 1, C), moves, createRng(battleSeed32(seedHex)), C)

    const r = await post(A.token, { type: 'finishTrial', moves })
    expect(r.statusCode).toBe(200)
    expect(r.json().battle).toEqual(local)
    expect(local.ok && local.winner).toBe('attacker')
    expect(r.json().trial).toMatchObject({ won: true, gold: 1_000, food: 50, xp: 240, first: true })
    expect(r.json().state.pve).toMatchObject({ active: null, battles: 1 })

    const logs = await t.db.select().from(actionLog).where(eq(actionLog.playerId, A.playerId))
    const log = logs.find(l => (l.action as { type: string }).type === 'finishTrial')!
    expect(log.seedHex).toBe(seedHex)
    expect(log.seedLabel).toBe(`battle:pve:${A.playerId}:0`)
    // startTrial and abandonTrial stay on the normal action seed.
    const startLog = logs.find(l => (l.action as { type: string }).type === 'startTrial')!
    expect(startLog.seedLabel).toBe(`${A.playerId}:${startLog.nonce}`)
  })

  it('ignores anything the client sends about the seed', async () => {
    const started = await post(A.token, START)
    const active = started.json().state.pve.active as ActiveTrial
    const { seedHex } = (await seed(A.token)).json() as { seedHex: string }
    const moves = play(active, seedHex)
    const r = await post(A.token, { type: 'finishTrial', moves, seedHex: `0x${'00'.repeat(32)}`, seed32: 1 })
    expect(r.json().battle).toEqual(simulateBattle(active.specs, nodeTeam(1, 1, C), moves, createRng(battleSeed32(seedHex)), C))
  })

  it('replaying an actionId pays once and answers the same', async () => {
    const started = await post(A.token, START)
    const { seedHex } = (await seed(A.token)).json() as { seedHex: string }
    const moves = play(started.json().state.pve.active, seedHex)
    const first = await post(A.token, { type: 'finishTrial', moves }, 'finish-key')
    const before = await stateOf(A.playerId)
    const again = await post(A.token, { type: 'finishTrial', moves }, 'finish-key')
    expect(again.statusCode).toBe(200)
    expect(again.json()).toEqual(first.json())
    expect(await stateOf(A.playerId)).toEqual(before)
    expect(before.gold).toBe(newPlayer(0).gold + 1_000)
  })

  it('NO_ACTIVE_TRIAL with none', async () => {
    const r = await post(A.token, { type: 'finishTrial', moves: [] })
    expect(r.statusCode).toBe(422)
    expect(r.json()).toEqual({ error: 'NO_ACTIVE_TRIAL' })
  })

  it('a short list is a forfeit, not a free cancel', async () => {
    await post(A.token, START)
    const r = await post(A.token, { type: 'finishTrial', moves: [] })
    expect(r.statusCode).toBe(200)
    expect(r.json().battle).toBeUndefined()
    expect(r.json().trial).toEqual({ won: false, stars: 0, gold: 0, food: 0, xp: 0, first: false })
    for (const d of (await stateOf(A.playerId)).dragons) expect(d.fatigue?.hp).toBe(1)
  })
})

describe('Review Focus 2: no free reroll', () => {
  it('replaying abandonTrial takes one battle and leaves the team on 1 HP', async () => {
    await post(A.token, START)
    await post(A.token, { type: 'abandonTrial' }, 'abandon-key')
    await post(A.token, { type: 'abandonTrial' }, 'abandon-key')
    const s = await stateOf(A.playerId)
    expect([s.pve.battles, s.pve.active]).toEqual([1, null])
    for (const d of s.dragons) expect(d.fatigue?.hp).toBe(1)
  })

  it('a second start is refused, and an abandoned team can\'t start again until it rests', async () => {
    await post(A.token, START)
    const second = await post(A.token, START)
    expect(second.statusCode).toBe(422)
    expect(second.json()).toEqual({ error: 'TRIAL_ACTIVE' })
    await post(A.token, { type: 'abandonTrial' })
    const third = await post(A.token, START)
    expect(third.statusCode).toBe(422)
    expect(third.json()).toEqual({ error: 'DRAGON_TIRED' })
  })

  it('a wire-illegal chapter or node is 400, and pveBattle is gone', async () => {
    for (const bad of [{ ...START, chapter: 11 }, { ...START, node: 0 }, { ...START, node: 1.5 }, { type: 'pveBattle', stage: 1, team: TEAM, moves: [] }]) {
      expect((await post(A.token, bad)).statusCode).toBe(400)
    }
  })
})

describe('heal-all through the store path', () => {
  it('with no tokens it is a 402 and the fatigue is untouched', async () => {
    const tired = sea(20, { fatigue: { hp: 1, atMs: 1_000 } })
    await setup(A.playerId, { dragons: tired })
    await t.db.update(balances).set({ tokenWei: 0n }).where(eq(balances.playerId, A.playerId))
    const r = await post(A.token, { type: 'buy', item: { kind: 'healAll' } })
    expect([r.statusCode, r.json().error]).toEqual([402, 'INSUFFICIENT_TOKENS'])
    expect((await stateOf(A.playerId)).dragons).toEqual(tired)
  })

  it('charges and clears; refused uncharged with nobody hurt', async () => {
    await t.db.update(balances).set({ tokenWei: 10n * E18 }).where(eq(balances.playerId, A.playerId))
    const bal = async () => (await t.db.select().from(balances).where(eq(balances.playerId, A.playerId)))[0]!.tokenWei
    const none = await post(A.token, { type: 'buy', item: { kind: 'healAll' } })
    expect([none.statusCode, none.json().error, await bal()]).toEqual([422, 'NOTHING_TO_HEAL', 10n * E18])
    await setup(A.playerId, { dragons: sea(20, { fatigue: { hp: 1, atMs: 1_000 } }) })
    const r = await post(A.token, { type: 'buy', item: { kind: 'healAll' } })
    expect(r.statusCode).toBe(200)
    expect(r.json().effects).toEqual([{ type: 'charge', microUsd: 50_000 }])
    expect(await bal()).toBe(9n * E18) // $0.05 at $0.05 a token
    for (const d of (await stateOf(A.playerId)).dragons) expect(d.fatigue).toBeUndefined()
  })
})
