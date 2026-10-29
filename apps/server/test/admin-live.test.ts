import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { loadConfig } from '../src/config'
import { balances, players, seasons, spLedger } from '../src/db/schema'
import { recordInflow } from '../src/services/inflows'
import { ensureCurrentSeason, SEASON_MS } from '../src/services/season'
import { TEST_ADMIN_TOKEN, testApp, type TestApp } from './helpers/testApp'
import { TEST_KEYS, wallet } from './helpers/wallet'

const E18 = 10n ** 18n
const admin = { 'x-admin-token': TEST_ADMIN_TOKEN }
let t: TestApp
beforeEach(async () => { t = await testApp({}, 1_000) })
afterEach(async () => { await t.close() })

describe('admin token', () => {
  it('must be at least 32 characters and is compared exactly', async () => {
    expect(() => loadConfig({ SESSION_SECRET: 's'.repeat(32), ADMIN_TOKEN: 'a'.repeat(31) })).toThrow()
    expect((await t.app.inject({ method: 'GET', url: '/admin/stats', headers: { 'x-admin-token': TEST_ADMIN_TOKEN.slice(0, -1) + 'x' } })).statusCode).toBe(401)
    expect((await t.app.inject({ method: 'GET', url: '/admin/stats' })).statusCode).toBe(401)
    expect(loadConfig({ SESSION_SECRET: 's'.repeat(32), ADMIN_TOKEN: 'a'.repeat(32), TRUST_PROXY: 'true' }).TRUST_PROXY).toBe(true)
  })
})

describe('live-ops routes', () => {
  it('looks a player up by id or address with balance, sp and ban fields', async () => {
    const a = await t.login(wallet(TEST_KEYS.alice))
    await t.db.update(balances).set({ tokenWei: 5n * E18, earnedWei: 2n * E18 }).where(eq(balances.playerId, a.playerId))
    const season = await ensureCurrentSeason(t.db, t.clock)
    await t.db.insert(spLedger).values({ playerId: a.playerId, seasonId: season.id, day: 0, source: 'seed', points: 12, ref: '' })
    const byId = await t.app.inject({ method: 'GET', url: `/admin/players/${a.playerId}`, headers: admin })
    expect(byId.statusCode).toBe(200)
    expect(byId.json()).toMatchObject({
      player: { id: a.playerId, level: 1, trophies: 0, earningUnlocked: false, bannedAt: null, referrerId: null },
      balance: { tokenWei: (5n * E18).toString(), earnedWei: (2n * E18).toString(), depositedWei: '0' },
      sp: { total: 12, today: 12 },
    })
    const byAddress = await t.app.inject({ method: 'GET', url: `/admin/players?address=${wallet(TEST_KEYS.alice).address}`, headers: admin })
    expect(byAddress.json().player.id).toBe(a.playerId)
    expect((await t.app.inject({ method: 'GET', url: '/admin/players?address=0x0000000000000000000000000000000000000001', headers: admin })).statusCode).toBe(404)
  })

  it('records a buyback once, summarises the season, and closes it only once ended', async () => {
    const a = await t.login(wallet(TEST_KEYS.alice))
    await t.db.update(players).set({ earningUnlocked: true })
    const season = await ensureCurrentSeason(t.db, t.clock)
    await t.db.insert(spLedger).values({ playerId: a.playerId, seasonId: season.id, day: 0, source: 'seed', points: 250, ref: '' })
    const body = { source: 'buyback', wei: (1_000n * E18).toString(), ref: 'bb:2026-10-29' }
    expect((await t.app.inject({ method: 'POST', url: '/admin/inflow', headers: admin, payload: body })).statusCode).toBe(200)
    expect((await t.app.inject({ method: 'POST', url: '/admin/inflow', headers: admin, payload: body })).statusCode).toBe(409)
    await t.db.transaction(tx => recordInflow(tx, t.clock, 'forfeit', 10n, 'f'))

    const summary = await t.app.inject({ method: 'GET', url: `/admin/season/${season.id}/summary`, headers: admin })
    expect(summary.json()).toMatchObject({
      season: { id: season.id }, closedAt: null,
      inflows: { totalWei: (1_000n * E18 + 10n).toString(), bySource: { buyback: (1_000n * E18).toString(), forfeit: '10' } },
      poolWei: ((1_000n * E18 + 10n) * 3n / 10n).toString(),
      standingsCount: 1, prizesPaidWei: '0',
    })

    expect((await t.app.inject({ method: 'POST', url: `/admin/season/${season.id}/close`, headers: admin })).json()).toEqual({ error: 'SEASON_ACTIVE' })
    t.clock.advance(SEASON_MS + 6 * 60_000)
    expect((await t.app.inject({ method: 'POST', url: `/admin/season/${season.id}/close`, headers: admin })).json()).toEqual({ closed: [season.id] })
    const after = await t.app.inject({ method: 'GET', url: `/admin/season/${season.id}/summary`, headers: admin })
    expect(after.json().closedAt).not.toBeNull()
    expect(BigInt(after.json().prizesPaidWei)).toBeGreaterThan(0n)

    const stats = await t.app.inject({ method: 'GET', url: '/admin/stats', headers: admin })
    expect(stats.json()).toEqual({ players: 1, earningUnlocked: 1, banned: 0, actions24h: 0, openVouchers: 0 })
  })
})

describe('tightened admin routes', () => {
  it('POST /admin/inflow accepts only buyback', async () => {
    const post = (payload: object) => t.app.inject({ method: 'POST', url: '/admin/inflow', headers: admin, payload })
    expect((await post({ source: 'spend', wei: '1', ref: 'x' })).statusCode).toBe(400)
    expect((await post({ source: 'buyback', wei: '1', ref: 'b1' })).statusCode).toBe(200)
  })

  it('close targets only the requested season, and rejects closed or still-graced seasons', async () => {
    const s1 = await ensureCurrentSeason(t.db, t.clock)
    t.clock.advance(SEASON_MS + 6 * 60_000)
    const s2 = await ensureCurrentSeason(t.db, t.clock)
    const close = (id: number) => t.app.inject({ method: 'POST', url: `/admin/season/${id}/close`, headers: admin })
    expect(s2.id).not.toBe(s1.id)
    t.clock.advance(s2.endsAt.getTime() - t.clock() + 1) // s2 ended but is inside the grace period
    expect((await close(s2.id)).json()).toEqual({ error: 'SEASON_GRACE' })
    t.clock.advance(6 * 60_000)
    const r = await close(s2.id)
    expect(r.json()).toEqual({ closed: [s2.id] })
    const closedAt = async (id: number) => (await t.db.select().from(seasons).where(eq(seasons.id, id)))[0]!.closedAt
    expect(await closedAt(s1.id)).toBeNull()
    expect(await closedAt(s2.id)).not.toBeNull()
    const again = await close(s2.id)
    expect(again.statusCode).toBe(409)
    expect(again.json()).toEqual({ error: 'ALREADY_CLOSED' })
    expect((await close(9999)).statusCode).toBe(404)
  })
})
