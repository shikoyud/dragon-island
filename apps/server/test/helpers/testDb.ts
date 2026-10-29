import { sql } from 'drizzle-orm'
import { afterAll } from 'vitest'
import { createPgDb, createPgliteDb, migrate, type Db } from '../../src/db/client'

type Handle = { db: Db; close: () => Promise<void> }
let shared: Promise<Handle> | null = null

// With TEST_DATABASE_URL set the suite runs on real Postgres (CI: server-postgres job). Registered at
// import time (collection phase), so the pool is ended once per test file and the worker can exit.
if (process.env.TEST_DATABASE_URL) {
  afterAll(async () => {
    const h = shared
    shared = null
    if (h) await (await h).close()
  })
}

/**
 * One database handle per test file; each call wipes every table so tests start from an empty database.
 * Default: in-process PGlite (booting WASM Postgres costs seconds). With TEST_DATABASE_URL: a pg Pool on that
 * database, migrated once per file. All files share that one database, so they must run serially
 * (vitest.config.ts keeps fileParallelism false). The returned `close` is a no-op per call.
 */
export async function testDb(): Promise<{ db: Db; close: () => Promise<void> }> {
  shared ??= (async () => {
    const url = process.env.TEST_DATABASE_URL
    const h = url ? createPgDb(url) : await createPgliteDb()
    await migrate(h.db)
    return h
  })()
  const { db } = await shared
  await db.execute(sql`
    do $$ declare r record; begin
      for r in select tablename from pg_tables where schemaname = 'public' and tablename <> '__drizzle_migrations' loop
        execute 'truncate table ' || quote_ident(r.tablename) || ' restart identity cascade';
      end loop;
    end $$;
  `)
  return { db, close: async () => {} }
}
