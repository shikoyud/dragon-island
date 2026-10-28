import { eq } from 'drizzle-orm'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { TASKS } from '../src/domain/tasks'
import { walletMessage } from '../src/domain/walletMessage'
import { loadConfig } from '../src/server/config'
import { entrants } from '../src/server/db/schema'
import * as handlers from '../src/server/handlers'
import { clientIp } from '../src/server/http'
import { FakeXClient } from '../src/server/x'
import { makeTestDeps } from './helpers'

type TD = Awaited<ReturnType<typeof makeTestDeps>>
let d: TD
let ip: string
let ipSeq = 0

beforeEach(async () => {
  d = await makeTestDeps()
  // The rate limiter is process-wide; a fresh IP per test keeps tests independent.
  ip = `10.0.${Math.floor(++ipSeq / 250)}.${ipSeq % 250}`
})
afterEach(async () => {
  await d.close()
})

const BASE = 'http://localhost:3000'
type Jar = Record<string, string>

function req(path: string, opts: { method?: string; jar?: Jar; body?: unknown; headers?: Record<string, string> } = {}) {
  const headers = new Headers({ 'x-forwarded-for': `${ip}, 192.168.0.1`, ...opts.headers })
  if (opts.jar && Object.keys(opts.jar).length > 0) {
    headers.set(
      'cookie',
      Object.entries(opts.jar)
        .map(([k, v]) => `${k}=${v}`)
        .join('; '),
    )
  }
  let body: string | undefined
  if (opts.body !== undefined) {
    body = typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body)
    headers.set('content-type', 'application/json')
  }
  return new Request(BASE + path, { method: opts.method ?? 'GET', headers, body })
}

/** Apply Set-Cookie headers to a jar; returns the raw Set-Cookie strings by cookie name. */
function absorb(res: Response, jar: Jar): Record<string, string> {
  const raw: Record<string, string> = {}
  for (const sc of res.headers.getSetCookie()) {
    const [pair] = sc.split(';')
    const i = pair!.indexOf('=')
    const name = pair!.slice(0, i)
    const value = pair!.slice(i + 1)
    raw[name] = sc
    if (value === '' || /max-age=0/i.test(sc)) delete jar[name]
    else jar[name] = value
  }
  return raw
}

async function signIn(jar: Jar, query = ''): Promise<Response> {
  const start = await handlers.authStart(d, req(`/api/auth/x${query}`))
  expect(start.status).toBe(302)
  absorb(start, jar)
  const loc = new URL(start.headers.get('location')!, BASE)
  const cb = await handlers.authCallback(d, req(`/api/auth/x/callback${loc.search}`, { jar }))
  absorb(cb, jar)
  return cb
}

const countEntrants = async () => (await d.db.select().from(entrants)).length

