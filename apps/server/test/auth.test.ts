import { newPlayer } from '@wyrmhaven/game-core'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { bearer, testApp, type TestApp } from './helpers/testApp'
import { signSiwe, TEST_KEYS, wallet } from './helpers/wallet'

const alice = wallet(TEST_KEYS.alice)
let t: TestApp

beforeEach(async () => {
  t = await testApp({}, 1_700_000_000_000)
})
afterEach(async () => {
  await t.close()
})

async function nonce() {
  const r = await t.app.inject({ method: 'GET', url: '/auth/nonce' })
  expect(r.statusCode).toBe(200)
  return r.json<{ nonce: string }>().nonce
}

describe('SIWE auth', () => {
  it('signs in and serves /me with a fresh player', async () => {
    const { token, playerId } = await t.login(alice)
    const me = await t.app.inject({ method: 'GET', url: '/me', headers: bearer(token) })
    expect(me.statusCode).toBe(200)
    const body = me.json()
    expect(body.playerId).toBe(playerId)
    expect(body.address).toBe(alice.address)
    expect(body.state).toEqual(newPlayer(t.clock()))
    expect(body.balanceWei).toBe('0')
    expect(body.earningUnlocked).toBe(false)
    expect(body.banned).toBe(false)
  })

  it('reuses the player on a second login', async () => {
    const a = await t.login(alice)
    const b = await t.login(alice)
    expect(b.playerId).toBe(a.playerId)
    expect(b.token).not.toBe(a.token)
  })

  it('rejects the wrong chain, a reused nonce, an expired nonce and a tampered signature', async () => {
    const n1 = await nonce()
    const wrongChain = await signSiwe(alice, n1, { chainId: 4663, issuedAt: new Date(t.clock()) })
    expect((await t.app.inject({ method: 'POST', url: '/auth/verify', payload: wrongChain })).statusCode).toBe(401)

    const good = await signSiwe(alice, n1, { issuedAt: new Date(t.clock()) })
    expect((await t.app.inject({ method: 'POST', url: '/auth/verify', payload: good })).statusCode).toBe(200)
    expect((await t.app.inject({ method: 'POST', url: '/auth/verify', payload: good })).statusCode).toBe(401)

    const n2 = await nonce()
    t.clock.advance(11 * 60_000)
    const late = await signSiwe(alice, n2, { issuedAt: new Date(t.clock()) })
    expect((await t.app.inject({ method: 'POST', url: '/auth/verify', payload: late })).statusCode).toBe(401)

    const n3 = await nonce()
    const ok = await signSiwe(alice, n3, { issuedAt: new Date(t.clock()) })
    // Corrupt a byte of r (the trailing v byte is just yParity and would recover the same signer).
    const flipped = (parseInt(ok.signature.slice(10, 12), 16) ^ 0xff).toString(16).padStart(2, '0')
    const tampered = { message: ok.message, signature: (ok.signature.slice(0, 10) + flipped + ok.signature.slice(12)) as `0x${string}` }
    expect((await t.app.inject({ method: 'POST', url: '/auth/verify', payload: tampered })).statusCode).toBe(401)
  })

  it('requires a session and honours logout', async () => {
    expect((await t.app.inject({ method: 'GET', url: '/me' })).statusCode).toBe(401)
    expect((await t.app.inject({ method: 'GET', url: '/me', headers: bearer('nope') })).statusCode).toBe(401)
    const { token } = await t.login(alice)
    expect((await t.app.inject({ method: 'POST', url: '/auth/logout', headers: bearer(token) })).statusCode).toBe(204)
    expect((await t.app.inject({ method: 'GET', url: '/me', headers: bearer(token) })).statusCode).toBe(401)
  })

  it('expires sessions', async () => {
    const { token } = await t.login(alice)
    t.clock.advance(8 * 86_400_000)
    expect((await t.app.inject({ method: 'GET', url: '/me', headers: bearer(token) })).statusCode).toBe(401)
  })

  it('rate-limits nonce requests per IP', async () => {
    for (let i = 0; i < 20; i++) expect((await t.app.inject({ method: 'GET', url: '/auth/nonce' })).statusCode).toBe(200)
    const r = await t.app.inject({ method: 'GET', url: '/auth/nonce' })
    expect(r.statusCode).toBe(429)
    expect(r.json()).toEqual({ error: 'RATE_LIMITED' })
    t.clock.advance(61_000)
    expect((await t.app.inject({ method: 'GET', url: '/auth/nonce' })).statusCode).toBe(200)
  })
})
