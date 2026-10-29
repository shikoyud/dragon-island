import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Db } from '../src/db/client'
import { players, seasonPrizes, seasons, spLedger } from '../src/db/schema'
import { closeSeasons } from '../src/jobs/seasonClose'
import { parseBackfillArgs } from '../src/scripts/backfillSeasons'
import { backfillClosedSeasons } from '../src/services/seasonBackfill'
import { recordInflow } from '../src/services/inflows'
import { TEST_KEYS, wallet } from './helpers/wallet'
import { testApp, type TestApp } from './helpers/testApp'

const E18 = 10n ** 18n
const DAY = 86_400_000
const NOW = 100 * DAY
let t: TestApp
let db: Db
let playerId: string

beforeEach(async () => {
  t = await testApp({}, NOW)
  db = t.db
  playerId = (await t.login(wallet(TEST_KEYS.alice))).playerId
  await db.update(players).set({ earningUnlocked: true, trophies: 1_500 })
})
afterEach(async () => { await t.close() })

const mkSeason = async (startDay: number, lengthDays: number) => {
  const [s] = await db.insert(seasons).values({
    startsAt: new Date(startDay * DAY), endsAt: new Date((startDay + lengthDays) * DAY), secretHex: '0x' + 'ab'.repeat(32), commitHash: '0x' + 'cd'.repeat(32),
  }).returning()
  return s!
}
const get = async (id: number) => (await db.select().from(seasons).where(eq(seasons.id, id)))[0]!

describe('backfillClosedSeasons', () => {
  it('backfill marks ended seasons closed without prizes', async () => {
    const a = await mkSeason(10, 14)
    const b = await mkSeason(24, 14)
    for (const s of [a, b]) {
      await db.insert(spLedger).values({ playerId, seasonId: s.id, day: 0, source: 'seed', points: 500, ref: '' })
      await db.transaction(tx => recordInflow(tx, t.clock, 'buyback', 100n * E18, `bb${s.id}`))
    }
    const r = await backfillClosedSeasons(db, t.clock, { endedBeforeMs: NOW, dryRun: false })
    expect(r.seasonIds).toEqual([a.id, b.id])
    for (const s of [a, b]) expect(await get(s.id)).toMatchObject({ revealed: true, closedAt: new Date(NOW) })
    expect(await db.select().from(seasonPrizes)).toHaveLength(0)
    const [p] = await db.select().from(players).where(eq(players.id, playerId))
    expect(p!.trophies).toBe(1_500)
  })

  it('backfill leaves the current season and later-ending seasons open', async () => {
    const old = await mkSeason(10, 14)
    const current = await mkSeason(90, 14) // ends day 104 > NOW
    const edge = await mkSeason(50, 50) // ends exactly day 100 = cutoff: included
    const r = await backfillClosedSeasons(db, t.clock, { endedBeforeMs: NOW, dryRun: false })
    expect(r.seasonIds).toEqual([old.id, edge.id])
    expect((await get(current.id)).closedAt).toBeNull()
    expect((await get(current.id)).revealed).toBe(false)
  })

  it('does not restamp seasons that are already closed', async () => {
    const a = await mkSeason(10, 14)
    await db.update(seasons).set({ closedAt: new Date(5 * DAY), revealed: true }).where(eq(seasons.id, a.id))
    expect((await backfillClosedSeasons(db, t.clock, { endedBeforeMs: NOW, dryRun: false })).seasonIds).toEqual([])
    expect((await get(a.id)).closedAt).toEqual(new Date(5 * DAY))
  })

  it('dry run changes nothing', async () => {
    const a = await mkSeason(10, 14)
    const r = await backfillClosedSeasons(db, t.clock, { endedBeforeMs: NOW, dryRun: true })
    expect(r.seasonIds).toEqual([a.id])
    expect(await get(a.id)).toMatchObject({ closedAt: null, revealed: false })
  })

  it('closeSeasons after backfill closes nothing', async () => {
    await mkSeason(10, 14)
    await mkSeason(24, 14)
    await backfillClosedSeasons(db, t.clock, { endedBeforeMs: NOW, dryRun: false })
    expect(await closeSeasons({ db, clock: t.clock })).toEqual({ closed: [], busy: false })
    expect(await db.select().from(seasonPrizes)).toHaveLength(0)
  })
})

describe('parseBackfillArgs', () => {
  it('parses cutoff and apply flag', () => {
    expect(parseBackfillArgs(['--ended-before', '2026-11-01T00:00:00Z'])).toEqual({ endedBeforeMs: Date.UTC(2026, 10, 1), dryRun: true })
    expect(parseBackfillArgs(['--', '--ended-before', '2026-11-01T00:00:00Z', '--apply'])).toEqual({ endedBeforeMs: Date.UTC(2026, 10, 1), dryRun: false })
  })
  it('rejects missing or invalid dates', () => {
    expect(() => parseBackfillArgs([])).toThrow(/--ended-before/)
    expect(() => parseBackfillArgs(['--ended-before', 'nope'])).toThrow(/invalid/i)
    expect(() => parseBackfillArgs(['--ended-before'])).toThrow(/--ended-before/)
  })
})
