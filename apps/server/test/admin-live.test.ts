import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { loadConfig } from '../src/config'
import { balances, players } from '../src/db/schema'
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
  it('looks a player up by id or address with balance and ban fields', async () => {
    const a = await t.login(wallet(TEST_KEYS.alice))
    await t.db.update(balances).set({ tokenWei: 5n * E18, earnedWei: 2n * E18 }).where(eq(balances.playerId, a.playerId))
    const byId = await t.app.inject({ method: 'GET', url: `/admin/players/${a.playerId}`, headers: admin })
    expect(byId.statusCode).toBe(200)
    expect(byId.json()).toMatchObject({
      player: { id: a.playerId, level: 1, trophies: 0, earningUnlocked: false, bannedAt: null },
      balance: { tokenWei: (5n * E18).toString(), earnedWei: (2n * E18).toString(), depositedWei: '0' },
    })
    const byAddress = await t.app.inject({ method: 'GET', url: `/admin/players?address=${wallet(TEST_KEYS.alice).address}`, headers: admin })
    expect(byAddress.json().player.id).toBe(a.playerId)
    expect((await t.app.inject({ method: 'GET', url: '/admin/players?address=0x0000000000000000000000000000000000000001', headers: admin })).statusCode).toBe(404)
  })

  it('reports player counts in /admin/stats', async () => {
    await t.login(wallet(TEST_KEYS.alice))
    await t.db.update(players).set({ earningUnlocked: true })
    const stats = await t.app.inject({ method: 'GET', url: '/admin/stats', headers: admin })
    expect(stats.json()).toEqual({ players: 1, earningUnlocked: 1, banned: 0, actions24h: 0, openVouchers: 0 })
  })
})