describe('auth start', () => {
  it('sets wh_oauth and redirects to X with PKCE S256', async () => {
    const res = await handlers.authStart(d, req('/api/auth/x'))
    expect(res.status).toBe(302)
    const raw = absorb(res, {})
    const cookie = raw['wh_oauth']!
    expect(cookie).toMatch(/HttpOnly/i)
    expect(cookie).toMatch(/SameSite=Lax/i)
    expect(cookie).toMatch(/Path=\//)
    expect(cookie).toMatch(/Max-Age=600/)
    expect(cookie).not.toMatch(/Secure/)
    const loc = new URL(res.headers.get('location')!, BASE)
    expect(loc.searchParams.get('state')!.length).toBeGreaterThanOrEqual(22)
  })

  it('the 21st start in a minute from one IP is 429', async () => {
    for (let i = 0; i < 20; i++) expect((await handlers.authStart(d, req('/api/auth/x'))).status).toBe(302)
    const res = await handlers.authStart(d, req('/api/auth/x'))
    expect(res.status).toBe(429)
    expect(await res.json()).toEqual({ error: 'RATE_LIMITED' })
    d.clock.advance(60_000)
    expect((await handlers.authStart(d, req('/api/auth/x'))).status).toBe(302)
  })
})

describe('auth callback', () => {
  it('creates the entrant, sets wh_session, clears wh_oauth and redirects to /#join', async () => {
    const jar: Jar = {}
    const start = await handlers.authStart(d, req('/api/auth/x'))
    absorb(start, jar)
    const loc = new URL(start.headers.get('location')!, BASE)
    const cb = await handlers.authCallback(d, req(`/api/auth/x/callback${loc.search}`, { jar }))
    expect(cb.status).toBe(302)
    expect(cb.headers.get('location')).toBe('/#join')
    const raw = absorb(cb, jar)
    expect(raw['wh_session']).toMatch(/HttpOnly/i)
    expect(raw['wh_session']).toMatch(/SameSite=Lax/i)
    expect(raw['wh_session']).toMatch(/Max-Age=2592000/)
    expect(raw['wh_oauth']).toMatch(/Max-Age=0/)
    expect(jar['wh_oauth']).toBeUndefined()
    expect(await countEntrants()).toBe(1)
  })

  it('error=access_denied redirects to /?x=denied#join and creates no entrant', async () => {
    const jar: Jar = {}
    absorb(await handlers.authStart(d, req('/api/auth/x')), jar)
    const res = await handlers.authCallback(d, req('/api/auth/x/callback?error=access_denied&state=s', { jar }))
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe('/?x=denied#join')
    expect(await countEntrants()).toBe(0)
  })

  it('a mismatched state redirects to /?x=error#join and creates no entrant', async () => {
    const jar: Jar = {}
    absorb(await handlers.authStart(d, req('/api/auth/x')), jar)
    const res = await handlers.authCallback(d, req('/api/auth/x/callback?state=forged&code=fake-code', { jar }))
    expect(res.headers.get('location')).toBe('/?x=error#join')
    expect(await countEntrants()).toBe(0)
  })

  it('a missing wh_oauth cookie redirects to /?x=error#join and creates no entrant', async () => {
    const start = await handlers.authStart(d, req('/api/auth/x'))
    const loc = new URL(start.headers.get('location')!, BASE)
    const res = await handlers.authCallback(d, req(`/api/auth/x/callback${loc.search}`))
    expect(res.headers.get('location')).toBe('/?x=error#join')
    expect(await countEntrants()).toBe(0)
  })

  it('a tampered wh_oauth cookie redirects to /?x=error#join', async () => {
    const jar: Jar = {}
    const start = await handlers.authStart(d, req('/api/auth/x'))
    absorb(start, jar)
    jar['wh_oauth'] = jar['wh_oauth']!.slice(0, -2) + 'xx'
    const loc = new URL(start.headers.get('location')!, BASE)
    const res = await handlers.authCallback(d, req(`/api/auth/x/callback${loc.search}`, { jar }))
    expect(res.headers.get('location')).toBe('/?x=error#join')
    expect(await countEntrants()).toBe(0)
  })

  it('an X failure redirects to /?x=error#join', async () => {
    d.x = new FakeXClient({ siteUrl: '' })
    d.x.me = async () => {
      throw new Error('X is down')
    }
    const res = await signIn({})
    expect(res.headers.get('location')).toBe('/?x=error#join')
    expect(await countEntrants()).toBe(0)
  })

  it('a too-new X account redirects to /?x=too_new#join', async () => {
    d.x = new FakeXClient({ siteUrl: '', profile: { createdAt: new Date(d.clock.now().getTime() - 86_400_000) } })
    const jar: Jar = {}
    const res = await signIn(jar)
    expect(res.headers.get('location')).toBe('/?x=too_new#join')
    expect(jar['wh_session']).toBeUndefined()
    expect(await countEntrants()).toBe(0)
  })

  it('?ref=CODE on auth start reaches upsertFromX', async () => {
    const a: Jar = {}
    await signIn(a)
    const refCode = ((await (await handlers.me(d, req('/api/me', { jar: a }))).json()) as { refCode: string }).refCode
    d.x = new FakeXClient({ siteUrl: '', profile: { id: '2002', username: 'tide' } })
    await signIn({}, `?ref=${refCode}`)
    const [referrer] = await d.db.select().from(entrants).where(eq(entrants.refCode, refCode))
    const [b] = await d.db.select().from(entrants).where(eq(entrants.xUserId, '2002'))
    expect(b!.referredBy).toBe(referrer!.id)
  })
})

describe('authed routes', () => {
  it('full happy path: tasks, nonce, wallet, join, /me shows the position', async () => {
    const jar: Jar = {}
    await signIn(jar)

    for (const task of TASKS) {
      const open = await handlers.openTask(d, req(`/api/tasks/${task}/open`, { method: 'POST', jar }), { task })
      expect(open.status).toBe(200)
    }
    const early = await handlers.confirmTask(d, req('/api/tasks/follow/confirm', { method: 'POST', jar }), {
      task: 'follow',
    })
    expect(early.status).toBe(409)
    expect(await early.json()).toEqual({ error: 'TOO_EARLY' })

    const notReady = await handlers.join(d, req('/api/join', { method: 'POST', jar }))
    expect(notReady.status).toBe(409)
    expect(await notReady.json()).toEqual({ error: 'TASKS_INCOMPLETE' })

    d.clock.advance(15_000)
    for (const task of TASKS) {
      const res = await handlers.confirmTask(d, req(`/api/tasks/${task}/confirm`, { method: 'POST', jar }), { task })
      expect(res.status).toBe(200)
      expect(await res.json()).toEqual({ confirmedAt: d.clock.now().toISOString() })
    }

    const nonceRes = await handlers.walletNonce(d, req('/api/wallet/nonce', { jar }))
    expect(nonceRes.status).toBe(200)
    const { nonce } = (await nonceRes.json()) as { nonce: string }
    const acct = privateKeyToAccount(generatePrivateKey())
    const me0 = (await (await handlers.me(d, req('/api/me', { jar }))).json()) as { handle: string }
    const signature = await acct.signMessage({ message: walletMessage(me0.handle, acct.address, nonce) })
    const bind = await handlers.wallet(d, req('/api/wallet', { method: 'POST', jar, body: { address: acct.address, signature, nonce } }))
    expect(bind.status).toBe(200)
    expect(await bind.json()).toEqual({ wallet: acct.address.toLowerCase() })

    const joined = await handlers.join(d, req('/api/join', { method: 'POST', jar }))
    expect(joined.status).toBe(200)
    expect(await joined.json()).toEqual({ position: 1 })

    const me = await handlers.me(d, req('/api/me', { jar }))
    expect(me.status).toBe(200)
    const state = (await me.json()) as { position: number; wallet: string }
    expect(state.position).toBe(1)
    expect(state.wallet).toBe(acct.address.toLowerCase())

    const stats = await handlers.stats(d, req('/api/stats'))
    expect(stats.headers.get('cache-control')).toBe('public, s-maxage=60')
    expect(await stats.json()).toEqual({ joined: 1 })
  })

  it('/me without a session is 401', async () => {
    const res = await handlers.me(d, req('/api/me'))
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'UNAUTHORIZED' })
  })

  it('a forged session is 401', async () => {
    const res = await handlers.me(d, req('/api/me', { jar: { wh_session: 'not.a.jwt' } }))
    expect(res.status).toBe(401)
  })

  it('a session signed with another secret is 401', async () => {
    const jar: Jar = {}
    const other = { ...d, config: loadConfig({ SESSION_SECRET: 'another-secret-another-secret-12345' }) }
    const start = await handlers.authStart(other, req('/api/auth/x'))
    absorb(start, jar)
    const loc = new URL(start.headers.get('location')!, BASE)
    absorb(await handlers.authCallback(other, req(`/api/auth/x/callback${loc.search}`, { jar })), jar)
    expect((await handlers.me(d, req('/api/me', { jar }))).status).toBe(401)
  })

  it('an expired session (after 30 days) is 401', async () => {
    const jar: Jar = {}
    await signIn(jar)
    d.clock.advance(30 * 86_400_000 + 1000)
    expect((await handlers.me(d, req('/api/me', { jar }))).status).toBe(401)
  })

  it('a session for a deleted entrant is 401 on every authed route', async () => {
    const jar: Jar = {}
    await signIn(jar)
    await d.db.delete(entrants)
    const calls = [
      handlers.me(d, req('/api/me', { jar })),
      handlers.openTask(d, req('/api/tasks/follow/open', { method: 'POST', jar }), { task: 'follow' }),
      handlers.confirmTask(d, req('/api/tasks/follow/confirm', { method: 'POST', jar }), { task: 'follow' }),
      handlers.walletNonce(d, req('/api/wallet/nonce', { jar })),
      handlers.wallet(d, req('/api/wallet', { method: 'POST', jar, body: { address: '0x', signature: '0x00', nonce: 'n' } })),
      handlers.join(d, req('/api/join', { method: 'POST', jar })),
    ]
    for (const res of await Promise.all(calls)) {
      expect(res.status).toBe(401)
      expect(await res.json()).toEqual({ error: 'UNAUTHORIZED' })
    }
  })

  it('an unknown task path is 400', async () => {
    const jar: Jar = {}
    await signIn(jar)
    const open = await handlers.openTask(d, req('/api/tasks/dance/open', { method: 'POST', jar }), { task: 'dance' })
    expect(open.status).toBe(400)
    expect(await open.json()).toEqual({ error: 'BAD_REQUEST' })
    const confirm = await handlers.confirmTask(d, req('/api/tasks/dance/confirm', { method: 'POST', jar }), {
      task: 'dance',
    })
    expect(confirm.status).toBe(400)
  })

  it('confirm before open is TASK_NOT_OPENED 409', async () => {
    const jar: Jar = {}
    await signIn(jar)
    const res = await handlers.confirmTask(d, req('/api/tasks/like/confirm', { method: 'POST', jar }), { task: 'like' })
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: 'TASK_NOT_OPENED' })
  })

  it('wallet body failing validation is BAD_REQUEST', async () => {
    const jar: Jar = {}
    await signIn(jar)
    const bodies = [
      'not json',
      {},
      { address: '0xabc', signature: 'zz', nonce: 'n' },
      { address: 1, signature: '0x00', nonce: 'n' },
      { address: '0xabc', signature: '0x00' },
    ]
    for (const body of bodies) {
      const res = await handlers.wallet(d, req('/api/wallet', { method: 'POST', jar, body }))
      expect(res.status).toBe(400)
      expect(await res.json()).toEqual({ error: 'BAD_REQUEST' })
    }
  })

  it('wallet bound to another X account is WALLET_TAKEN 409', async () => {
    const acct = privateKeyToAccount(generatePrivateKey())
    const bindAs = async (jar: Jar, handle: string) => {
      const { nonce } = (await (await handlers.walletNonce(d, req('/api/wallet/nonce', { jar }))).json()) as {
        nonce: string
      }
      const signature = await acct.signMessage({ message: walletMessage(handle, acct.address, nonce) })
      return handlers.wallet(d, req('/api/wallet', { method: 'POST', jar, body: { address: acct.address, signature, nonce } }))
    }
    const a: Jar = {}
    d.x = new FakeXClient({ siteUrl: '', profile: { id: '3001', username: 'ember' } })
    await signIn(a)
    expect((await bindAs(a, 'ember')).status).toBe(200)
    const b: Jar = {}
    d.x = new FakeXClient({ siteUrl: '', profile: { id: '3002', username: 'tide' } })
    await signIn(b)
    const res = await bindAs(b, 'tide')
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: 'WALLET_TAKEN' })
  })

  it('the 11th join in a minute from one IP is 429', async () => {
    const jar: Jar = {}
    await signIn(jar)
    for (let i = 0; i < 10; i++) expect((await handlers.join(d, req('/api/join', { method: 'POST', jar }))).status).toBe(409)
    expect((await handlers.join(d, req('/api/join', { method: 'POST', jar }))).status).toBe(429)
  })

  it('logout clears the session cookie', async () => {
    const jar: Jar = {}
    await signIn(jar)
    const res = await handlers.logout(d, req('/api/auth/logout', { method: 'POST', jar }))
    expect(res.status).toBe(200)
    const raw = absorb(res, jar)
    expect(raw['wh_session']).toMatch(/Max-Age=0/)
    expect((await handlers.me(d, req('/api/me', { jar }))).status).toBe(401)
  })
})

