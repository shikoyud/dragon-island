import { fileURLToPath } from 'node:url'
import { systemClock } from '../clock'
import { createPgDb, migrate } from '../db/client'
import { backfillClosedSeasons } from '../services/seasonBackfill'

/** `--ended-before <ISO date>` (required) and `--apply` (otherwise a dry run). A bare `--` is ignored. */
export function parseBackfillArgs(argv: string[]): { endedBeforeMs: number; dryRun: boolean } {
  const args = argv.filter(a => a !== '--')
  const i = args.indexOf('--ended-before')
  const value = i === -1 ? undefined : args[i + 1]
  if (value === undefined || value.startsWith('--')) throw new Error('missing required --ended-before <ISO date>')
  const endedBeforeMs = Date.parse(value)
  if (Number.isNaN(endedBeforeMs)) throw new Error(`invalid --ended-before date: ${value}`)
  return { endedBeforeMs, dryRun: !args.includes('--apply') }
}

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is required')
  const opts = parseBackfillArgs(process.argv.slice(2))
  const { db, close } = createPgDb(url)
  try {
    await migrate(db)
    const { seasonIds } = await backfillClosedSeasons(db, systemClock, opts)
    const verb = opts.dryRun ? 'would close' : 'closed'
    console.log(`${verb} ${seasonIds.length} season(s) ending on or before ${new Date(opts.endedBeforeMs).toISOString()}: ${seasonIds.join(', ') || '(none)'}`)
    if (opts.dryRun) console.log('dry run; pass --apply to write')
  } finally {
    await close()
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch(err => {
    console.error(err instanceof Error ? err.message : err)
    process.exit(1)
  })
}
