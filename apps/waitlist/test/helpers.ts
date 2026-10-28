import { createPgliteDb, migrate, type Db } from '../src/server/db/client'

/** A fresh, migrated in-memory Postgres. */
export async function makeTestDb(): Promise<{ db: Db; close(): Promise<void> }> {
  const { db, close } = await createPgliteDb()
  await migrate(db)
  return { db, close }
}
