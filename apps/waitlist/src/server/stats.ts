import { count, isNotNull } from 'drizzle-orm'
import type { Deps } from './deps'
import { entrants } from './db/schema'

/** Number of entrants who have joined the waitlist. */
export async function countJoined(deps: Deps): Promise<number> {
  const [row] = await deps.db.select({ n: count() }).from(entrants).where(isNotNull(entrants.position))
  return row?.n ?? 0
}
