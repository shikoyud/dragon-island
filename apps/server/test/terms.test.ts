import { eq } from 'drizzle-orm'
import { afterEach, describe, expect, it } from 'vitest'
import { loadConfig } from '../src/config'
import { players } from '../src/db/schema'
import { bearer, TEST_ADMIN_TOKEN, TEST_SIGNER_KEY, TEST_VAULT, testApp, type TestApp } from './helpers/testApp'
import { signSiwe, TEST_KEYS, wallet } from './helpers/wallet'

const alice = wallet(TEST_KEYS.alice)
const bob = wallet(TEST_KEYS.bob)
let t: TestApp

const config = (termsVersion: string) => loadConfig({
  SESSION_SECRET: 't'.repeat(32), ADMIN_TOKEN: TEST_ADMIN_TOKEN, SIGNER_PRIVATE_KEY: TEST_SIGNER_KEY, VAULT_ADDRESS: TEST_VAULT, TERMS_VERSION: termsVersion,
})
let keys = 0
const act = (token: string) => t.app.inject({
  method: 'POST', url: '/actions', headers: bearer(token), payload: { action: { type: 'harvest', plot: 0 }, idempotencyKey: `k${++keys}` },
})
const me = async (token: string) => (await t.app.inject({ method: 'GET', url: '/me', headers: bearer(token) })).json()
const accept = (token: string, version: string) => t.app.inject({ method: 'POST', url: '/me/terms', headers: bearer(token), payload: { version } })
async function loginWithTerms(account: typeof alice, termsVersion: string) {
  const n = (await t.app.inject({ method: 'GET', url: '/auth/nonce' })).json<{ nonce: string }>().nonce
  const payload = await signSiwe(account, n, { issuedAt: new Date(t.clock()) })
  const res = await t.app.inject({ method: 'POST', url: '/auth/verify', payload: { ...payload, termsVersion } })
  expect(res.statusCode).toBe(200)
  return res.json<{ token: string; playerId: string }>()
}

afterEach(async () => { await t.close() })

describe('terms acceptance', () => {
  it('actions need the current terms version when one is set', async () => {
    t = await testApp({ config: config('2026-10') }, 1_700_000_000_000)
    const { token } = await t.login(alice)
    const res = await act(token)
    expect(res.statusCode).toBe(428)
    expect(res.json()).toEqual({ error: 'TERMS_REQUIRED' })
    expect((await t.app.inject({ method: 'GET', url: '/pvp/offers', headers: bearer(token) })).statusCode).toBe(428)
    // /me still works and tells the client which version to show.
    expect((await me(token)).termsRequired).toBe('2026-10')
  })

  it('accepting terms unblocks actions', async () => {
    t = await testApp({ config: config('2026-10') }, 1_700_000_000_000)
    const { token } = await t.login(alice)
    expect((await act(token)).statusCode).toBe(428)
    const ok = await accept(token, '2026-10')
    expect(ok.statusCode).toBe(200)
    expect(ok.json()).toEqual({ ok: true })
    expect((await act(token)).statusCode).not.toBe(428)
    expect((await me(token)).termsRequired).toBeNull()
    // A new version requires accepting again.
    t.deps.config.TERMS_VERSION = '2026-11'
    expect((await act(token)).statusCode).toBe(428)
    expect((await me(token)).termsRequired).toBe('2026-11')
  })

  it('sign-in stores termsVersion only when it equals the current version', async () => {
    t = await testApp({ config: config('2026-10') }, 1_700_000_000_000)
    const a = await loginWithTerms(alice, '2026-10')
    expect((await act(a.token)).statusCode).not.toBe(428)
    const b = await loginWithTerms(bob, '2025-01')
    expect((await act(b.token)).statusCode).toBe(428)
    const [row] = await t.db.select({ v: players.termsVersion }).from(players).where(eq(players.id, b.playerId))
    expect(row!.v).toBeNull()
    expect((await t.app.inject({ method: 'POST', url: '/auth/verify', payload: { message: 'x', signature: '0x00', termsVersion: 'v'.repeat(65) } })).statusCode).toBe(400)
  })

  it('a mismatched version on /me/terms is 400 and stores nothing', async () => {
    t = await testApp({ config: config('2026-10') }, 1_700_000_000_000)
    const { token, playerId } = await t.login(alice)
    const res = await accept(token, '2026-09')
    expect(res.statusCode).toBe(400)
    expect(res.json().error).toBe('TERMS_VERSION_MISMATCH')
    const [row] = await t.db.select({ v: players.termsVersion }).from(players).where(eq(players.id, playerId))
    expect(row!.v).toBeNull()
    expect((await t.app.inject({ method: 'POST', url: '/me/terms', payload: { version: '2026-10' } })).statusCode).toBe(401)
  })

  it('TERMS_VERSION empty means no gating', async () => {
    t = await testApp({ config: config('') }, 1_700_000_000_000)
    const { token } = await t.login(alice)
    expect((await act(token)).statusCode).not.toBe(428)
    expect((await me(token)).termsRequired).toBeNull()
    expect((await accept(token, '')).statusCode).toBe(400)
  })

  it('withdrawals, /me and sign-in are never terms-gated', async () => {
    t = await testApp({ config: config('2026-10') }, 1_700_000_000_000)
    const { token } = await t.login(alice)
    expect((await t.app.inject({ method: 'GET', url: '/withdraw/pending', headers: bearer(token) })).statusCode).toBe(200)
    const w = await t.app.inject({ method: 'POST', url: '/withdraw', headers: bearer(token), payload: { grossWei: '1' } })
    expect(w.statusCode).not.toBe(428)
    expect(w.json().error).not.toBe('TERMS_REQUIRED')
    expect((await t.app.inject({ method: 'GET', url: '/me', headers: bearer(token) })).statusCode).toBe(200)
  })
})
