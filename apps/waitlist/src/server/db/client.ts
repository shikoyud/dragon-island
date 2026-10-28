import { PGlite } from '@electric-sql/pglite'
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite'
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres'
import { migrate as migratePglite } from 'drizzle-orm/pglite/migrator'
import { migrate as migratePg } from 'drizzle-orm/node-postgres/migrator'
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'
import { Pool } from 'pg'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import * as schema from './schema'

/** One database type for both drivers, so query builders type-check identically. */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>
/** A transaction handle; same query API as Db. */
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0]
type PgliteDb = ReturnType<typeof drizzlePglite<typeof schema>>
type NodePgDb = ReturnType<typeof drizzlePg<typeof schema>>

const migrationsFolder = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'drizzle')

/** In-memory (or file-backed) Postgres for tests and local development. */
export async function createPgliteDb(dataDir?: string): Promise<{ db: Db; close: () => Promise<void> }> {
  const client = dataDir ? new PGlite(dataDir) : new PGlite()
  await client.waitReady
  const db = drizzlePglite(client, { schema }) as unknown as Db
  return { db, close: () => client.close() }
}

export function createPgDb(url: string): { db: Db; close: () => Promise<void> } {
  const pool = new Pool({ connectionString: url })
  return { db: drizzlePg(pool, { schema }) as unknown as Db, close: () => pool.end() }
}

export async function migrate(db: Db): Promise<void> {
  const client = (db as unknown as { $client?: unknown }).$client
  if (client instanceof PGlite) {
    await migratePglite(db as unknown as PgliteDb, { migrationsFolder })
  } else {
    await migratePg(db as unknown as NodePgDb, { migrationsFolder })
  }
}
