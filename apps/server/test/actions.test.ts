import { applyAction, cumulativeXp, newPlayer, skipPriceMicroUsd, type PlayerState } from '@wyrmhaven/game-core'
import { eq, sql } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { actionLog, balances, players, spendBatches } from '../src/db/schema'
import { FixedPriceSource } from '../src/services/price'
import { FREE } from './helpers/land'
import { bearer, testApp, type TestApp } from './helpers/testApp'
import { TEST_KEYS, wallet } from './helpers/wallet'

// Wraps the real applyAction so a test can read the arguments the server passes.
vi.mock('@wyrmhaven/game-core', async importOriginal => {
  const mod = await importOriginal<typeof import('@wyrmhaven/game-core')>()
  return { ...mod, applyAction: vi.fn(mod.applyAction) }
})

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
    expect(body.state.gold).toBe(2800)
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

  it('replaying a buyPlot idempotency key charges once (§5.5)', async () => {
    await setState({ level: 2, gold: 1_000 })
    const buy = { type: 'buyPlot', island: 'home', plot: 4 }
    const first = await post(buy, 'plot-1')
    const replay = await post(buy, 'plot-1')
    expect([first.statusCode, replay.statusCode]).toEqual([200, 200])
    expect(replay.json()).toEqual(first.json())
    expect(await t.db.select().from(actionLog)).toHaveLength(1)
    const [p] = await t.db.select().from(players).where(eq(players.id, playerId))
    const s = p!.state as PlayerState
    expect(s.gold).toBe(900)
    expect(s.islands.plots.home).toEqual([5, 6, 9, 10, 4])
    // A new key on the same plot is refused, and still charges nothing.
    const again = await post(buy, 'plot-2')
    expect([again.statusCode, again.json().error]).toEqual([422, 'PLOT_OWNED'])
    const [q] = await t.db.select().from(players).where(eq(players.id, playerId))
    expect((q!.state as PlayerState).gold).toBe(900)
  })

  it('a server-side land rule refuses unowned land', async () => {
    await setState({ level: 5, gold: 100_000 })
    const r = await post({ type: 'placeBuilding', building: { kind: 'habitat', element: 'terra' }, placement: { island: 'home', col: 0, row: 0, facing: 0 } })
    expect([r.statusCode, r.json().error]).toEqual([422, 'NOT_OWNED'])
  })

  it('charges store purchases in tokens and records the spend batch', async () => {
    const r = await post({ type: 'buy', item: { kind: 'foodPack' } })
    expect(r.statusCode).toBe(200)
    expect(r.json().state.food).toBe(1_050)
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
    expect((p!.state as PlayerState).food).toBe(50)
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
    await post({ type: 'plant', plot: 0, crop: 'dragonBush' })
    const r = await post({ type: 'plant', plot: 0, crop: 'dragonBush' })
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
    const placed = await post({ type: 'placeBuilding', building: { kind: 'habitat', element: 'terra' }, placement: FREE })
    expect(placed.statusCode).toBe(200)
    expect(placed.json().state.constructions).toHaveLength(1)
    const skipped = await post({ type: 'buy', item: { kind: 'skip', target: 'construction', index: 0 } })
    expect(skipped.statusCode).toBe(200)
    expect(skipped.json().effects).toEqual([{ type: 'charge', microUsd: skipPriceMicroUsd(100_000) }])
    expect(skipped.json().state.habitats).toHaveLength(3)
    expect(skipped.json().state.constructions).toEqual([])
    const late = await post({ type: 'finishConstruction', index: 0 })
    expect(late.statusCode).toBe(422)
    expect(late.json()).toEqual({ error: 'NOT_FOUND' })
  })

  it('a construction skip with a bad index or on a ready construction charges nothing', async () => {
    const placed = await post({ type: 'placeBuilding', building: { kind: 'habitat', element: 'terra' }, placement: FREE })
    expect(placed.statusCode).toBe(200)
    const bad = await post({ type: 'buy', item: { kind: 'skip', target: 'construction', index: 5 } })
    expect([bad.statusCode, bad.json()]).toEqual([422, { error: 'NOT_FOUND' }])
    t.clock.set(placed.json().state.constructions[0].readyAtMs)
    const ready = await post({ type: 'buy', item: { kind: 'skip', target: 'construction', index: 0 } })
    expect([ready.statusCode, ready.json()]).toEqual([422, { error: 'NOTHING_TO_SKIP' }])
    expect((await t.db.select().from(balances))[0]!.tokenWei).toBe(100n * E18)
    expect(await t.db.select().from(spendBatches)).toHaveLength(0)
  })

  it('Ascension charges $2.00 in $DRIS and starts the Tier 5 build, all in one action (R35)', async () => {
    const at = FREE
    await setState({ roostPlacement: at, roostTier: 4, level: 30, gold: 10_000_000 })
    const r = await post({ type: 'buy', item: { kind: 'ascension' } })
    expect(r.statusCode).toBe(200)
    expect(r.json().effects).toEqual([{ type: 'charge', microUsd: 2_000_000 }])
    expect(r.json().state.gold).toBe(0)
    expect(r.json().state.constructions).toHaveLength(1)
    expect((await t.db.select().from(balances))[0]!.tokenWei).toBe(60n * E18) // $2.00 at $0.05 is 40 tokens
  })

  it('Ascension with too little $DRIS rolls the whole action back: Gold, build and balance unchanged', async () => {
    const at = FREE
    await setState({ roostPlacement: at, roostTier: 4, level: 30, gold: 10_000_000 })
    await t.db.update(balances).set({ tokenWei: 39n * E18 })
    const r = await post({ type: 'buy', item: { kind: 'ascension' } })
    expect(r.statusCode).toBe(402)
    expect(r.json()).toEqual({ error: 'INSUFFICIENT_TOKENS' })
    const [p] = await t.db.select().from(players).where(eq(players.id, playerId))
    const st = p!.state as PlayerState
    expect([st.gold, st.constructions, st.roostTier]).toEqual([10_000_000, [], 4])
    expect((await t.db.select().from(balances))[0]!.tokenWei).toBe(39n * E18)
    expect(await t.db.select().from(spendBatches)).toHaveLength(0)
  })

  it('Ascension with 9,999,999 Gold is a 422 INSUFFICIENT_GOLD with no charge', async () => {
    const at = FREE
    await setState({ roostPlacement: at, roostTier: 4, level: 30, gold: 9_999_999 })
    const r = await post({ type: 'buy', item: { kind: 'ascension' } })
    expect([r.statusCode, r.json()]).toEqual([422, { error: 'INSUFFICIENT_GOLD' }])
    expect((await t.db.select().from(balances))[0]!.tokenWei).toBe(100n * E18)
    expect(await t.db.select().from(spendBatches)).toHaveLength(0)
  })

  it('replaying the same idempotency key after an Ascension charges once', async () => {
    const at = FREE
    await setState({ roostPlacement: at, roostTier: 4, level: 30, gold: 10_000_000 })
    const first = await post({ type: 'buy', item: { kind: 'ascension' } }, 'asc-1')
    const replay = await post({ type: 'buy', item: { kind: 'ascension' } }, 'asc-1')
    expect([first.statusCode, replay.statusCode]).toEqual([200, 200])
    expect(replay.json()).toEqual(first.json())
    expect((await t.db.select().from(balances))[0]!.tokenWei).toBe(60n * E18)
    expect(await t.db.select().from(spendBatches)).toHaveLength(1)
  })

  it('replaying a useSpeedUp idempotency key spends one token (R55)', async () => {
    const [p] = await t.db.select().from(players).where(eq(players.id, playerId))
    const br = (p!.state as PlayerState).breeders
    const egg = { speciesId: 'flame', readyAtMs: 10_800_000, hatchMs: 1, xpFree: false }
    await setState({ speedUps: { '15m': 0, '1h': 3, '3h': 0 }, breeders: [{ ...br[0]!, egg }, ...br.slice(1)] })
    const use = { type: 'useSpeedUp', token: '1h', target: 'breeder', index: 0 }
    const first = await post(use, 'tok-1')
    const replay = await post(use, 'tok-1')
    expect([first.statusCode, replay.statusCode]).toEqual([200, 200])
    expect(replay.json()).toEqual(first.json())
    const [q] = await t.db.select().from(players).where(eq(players.id, playerId))
    const s = q!.state as PlayerState
    expect([s.speedUps['1h'], s.breeders[0]!.egg!.readyAtMs]).toEqual([2, 7_200_000])
    expect(await t.db.select().from(spendBatches)).toHaveLength(0)
    const none = await post({ ...use, token: '3h' }, 'tok-2')
    expect([none.statusCode, none.json().error]).toEqual([422, 'NO_TOKEN'])
  })

  it('claimGoal posted twice with one idempotency key pays the reward once', async () => {
    const [p] = await t.db.select().from(players).where(eq(players.id, playerId))
    const before = p!.state as PlayerState
    await setState({ goalStats: { ...before.goalStats, collects: 1 } })
    const first = await post({ type: 'claimGoal' }, 'goal-1')
    const replay = await post({ type: 'claimGoal' }, 'goal-1')
    expect([first.statusCode, replay.statusCode]).toEqual([200, 200])
    expect(replay.json()).toEqual(first.json())
    expect(first.json().state.gold).toBe(before.gold + 200) // Goal 1: +200 gold
    const paidXp = first.json().state.xp as number // Goal 1's XP after the server's preset multiplier
    expect(paidXp).toBeGreaterThan(0)
    const [after] = await t.db.select().from(players).where(eq(players.id, playerId))
    expect(after!.state).toMatchObject({ gold: before.gold + 200, xp: paidXp, goalIndex: 1 })
    expect(await t.db.select().from(actionLog).where(eq(actionLog.idempotencyKey, 'goal-1'))).toHaveLength(1)
  })

  it('a fresh key while the Ascension builds is a 422 UNDER_CONSTRUCTION with no second charge', async () => {
    const at = FREE
    await setState({ roostPlacement: at, roostTier: 4, level: 30, gold: 20_000_000 })
    expect((await post({ type: 'buy', item: { kind: 'ascension' } })).statusCode).toBe(200)
    const again = await post({ type: 'buy', item: { kind: 'ascension' } })
    expect([again.statusCode, again.json()]).toEqual([422, { error: 'UNDER_CONSTRUCTION' }])
    expect((await t.db.select().from(balances))[0]!.tokenWei).toBe(60n * E18)
  })

  it('Ascension below Tier 4 is a 422 with no charge', async () => {
    const at = FREE
    await setState({ roostPlacement: at, roostTier: 3, level: 30, gold: 10_000_000 })
    const r = await post({ type: 'buy', item: { kind: 'ascension' } })
    expect([r.statusCode, r.json()]).toEqual([422, { error: 'INVALID_ACTION' }])
    expect((await t.db.select().from(balances))[0]!.tokenWei).toBe(100n * E18)
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

  it('resets a version 2 save (nests and pity) to a fresh player on /me and on /actions, logging each reset once', async () => {
    const warn = vi.spyOn(t.app.log, 'warn')
    const resets = () => warn.mock.calls.filter(c => JSON.stringify(c).includes('state reset'))
    const v2 = { ...newPlayer(0), version: 2, pity: { 'flame+sea': 4 } }
    await t.db.update(players).set({ state: v2 }).where(eq(players.id, playerId))
    const me = await t.app.inject({ method: 'GET', url: '/me', headers: bearer(token) })
    expect(me.statusCode).toBe(200)
    expect(me.json().state.version).toBe(newPlayer(0).version)
    expect(me.json().state).not.toHaveProperty('pity')
    expect(resets()).toHaveLength(1)

    await t.db.update(players).set({ state: v2 }).where(eq(players.id, playerId))
    const r = await post({ type: 'collectGold', habitatId: 'h1' })
    expect(r.statusCode).toBeLessThan(500)
    expect(r.json().state).not.toHaveProperty('pity')
    expect(resets()).toHaveLength(2)
  })

  it('GET /me shows the banked XP the new day releases, with no action, and leaves the stored row alone (R41)', async () => {
    const bank = cumulativeXp(15) - cumulativeXp(12)
    await setState({ level: 12, xp: bank })
    const stored = async () => (await t.db.select().from(players).where(eq(players.id, playerId)))[0]!.state as PlayerState
    await t.app.inject({ method: 'GET', url: '/me', headers: bearer(token) }) // creates the game row at clock 0
    const day1 = (await t.app.inject({ method: 'GET', url: '/me', headers: bearer(token) })).json()
    expect(day1.state).toMatchObject({ level: 12, xp: bank })
    t.clock.set(86_400_000 + 1_000) // game day 2: limit PL 18
    const day2 = (await t.app.inject({ method: 'GET', url: '/me', headers: bearer(token) })).json()
    expect(day2.game.day).toBe(2)
    expect(day2.state).toMatchObject({ level: 15, xp: 0 })
    expect(await stored()).toMatchObject({ level: 12, xp: bank })
    // The next action pays it for real.
    expect((await post({ type: 'collectGold', habitatId: 'h1' })).json().state).toMatchObject({ level: 15, xp: 0 })
    expect(await stored()).toMatchObject({ level: 15, xp: 0 })
  })

  it('passes the game day to applyAction, from the game row when LAUNCH_AT is unset', async () => {
    const spy = vi.mocked(applyAction)
    spy.mockClear()
    await t.app.inject({ method: 'GET', url: '/me', headers: bearer(token) }) // creates the game row at clock 0
    t.clock.set(4 * 86_400_000 + 1_000) // launch + 4 days: game day 5
    await post({ type: 'collectGold', habitatId: 'h1' })
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy.mock.calls[0]![6]).toBe(5)
    t.clock.set(1_000)
    await post({ type: 'collectGold', habitatId: 'h1' })
    expect(spy.mock.calls[1]![6]).toBe(1)
  })

  it('passes the game day from LAUNCH_AT when it is set, ignoring the game row', async () => {
    const launch = 10 * 86_400_000
    const t2 = await testApp({ price: new FixedPriceSource(50_000n), config: { ...t.deps.config, LAUNCH_AT: new Date(launch).toISOString() } }, launch)
    try {
      const { token: tok2 } = await t2.login(wallet(TEST_KEYS.alice))
      const spy = vi.mocked(applyAction)
      spy.mockClear()
      t2.clock.set(launch + 2 * 86_400_000 + 5) // LAUNCH_AT + 2 days: game day 3
      const r = await t2.app.inject({ method: 'POST', url: '/actions', headers: bearer(tok2), payload: { action: { type: 'collectGold', habitatId: 'h1' }, idempotencyKey: crypto.randomUUID() } })
      expect(r.statusCode).toBe(200)
      expect(spy.mock.calls[0]![6]).toBe(3)
    } finally {
      await t2.close()
    }
  })

  it('runs a startBreed action without a seasons table and logs no season_id', async () => {
    const tables = await t.db.execute(sql`select table_name from information_schema.tables where table_schema = 'public'`)
    expect(JSON.stringify(tables)).not.toContain('seasons')
    await setState({ level: 2, dragons: newPlayer(0).dragons.map(d => ({ ...d, level: 4 })) })
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
    await setState({ food: 50 })
    const results = await Promise.all(Array.from({ length: 10 }, () => post({ type: 'feed', dragonId: 'd1' })))
    const codes = results.map(r => r.statusCode).sort()
    // Feeds cost 5 x4 (Lv 1) then 6 x4 (Lv 2) = 44 food; the 9th feed costs 8 > 6 left, so exactly 8 succeed.
    expect(codes.filter(c => c === 200)).toHaveLength(8)
    expect(codes.filter(c => c === 422)).toHaveLength(2)
    const [p] = await t.db.select().from(players).where(eq(players.id, playerId))
    const s = p!.state as PlayerState
    expect([s.dragons[0]!.level, s.dragons[0]!.feeds]).toEqual([3, 0])
    expect(s.food).toBe(6)
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
