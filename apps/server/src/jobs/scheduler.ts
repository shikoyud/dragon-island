/** Runs named jobs on fixed intervals; a failing run is logged and never stops the others. */
export interface SchedulerOptions {
  jobs: Record<string, () => Promise<unknown>>
  intervalsMs: Record<string, number>
  log?: (level: 'info' | 'error', message: string, extra?: unknown) => void
}

export const DEFAULT_INTERVALS_MS = {
  indexer: 15_000,
  voucherExpiry: 60_000,
  burnBatch: 10 * 60_000,
  game: 60_000,
  prune: 60 * 60_000,
  /** Registered only when VAULT_ADDRESS is set; an interval without a job is skipped. */
  chainWatch: 5 * 60_000,
} as const

export function startScheduler(opts: SchedulerOptions): { stop: () => Promise<void> } {
  const log = opts.log ?? ((level, message, extra) => console[level === 'error' ? 'error' : 'log'](message, extra ?? ''))
  const running = new Set<string>()
  const inFlight = new Map<string, Promise<void>>()
  const timers: NodeJS.Timeout[] = []
  for (const [name, job] of Object.entries(opts.jobs)) {
    const interval = opts.intervalsMs[name]
    if (!interval) continue
    const tick = async () => {
      if (running.has(name)) return // never overlap a slow run with itself
      running.add(name)
      const run = (async () => {
        try {
          await job()
        } catch (err) {
          log('error', `job ${name} failed`, err)
        } finally {
          running.delete(name)
          inFlight.delete(name)
        }
      })()
      inFlight.set(name, run)
      await run
    }
    timers.push(setInterval(() => void tick(), interval))
  }
  return {
    /** Stops scheduling and waits for runs already in progress (a burn mid-flight must finish). */
    stop: async () => {
      timers.forEach(clearInterval)
      await Promise.all([...inFlight.values()])
    },
  }
}
