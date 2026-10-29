import { afterEach, describe, expect, it } from 'vitest'
import { loadConfig } from '../src/config'
import { bearer, TEST_ADMIN_TOKEN, TEST_SIGNER_KEY, TEST_VAULT, testApp, type TestApp } from './helpers/testApp'
import { signSiwe, TEST_KEYS, wallet } from './helpers/wallet'

const alice = wallet(TEST_KEYS.alice)
let t: TestApp | undefined

const config = (env: Record<string, string> = {}) => loadConfig({
  SESSION_SECRET: 't'.repeat(32), ADMIN_TOKEN: TEST_ADMIN_TOKEN, SIGNER_PRIVATE_KEY: TEST_SIGNER_KEY, VAULT_ADDRESS: TEST_VAULT, ...env,
})
const from = (country: string) => ({ 'cf-ipcountry': country })

afterEach(async () => { await t?.close(); t = undefined })

describe('config', () => {
  it('parses BLOCKED_COUNTRIES into uppercase codes and rejects malformed entries', () => {
    expect(config().BLOCKED_COUNTRIES).toEqual([])
    expect(config({ BLOCKED_COUNTRIES: ' kp, IR ,cu,' }).BLOCKED_COUNTRIES).toEqual(['KP', 'IR', 'CU'])
    expect(() => config({ BLOCKED_COUNTRIES: 'KP,USA' })).toThrow()
    expect(() => config({ BLOCKED_COUNTRIES: 'K1' })).toThrow()
    expect(config().TERMS_VERSION).toBe('')
  })
})

describe('country block list', () => {
  it('blocked country gets 451 on sign-in and actions', async () => {
    t = await testApp({ config: config({ TRUST_PROXY: 'true', BLOCKED_COUNTRIES: 'KP,IR' }) }, 1_700_000_000_000)
    // Signed in from an allowed country first, then seen from a blocked one.
    const { token } = await t!.login(alice, { headers: from('US') })
    const nonce = await t!.app.inject({ method: 'GET', url: '/auth/nonce', headers: from('kp') })
    expect(nonce.statusCode).toBe(451)
    expect(nonce.json()).toEqual({ error: 'REGION_BLOCKED' })
    const n = (await t!.app.inject({ method: 'GET', url: '/auth/nonce', headers: from('US') })).json<{ nonce: string }>().nonce
    const payload = await signSiwe(alice, n, { issuedAt: new Date(t!.clock()) })
    expect((await t!.app.inject({ method: 'POST', url: '/auth/verify', payload, headers: from('IR') })).statusCode).toBe(451)
    const action = await t!.app.inject({ method: 'POST', url: '/actions', headers: { ...bearer(token), ...from('KP') }, payload: { action: { type: 'buyFarmPlot' }, idempotencyKey: 'k1' } })
    expect(action.statusCode).toBe(451)
    expect(action.json().error).toBe('REGION_BLOCKED')
    expect((await t!.app.inject({ method: 'POST', url: '/actions?x=1', headers: { ...bearer(token), ...from('KP') }, payload: {} })).statusCode).toBe(451)
    // Percent-encoded paths route to the same handlers, so they are blocked too.
    expect((await t!.app.inject({ method: 'POST', url: '/%61ctions', headers: { ...bearer(token), ...from('KP') }, payload: {} })).statusCode).toBe(451)
    expect((await t!.app.inject({ method: 'GET', url: '/%61uth/nonce', headers: from('KP') })).statusCode).toBe(451)
    expect((await t!.app.inject({ method: 'POST', url: '/withdraw', headers: { ...bearer(token), ...from('KP') }, payload: { grossWei: '1' } })).statusCode).toBe(451)
    expect((await t!.app.inject({ method: 'GET', url: '/withdraw/pending', headers: { ...bearer(token), ...from('KP') } })).statusCode).toBe(451)
    // Not on the list, and routes outside the brief's list, are untouched.
    expect((await t!.app.inject({ method: 'GET', url: '/withdraw/pending', headers: { ...bearer(token), ...from('US') } })).statusCode).toBe(200)
    expect((await t!.app.inject({ method: 'GET', url: '/me', headers: { ...bearer(token), ...from('KP') } })).statusCode).toBe(200)
  })

  it('fails closed while the list is set: missing header, XX (unknown) and T1 (Tor) get 451', async () => {
    t = await testApp({ config: config({ TRUST_PROXY: 'true', BLOCKED_COUNTRIES: 'KP' }) }, 1_700_000_000_000)
    // A request that reached the origin without Cloudflare (no CF-IPCountry) cannot be placed, so it is refused.
    const missing = await t!.app.inject({ method: 'GET', url: '/auth/nonce' })
    expect(missing.statusCode).toBe(451)
    expect(missing.json()).toEqual({ error: 'REGION_BLOCKED' })
    expect((await t!.app.inject({ method: 'GET', url: '/auth/nonce', headers: from('') })).statusCode).toBe(451)
    expect((await t!.app.inject({ method: 'GET', url: '/auth/nonce', headers: from('XX') })).statusCode).toBe(451)
    expect((await t!.app.inject({ method: 'GET', url: '/auth/nonce', headers: from('t1') })).statusCode).toBe(451)
    const { token } = await t!.login(alice, { headers: from('US') })
    expect((await t!.app.inject({ method: 'POST', url: '/actions', headers: bearer(token), payload: {} })).statusCode).toBe(451)
    // Unblocked paths stay open without the header.
    expect((await t!.app.inject({ method: 'GET', url: '/health' })).statusCode).toBe(200)
    expect((await t!.app.inject({ method: 'GET', url: '/me', headers: bearer(token) })).statusCode).toBe(200)
  })

  it('without a list, a missing header blocks nobody', async () => {
    t = await testApp({ config: config({ TRUST_PROXY: 'true' }) }, 1_700_000_000_000)
    expect((await t!.app.inject({ method: 'GET', url: '/auth/nonce' })).statusCode).toBe(200)
    expect((await t!.app.inject({ method: 'GET', url: '/auth/nonce', headers: from('XX') })).statusCode).toBe(200)
  })

  it('header ignored when TRUST_PROXY is off', async () => {
    t = await testApp({ config: config({ TRUST_PROXY: 'false', BLOCKED_COUNTRIES: 'KP' }) }, 1_700_000_000_000)
    expect((await t!.app.inject({ method: 'GET', url: '/auth/nonce', headers: from('KP') })).statusCode).toBe(200)
    await t!.login(alice)
  })

  it('an empty list blocks nobody', async () => {
    t = await testApp({ config: config({ TRUST_PROXY: 'true' }) }, 1_700_000_000_000)
    expect((await t!.app.inject({ method: 'GET', url: '/auth/nonce', headers: from('KP') })).statusCode).toBe(200)
  })

  it('health and admin are never geo-blocked', async () => {
    t = await testApp({ config: config({ TRUST_PROXY: 'true', BLOCKED_COUNTRIES: 'KP' }) }, 1_700_000_000_000)
    expect((await t!.app.inject({ method: 'GET', url: '/health', headers: from('KP') })).statusCode).toBe(200)
    const adminRes = await t!.app.inject({ method: 'GET', url: '/admin/beta', headers: { 'x-admin-token': TEST_ADMIN_TOKEN, ...from('KP') } })
    expect(adminRes.statusCode).toBe(200)
  })
})
