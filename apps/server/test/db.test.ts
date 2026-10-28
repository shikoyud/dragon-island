import { eq, sql } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Db } from '../src/db/client'
import { balances, players } from '../src/db/schema'
import { fixedClock, stepClock } from '../src/clock'
import { loadConfig } from '../src/config'
import { testDb } from './helpers/testDb'

let db: Db
let close: () => Promise<void>

beforeAll(async () => {
  ;({ db, close } = await testDb())
})
afterAll(async () => {
  await close()
})

describe('db layer', () => {
  it('migrates and stores a player', async () => {
    const [p] = await db.insert(players).values({ address: '0xabc', state: { gold: 1 } }).returning()
    expect(p!.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(p!.actionNonce).toBe(0n)
    expect(p!.state).toEqual({ gold: 1 })
  })

  it('round-trips large bigints in numeric columns', async () => {
    const [p] = await db.insert(players).values({ address: '0xbig', state: {} }).returning()
    await db.insert(balances).values({ playerId: p!.id, tokenWei: 2n ** 70n })
    const [b] = await db.select().from(balances).where(eq(balances.playerId, p!.id))
    expect(b!.tokenWei).toBe(2n ** 70n)
    expect(b!.depositedWei).toBe(0n)
  })

  it('serialises writers with SELECT ... FOR UPDATE', async () => {
    const [p] = await db.insert(players).values({ address: '0xlock', state: { n: 0 } }).returning()
    const order: string[] = []
    let releaseFirst!: () => void
    const firstHolds = new Promise<void>(r => (releaseFirst = r))

    const t1 = db.transaction(async tx => {
      await tx.execute(sql`select 1 from players where id = ${p!.id} for update`)
      order.push('t1 locked')
      await firstHolds
      await tx.update(players).set({ state: { n: 1 } }).where(eq(players.id, p!.id))
      order.push('t1 done')
    })
    await new Promise(r => setTimeout(r, 50))
    const t2 = db.transaction(async tx => {
      await tx.execute(sql`select 1 from players where id = ${p!.id} for update`)
      order.push('t2 locked')
      const [row] = await tx.select().from(players).where(eq(players.id, p!.id))
      expect(row!.state).toEqual({ n: 1 })
    })
    await new Promise(r => setTimeout(r, 50))
    expect(order).toEqual(['t1 locked'])
    releaseFirst()
    await Promise.all([t1, t2])
    expect(order).toEqual(['t1 locked', 't1 done', 't2 locked'])
  })
})

describe('clock and config', () => {
  it('provides fixed and stepping clocks', () => {
    expect(fixedClock(5)()).toBe(5)
    const c = stepClock(10, 2)
    expect([c(), c(), c()]).toEqual([10, 12, 14])
  })

  it('parses config with defaults and rejects a bad chain id', () => {
    const cfg = loadConfig({ SESSION_SECRET: 's'.repeat(32), ADMIN_TOKEN: 'a' })
    expect(cfg.CHAIN_ID).toBe(46630)
    expect(cfg.CONFIRMATIONS).toBe(1)
    expect(cfg.PORT).toBe(3000)
    expect(() => loadConfig({ SESSION_SECRET: 's'.repeat(32), ADMIN_TOKEN: 'a', CHAIN_ID: '4663' })).toThrow()
  })
})
