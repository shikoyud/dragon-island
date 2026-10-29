import { computePrizes, prizePoolWei, type PlayerState } from '@wyrmhaven/game-core'
import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { balances, players, seasonPrizes, seasons, spLedger } from '../src/db/schema'
import { closeSeasons } from '../src/jobs/seasonClose'
import { recordInflow } from '../src/services/inflows'
import { ensureCurrentSeason, SEASON_MS } from '../src/services/season'
import { standings } from '../src/services/standings'
import { testApp, type TestApp } from './helpers/testApp'
import { TEST_KEYS, wallet } from './helpers/wallet'

const E18 = 10n ** 18n
let t: TestApp
let ids: string[]

beforeEach(async () => {
  t = await testApp({}, 1_000)
  ids = []
  for (const k of [TEST_KEYS.alice, TEST_KEYS.bob, TEST_KEYS.carol]) ids.push((await t.login(wallet(k))).playerId)
  await t.db.update(players).set({ earningUnlocked: true })
})
afterEach(async () => { await t.close() })

const givePoints = async (seasonId: number, playerId: string, points: number) =>
  t.db.insert(spLedger).values({ playerId, seasonId, day: 0, source: 'seed', points, ref: '' })

describe('closeSeasons', () => {
  it('credits prizes, records them, reveals the secret and resets trophies', async () => {
    const season = await ensureCurrentSeason(t.db, t.clock)
    await t.db.transaction(tx => recordInflow(tx, t.clock, 'buyback', 1_000n * E18, 'bb'))
    await givePoints(season.id, ids[0]!, 2100)
    await givePoints(season.id, ids[1]!, 600)
    await givePoints(season.id, ids[2]!, 600)
    const [p0] = await t.db.select().from(players).where(eq(players.id, ids[0]!))
    await t.db.update(players).set({ trophies: 1_500, state: { ...(p0!.state as PlayerState), trophies: 1_500 } }).where(eq(players.id, ids[0]!))

    t.clock.advance(SEASON_MS + 1)
    expect(await closeSeasons({ db: t.db, clock: t.clock })).toEqual([season.id])

    const expected = computePrizes(prizePoolWei(1_000n * E18), [{ playerId: ids[0]!, sp: 2100 }, { playerId: ids[1]!, sp: 600 }, { playerId: ids[2]!, sp: 600 }])
    for (const a of expected.awards) {
      const [b] = await t.db.select().from(balances).where(eq(balances.playerId, a.playerId))
      expect(b!.earnedWei).toBe(a.wei)
      expect(b!.tokenWei).toBe(a.wei)
    }
    const prizes = await t.db.select().from(seasonPrizes).where(eq(seasonPrizes.seasonId, season.id))
    expect(prizes).toHaveLength(3)
    expect(prizes.find(p => p.playerId === ids[0])).toMatchObject({ tier: 3, rank: 1 })

    const [s] = await t.db.select().from(seasons).where(eq(seasons.id, season.id))
    expect(s!.revealed).toBe(true)
    expect(s!.closedAt).not.toBeNull()
    const [after] = await t.db.select().from(players).where(eq(players.id, ids[0]!))
    expect(after!.trophies).toBe(1_250)
    expect((after!.state as PlayerState).trophies).toBe(1_250)
  })

  it('closing twice credits nothing the second time', async () => {
    const season = await ensureCurrentSeason(t.db, t.clock)
    await t.db.transaction(tx => recordInflow(tx, t.clock, 'buyback', 100n * E18, 'bb'))
    await givePoints(season.id, ids[0]!, 300)
    t.clock.advance(SEASON_MS + 1)
    await closeSeasons({ db: t.db, clock: t.clock })
    const [before] = await t.db.select().from(balances).where(eq(balances.playerId, ids[0]!))
    expect(await closeSeasons({ db: t.db, clock: t.clock })).toEqual([])
    const [after] = await t.db.select().from(balances).where(eq(balances.playerId, ids[0]!))
    expect(after!.tokenWei).toBe(before!.tokenWei)
    expect(before!.tokenWei).toBeGreaterThan(0n)
  })

  it('banned and earning-locked players are excluded from standings and prizes', async () => {
    const season = await ensureCurrentSeason(t.db, t.clock)
    await t.db.transaction(tx => recordInflow(tx, t.clock, 'buyback', 100n * E18, 'bb'))
    await givePoints(season.id, ids[0]!, 2500)
    await givePoints(season.id, ids[1]!, 400)
    await givePoints(season.id, ids[2]!, 50)
    await t.db.update(players).set({ bannedAt: new Date(t.clock()) }).where(eq(players.id, ids[0]!))
    await t.db.update(players).set({ earningUnlocked: false }).where(eq(players.id, ids[1]!))
    expect(await standings(t.db, season.id)).toEqual([{ playerId: ids[2], sp: 50 }])
    t.clock.advance(SEASON_MS + 1)
    await closeSeasons({ db: t.db, clock: t.clock })
    const prizes = await t.db.select().from(seasonPrizes)
    expect(prizes.map(p => p.playerId)).toEqual([ids[2]])
  })

  it('does not close a running season', async () => {
    await ensureCurrentSeason(t.db, t.clock)
    expect(await closeSeasons({ db: t.db, clock: t.clock })).toEqual([])
  })
})
