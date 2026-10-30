import type { Preset } from './data/presets'
import { XP_TO_NEXT } from './data/xp'
import type { PlayerState } from './state'

export const MAX_PLAYER_LEVEL = 50

/** XP to leave `level` (§4.3, ceil(50 x PL^1.8)); Infinity at max level. The curve is not scaled by the preset (R29). */
export function xpToNext(level: number): number {
  return level >= MAX_PLAYER_LEVEL ? Infinity : XP_TO_NEXT[level - 1]!
}

/** XP needed to go from PL 1 to `level`. */
export function cumulativeXp(level: number): number {
  let total = 0
  for (let pl = 1; pl < level; pl++) total += xpToNext(pl)
  return total
}

/** The only place levels rise. `day` is for the later level-up hooks (M3 Task 8). XP keeps accumulating at max level. */
export function settleLevels(s: PlayerState, _preset: Preset, _day: number): PlayerState {
  let level = s.level
  let xp = s.xp
  while (level < MAX_PLAYER_LEVEL && xp >= xpToNext(level)) {
    xp -= xpToNext(level)
    level++
  }
  return level === s.level ? s : { ...s, level, xp }
}

/** Adds classic XP times the preset's `xpMult` (§7.2, R27/R29), then settles levels; the one place XP is awarded. */
export function addXp(s: PlayerState, classicXp: number, preset: Preset, day: number): PlayerState {
  return settleLevels({ ...s, xp: s.xp + classicXp * preset.xpMult }, preset, day)
}
