import { createPgliteDb, migrate, type Db } from '../../src/db/client'

/** Fresh in-memory Postgres (PGlite) with all migrations applied. */
export async function testDb(): Promise<{ db: Db; close: () => Promise<void> }> {
  const { db, close } = await createPgliteDb()
  await migrate(db)
  return { db, close }
}
