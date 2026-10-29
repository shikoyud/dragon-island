import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { fixedClock } from '../src/clock'
import type { Db } from '../src/db/client'
import { prune } from '../src/jobs/prune'
import { actionLog, battleOffers, players, rateLimits, seasons, siweNonces } from '../src/db/schema'
import { testDb } from './helpers/testDb'

const NOW = Date.UTC(2026, 9, 29, 12)
const DAY = 86_400_000
let db: Db
let close: () => Promise<void>

beforeAll(async () => {
  ;({ db, close } = await testDb())
})
afterAll(async () => {
  await close()
})
beforeEach(async () => {
  ;({ db, close } = await testDb())
})

describe('prune', () => {
  it('deletes expired nonces, old rate-limit windows and offers expired over 7 days ago; keeps the rest', async () => {
    await db.insert(siweNonces).values([
      { nonce: 'old', expiresAt: new Date(NOW - 1) },
      { nonce: 'fresh', expiresAt: new Date(NOW + 60_000) },
    ])
    await db.insert(rateLimits).values([
      { key: 'auth:1.2.3.4', windowStart: new Date(NOW - DAY - 1), count: 3 },
      { key: 'auth:5.6.7.8', windowStart: new Date(NOW - DAY + 60_000), count: 3 },
    ])
    const [p] = await db.insert(players).values({ address: '0xprune', state: {} }).returning()
    const offer = (expiresAt: number, usedAt?: number) => ({
      playerId: p!.id, opponent: {}, seedHex: '0x01', expiresAt: new Date(expiresAt), usedAt: usedAt ? new Date(usedAt) : null,
    })
    const rows = await db.insert(battleOffers).values([
      offer(NOW - 7 * DAY - 1), // unused, old: goes
      offer(NOW - 8 * DAY, NOW - 8 * DAY), // used, old: goes
      offer(NOW - 7 * DAY + 60_000), // recent expiry: stays
      offer(NOW + 60_000), // live: stays
    ]).returning()

    const res = await prune({ db, clock: fixedClock(NOW) })
    expect(res).toEqual({ nonces: 1, rateLimits: 1, offers: 2 })
    expect((await db.select().from(siweNonces)).map(r => r.nonce)).toEqual(['fresh'])
    expect((await db.select().from(rateLimits)).map(r => r.key)).toEqual(['auth:5.6.7.8'])
    const left = (await db.select().from(battleOffers)).map(r => r.id).sort()
    expect(left).toEqual([rows[2]!.id, rows[3]!.id].sort())
  })

  it('keeps the battle seed in the action log after its offer is pruned', async () => {
    const [p] = await db.insert(players).values({ address: '0xprune2', state: {} }).returning()
    const [o] = await db.insert(battleOffers).values({
      playerId: p!.id, opponent: {}, seedHex: '0xabc', expiresAt: new Date(NOW - 9 * DAY), usedAt: new Date(NOW - 9 * DAY),
    }).returning()
    const [season] = await db.insert(seasons).values({
      startsAt: new Date(NOW - 20 * DAY), endsAt: new Date(NOW + DAY), secretHex: '0x00', commitHash: '0x00',
    }).returning()
    await db.insert(actionLog).values({
      playerId: p!.id, nonce: 1n, idempotencyKey: 'k1', seasonId: season!.id, seedHex: '0xabc', seedLabel: `battle:${o!.id}`,
      action: { type: 'battle', offerId: o!.id }, status: 200, response: {}, createdAt: new Date(NOW - 9 * DAY),
    })
    expect((await prune({ db, clock: fixedClock(NOW) })).offers).toBe(1)
    const [log] = await db.select().from(actionLog).where(eq(actionLog.playerId, p!.id))
    expect(log!.seedHex).toBe('0xabc')
  })

  it('is a no-op on empty tables', async () => {
    expect(await prune({ db, clock: fixedClock(NOW) })).toEqual({ nonces: 0, rateLimits: 0, offers: 0 })
  })
})
