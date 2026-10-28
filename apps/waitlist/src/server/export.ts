import { and, asc, eq, isNotNull, sql } from 'drizzle-orm'
import { TASKS, type Task } from '../domain/tasks'
import type { Deps } from './deps'
import { entrants, taskEvents } from './db/schema'

const HEADER = [
  'position',
  'handle',
  'wallet',
  'element',
  'invites',
  ...TASKS.flatMap((t) => [`${t}_opened_at`, `${t}_confirmed_at`]),
  'joined_at',
]

function field(v: string | number | Date | null): string {
  if (v === null) return ''
  const s = v instanceof Date ? v.toISOString() : String(v)
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

type TaskTimes = { openedAt: Date; confirmedAt: Date | null }

/**
 * CSV of joined entrants ordered by position. `invites` counts referred entrants who have joined.
 * Handles are written without `@`: a leading `@` (like `=`, `+`, `-`) starts a formula in spreadsheets.
 */
export async function exportCsv(deps: Deps): Promise<string> {
  const { db } = deps
  const joined = await db.select().from(entrants).where(isNotNull(entrants.position)).orderBy(asc(entrants.position))
  // Only joined entrants' events, indexed once: entrant -> task -> times.
  const events = await db
    .select({
      entrantId: taskEvents.entrantId,
      task: taskEvents.task,
      openedAt: taskEvents.openedAt,
      confirmedAt: taskEvents.confirmedAt,
    })
    .from(taskEvents)
    .innerJoin(entrants, and(eq(entrants.id, taskEvents.entrantId), isNotNull(entrants.position)))
  const byEntrant = new Map<string, Map<string, TaskTimes>>()
  for (const ev of events) {
    let tasks = byEntrant.get(ev.entrantId)
    if (!tasks) byEntrant.set(ev.entrantId, (tasks = new Map()))
    tasks.set(ev.task, ev)
  }
  const invited = await db
    .select({ referrer: entrants.referredBy, n: sql<number>`count(*)::int` })
    .from(entrants)
    .where(isNotNull(entrants.position))
    .groupBy(entrants.referredBy)
  const invites = new Map(invited.map((r) => [r.referrer, r.n]))

  const lines = joined.map((e) => {
    const tasks = byEntrant.get(e.id)
    const times = TASKS.flatMap((t: Task) => {
      const ev = tasks?.get(t)
      return [ev?.openedAt ?? null, ev?.confirmedAt ?? null]
    })
    return [e.position, e.xHandle, e.wallet, e.element, invites.get(e.id) ?? 0, ...times, e.joinedAt].map(field).join(',')
  })
  return [HEADER.join(','), ...lines].join('\n') + '\n'
}
