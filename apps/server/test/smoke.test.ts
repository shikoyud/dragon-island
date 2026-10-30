import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Db } from '../src/db/client'
import { bearer, testApp, type TestApp } from './helpers/testApp'
import { TEST_KEYS, wallet } from './helpers/wallet'

let t: TestApp

beforeEach(async () => {
  t = await testApp({}, 1_700_000_000_000)
})
afterEach(async () => {
  await t.close()
})

describe('smoke', () => {
  it('runs the whole happy path on a fresh database', async () => {
    const { token } = await t.login(wallet(TEST_KEYS.alice))
    expect((await t.app.inject({ method: 'GET', url: '/me', headers: bearer(token) })).statusCode).toBe(200)
    t.clock.advance(10 * 60_000)
    const act = await t.app.inject({
      method: 'POST', url: '/actions', headers: bearer(token),
      payload: { action: { type: 'collectGold', habitatId: 'h1' }, idempotencyKey: 'smoke-1' },
    })
    expect(act.statusCode).toBe(200)
    expect(act.json().state.gold).toBe(1700)
    expect((await t.app.inject({ method: 'GET', url: '/season' })).statusCode).toBe(404)
    expect((await t.app.inject({ method: 'GET', url: '/health' })).json()).toEqual({ ok: true })
    expect((await t.app.inject({ method: 'GET', url: '/nope' })).statusCode).toBe(404)
  })

  it('health returns 503 when the database is down', async () => {
    // The real database object with every query rejecting, as a dropped connection would.
    const down = Object.assign(Object.create(t.db) as Db, { execute: () => Promise.reject(new Error('connection refused')) })
    const broken = await testApp({ db: down })
    try {
      const res = await broken.app.inject({ method: 'GET', url: '/health' })
      expect(res.statusCode).toBe(503)
      expect(res.json()).toEqual({ ok: false })
    } finally {
      await broken.close()
    }
  })
})
