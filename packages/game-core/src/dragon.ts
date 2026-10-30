import { ADULT_FROM_LEVEL, FEEDS_PER_LEVEL, FOOD_PER_FEED_XP, foodPerFeed, JUVENILE_FROM_LEVEL, MAX_DRAGON_LEVEL, ROOST_LEVEL_CAPS } from './data/dragon-levels'
import type { Element } from './data/elements'
import { HABITATS } from './data/habitats'
import type { Preset } from './data/presets'
import { GPM_RARITY_MULT_TENTHS, type Rarity } from './rarity'

export { ADULT_FROM_LEVEL, BREED_MIN_LEVEL, FEEDS_PER_LEVEL, foodPerFeed, JUVENILE_FROM_LEVEL, MAX_DRAGON_LEVEL, ROOST_LEVEL_CAPS } from './data/dragon-levels'

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

/** XP for feeding `food` (§4.3); classic XP; `addXp` applies the preset multiplier (R27). */
export function feedXp(food: number): number {
  return Math.max(1, Math.floor(food / FOOD_PER_FEED_XP))
}

/**
 * §5.1 income in twentieths of a Gold per minute (R7; divide by 20 for Gold/min):
 * RarityMult x [Base + Inc x min(L-1, 9) + Inc/2 x max(L-10, 0)] x goldMult, with the rarity multiplier in tenths
 * and the bracket doubled so Inc/2 stays whole. `element` is the dragon's primary element, not its habitat's.
 */
export function goldPerMinuteX20(element: Element, rarity: Rarity, level: number, preset: Preset): number {
  const { base, inc } = HABITATS[element]
  const bracketX2 = 2 * base + 2 * inc * Math.min(level - 1, 9) + inc * Math.max(level - 10, 0)
  return GPM_RARITY_MULT_TENTHS[rarity] * bracketX2 * preset.goldMult
}
