import { sql } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { createPgliteDb } from '../src/db/client'
import { runMigrations } from '../src/scripts/migrate'

describe('db:migrate script', () => {
  it('refuses to run without DATABASE_URL and never connects', async () => {
    let connected = false
    const connect = () => { connected = true; throw new Error('should not connect') }
    await expect(runMigrations({}, connect)).rejects.toThrow(/DATABASE_URL is required/)
    await expect(runMigrations({ DATABASE_URL: '' }, connect)).rejects.toThrow(/DATABASE_URL is required/)
    expect(connected).toBe(false)
  })

  it('applies the migrations to the database at DATABASE_URL and closes the connection', async () => {
    const { db, close } = await createPgliteDb()
    let seenUrl: string | undefined
    let closed = false
    await runMigrations({ DATABASE_URL: 'postgres://example/db' }, url => {
      seenUrl = url
      return { db, close: async () => { closed = true } }
    })
    expect(seenUrl).toBe('postgres://example/db')
    expect(closed).toBe(true)
    const rows = await db.execute(sql`select count(*)::int as n from players`)
    expect((rows as unknown as { rows: { n: number }[] }).rows[0]!.n).toBe(0)
    await close()
  })

  it('closes the connection when a migration fails', async () => {
    const { db, close } = await createPgliteDb()
    await close() // a closed client makes migrate throw
    let closed = false
    await expect(runMigrations({ DATABASE_URL: 'postgres://example/db' }, () => ({ db, close: async () => { closed = true } }))).rejects.toThrow()
    expect(closed).toBe(true)
  })
})
