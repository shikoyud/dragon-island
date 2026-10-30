import { newPlayer, type PlayerState } from '@wyrmhaven/game-core'
import { eq, sql } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { actionLog, balances, players, spendBatches } from '../src/db/schema'
import { FixedPriceSource } from '../src/services/price'
import { bearer, testApp, type TestApp } from './helpers/testApp'
import { TEST_KEYS, wallet } from './helpers/wallet'

const E18 = 10n ** 18n
let t: TestApp
let token: string
let playerId: string

beforeEach(async () => {
  t = await testApp({ price: new FixedPriceSource(50_000n) }, 0) // $0.05 per token
  ;({ token, playerId } = await t.login(wallet(TEST_KEYS.alice)))
  await t.db.update(balances).set({ tokenWei: 100n * E18 }).where(eq(balances.playerId, playerId))
})
afterEach(async () => {
  await t.close()
})

const post = (action: unknown, idempotencyKey: string = crypto.randomUUID(), tok = token) =>
  t.app.inject({ method: 'POST', url: '/actions', headers: bearer(tok), payload: { action, idempotencyKey } })

async function setState(patch: Partial<PlayerState>) {
  const [p] = await t.db.select().from(players).where(eq(players.id, playerId))
  await t.db.update(players).set({ state: { ...(p!.state as PlayerState), ...patch } }).where(eq(players.id, playerId))
}

