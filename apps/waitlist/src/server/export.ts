import { asc, isNotNull, sql } from 'drizzle-orm'
import { TASKS } from '../domain/tasks'
import type { Deps } from './deps'
import { entrants, taskEvents } from './db/schema'

const HEADER = [
  'position',
  'handle',
  'wallet',
  'element',
  'invites',
  ...TASKS.map((t) => `${t}_confirmed_at`),
  'joined_at',
]

function field(v: string | number | Date | null): string {
  if (v === null) return ''
  const s = v instanceof Date ? v.toISOString() : String(v)
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** CSV of joined entrants ordered by position. `invites` counts referred entrants who have joined. */
export async function exportCsv(deps: Deps): Promise<string> {
  const { db } = deps
  const joined = await db.select().from(entrants).where(isNotNull(entrants.position)).orderBy(asc(entrants.position))
  const events = await db.select().from(taskEvents)
  const invited = await db
    .select({ referrer: entrants.referredBy, n: sql<number>`count(*)::int` })
    .from(entrants)
    .where(isNotNull(entrants.position))
    .groupBy(entrants.referredBy)
  const invites = new Map(invited.map((r) => [r.referrer, r.n]))

  const lines = joined.map((e) => {
    const confirmed = TASKS.map(
      (t) => events.find((ev) => ev.entrantId === e.id && ev.task === t)?.confirmedAt ?? null,
    )
    return [e.position, `@${e.xHandle}`, e.wallet, e.element, invites.get(e.id) ?? 0, ...confirmed, e.joinedAt]
      .map(field)
      .join(',')
  })
  return [HEADER.join(','), ...lines].join('\n') + '\n'
}