describe('admin export', () => {
  const withToken = (token?: string) => ({
    ...d,
    config: loadConfig({ SESSION_SECRET: 'test-secret-test-secret-test-secret!', ADMIN_TOKEN: token }),
  })

  it('is 401 without or with a wrong token, CSV with the right one', async () => {
    const deps = withToken('s3cret-admin-token')
    expect((await handlers.adminExport(deps, req('/api/admin/export'))).status).toBe(401)
    const wrong = await handlers.adminExport(deps, req('/api/admin/export', { headers: { authorization: 'Bearer nope' } }))
    expect(wrong.status).toBe(401)
    expect(await wrong.json()).toEqual({ error: 'UNAUTHORIZED' })
    const ok = await handlers.adminExport(
      deps,
      req('/api/admin/export', { headers: { authorization: 'Bearer s3cret-admin-token' } }),
    )
    expect(ok.status).toBe(200)
    expect(ok.headers.get('content-type')).toMatch(/^text\/csv/)
    expect((await ok.text()).split('\n')[0]).toMatch(/^position,handle,wallet/)
  })

  it('is 401 when ADMIN_TOKEN is unset, even with an empty bearer', async () => {
    const deps = withToken(undefined)
    const res = await handlers.adminExport(deps, req('/api/admin/export', { headers: { authorization: 'Bearer ' } }))
    expect(res.status).toBe(401)
  })
})

describe('clientIp', () => {
  const h = (headers: Record<string, string>) => new Request(BASE, { headers })
  it('prefers the first x-forwarded-for entry, then x-real-ip, then unknown', () => {
    expect(clientIp(h({ 'x-forwarded-for': ' 1.2.3.4 , 5.6.7.8', 'x-real-ip': '9.9.9.9' }))).toBe('1.2.3.4')
    expect(clientIp(h({ 'x-real-ip': '9.9.9.9' }))).toBe('9.9.9.9')
    expect(clientIp(h({}))).toBe('unknown')
  })
})
