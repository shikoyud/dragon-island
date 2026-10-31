import { newPlayer, type PlayerState } from '@wyrmhaven/game-core'
import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { loadConfig } from '../src/config'
import { balances, players } from '../src/db/schema'
import { FixedPriceSource } from '../src/services/price'
import { bearer, testApp, type TestApp } from './helpers/testApp'
import { TEST_KEYS, wallet } from './helpers/wallet'

const E18 = 10n ** 18n
const ANVIL_1 = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d'
const base = { SESSION_SECRET: 's'.repeat(32), ADMIN_TOKEN: 'a'.repeat(32) }

describe('I6: E2E mode cannot run against anything real', () => {
  it('refuses E2E=1 with a non-anvil signer, a database url, or NODE_ENV=production', () => {
    expect(() => loadConfig({ ...base, E2E: '1', SIGNER_PRIVATE_KEY: `0x${'ab'.repeat(32)}` })).toThrow(/E2E/)
    expect(() => loadConfig({ ...base, E2E: '1', DATABASE_URL: 'postgres://real' })).toThrow(/E2E/)
    expect(() => loadConfig({ ...base, E2E: '1', NODE_ENV: 'production' })).toThrow(/E2E/)
    expect(loadConfig({ ...base, E2E: '1', SIGNER_PRIVATE_KEY: ANVIL_1 }).E2E).toBe('1')
    expect(loadConfig({ ...base, E2E: '1' }).E2E).toBe('1')
  })
})

describe('I5: pve battles fall back to the AI for missing moves instead of forfeiting', () => {
  let t: TestApp
  beforeEach(async () => { t = await testApp({}, 1_000) })
  afterEach(async () => { await t.close() })

  it('wins stage 1 with a one-move list', async () => {
    const { token, playerId } = await t.login(wallet(TEST_KEYS.alice))
    const TEAM = ['d1', 'd2', 'd3']
    const [p] = await t.db.select().from(players).where(eq(players.id, playerId))
    await t.db.update(players).set({
      state: { ...(p!.state as PlayerState), level: 8, dragons: TEAM.map(id => ({ id, speciesId: 'sea', level: 20, feeds: 0, habitatId: 'h2' })) }, level: 8,
    }).where(eq(players.id, playerId))
    const r = await t.app.inject({ method: 'POST', url: '/actions', headers: bearer(token), payload: { action: { type: 'pveBattle', stage: 1, team: TEAM, moves: [{ kind: 'attack', move: 1 }] }, idempotencyKey: 'k' } })
    expect(r.statusCode).toBe(200)
    expect(r.json().battle.winner).toBe('attacker')
    expect(r.json().state.pve.cleared).toBe(1)
  })
})
