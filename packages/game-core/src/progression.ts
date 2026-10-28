import type { PlayerState } from './state'

export const MAX_PLAYER_LEVEL = 50

export function xpToNext(level: number): number {
  return 50 * level * level
}

/** XP keeps accumulating at max level. */
export function addXp(s: PlayerState, xp: number): PlayerState {
  let level = s.level
  let total = s.xp + xp
  while (level < MAX_PLAYER_LEVEL && total >= xpToNext(level)) {
    total -= xpToNext(level)
    level++
  }
  return { ...s, level, xp: total }
}
