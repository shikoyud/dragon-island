/** In-memory fixed-window rate limiter (per process / per instance). */

type Window = { start: number; count: number }

const windows = new Map<string, Window>()
const SWEEP_AT = 10_000

/** Count one hit for `key`; returns false once `limit` hits have been made in the current window. */
export function rateLimit(key: string, limit: number, windowMs: number, now: Date): boolean {
  const t = now.getTime()
  if (windows.size >= SWEEP_AT) {
    for (const [k, w] of windows) if (t - w.start >= windowMs) windows.delete(k)
  }
  const w = windows.get(key)
  if (!w || t - w.start >= windowMs) {
    windows.set(key, { start: t, count: 1 })
    return true
  }
  if (w.count >= limit) return false
  w.count++
  return true
}

export const LIMITS = {
  auth: { limit: 20, windowMs: 60_000 },
  wallet: { limit: 20, windowMs: 60_000 },
  join: { limit: 10, windowMs: 60_000 },
} as const
