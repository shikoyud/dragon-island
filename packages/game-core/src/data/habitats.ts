// GDD §5.1 (dragon income), §5.2 (the 10 habitats, upgrade path, Golden Aerie), rulings A5 (timers), R3 (Aerie cap), R4 (L3-L5 caps).
// Every value is classic; the preset multiplies Gold and caps and divides timers (§7.2).
import { ELEMENT_TIER, type Element, type ElementTier } from './elements'
import type { Preset } from './presets'

export interface HabitatSpec {
  archetype: 'sprinter' | 'standard' | 'steady' | 'vault'
  /** §5.1 income Base: classic Gold/min of a Common at Lv 1. */
  base: number
  /** §5.1 income Inc per level up to Lv 10, then Inc / 2. */
  inc: number
  capL1: number
  capL2: number
  buildGold: number
  upgradeL2Gold: number
}

/** §5.2 table, classic values. */
export const HABITATS: Record<Element, HabitatSpec> = {
  terra: { archetype: 'sprinter', base: 18, inc: 12, capL1: 8_000, capL2: 28_000, buildGold: 500, upgradeL2Gold: 10_000 },
  flame: { archetype: 'standard', base: 7, inc: 5, capL1: 10_000, capL2: 35_000, buildGold: 2_000, upgradeL2Gold: 20_000 },
  sea: { archetype: 'standard', base: 10, inc: 7, capL1: 14_000, capL2: 49_000, buildGold: 5_000, upgradeL2Gold: 40_000 },
  nature: { archetype: 'standard', base: 9, inc: 7, capL1: 18_000, capL2: 64_000, buildGold: 10_000, upgradeL2Gold: 60_000 },
  electric: { archetype: 'sprinter', base: 15, inc: 10, capL1: 10_000, capL2: 35_000, buildGold: 25_000, upgradeL2Gold: 100_000 },
  ice: { archetype: 'steady', base: 8, inc: 6, capL1: 23_000, capL2: 83_000, buildGold: 40_000, upgradeL2Gold: 150_000 },
  metal: { archetype: 'steady', base: 9, inc: 6, capL1: 24_000, capL2: 84_000, buildGold: 60_000, upgradeL2Gold: 200_000 },
  dark: { archetype: 'vault', base: 6, inc: 4, capL1: 32_000, capL2: 112_000, buildGold: 150_000, upgradeL2Gold: 500_000 },
  light: { archetype: 'steady', base: 8, inc: 5, capL1: 27_000, capL2: 94_000, buildGold: 200_000, upgradeL2Gold: 600_000 },
  war: { archetype: 'vault', base: 7, inc: 4, capL1: 33_000, capL2: 115_000, buildGold: 250_000, upgradeL2Gold: 750_000 },
}

/** Dragons a habitat holds; index = level - 1 (§5.2 upgrade path). */
export const HABITAT_CAPACITY: readonly number[] = [2, 3, 4, 5, 6]

/** Top habitat level (§5.2), reached only through the store; the Golden Aerie is built at it. */
export const HABITAT_MAX_LEVEL = 5

/** L5 price in micro-USD by element tier (§5.2: $1.50 / $2.50 / $4.00). */
export const HABITAT_L5_USD_MICRO: Record<ElementTier, number> = { A: 1_500_000, B: 2_500_000, C: 4_000_000 }

/** A5 build time by element tier, classic: 10 min / 1 h / 4 h. */
export const HABITAT_BUILD_CLASSIC_MS: Record<ElementTier, number> = { A: 600_000, B: 3_600_000, C: 14_400_000 }

/** A5 upgrade time to L2..L5, classic: 1 h / 4 h / 12 h / instant (L5 is a store item). */
export const HABITAT_UPGRADE_CLASSIC_MS: readonly number[] = [3_600_000, 14_400_000, 43_200_000, 0]

/** §5.2 Premium habitat: any element, 6 dragons, 3x the Gold cap of the habitat with the largest L1 cap (R3: War). */
export const GOLDEN_AERIE = { usdMicro: 5_000_000, capacity: 6, capMult: 3, capOf: 'war' as Element }

/** Classic Gold cap: L1/L2 are the table's values; L3 = L1 x 12.25, L4 = L1 x 42.9, L5 = L1 x 150, floored (R4). */
export function habitatCapClassic(element: Element | 'aerie', level: number): number {
  if (element === 'aerie') return GOLDEN_AERIE.capMult * HABITATS[GOLDEN_AERIE.capOf].capL1
  const h = HABITATS[element]
  switch (level) {
    case 1: return h.capL1
    case 2: return h.capL2
    case 3: return Math.floor(h.capL1 * 49 / 4)
    case 4: return Math.floor(h.capL1 * 429 / 10)
    default: return h.capL1 * 150
  }
}

/** Gold cap under `preset` (classic x goldMult). */
export function habitatCap(element: Element | 'aerie', level: number, preset: Preset): number {
  return habitatCapClassic(element, level) * preset.goldMult
}

/** Gold to upgrade to `toLevel`: L2 is the table value, L3 = L2 x 4, L4 = L2 x 16. */
export function habitatUpgradeGold(element: Element, toLevel: 2 | 3 | 4): number {
  const l2 = HABITATS[element].upgradeL2Gold
  return toLevel === 2 ? l2 : toLevel === 3 ? l2 * 4 : l2 * 16
}

/** Build time of a new habitat (A5 by element tier, divided by the preset). */
export function habitatBuildMs(element: Element, preset: Preset): number {
  return Math.floor(HABITAT_BUILD_CLASSIC_MS[ELEMENT_TIER[element]] / preset.timerDiv)
}

/** Upgrade time to `toLevel` 2..5 (A5, divided by the preset). */
export function habitatUpgradeMs(toLevel: number, preset: Preset): number {
  return Math.floor((HABITAT_UPGRADE_CLASSIC_MS[toLevel - 2] ?? 0) / preset.timerDiv)
}
