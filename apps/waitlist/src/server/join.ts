import { eq, sql } from 'drizzle-orm'
import { TASKS } from '../domain/tasks'
import type { Deps } from './deps'
import { entrants, taskEvents } from './db/schema'

export type JoinError = 'TASKS_INCOMPLETE' | 'WALLET_REQUIRED'

/**
 * Join the waitlist. Locks the entrant row (the same row wallet binding locks), so concurrent joins
 * and a racing wallet bind serialize; the position is drawn from the sequence only once.
 */
export async function join(deps: Deps, entrantId: string): Promise<{ position: number } | { error: JoinError }> {
  const { db, clock } = deps
  return db.transaction(async (tx) => {
    const [entrant] = await tx.select().from(entrants).where(eq(entrants.id, entrantId)).for('update')
    if (!entrant) throw new Error(`entrant not found: ${entrantId}`)
    if (entrant.position !== null) return { position: entrant.position }

    const events = await tx.select().from(taskEvents).where(eq(taskEvents.entrantId, entrantId))
    const done = TASKS.every((t) => events.some((e) => e.task === t && e.confirmedAt !== null))
    if (!done) return { error: 'TASKS_INCOMPLETE' as const }
    if (!entrant.wallet) return { error: 'WALLET_REQUIRED' as const }

    const [updated] = await tx
      .update(entrants)
      .set({ position: sql`nextval('waitlist_position_seq')`, joinedAt: clock.now() })
      .where(eq(entrants.id, entrantId))
      .returning({ position: entrants.position })
    return { position: updated!.position! }
  })
}
