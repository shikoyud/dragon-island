import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { sql } from 'drizzle-orm'
import { entrants } from '../src/server/db/schema'
import type { Db } from '../src/server/db/client'
import { makeTestDb } from './helpers'

let db: Db
let close: () => Promise<void>
beforeAll(async () => {
  const t = await makeTestDb()
  db = t.db
  close = t.close
})
afterAll(() => close())

const row = (n: number, extra: Partial<typeof entrants.$inferInsert> = {}): typeof entrants.$inferInsert => ({
  xUserId: `u${n}`,
  xHandle: `h${n}`,
  xName: `n${n}`,
  xCreatedAt: new Date('2020-01-01T00:00:00Z'),
  element: 'fire',
  refCode: `ref${n}`,
  ...extra,
})

describe('schema', () => {
  it('rejects a duplicate x_user_id', async () => {
    await db.insert(entrants).values(row(1))
    await expect(db.insert(entrants).values(row(2, { xUserId: 'u1' }))).rejects.toThrow()
  })
  it('rejects a duplicate wallet', async () => {
    await db.insert(entrants).values(row(3, { wallet: '0xabc' }))
    await expect(db.insert(entrants).values(row(4, { wallet: '0xabc' }))).rejects.toThrow()
  })
  it('waitlist_position_seq counts 1 then 2', async () => {
    const a = await db.execute(sql`select nextval('waitlist_position_seq')::int as n`)
    const b = await db.execute(sql`select nextval('waitlist_position_seq')::int as n`)
    expect((a as unknown as { rows: { n: number }[] }).rows[0]!.n).toBe(1)
    expect((b as unknown as { rows: { n: number }[] }).rows[0]!.n).toBe(2)
  })
})
