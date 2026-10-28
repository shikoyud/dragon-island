import { createPgDb, migrate } from '../src/server/db/client'

// Deploy step: apply pending migrations to the production Postgres. Run from apps/waitlist.
const url = process.env.DATABASE_URL
if (!url) {
  console.error('DATABASE_URL is required')
  process.exit(1)
}

const { db, close } = createPgDb(url)
try {
  await migrate(db)
  console.log('migrations applied')
} finally {
  await close()
}
