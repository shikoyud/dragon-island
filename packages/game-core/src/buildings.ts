import { habitatUpgradeGold, habitatUpgradeMs } from './data/habitats'
import type { Preset } from './data/presets'
import type { BuildingRef, PlayerState } from './state'

export interface UpgradeStep { cost: number; timerMs: number; minLevel: number }

/** Index = plot level - 1. */
export const FARM_LEVELS: readonly { foodPct: number; up: UpgradeStep | null }[] = [
  { foodPct: 100, up: { cost: 1_500, timerMs: 900_000, minLevel: 4 } },
  { foodPct: 115, up: { cost: 8_000, timerMs: 3_600_000, minLevel: 10 } },
  { foodPct: 130, up: { cost: 30_000, timerMs: 14_400_000, minLevel: 18 } },
  { foodPct: 150, up: null },
]

/** Index = hatchery level - 1. */
export const HATCHERY_LEVELS: readonly { slots: number; up: UpgradeStep | null }[] = [
  { slots: 3, up: { cost: 12_000, timerMs: 7_200_000, minLevel: 8 } },
  { slots: 4, up: { cost: 75_000, timerMs: 28_800_000, minLevel: 20 } },
  { slots: 5, up: null },
]

/** Index = nest level - 1. */
export const NEST_LEVELS: readonly { breedPct: number; up: UpgradeStep | null }[] = [
  { breedPct: 100, up: { cost: 15_000, timerMs: 7_200_000, minLevel: 12 } },
  { breedPct: 90, up: { cost: 90_000, timerMs: 28_800_000, minLevel: 24 } },
  { breedPct: 80, up: null },
]

export function hatcherySlots(level: number): number {
  return HATCHERY_LEVELS[level - 1]!.slots
}

export function nestBreedMs(baseMs: number, nestLevel: number): number {
  return Math.floor(baseMs * NEST_LEVELS[nestLevel - 1]!.breedPct / 100)
}

export function farmFood(cropFood: number, plotLevel: number): number {
  return Math.floor(cropFood * FARM_LEVELS[plotLevel - 1]!.foodPct / 100)
}

/**
 * Next Gold upgrade of a building, or null at max level (or an unknown building). A habitat has a Gold upgrade to
 * L2..L4 only; L5 is a store item (§5.2), so L4 and the Golden Aerie return null.
 */
export function upgradeInfo(s: PlayerState, ref: BuildingRef, preset: Preset): UpgradeStep | null {
  switch (ref.type) {
    case 'habitat': {
      const h = s.habitats.find(x => x.id === ref.id)
      if (!h || h.element === 'aerie' || h.level >= 4) return null
      const to = (h.level + 1) as 2 | 3 | 4
      return { cost: habitatUpgradeGold(h.element, to), timerMs: habitatUpgradeMs(to, preset), minLevel: 1 }
    }
    case 'farm': {
      const f = s.farms[ref.index]
      return f ? FARM_LEVELS[f.level - 1]?.up ?? null : null
    }
    case 'nest': {
      const n = s.nests[ref.index]
      return n ? NEST_LEVELS[n.level - 1]?.up ?? null : null
    }
    case 'hatchery':
      return HATCHERY_LEVELS[s.hatcheryLevel - 1]?.up ?? null
  }
}
