import { and, eq, isNull } from 'drizzle-orm'
import { canConfirm, type Task } from '../domain/tasks'
import type { Deps } from './deps'
import { taskEvents } from './db/schema'

const key = (entrantId: string, task: Task) => and(eq(taskEvents.entrantId, entrantId), eq(taskEvents.task, task))

/** Record that the entrant opened the X intent. The first open time is kept. */
export async function openTask(deps: Deps, entrantId: string, task: Task): Promise<{ openedAt: Date }> {
  const { db, clock } = deps
  await db.insert(taskEvents).values({ entrantId, task, openedAt: clock.now() }).onConflictDoNothing()
  const [row] = await db.select({ openedAt: taskEvents.openedAt }).from(taskEvents).where(key(entrantId, task))
  return { openedAt: row!.openedAt }
}

/** Honor-based confirm: allowed once 15 s have passed since the first open. Repeat confirms return the stored time. */
export async function confirmTask(
  deps: Deps,
  entrantId: string,
  task: Task,
): Promise<{ confirmedAt: Date } | { error: 'TASK_NOT_OPENED' | 'TOO_EARLY' }> {
  const { db, clock } = deps
  const [row] = await db.select().from(taskEvents).where(key(entrantId, task))
  if (row?.confirmedAt) return { confirmedAt: row.confirmedAt }
  const verdict = canConfirm(row?.openedAt ?? null, clock.now())
  if (verdict !== 'ok') return { error: verdict }

  const [updated] = await db
    .update(taskEvents)
    .set({ confirmedAt: clock.now() })
    .where(and(key(entrantId, task), isNull(taskEvents.confirmedAt)))
    .returning({ confirmedAt: taskEvents.confirmedAt })
  if (updated?.confirmedAt) return { confirmedAt: updated.confirmedAt }
  // Lost a race with a concurrent confirm: return what it stored.
  const [again] = await db.select({ confirmedAt: taskEvents.confirmedAt }).from(taskEvents).where(key(entrantId, task))
  return { confirmedAt: again!.confirmedAt! }
}
