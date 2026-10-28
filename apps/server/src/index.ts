import { buildApp } from './app'
import { systemClock } from './clock'
import { loadConfig } from './config'
import { createPgDb, createPgliteDb, migrate } from './db/client'
import { DEFAULT_INTERVALS_MS, startScheduler } from './jobs/scheduler'

async function main(): Promise<void> {
  const config = loadConfig()
  const { db, close } = config.DATABASE_URL ? createPgDb(config.DATABASE_URL) : await createPgliteDb(config.PGLITE_DIR)
  await migrate(db)
  const app = await buildApp({ db, clock: systemClock, config, logger: true })
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
