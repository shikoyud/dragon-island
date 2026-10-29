import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { ReferralMeResponse } from '@wyrmhaven/shared'
import { balances, players, referralPayouts, vaultInflows } from '../src/db/schema'
import { FixedPriceSource } from '../src/services/price'
import { referralCode } from '../src/services/referrals'
import { bearer, testApp, type TestApp } from './helpers/testApp'
import { TEST_KEYS, wallet } from './helpers/wallet'

const E18 = 10n ** 18n
let t: TestApp
beforeEach(async () => { t = await testApp({ price: new FixedPriceSource(500_000n) }, 1_000) }) // $0.50 per token
afterEach(async () => { await t.close() })

const claim = (token: string, code: string) => t.app.inject({ method: 'POST', url: '/referral/claim', headers: bearer(token), payload: { code } })

describe('referrals', () => {
  it('pays the referrer 5% of a referred spend from the vault share', async () => {
    const ref = await t.login(wallet(TEST_KEYS.alice), { ip: '10.0.0.1', deviceId: 'dev-a' })
    const me = await t.login(wallet(TEST_KEYS.bob), { ip: '10.0.0.2', deviceId: 'dev-b' })
    expect((await claim(me.token, referralCode(ref.playerId))).statusCode).toBe(200)
    await t.db.update(balances).set({ tokenWei: 100n * E18 }).where(eq(balances.playerId, me.playerId))
    const r = await t.app.inject({ method: 'POST', url: '/actions', headers: bearer(me.token), payload: { action: { type: 'buy', item: { kind: 'foodPack' } }, idempotencyKey: 'k1' } })
    expect(r.statusCode).toBe(200) // 1 token charged
    const [refBal] = await t.db.select().from(balances).where(eq(balances.playerId, ref.playerId))
    expect(refBal!.earnedWei).toBe(E18 / 20n)
    expect(refBal!.tokenWei).toBe(E18 / 20n)
    const [payout] = await t.db.select().from(referralPayouts)
    expect(payout).toMatchObject({ referrerId: ref.playerId, referredId: me.playerId, wei: E18 / 20n })
    const [inflow] = await t.db.select().from(vaultInflows)
    expect(inflow).toMatchObject({ source: 'spend', wei: E18 / 2n - E18 / 20n })

    const mine = await t.app.inject({ method: 'GET', url: '/referral/me', headers: bearer(ref.token) })
    expect(mine.json<ReferralMeResponse>()).toEqual({ code: referralCode(ref.playerId), referredCount: 1, earnedWei: (E18 / 20n).toString(), referrer: false })
    expect((await t.app.inject({ method: 'GET', url: '/referral/me', headers: bearer(me.token) })).json<ReferralMeResponse>().referrer).toBe(true)
  })

  it('refuses self, repeat, post-spend, unknown and same-device or same-IP claims', async () => {
    const ref = await t.login(wallet(TEST_KEYS.alice), { ip: '10.0.0.1', deviceId: 'dev-a' })
    const code = referralCode(ref.playerId)
    expect((await claim(ref.token, code)).json()).toEqual({ error: 'REFERRAL_SELF' })

    const sameDevice = await t.login(wallet(TEST_KEYS.bob), { ip: '10.0.0.9', deviceId: 'dev-a' })
    expect((await claim(sameDevice.token, code)).statusCode).toBe(403)
    const sameIp = await t.login(wallet(TEST_KEYS.carol), { ip: '10.0.0.1', deviceId: 'dev-c' })
    expect((await claim(sameIp.token, code)).json()).toEqual({ error: 'REFERRAL_SAME_DEVICE' })

    const ok = await t.login(wallet(TEST_KEYS.dave), { ip: '10.0.0.4', deviceId: 'dev-d' })
    expect((await claim(ok.token, 'zzzzzzzz')).statusCode).toBe(404)
    expect((await claim(ok.token, code)).statusCode).toBe(200)
    expect((await claim(ok.token, code)).json()).toEqual({ error: 'REFERRAL_ALREADY_SET' })

    const spent = await t.login(wallet(TEST_KEYS.erin), { ip: '10.0.0.5', deviceId: 'dev-e' })
    await t.db.update(balances).set({ tokenWei: 100n * E18, spentWei: 1n }).where(eq(balances.playerId, spent.playerId))
    expect((await claim(spent.token, code)).json()).toEqual({ error: 'REFERRAL_AFTER_SPEND' })

    const [p] = await t.db.select().from(players).where(eq(players.id, ok.playerId))
    expect(p!.referrerId).toBe(ref.playerId)
    expect(p!.ipHash).toMatch(/^[0-9a-f]{64}$/)
  })

  it('a missing device header never matches', async () => {
    const ref = await t.login(wallet(TEST_KEYS.alice), { ip: '10.0.0.1' })
    const me = await t.login(wallet(TEST_KEYS.bob), { ip: '10.0.0.2' })
    expect((await claim(me.token, referralCode(ref.playerId))).statusCode).toBe(200)
  })
})
