import { sql } from 'drizzle-orm'
import { createPgliteDb, migrate, type Db } from '../../src/db/client'

let shared: Promise<{ db: Db; close: () => Promise<void> }> | null = null

/**
 * One PGlite per test file (booting WASM Postgres costs seconds); each call wipes every table so
 * tests start from an empty database. `close` is a no-op here; the instance dies with the worker.
 */
export async function testDb(): Promise<{ db: Db; close: () => Promise<void> }> {
  shared ??= (async () => {
    const { db, close } = await createPgliteDb()
    await migrate(db)
    return { db, close }
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
