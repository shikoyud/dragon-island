import { buildApp } from './app'
import { FakeChainClient } from './chain/fake'
import { FixedPriceSource } from './services/price'
import { systemClock } from './clock'
import { loadConfig } from './config'
import { createPgDb, createPgliteDb, migrate } from './db/client'
import { DEFAULT_INTERVALS_MS, startScheduler } from './jobs/scheduler'

async function main(): Promise<void> {
  const config = loadConfig()
  const e2e = config.E2E === '1'
  const { db, close } = config.DATABASE_URL && !e2e ? createPgDb(config.DATABASE_URL) : await createPgliteDb(e2e ? undefined : config.PGLITE_DIR)
  await migrate(db)
  let chain: FakeChainClient | undefined
  if (e2e) {
    chain = new FakeChainClient()
    chain.remainingPayout = 1_000n * 10n ** 18n
    chain.remainingBurn = 1_000_000n * 10n ** 18n
  }
  const app = await buildApp({ db, clock: systemClock, config, logger: !e2e, ...(e2e ? { chain, price: new FixedPriceSource(50_000n) } : {}) })
  const scheduler = startScheduler({
    jobs: app.jobs,
    intervalsMs: DEFAULT_INTERVALS_MS,
    log: (level, message, extra) => app.log[level](extra ? { extra } : {}, message),
  })
  const shutdown = async () => {
    await scheduler.stop()
    await app.close()
    await close()
    process.exit(0)
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
  await app.listen({ port: config.PORT, host: '0.0.0.0' })
  app.log.info(`wyrmhaven server on :${config.PORT} (${config.DATABASE_URL ? 'postgres' : `pglite ${config.PGLITE_DIR}`})`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
