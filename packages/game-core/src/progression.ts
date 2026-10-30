import type { Preset } from './data/presets'
import type { PlayerState } from './state'

export const MAX_PLAYER_LEVEL = 50

export function xpToNext(level: number): number {
  return 50 * level * level
}

/** Adds classic XP times the preset's `xpMult` (§7.2, R27); the one place XP is awarded. XP keeps accumulating at max level. */
export function addXp(s: PlayerState, classicXp: number, preset: Preset): PlayerState {
  let level = s.level
  let total = s.xp + classicXp * preset.xpMult
  while (level < MAX_PLAYER_LEVEL && total >= xpToNext(level)) {
    total -= xpToNext(level)
    level++
  }
  return { ...s, level, xp: total }
}
