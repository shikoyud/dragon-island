import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { FakeChainClient } from '../src/chain/fake'
import { balances, sessions } from '../src/db/schema'
import { FixedPriceSource } from '../src/services/price'
import { bearer, testApp, type TestApp } from './helpers/testApp'
import { TEST_KEYS, wallet } from './helpers/wallet'

const E18 = 10n ** 18n
const alice = wallet(TEST_KEYS.alice)
const admin = { 'x-admin-token': 'admin-token' }
let t: TestApp
let chain: FakeChainClient
let token: string
let playerId: string

beforeEach(async () => {
  chain = new FakeChainClient()
  chain.remainingPayout = 1_000n * E18
  t = await testApp({ chain, price: new FixedPriceSource(50_000n) }, 1_000)
  ;({ token, playerId } = await t.login(alice))
  await t.db.update(balances).set({
    tokenWei: 70n * E18, depositedWei: 50n * E18, withdrawnWei: 10n * E18, earnedWei: 30n * E18,
  }).where(eq(balances.playerId, playerId))
})
afterEach(async () => {
  await t.close()
})

const ban = () => t.app.inject({ method: 'POST', url: '/admin/ban', headers: admin, payload: { playerId, reason: 'bots' } })
const act = (tok: string, action: unknown) =>
  t.app.inject({ method: 'POST', url: '/actions', headers: bearer(tok), payload: { action, idempotencyKey: crypto.randomUUID() } })

describe('bans', () => {
  it('forfeits earned tokens, kills sessions, and blocks play', async () => {
    expect((await ban()).statusCode).toBe(200)
    const [b] = await t.db.select().from(balances).where(eq(balances.playerId, playerId))
    expect(b!.tokenWei).toBe(40n * E18)
    expect(b!.earnedWei).toBe(0n)
    expect(await t.db.select().from(sessions).where(eq(sessions.playerId, playerId))).toEqual([])
    expect((await t.app.inject({ method: 'GET', url: '/me', headers: bearer(token) })).statusCode).toBe(401)

    const again = await t.login(alice)
    const me = await t.app.inject({ method: 'GET', url: '/me', headers: bearer(again.token) })
    expect(me.statusCode).toBe(200)
    expect(me.json().banned).toBe(true)
    const r = await act(again.token, { type: 'collectGold', habitatId: 'h1' })
    expect(r.statusCode).toBe(403)
    expect(r.json()).toEqual({ error: 'BANNED' })
    expect((await t.app.inject({ method: 'GET', url: '/pvp/offers', headers: bearer(again.token) })).statusCode).toBe(403)
    expect((await t.app.inject({ method: 'GET', url: '/sp', headers: bearer(again.token) })).statusCode).toBe(403)
  })

  it('still lets a banned player withdraw their own deposits, and no more', async () => {
    await ban()
    const { token: tok } = await t.login(alice)
    const over = await t.app.inject({ method: 'POST', url: '/withdraw', headers: bearer(tok), payload: { grossWei: (41n * E18).toString() } })
    expect(over.statusCode).toBe(422)
    expect(over.json()).toEqual({ error: 'WITHDRAW_LIMIT' })
    const ok = await t.app.inject({ method: 'POST', url: '/withdraw', headers: bearer(tok), payload: { grossWei: (40n * E18).toString() } })
    expect(ok.statusCode).toBe(200)
    expect((await t.app.inject({ method: 'GET', url: '/withdraw/pending', headers: bearer(tok) })).statusCode).toBe(200)
  })

  it('unban restores access but not the forfeited balance', async () => {
    await ban()
    expect((await t.app.inject({ method: 'POST', url: '/admin/unban', headers: admin, payload: { playerId } })).statusCode).toBe(200)
    const { token: tok } = await t.login(alice)
    expect((await act(tok, { type: 'collectGold', habitatId: 'h1' })).statusCode).toBe(200)
    expect((await t.db.select().from(balances))[0]!.tokenWei).toBe(40n * E18)
  })
})

describe('admin', () => {
  it('requires the admin token', async () => {
    expect((await t.app.inject({ method: 'POST', url: '/admin/ban', payload: { playerId, reason: 'x' } })).statusCode).toBe(401)
    expect((await t.app.inject({ method: 'POST', url: '/admin/ban', headers: { 'x-admin-token': 'wrong' }, payload: { playerId, reason: 'x' } })).statusCode).toBe(401)
  })

  it('sets the manual price that store charges use', async () => {
    await t.close()
    t = await testApp({ chain }, 1_000) // ManualPriceSource by default
    ;({ token, playerId } = await t.login(alice))
    await t.db.update(balances).set({ tokenWei: 100n * E18 }).where(eq(balances.playerId, playerId))
    expect((await act(token, { type: 'buy', item: { kind: 'foodPack' } })).statusCode).toBe(503)
    const set = await t.app.inject({ method: 'POST', url: '/admin/price', headers: admin, payload: { microUsdPerToken: '100000' } }) // $0.10
    expect(set.statusCode).toBe(200)
    expect((await act(token, { type: 'buy', item: { kind: 'foodPack' } })).statusCode).toBe(200)
    expect((await t.db.select().from(balances))[0]!.tokenWei).toBe(95n * E18) // $0.50 / $0.10 = 5 tokens
  })

  it('runs jobs and reveals ended seasons', async () => {
    expect((await t.app.inject({ method: 'POST', url: '/admin/jobs/indexer/run', headers: admin })).statusCode).toBe(200)
    expect((await t.app.inject({ method: 'POST', url: '/admin/jobs/nope/run', headers: admin })).statusCode).toBe(404)
    expect((await t.app.inject({ method: 'GET', url: '/season' })).statusCode).toBe(200) // creates season 1
    expect((await t.app.inject({ method: 'POST', url: '/admin/season/1/reveal', headers: admin })).statusCode).toBe(409)
    expect((await t.app.inject({ method: 'POST', url: '/admin/season/9/reveal', headers: admin })).statusCode).toBe(404)
  })
})
