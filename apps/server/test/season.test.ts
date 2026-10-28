import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { keccak256, type Hex } from 'viem'
import { MS_PER_DAY } from '@wyrmhaven/game-core'
import { AppError } from '../src/plugins/errors'
import { ensureCurrentSeason, getSeasonInfo, revealSecret, SEASON_MS } from '../src/services/season'
import { bearer, testApp, type TestApp } from './helpers/testApp'
import { TEST_KEYS, wallet } from './helpers/wallet'

const START = 1_700_000_000_000 // 2023-11-14T22:13:20Z
const MIDNIGHT = Math.floor(START / MS_PER_DAY) * MS_PER_DAY
let t: TestApp

beforeEach(async () => {
  t = await testApp({}, START)
})
afterEach(async () => {
  await t.close()
})

describe('seasons', () => {
  it('creates season 1 at UTC midnight with a commit and no reveal', async () => {
    const s = await ensureCurrentSeason(t.db, t.clock)
    expect(s.id).toBe(1)
    expect(s.startsAt.getTime()).toBe(MIDNIGHT)
    expect(s.endsAt.getTime()).toBe(MIDNIGHT + SEASON_MS)
    expect(s.commitHash).toMatch(/^0x[0-9a-f]{64}$/)
    expect(s.revealed).toBe(false)
    expect(await ensureCurrentSeason(t.db, t.clock)).toEqual(s)
    const info = await getSeasonInfo(t.db, t.clock)
    expect(info).toEqual({ id: 1, startsAtMs: MIDNIGHT, endsAtMs: MIDNIGHT + SEASON_MS, commitHash: s.commitHash, revealedSecret: null })
  })

  it('rolls to a new season after 14 days and keeps the old secret hidden', async () => {
    const s1 = await ensureCurrentSeason(t.db, t.clock)
    t.clock.set(MIDNIGHT + SEASON_MS)
    const s2 = await ensureCurrentSeason(t.db, t.clock)
    expect(s2.id).toBe(2)
    expect(s2.startsAt.getTime()).toBe(MIDNIGHT + SEASON_MS)
    expect(s2.commitHash).not.toBe(s1.commitHash)
    expect((await getSeasonInfo(t.db, t.clock)).id).toBe(2)
  })

  it('reveals only ended seasons and the reveal matches the commit', async () => {
    const s1 = await ensureCurrentSeason(t.db, t.clock)
    await expect(revealSecret(t.db, t.clock, 1)).rejects.toMatchObject(new AppError(409, 'SEASON_ACTIVE'))
    t.clock.set(MIDNIGHT + SEASON_MS)
    await ensureCurrentSeason(t.db, t.clock)
    const secret = await revealSecret(t.db, t.clock, 1)
    expect(keccak256(secret as Hex)).toBe(s1.commitHash)
    await expect(revealSecret(t.db, t.clock, 99)).rejects.toMatchObject(new AppError(404, 'NOT_FOUND'))
  })

  it('serves /season and /me.season, and action logs only to their owner', async () => {
    const alice = await t.login(wallet(TEST_KEYS.alice))
    const bob = await t.login(wallet(TEST_KEYS.bob))
    const season = await t.app.inject({ method: 'GET', url: '/season' })
    expect(season.statusCode).toBe(200)
    expect(season.json().id).toBe(1)
    const me = await t.app.inject({ method: 'GET', url: '/me', headers: bearer(alice.token) })
    expect(me.json().season.id).toBe(1)

    const own = await t.app.inject({ method: 'GET', url: `/season/1/actions?playerId=${alice.playerId}`, headers: bearer(alice.token) })
    expect(own.statusCode).toBe(200)
    expect(own.json()).toEqual({ actions: [] })
    const other = await t.app.inject({ method: 'GET', url: `/season/1/actions?playerId=${alice.playerId}`, headers: bearer(bob.token) })
    expect(other.statusCode).toBe(403)
    expect((await t.app.inject({ method: 'GET', url: `/season/1/actions?playerId=${alice.playerId}` })).statusCode).toBe(401)
  })
})
