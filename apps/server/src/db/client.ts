import { PGlite } from '@electric-sql/pglite'
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite'
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres'
import { migrate as migratePglite } from 'drizzle-orm/pglite/migrator'
import { migrate as migratePg } from 'drizzle-orm/node-postgres/migrator'
import { Pool } from 'pg'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import * as schema from './schema'

export type Db = ReturnType<typeof drizzlePglite<typeof schema>> | ReturnType<typeof drizzlePg<typeof schema>>
/** A transaction handle; same query API as Db. */
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0]

const migrationsFolder = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'drizzle')

/** In-memory (or file-backed) Postgres for tests and local development. */
export async function createPgliteDb(dataDir?: string): Promise<{ db: Db; close: () => Promise<void> }> {
  const client = dataDir ? new PGlite(dataDir) : new PGlite()
  await client.waitReady
  const db = drizzlePglite(client, { schema })
  return { db, close: () => client.close() }
}

export function createPgDb(url: string): { db: Db; close: () => Promise<void> } {
  const pool = new Pool({ connectionString: url })
  return { db: drizzlePg(pool, { schema }), close: () => pool.end() }
}

export async function migrate(db: Db): Promise<void> {
  if ('$client' in db && db.$client instanceof PGlite) {
    await migratePglite(db as ReturnType<typeof drizzlePglite<typeof schema>>, { migrationsFolder })
  } else {
    await migratePg(db as ReturnType<typeof drizzlePg<typeof schema>>, { migrationsFolder })
  }
}
