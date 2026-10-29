export const MS_PER_DAY = 86_400_000
/** Timer for the tutorial breed, hatch and first constructions. */
export const TUTORIAL_TIMER_MS = 15_000

/** Days since the Unix epoch, rolling over at 00:00 UTC. */
export function utcDay(nowMs: number): number {
  return Math.floor(nowMs / MS_PER_DAY)
}

/** A per-UTC-day counter (attacks, replays, …). */
export interface DayCounter { day: number; count: number }

/** Rolls the counter forward to `nowMs`; monotonic, so a clock stepping back never resets it. */
export function dayCounterAt(c: DayCounter, nowMs: number): DayCounter {
  const day = utcDay(nowMs)
  return day > c.day ? { day, count: 0 } : c
}
