import type { PlayerState, SpeedUpToken } from '@wyrmhaven/game-core'

const TOKEN_LABELS: Record<SpeedUpToken, string> = { '15m': '15 min', '1h': '1 h', '3h': '3 h' }
const TOKENS: SpeedUpToken[] = ['15m', '1h', '3h']

/**
 * What a completed clear dropped (R54/R55), read from the states either side of one action. A clear that left
 * `constructions` is the only thing that can drop anything, so Gold or Food gained by any other action is no drop.
 * Works for every path that finishes a clear: auto-finish, manual Finish, a $DRIS skip or a token.
 */
export function dropMessages(before: PlayerState, after: PlayerState): string[] {
  const done = before.constructions.some(c => c.kind === 'clear' && !after.constructions.some(x => x.kind === 'clear' && x.obstacleId === c.obstacleId))
  if (!done) return []
  const out: string[] = []
  if (after.gold > before.gold) out.push(`Found ${after.gold - before.gold} Gold`)
  if (after.food > before.food) out.push(`Found ${after.food - before.food} Food`)
  for (const k of TOKENS) if (after.speedUps[k] > before.speedUps[k]) out.push(`Found a ${TOKEN_LABELS[k]} speed-up`)
  return out
}
