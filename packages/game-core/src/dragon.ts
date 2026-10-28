import { RARITY, type Rarity } from './rarity'

export const MAX_DRAGON_LEVEL = 30

/** Income level: linear to 10, then half speed. */
export function effLevel(level: number): number {
  return level <= 10 ? level : 10 + Math.floor((level - 10) / 2)
}

export function goldPerMinute(speciesRarity: Rarity, level: number): number {
  return RARITY[speciesRarity].baseGold * effLevel(level)
}

/** Food to go from `level` to `level + 1` (defined for 1..29). */
export function foodToNextLevel(level: number): number {
  const factor = level < 10 ? 4 : level < 20 ? 8 : 16
  return factor * level * level
}
