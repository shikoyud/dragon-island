import { sql } from 'drizzle-orm'
import type { Clock } from '../clock'
import type { Db } from '../db/client'
import { AppError } from './errors'

export const AUTH_LIMIT = { limit: 20, windowMs: 60_000 }
export const PLAYER_LIMIT = { limit: 60, windowMs: 60_000 }

/**
 * Fixed-window counter in Postgres (no Redis). Throws 429 RATE_LIMITED once `limit` is exceeded
 * within the window that started at or after `now - windowMs`.
 */
export async function rateLimit(db: Db, key: string, limit: number, windowMs: number, clock: Clock): Promise<void> {
  const now = new Date(clock())
  const windowStart = new Date(clock() - windowMs)
  const result = await db.execute(sql`
    insert into rate_limits (key, window_start, count) values (${key}, ${now}, 1)
    on conflict (key) do update set
      count = case when rate_limits.window_start < ${windowStart} then 1 else rate_limits.count + 1 end,
      window_start = case when rate_limits.window_start < ${windowStart} then ${now} else rate_limits.window_start end
    returning count
  `)
  const rows = (result as unknown as { rows: { count: number | string }[] }).rows
  const count = Number(rows[0]!.count)
  if (count > limit) throw new AppError(429, 'RATE_LIMITED')
}
