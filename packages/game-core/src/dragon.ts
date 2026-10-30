import { GPM_RARITY_MULT_TENTHS, type Rarity } from './rarity'

export const MAX_DRAGON_LEVEL = 30

/** Income level: linear to 10, then half speed. */
export function effLevel(level: number): number {
  return level <= 10 ? level : 10 + Math.floor((level - 10) / 2)
}

/** Placeholder base Gold/min per effective level; task B6 replaces goldPerMinute with the §5.1 habitat model. */
const TRANSITIONAL_BASE_GOLD = 2

/** Transitional: whole Gold/min = floor(2 x §5.1 rarity multiplier x effective level). */
export function goldPerMinute(speciesRarity: Rarity, level: number): number {
  return Math.floor(TRANSITIONAL_BASE_GOLD * GPM_RARITY_MULT_TENTHS[speciesRarity] * effLevel(level) / 10)
}

/** Food to go from `level` to `level + 1` (defined for 1..29). */
export function foodToNextLevel(level: number): number {
  const factor = level < 10 ? 4 : level < 20 ? 8 : 16
  return factor * level * level
}
