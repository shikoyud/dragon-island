import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { LeaderboardResponse } from '@wyrmhaven/shared'
import { players, spLedger } from '../src/db/schema'
import { recordInflow } from '../src/services/inflows'
import { ensureCurrentSeason } from '../src/services/season'
import { bearer, testApp, type TestApp } from './helpers/testApp'
import { TEST_KEYS, wallet } from './helpers/wallet'

let t: TestApp
beforeEach(async () => { t = await testApp({}, 1_000) })
afterEach(async () => { await t.close() })

describe('GET /season/:id/leaderboard', () => {
  it('orders by sp then playerId, hides banned players, and reports the caller rank and pool', async () => {
    const a = await t.login(wallet(TEST_KEYS.alice))
    const b = await t.login(wallet(TEST_KEYS.bob))
    const c = await t.login(wallet(TEST_KEYS.carol))
    await t.db.update(players).set({ earningUnlocked: true })
    const season = await ensureCurrentSeason(t.db, t.clock)
    await t.db.transaction(tx => recordInflow(tx, t.clock, 'buyback', 1_000n, 'bb'))
    for (const [id, points] of [[a.playerId, 40], [b.playerId, 90], [c.playerId, 40]] as const) {
      await t.db.insert(spLedger).values({ playerId: id, seasonId: season.id, day: 0, source: 'seed', points, ref: '' })
    }
    await t.db.update(players).set({ bannedAt: new Date() }).where(eq(players.id, c.playerId))

    const r = await t.app.inject({ method: 'GET', url: `/season/${season.id}/leaderboard`, headers: bearer(a.token) })
    expect(r.statusCode).toBe(200)
    const body = r.json<LeaderboardResponse>()
    expect(body.poolWei).toBe('300')
    expect(body.closed).toBe(false)
    expect(body.top.map(x => [x.rank, x.playerId, x.sp])).toEqual([[1, b.playerId, 90], [2, a.playerId, 40]])
    expect(body.top[0]!.address).toMatch(/^0x[0-9a-fA-F]{40}$/)
    expect(body.me).toEqual({ rank: 2, sp: 40, prizeWei: null })

    const anon = await t.app.inject({ method: 'GET', url: `/season/${season.id}/leaderboard` })
    expect(anon.json<LeaderboardResponse>().me).toBeUndefined()
    expect((await t.app.inject({ method: 'GET', url: '/season/999/leaderboard' })).statusCode).toBe(404)
  })

  it('GET /season/:id/prizes/me is null before a close', async () => {
    const a = await t.login(wallet(TEST_KEYS.alice))
    const season = await ensureCurrentSeason(t.db, t.clock)
    const r = await t.app.inject({ method: 'GET', url: `/season/${season.id}/prizes/me`, headers: bearer(a.token) })
    expect(r.statusCode).toBe(200)
    expect(r.json()).toEqual({ prize: null })
  })
})
