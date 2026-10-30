import { afterEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { privateKeyToAccount } from 'viem/accounts'
import { loadConfig } from '../src/config'
import { game } from '../src/db/schema'
import { ensureGame } from '../src/services/game'
import { TEST_ADMIN_TOKEN, TEST_SIGNER_KEY, TEST_VAULT, bearer, testApp, type TestApp } from './helpers/testApp'

const DAY = 86_400_000
const LAUNCH = Date.UTC(2026, 10, 1)
const base = { SESSION_SECRET: 't'.repeat(32), ADMIN_TOKEN: TEST_ADMIN_TOKEN, SIGNER_PRIVATE_KEY: TEST_SIGNER_KEY, VAULT_ADDRESS: TEST_VAULT }
const player = privateKeyToAccount('0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a')

let t: TestApp | undefined
afterEach(async () => { await t?.close(); t = undefined })

describe('GET /game', () => {
  it('reports day, phase and preset from LAUNCH_AT, and /me carries the same game', async () => {
    const config = loadConfig({ ...base, LAUNCH_AT: new Date(LAUNCH).toISOString() })
    t = await testApp({ config }, LAUNCH + 5 * DAY)
    const g = await ensureGame(t.db, t.clock)
    const res = await t.app.inject({ method: 'GET', url: '/game' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({
      launchAtMs: LAUNCH, preset: 'flash14', day: 6, phase: 'endgame', commitHash: g.commitHash, revealedSecret: null,
    })
    const { token } = await t.login(player)
    const me = await t.app.inject({ method: 'GET', url: '/me', headers: bearer(token) })
    expect(me.json().game).toEqual(res.json())
  })

  it('without LAUNCH_AT the launch time is the game row created_at, and the row is created on demand', async () => {
    t = await testApp({}, 1_000_000)
    const res = await t.app.inject({ method: 'GET', url: '/game' })
    expect(res.json()).toMatchObject({ launchAtMs: 1_000_000, day: 1, phase: 'rush' })
    t.clock.set(1_000_000 + 13 * DAY)
    expect((await t.app.inject({ method: 'GET', url: '/game' })).json()).toMatchObject({ day: 14, phase: 'finals' })
  })

  it('is prelaunch (day 0) before LAUNCH_AT', async () => {
    const config = loadConfig({ ...base, LAUNCH_AT: new Date(LAUNCH).toISOString() })
    t = await testApp({ config }, LAUNCH - 1)
    expect((await t.app.inject({ method: 'GET', url: '/game' })).json()).toMatchObject({ day: 0, phase: 'prelaunch' })
  })

  it('a Flash-28 server plants a Dragon Bush that is ready in 20 s (30 s / 1.5)', async () => {
    const config = loadConfig({ ...base, PRESET: 'flash28', LAUNCH_AT: new Date(LAUNCH).toISOString() })
    const now = LAUNCH + DAY
    t = await testApp({ config }, now)
    const { token } = await t.login(player)
    const res = await t.app.inject({
      method: 'POST', url: '/actions', headers: bearer(token),
      payload: { action: { type: 'plant', plot: 0, crop: 'dragonBush' }, idempotencyKey: 'flash28-plant' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().state.farms[0]).toMatchObject({ crop: 'dragonBush', readyAtMs: now + 20_000 })
  })

  it('uses the flash28 preset when PRESET says so', async () => {
    const config = loadConfig({ ...base, PRESET: 'flash28', LAUNCH_AT: new Date(LAUNCH).toISOString() })
    t = await testApp({ config }, LAUNCH + 5 * DAY)
    expect((await t.app.inject({ method: 'GET', url: '/game' })).json()).toMatchObject({ preset: 'flash28', day: 6, phase: 'rush' })
  })

  it('never shows the secret before reveal, in /game or /me; shows it once revealed', async () => {
    t = await testApp()
    const g = await ensureGame(t.db, t.clock)
    const { token } = await t.login(player)
    const before = [
      (await t.app.inject({ method: 'GET', url: '/game' })).body,
      (await t.app.inject({ method: 'GET', url: '/me', headers: bearer(token) })).body,
    ]
    for (const body of before) expect(body).not.toContain(g.secretHex.slice(2))
    await t.db.update(game).set({ revealed: true }).where(eq(game.id, 1))
    const after = (await t.app.inject({ method: 'GET', url: '/game' })).json()
    expect(after.revealedSecret).toBe(g.secretHex)
  })
})

describe('config', () => {
  it('defaults PRESET to flash14 and rejects unknown presets and non-ISO LAUNCH_AT', () => {
    expect(loadConfig(base).PRESET).toBe('flash14')
    expect(() => loadConfig({ ...base, PRESET: 'flash7' })).toThrow()
    expect(() => loadConfig({ ...base, LAUNCH_AT: 'tomorrow' })).toThrow()
  })
})
