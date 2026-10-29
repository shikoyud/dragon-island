import { afterEach, describe, expect, it } from 'vitest'
import { loadConfig } from '../src/config'
import { bearer, TEST_ADMIN_TOKEN, TEST_SIGNER_KEY, TEST_VAULT, testApp, type TestApp } from './helpers/testApp'
import { signSiwe, TEST_KEYS, wallet } from './helpers/wallet'

const admin = { 'x-admin-token': TEST_ADMIN_TOKEN }
const alice = wallet(TEST_KEYS.alice)
const bob = wallet(TEST_KEYS.bob)
let t: TestApp

const config = (beta: 'true' | 'false') => loadConfig({
  SESSION_SECRET: 't'.repeat(32), ADMIN_TOKEN: TEST_ADMIN_TOKEN, SIGNER_PRIVATE_KEY: TEST_SIGNER_KEY, VAULT_ADDRESS: TEST_VAULT, BETA_CLOSED: beta,
})
const allow = (addresses: string[]) => t.app.inject({ method: 'POST', url: '/admin/beta/allow', headers: admin, payload: { addresses } })
async function verify(account: typeof alice) {
  const n = (await t.app.inject({ method: 'GET', url: '/auth/nonce' })).json<{ nonce: string }>().nonce
  const payload = await signSiwe(account, n, { issuedAt: new Date(t.clock()) })
  return { payload, res: await t.app.inject({ method: 'POST', url: '/auth/verify', payload }) }
}

afterEach(async () => { await t.close() })

describe('closed beta', () => {
  it('refuses unlisted wallets with 403 BETA_CLOSED, and the nonce is still spent', async () => {
    t = await testApp({ config: config('true') }, 1_700_000_000_000)
    const { payload, res } = await verify(alice)
    expect(res.statusCode).toBe(403)
    expect(res.json().error).toBe('BETA_CLOSED')
    await allow([alice.address])
    // Replaying the same signed message fails: the nonce was consumed by the refusal.
    expect((await t.app.inject({ method: 'POST', url: '/auth/verify', payload })).statusCode).toBe(401)
    expect((await verify(alice)).res.statusCode).toBe(200)
  })

  it('matches addresses regardless of case', async () => {
    t = await testApp({ config: config('true') }, 1_700_000_000_000)
    expect((await allow([alice.address.toUpperCase().replace('0X', '0x')])).statusCode).toBe(200)
    expect((await verify(alice)).res.statusCode).toBe(200)
    expect((await verify(bob)).res.statusCode).toBe(403)
  })

  it('open beta lets anyone in', async () => {
    t = await testApp({ config: config('false') }, 1_700_000_000_000)
    expect((await verify(bob)).res.statusCode).toBe(200)
  })

  it('admin allow is idempotent, counts only new rows and rejects malformed addresses', async () => {
    t = await testApp({}, 1_700_000_000_000)
    expect((await allow([alice.address, bob.address.toLowerCase()])).json()).toEqual({ added: 2 })
    expect((await allow([alice.address.toLowerCase(), alice.address])).json()).toEqual({ added: 0 })
    expect((await t.app.inject({ method: 'GET', url: '/admin/beta', headers: admin })).json()).toEqual({ count: 2 })
    expect((await allow(['0x123'])).statusCode).toBe(400)
    expect((await allow([alice.address, 'nope'])).statusCode).toBe(400)
    expect((await allow(Array.from({ length: 501 }, (_, i) => `0x${i.toString(16).padStart(40, '0')}`))).statusCode).toBe(400)
    expect((await t.app.inject({ method: 'GET', url: '/admin/beta', headers: admin })).json()).toEqual({ count: 2 })
    expect((await t.app.inject({ method: 'POST', url: '/admin/beta/allow', payload: { addresses: [] } })).statusCode).toBe(401)
  })

  it('existing sessions keep working while the beta is closed', async () => {
    t = await testApp({ config: config('false') }, 1_700_000_000_000)
    const { token } = await t.login(alice)
    t.deps.config.BETA_CLOSED = true
    expect((await t.app.inject({ method: 'GET', url: '/me', headers: bearer(token) })).statusCode).toBe(200)
    expect((await verify(bob)).res.statusCode).toBe(403)
  })
})
