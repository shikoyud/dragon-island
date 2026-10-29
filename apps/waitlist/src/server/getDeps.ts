import { newRefCode } from '../domain/refCode'
import { loadConfig } from './config'
import { createPgDb, createPgliteDb, migrate } from './db/client'
import { systemClock, type Deps } from './deps'
import { FakeXClient, HttpXClient } from './x'

export type AppDeps = Deps & { close(): Promise<void> }

/**
 * Wire Deps from env. Postgres when DATABASE_URL is set; otherwise (outside production only) a
 * file-backed PGlite in PGLITE_DIR (default `.pglite`), migrated on first use. X_FAKE=1 swaps in
 * FakeXClient and is refused in production.
 */
export async function buildDeps(env: Record<string, string | undefined>): Promise<AppDeps> {
  const config = loadConfig(env)
  const production = config.NODE_ENV === 'production'
  const fakeX = config.X_FAKE === '1'
  if (production && fakeX) throw new Error('X_FAKE=1 is not allowed in production')
  if (production && !config.DATABASE_URL) throw new Error('DATABASE_URL is required in production')

  const x = fakeX
    ? new FakeXClient({
        siteUrl: config.NEXT_PUBLIC_SITE_URL ?? '',
        profile: {
          ...(config.X_FAKE_ID ? { id: config.X_FAKE_ID } : {}),
          ...(config.X_FAKE_USERNAME ? { username: config.X_FAKE_USERNAME, name: config.X_FAKE_USERNAME } : {}),
        },
      })
    : new HttpXClient(config)

  let db: Deps['db']
  let close: () => Promise<void>
  if (config.DATABASE_URL) {
    ;({ db, close } = createPgDb(config.DATABASE_URL))
  } else {
    ;({ db, close } = await createPgliteDb(config.PGLITE_DIR ?? '.pglite'))
    await migrate(db)
  }
  return { db, clock: systemClock, x, newCode: newRefCode, config, close }
}

// Cached on globalThis so dev-server module reloads do not open the PGlite dir twice.
const g = globalThis as typeof globalThis & { __dragonIslandWaitlistDeps?: Promise<AppDeps> }

/** Lazy process-wide Deps for route handlers. A failed build is not cached, so the next request retries. */
export function getDeps(): Promise<AppDeps> {
  if (!g.__dragonIslandWaitlistDeps) {
    g.__dragonIslandWaitlistDeps = buildDeps(process.env).catch((e: unknown) => {
      g.__dragonIslandWaitlistDeps = undefined
      throw e
    })
  }
  return g.__dragonIslandWaitlistDeps
}
