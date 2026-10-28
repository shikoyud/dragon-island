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
  season: 60_000,
} as const

export function startScheduler(opts: SchedulerOptions): { stop: () => void } {
  const log = opts.log ?? ((level, message, extra) => console[level === 'error' ? 'error' : 'log'](message, extra ?? ''))
  const running = new Set<string>()
  const timers: NodeJS.Timeout[] = []
  for (const [name, job] of Object.entries(opts.jobs)) {
    const interval = opts.intervalsMs[name]
    if (!interval) continue
    const tick = async () => {
      if (running.has(name)) return // never overlap a slow run with itself
      running.add(name)
      try {
        await job()
      } catch (err) {
        log('error', `job ${name} failed`, err)
      } finally {
        running.delete(name)
      }
    }
    timers.push(setInterval(() => void tick(), interval))
  }
  return { stop: () => timers.forEach(clearInterval) }
}
