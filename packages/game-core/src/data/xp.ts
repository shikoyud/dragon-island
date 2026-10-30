// GDD §4.3 (Player XP), classic values before the preset XP multiplier.
import type { Rarity } from '../rarity'

/** §4.3 "Hatch an egg": C 10, U 30, R 80, E 200, L 500. */
export const HATCH_XP: Record<Rarity, number> = {
  common: 10, uncommon: 30, rare: 80, epic: 200, legendary: 500,
}

/** §4.3 "Start a breed". */
export const START_BREED_XP = 5
