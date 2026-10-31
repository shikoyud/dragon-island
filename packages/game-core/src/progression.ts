import type { Preset } from './data/presets'
import type { Species } from './catalog'
import { BUILD_XP_GOLD_PER_XP, BUILD_XP_MIN, XP_LEVEL_LIMITS, XP_TO_NEXT } from './data/xp'
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

/** Highest level game day `day` allows (§7.2, Q1 c), or null once Rush is over (R40). */
export function levelLimit(day: number, preset: Preset): number | null {
  return XP_LEVEL_LIMITS[preset.id].find(([lastDay]) => day <= lastDay)?.[1] ?? null
}

/** Q1 (a): a breed pays no XP when both parents and the child are Common. A hybrid, or a Common from a hybrid parent, pays. */
export function breedXpApplies(a: Species, b: Species, child: Species): boolean {
  return !(a.rarity === 'common' && b.rarity === 'common' && child.rarity === 'common')
}

/** The only place levels rise. It stops at the day's limit and keeps the XP (R40). XP keeps accumulating at max level. */
export function settleLevels(s: PlayerState, preset: Preset, day: number): PlayerState {
  const top = levelLimit(day, preset) ?? MAX_PLAYER_LEVEL
  let level = s.level
  let xp = s.xp
  while (level < top && xp >= xpToNext(level)) {
    xp -= xpToNext(level)
    level++
  }
  return level === s.level ? s : { ...s, level, xp }
}

/** Adds XP the preset does not scale (build XP, M3 Q2 a), then settles levels. */
export function addRawXp(s: PlayerState, xp: number, preset: Preset, day: number): PlayerState {
  return settleLevels({ ...s, xp: s.xp + xp }, preset, day)
}

/** Build XP for `goldSpent` (R31): 1 per 20 Gold, at least 5, never more than one level's worth. */
export function buildXp(goldSpent: number, s: PlayerState): number {
  return Math.min(Math.max(BUILD_XP_MIN, Math.floor(goldSpent / BUILD_XP_GOLD_PER_XP)), xpToNext(s.level))
}

/** Pays build XP for Gold just spent; `before` is the state ahead of the spend (its level sets the cap). */
export function payBuildXp(after: PlayerState, goldSpent: number, before: PlayerState, preset: Preset, day: number): PlayerState {
  return addRawXp(after, buildXp(goldSpent, before), preset, day)
}

/** Adds classic XP times the preset's `xpMult` (§7.2, R27/R29), then settles levels; the one place XP is awarded. */
export function addXp(s: PlayerState, classicXp: number, preset: Preset, day: number): PlayerState {
  return settleLevels({ ...s, xp: s.xp + classicXp * preset.xpMult }, preset, day)
}
