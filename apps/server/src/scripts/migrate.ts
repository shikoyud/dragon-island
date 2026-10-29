import { fileURLToPath } from 'node:url'
import { createPgDb, migrate, type Db } from '../db/client'

type Connect = (url: string) => { db: Db; close: () => Promise<void> }

/** Applies the drizzle migrations to the Postgres at DATABASE_URL. Refuses to fall back to PGlite. */
export async function runMigrations(env: Record<string, string | undefined>, connect: Connect = createPgDb): Promise<void> {
  const url = env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is required')
  const { db, close } = connect(url)
  try {
    await migrate(db)
  } finally {
    await close()
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  runMigrations(process.env).then(
    () => console.log('migrations applied'),
    err => {
      console.error(err instanceof Error ? err.message : err)
      process.exit(1)
    },
  )
}
