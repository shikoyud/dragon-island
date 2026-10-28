import { and, count, eq, isNotNull } from 'drizzle-orm'
import { pickElement, type Element } from '../domain/elements'
import { TASKS, type Task } from '../domain/tasks'
import type { Deps, XProfile } from './deps'
import { entrants, taskEvents } from './db/schema'

export type EntrantState = {
  handle: string
  name: string
  avatarUrl: string | null
  element: Element
  refCode: string
  inviteCount: number
  tasks: Record<Task, { openedAt: string | null; confirmedAt: string | null }>
  wallet: string | null
  position: number | null
}

const DAY_MS = 86_400_000

/** X returns a 48px `_normal` avatar; the 400px variant sits at the same path. */
function largeAvatar(url: string): string {
  return url.replace('_normal', '_400x400')
}

/**
 * Create the entrant for an X profile, or refresh handle/name/avatar if it exists.
 * `refCode` only counts on creation: ON CONFLICT never touches referred_by.
 */
export async function upsertFromX(
  deps: Deps,
  profile: XProfile,
  refCode?: string,
): Promise<{ entrantId: string } | { error: 'X_ACCOUNT_TOO_NEW' }> {
  const { db, clock, config } = deps
  const now = clock.now()
  if (now.getTime() - profile.createdAt.getTime() < config.MIN_X_ACCOUNT_AGE_DAYS * DAY_MS) {
    return { error: 'X_ACCOUNT_TOO_NEW' }
  }

  let referredBy: string | null = null
  if (refCode) {
    const [referrer] = await db.select({ id: entrants.id }).from(entrants).where(eq(entrants.refCode, refCode))
    referredBy = referrer?.id ?? null
  }

  const xAvatarUrl = largeAvatar(profile.profileImageUrl)
  const [row] = await db
    .insert(entrants)
    .values({
      xUserId: profile.id,
      xHandle: profile.username,
      xName: profile.name,
      xAvatarUrl,
      xCreatedAt: profile.createdAt,
      element: pickElement(profile.id),
      refCode: deps.newCode(),
      referredBy,
    })
    .onConflictDoUpdate({
      target: entrants.xUserId,
      set: { xHandle: profile.username, xName: profile.name, xAvatarUrl },
    })
    .returning({ id: entrants.id })
  return { entrantId: row!.id }
}

export async function getEntrantState(deps: Deps, entrantId: string): Promise<EntrantState | null> {
  const { db } = deps
  const [e] = await db.select().from(entrants).where(eq(entrants.id, entrantId))
  if (!e) return null

  const events = await db.select().from(taskEvents).where(eq(taskEvents.entrantId, entrantId))
  const tasks = Object.fromEntries(
    TASKS.map((t) => {
      const ev = events.find((x) => x.task === t)
      return [t, { openedAt: ev?.openedAt.toISOString() ?? null, confirmedAt: ev?.confirmedAt?.toISOString() ?? null }]
    }),
  ) as EntrantState['tasks']

  const [invited] = await db
    .select({ n: count() })
    .from(entrants)
    .where(and(eq(entrants.referredBy, entrantId), isNotNull(entrants.position)))

  return {
    handle: e.xHandle,
    name: e.xName,
    avatarUrl: e.xAvatarUrl,
    element: e.element as Element,
    refCode: e.refCode,
    inviteCount: invited?.n ?? 0,
    tasks,
    wallet: e.wallet,
    position: e.position,
  }
}
