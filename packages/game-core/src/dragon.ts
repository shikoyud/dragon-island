import { ADULT_FROM_LEVEL, FEEDS_PER_LEVEL, JUVENILE_FROM_LEVEL, MAX_DRAGON_LEVEL, ROOST_LEVEL_CAPS } from './data/dragon-levels'
import { GPM_RARITY_MULT_TENTHS, type Rarity } from './rarity'

export { ADULT_FROM_LEVEL, BREED_MIN_LEVEL, FEEDS_PER_LEVEL, JUVENILE_FROM_LEVEL, MAX_DRAGON_LEVEL, ROOST_LEVEL_CAPS } from './data/dragon-levels'

/** Food for one feed at `level`: ⌈5 × 1.2^(L−1)⌉ = ⌈5·6^(L−1) / 5^(L−1)⌉, exact in integers (R5, §4.1). */
export function foodPerFeed(level: number): number {
  const n = BigInt(level - 1)
  const den = 5n ** n
  return Number((5n * 6n ** n + den - 1n) / den)
}

/** Food to go from `level` to `level + 1` (four feeds). */
export function foodForLevel(level: number): number {
  return FEEDS_PER_LEVEL * foodPerFeed(level)
}

/** Total Food from Lv 1 to `level`: Σ foodForLevel(1 … level−1). */
export function totalFoodTo(level: number): number {
  let total = 0
  for (let l = 1; l < level; l++) total += foodForLevel(l)
  return total
}

/** Highest dragon level the Roost allows at `roostTier` (§4.2). */
export function levelCap(roostTier: number): number {
  return ROOST_LEVEL_CAPS[Math.min(Math.max(roostTier, 0), ROOST_LEVEL_CAPS.length - 1)] ?? MAX_DRAGON_LEVEL
}

export type Stage = 'baby' | 'juvenile' | 'adult'

/** Baby 1–3, Juvenile 4–6, Adult 7+ (§4.1). */
export function stageOf(level: number): Stage {
  return level >= ADULT_FROM_LEVEL ? 'adult' : level >= JUVENILE_FROM_LEVEL ? 'juvenile' : 'baby'
}

/** XP for feeding `food` (§4.3); the preset XP multiplier is applied in M3. */
export function feedXp(food: number): number {
  return Math.max(1, Math.floor(food / 10))
}

/** Placeholder base Gold/min per level; task B6 replaces goldPerMinute with the §5.1 habitat model. */
const TRANSITIONAL_BASE_GOLD = 2

/** Transitional: whole Gold/min = floor(2 x §5.1 rarity multiplier x level). Replaced in B6. */
export function goldPerMinute(speciesRarity: Rarity, level: number): number {
  return Math.floor(TRANSITIONAL_BASE_GOLD * GPM_RARITY_MULT_TENTHS[speciesRarity] * level / 10)
}