describe('POST /actions', () => {
  it('applies an action, logs it with a seed, and returns the new state', async () => {
    t.clock.set(600_000)
    const r = await post({ type: 'collectGold', habitatId: 'h1' }, 'k1')
    expect(r.statusCode).toBe(200)
    const body = r.json()
    expect(body.state.gold).toBe(1020)
    expect(body.effects).toEqual([])
    const [log] = await t.db.select().from(actionLog).where(eq(actionLog.playerId, playerId))
    expect(log!.nonce).toBe(1n)
    expect(log!.seedHex).toMatch(/^0x[0-9a-f]{64}$/)
    expect(log!.status).toBe(200)
    expect(log!.idempotencyKey).toBe('k1')
  })

  it('replays an idempotency key with the original response', async () => {
    t.clock.set(600_000)
    const first = await post({ type: 'collectGold', habitatId: 'h1' }, 'same')
    const replay = await post({ type: 'buy', item: { kind: 'foodPack' } }, 'same')
    expect(replay.statusCode).toBe(200)
    expect(replay.json()).toEqual(first.json())
    expect(await t.db.select().from(actionLog)).toHaveLength(1)
    const [p] = await t.db.select().from(players).where(eq(players.id, playerId))
    expect(p!.actionNonce).toBe(1n)
    expect((await t.db.select().from(balances))[0]!.tokenWei).toBe(100n * E18)
  })

  it('charges store purchases in tokens and records the spend batch', async () => {
    const r = await post({ type: 'buy', item: { kind: 'foodPack' } })
    expect(r.statusCode).toBe(200)
    expect(r.json().state.food).toBe(1_100)
    expect(r.json().effects).toEqual([{ type: 'charge', microUsd: 500_000 }])
    const [b] = await t.db.select().from(balances)
    expect(b!.tokenWei).toBe(90n * E18)
    const [batch] = await t.db.select().from(spendBatches)
    expect(batch!.spentWei).toBe(10n * E18)
  })

  it('refuses a purchase the balance cannot cover and persists nothing', async () => {
    await t.db.update(balances).set({ tokenWei: 5n * E18 })
    const r = await post({ type: 'buy', item: { kind: 'foodPack' } })
    expect(r.statusCode).toBe(402)
    expect(r.json()).toEqual({ error: 'INSUFFICIENT_TOKENS' })
    const [p] = await t.db.select().from(players).where(eq(players.id, playerId))
    expect((p!.state as PlayerState).food).toBe(100)
    expect(await t.db.select().from(actionLog)).toHaveLength(0)
  })

  it('fails closed when no price is available', async () => {
    await t.close()
    t = await testApp({ price: new FixedPriceSource(null) }, 0)
    ;({ token } = await t.login(wallet(TEST_KEYS.alice)))
    const r = await post({ type: 'buy', item: { kind: 'foodPack' } })
    expect(r.statusCode).toBe(503)
    expect(r.json()).toEqual({ error: 'PRICE_UNAVAILABLE' })
  })

  it('maps game-core errors to 422 and still consumes the nonce', async () => {
    await post({ type: 'plant', plot: 0, crop: 'sprout' })
    const r = await post({ type: 'plant', plot: 0, crop: 'sprout' })
    expect(r.statusCode).toBe(422)
    expect(r.json()).toEqual({ error: 'PLOT_BUSY' })
    const logs = await t.db.select().from(actionLog)
    expect(logs.map(l => l.status)).toEqual([200, 422])
    const [p] = await t.db.select().from(players).where(eq(players.id, playerId))
    expect(p!.actionNonce).toBe(2n)
  })

  it('rejects malformed bodies before touching the player', async () => {
    const r = await post({ type: 'plant', plot: 0, crop: 'constructor' })
    expect(r.statusCode).toBe(400)
    expect(r.json()).toEqual({ error: 'INVALID_ACTION' })
    expect((await t.app.inject({ method: 'POST', url: '/actions', headers: bearer(token), payload: { action: { type: 'buyFarmPlot' } } })).statusCode).toBe(400)
    expect(await t.db.select().from(actionLog)).toHaveLength(0)
  })

  it('runs placeBuilding and finishConstruction through /actions and charges a construction skip', async () => {
    const placed = await post({ type: 'placeBuilding', building: { kind: 'farm' }, placement: { island: 'home', col: 6, row: 7, facing: 0 } })
    expect(placed.statusCode).toBe(200)
    expect(placed.json().state.constructions).toHaveLength(1)
    const skipped = await post({ type: 'buy', item: { kind: 'skip', target: 'construction', index: 0 } })
    expect(skipped.statusCode).toBe(200)
    expect(skipped.json().effects).toEqual([{ type: 'charge', microUsd: 100_000 }])
    expect(skipped.json().state.farms).toHaveLength(3)
    expect(skipped.json().state.constructions).toEqual([])
    const late = await post({ type: 'finishConstruction', index: 0 })
    expect(late.statusCode).toBe(422)
    expect(late.json()).toEqual({ error: 'NOT_FOUND' })
  })

  it('a construction skip with a bad index or on a ready construction charges nothing', async () => {
    const placed = await post({ type: 'placeBuilding', building: { kind: 'farm' }, placement: { island: 'home', col: 6, row: 7, facing: 0 } })
    expect(placed.statusCode).toBe(200)
    const bad = await post({ type: 'buy', item: { kind: 'skip', target: 'construction', index: 5 } })
    expect([bad.statusCode, bad.json()]).toEqual([422, { error: 'NOT_FOUND' }])
    t.clock.set(placed.json().state.constructions[0].readyAtMs)
    const ready = await post({ type: 'buy', item: { kind: 'skip', target: 'construction', index: 0 } })
    expect([ready.statusCode, ready.json()]).toEqual([422, { error: 'NOTHING_TO_SKIP' }])
    expect((await t.db.select().from(balances))[0]!.tokenWei).toBe(100n * E18)
    expect(await t.db.select().from(spendBatches)).toHaveLength(0)
  })

  it('GET /me resets a save of another version to a fresh player instead of returning it raw', async () => {
    const [p] = await t.db.select().from(players).where(eq(players.id, playerId))
    await t.db.update(players).set({ state: { ...(p!.state as PlayerState), version: 1, gold: 7 } }).where(eq(players.id, playerId))
    const me = await t.app.inject({ method: 'GET', url: '/me', headers: bearer(token) })
    expect(me.statusCode).toBe(200)
    expect(me.json().state.version).toBe(newPlayer(0).version)
    expect(me.json().state.gold).toBe(newPlayer(0).gold)
    expect(me.json()).not.toHaveProperty('season')
  })

  it('logs the player id once when a stored state of another version is reset (R2), on /me and on actions', async () => {
    const warn = vi.spyOn(t.app.log, 'warn')
    const [p] = await t.db.select().from(players).where(eq(players.id, playerId))
    const { version, ...unversioned } = p!.state as PlayerState
    void version
    await t.db.update(players).set({ state: unversioned }).where(eq(players.id, playerId))
    expect((await t.app.inject({ method: 'GET', url: '/me', headers: bearer(token) })).statusCode).toBe(200)
    const resets = () => warn.mock.calls.filter(c => JSON.stringify(c).includes('state reset'))
    expect(resets()).toHaveLength(1)
    expect(resets()[0]![0]).toMatchObject({ playerId })

    await t.db.update(players).set({ state: unversioned }).where(eq(players.id, playerId))
    expect((await post({ type: 'collectGold', habitatId: 'h1' })).statusCode).toBeLessThan(500)
    expect(resets()).toHaveLength(2)
    expect(resets()[1]![0]).toMatchObject({ playerId })
  })

  it('runs a startBreed action without a seasons table and logs no season_id', async () => {
    const tables = await t.db.execute(sql`select table_name from information_schema.tables where table_schema = 'public'`)
    expect(JSON.stringify(tables)).not.toContain('seasons')
    await setState({ dragons: newPlayer(0).dragons.map(d => ({ ...d, level: 4 })) })
    const r = await post({ type: 'startBreed', parentA: 'd1', parentB: 'd2' })
    expect(r.statusCode).toBe(200)
    const [log] = await t.db.select().from(actionLog).where(eq(actionLog.playerId, playerId))
    expect(log!.status).toBe(200)
    expect(log).not.toHaveProperty('seasonId')
    const cols = await t.db.execute(sql`select column_name from information_schema.columns where table_name = 'action_log'`)
    expect(JSON.stringify(cols)).not.toContain('season_id')
  })

  it('requires a stored offer for pvp battles', async () => {
    const r = await post({ type: 'pvpBattle', offerId: crypto.randomUUID(), team: ['d1', 'd2', 'd1'], moves: [] })
    expect(r.statusCode).toBe(409)
    expect(r.json()).toEqual({ error: 'OFFER_NOT_FOUND' })
  })

  it('serialises concurrent actions through the row lock', async () => {
    await setState({ food: 1_000 })
    const results = await Promise.all(Array.from({ length: 10 }, () => post({ type: 'feed', dragonId: 'd1' })))
    const codes = results.map(r => r.statusCode).sort()
    // Sequentially: d1 L1→L2 (4), →3 (16), →4 (36), →5 (64), →6 (100), →7 (144), →8 (196), →9 (256)
    // costs 816 food total, leaving 184 < 324 for L9→10, so exactly 8 succeed.
    expect(codes.filter(c => c === 200)).toHaveLength(8)
    expect(codes.filter(c => c === 422)).toHaveLength(2)
    const [p] = await t.db.select().from(players).where(eq(players.id, playerId))
    const s = p!.state as PlayerState
    expect(s.dragons[0]!.level).toBe(9)
    expect(s.food).toBe(184)
    expect(p!.actionNonce).toBe(10n)
  })

  it('keeps the players table columns in sync with state', async () => {
    await setState({ ...newPlayer(0), level: 8 })
    const r = await post({ type: 'setDefenceTeam', dragonIds: ['d1', 'd2', 'd2'] })
    expect(r.statusCode).toBe(422)
    const [p] = await t.db.select().from(players).where(eq(players.id, playerId))
    expect(p!.level).toBe(8)
  })
})
