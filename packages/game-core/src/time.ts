export const MS_PER_DAY = 86_400_000

/** Days since the Unix epoch, rolling over at 00:00 UTC. */
export function utcDay(nowMs: number): number {
  return Math.floor(nowMs / MS_PER_DAY)
}
