import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { balances, players, seasonPrizes, seasons, signInOrigins, spLedger, vaultInflows } from '../src/db/schema'
import { CLOSE_GRACE_MS, closeSeasons } from '../src/jobs/seasonClose'
import { banPlayer } from '../src/services/bans'
import { recordInflow } from '../src/services/inflows'
import { FixedPriceSource } from '../src/services/price'
import { referralCode } from '../src/services/referrals'
import { ensureCurrentSeason, SEASON_MS } from '../src/services/season'
import { bearer, testApp, type TestApp } from './helpers/testApp'
import { TEST_KEYS, wallet } from './helpers/wallet'

const E18 = 10n ** 18n
let t: TestApp
beforeEach(async () => { t = await testApp({ price: new FixedPriceSource(500_000n) }, 1_000) })
afterEach(async () => { await t.close() })

const buy = (token: string, key: string) =>
  t.app.inject({ method: 'POST', url: '/actions', headers: bearer(token), payload: { action: { type: 'buy', item: { kind: 'foodPack' } }, idempotencyKey: key } })
const claim = (token: string, code: string) => t.app.inject({ method: 'POST', url: '/referral/claim', headers: bearer(token), payload: { code } })

describe('Review 1: a season is closed only after a grace period, so late writers still count', () => {
  it('counts SP and inflows written after endsAt but before the close', async () => {
    const a = await t.login(wallet(TEST_KEYS.alice))
    await t.db.update(players).set({ earningUnlocked: true })
    const season = await ensureCurrentSeason(t.db, t.clock)
    t.clock.advance(SEASON_MS + 1) // the season has ended, an action started just before is still committing
    await t.db.insert(spLedger).values({ playerId: a.playerId, seasonId: season.id, day: 14, source: 'late', points: 250, ref: '' })
    await t.db.insert(vaultInflows).values({ seasonId: season.id, source: 'buyback', wei: 1_000n * E18, ref: 'late' })
    expect(await closeSeasons({ db: t.db, clock: t.clock })).toEqual([]) // inside the grace period: not yet
    t.clock.advance(CLOSE_GRACE_MS)
    expect(await closeSeasons({ db: t.db, clock: t.clock })).toEqual([season.id])
    const [prize] = await t.db.select().from(seasonPrizes).where(eq(seasonPrizes.playerId, a.playerId))
    expect(prize!.wei).toBeGreaterThan(0n)
    expect(prize!.tier).toBe(0)
    const [s] = await t.db.select().from(seasons).where(eq(seasons.id, season.id))
    expect(s!.closedAt).not.toBeNull()
  })
})

describe('Review 2: referral checks use every sign-in origin, at claim time and at payout time', () => {
  it('refuses a claim when any past origin of the referrer matches any origin of the claimant', async () => {
    const ref = await t.login(wallet(TEST_KEYS.alice), { ip: '10.0.0.1', deviceId: 'dev-a' })
    await t.login(wallet(TEST_KEYS.alice), { ip: '10.0.0.7', deviceId: 'dev-vpn' }) // referrer moves to a VPN
    const me = await t.login(wallet(TEST_KEYS.bob), { ip: '10.0.0.1', deviceId: 'dev-b' }) // claimant on the referrer's old IP
    expect((await claim(me.token, referralCode(ref.playerId))).json()).toEqual({ error: 'REFERRAL_SAME_DEVICE' })
    expect(await t.db.select().from(signInOrigins).where(eq(signInOrigins.playerId, ref.playerId))).toHaveLength(2)
  })

  it('stops paying once the referred player shows up from the referrer’s device', async () => {
    const ref = await t.login(wallet(TEST_KEYS.alice), { ip: '10.0.0.1', deviceId: 'dev-a' })
    const me = await t.login(wallet(TEST_KEYS.bob), { ip: '10.0.0.2', deviceId: 'dev-b' })
    expect((await claim(me.token, referralCode(ref.playerId))).statusCode).toBe(200)
    await t.db.update(balances).set({ tokenWei: 100n * E18 }).where(eq(balances.playerId, me.playerId))
    expect((await buy(me.token, 'k1')).statusCode).toBe(200)
    const earned = async () => (await t.db.select().from(balances).where(eq(balances.playerId, ref.playerId)))[0]!.earnedWei
    expect(await earned()).toBe(E18 / 20n)

    const again = await t.login(wallet(TEST_KEYS.bob), { ip: '10.0.0.9', deviceId: 'dev-a' }) // same device as the referrer
    expect((await buy(again.token, 'k2')).statusCode).toBe(200)
    expect(await earned()).toBe(E18 / 20n) // no second payout
    const inflows = await t.db.select().from(vaultInflows).where(eq(vaultInflows.source, 'spend'))
    expect(inflows.map(r => r.wei)).toEqual([E18 / 2n - E18 / 20n, E18 / 2n]) // the vault keeps the full half the second time
  })
})

describe('Review 3: banned referrers are not paid', () => {
  it('pays nothing to a banned referrer and keeps the full half in the vault', async () => {
    const ref = await t.login(wallet(TEST_KEYS.alice), { ip: '10.0.0.1', deviceId: 'dev-a' })
    const me = await t.login(wallet(TEST_KEYS.bob), { ip: '10.0.0.2', deviceId: 'dev-b' })
    expect((await claim(me.token, referralCode(ref.playerId))).statusCode).toBe(200)
    await banPlayer(t.db, t.clock, ref.playerId, 'multi-accounting')
    await t.db.update(balances).set({ tokenWei: 100n * E18 }).where(eq(balances.playerId, me.playerId))
    expect((await buy(me.token, 'k1')).statusCode).toBe(200)
    const [b] = await t.db.select().from(balances).where(eq(balances.playerId, ref.playerId))
    expect(b!.earnedWei).toBe(0n)
    const [inflow] = await t.db.select().from(vaultInflows).where(eq(vaultInflows.source, 'spend'))
    expect(inflow!.wei).toBe(E18 / 2n)
  })
})
