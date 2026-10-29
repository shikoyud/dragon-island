import { buildApp } from './app'
import { FakeChainClient } from './chain/fake'
import { FixedPriceSource } from './services/price'
import { offsetClock, systemClock } from './clock'
import { loadConfig } from './config'
import { createPgDb, createPgliteDb, migrate } from './db/client'
import { DEFAULT_INTERVALS_MS, startScheduler } from './jobs/scheduler'

async function main(): Promise<void> {
  const config = loadConfig()
  const e2e = config.E2E === '1'
  // Loaded only with a DSN, so a server without Sentry never pulls the SDK in.
  const sentry = config.SENTRY_DSN ? await import('@sentry/node') : null
  sentry?.init({ dsn: config.SENTRY_DSN, environment: config.NODE_ENV ?? 'development' })
  const { db, close } = config.DATABASE_URL && !e2e ? createPgDb(config.DATABASE_URL) : await createPgliteDb(e2e ? undefined : config.PGLITE_DIR)
  await migrate(db)
  let chain: FakeChainClient | undefined
  if (e2e) {
    chain = new FakeChainClient()
    chain.remainingPayout = 1_000n * 10n ** 18n
    chain.remainingBurn = 1_000_000n * 10n ** 18n
  }
  // E2E specs move the clock through POST /e2e/clock; production time is never adjustable.
  const clock = e2e ? offsetClock() : systemClock
  const app = await buildApp({ db, clock, config, logger: !e2e, ...(e2e ? { chain, price: new FixedPriceSource(50_000n) } : {}) })
  if (sentry) {
    app.addHook('onError', async (_req, _reply, err) => {
      if ((err.statusCode ?? 500) >= 500) sentry.captureException(err)
    })
  }
  // chainWatch is only in app.jobs when VAULT_ADDRESS is set; the scheduler skips absent jobs.
  const scheduler = startScheduler({
    jobs: app.jobs,
    intervalsMs: DEFAULT_INTERVALS_MS,
    log: (level, message, extra) => {
      app.log[level](extra ? { extra } : {}, message)
      if (level === 'error' && sentry) sentry.captureException(extra ?? new Error(message))
    },
  })
  const shutdown = async () => {
    await scheduler.stop()
    await app.close()
    await close()
    await sentry?.close(2_000)
    process.exit(0)
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
  await app.listen({ port: config.PORT, host: '0.0.0.0' })
  app.log.info(`dragon-island server on :${config.PORT} (${config.DATABASE_URL ? 'postgres' : `pglite ${config.PGLITE_DIR}`})`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
