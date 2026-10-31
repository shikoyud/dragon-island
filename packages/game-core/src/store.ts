import { GROVE_L3, HATCHERY_FIFTH_SLOT } from './data/breeding-buildings'
import { isUnderConstruction } from './construction'
import { ASCENSION_TIER, ROOST_TIERS } from './data/roost'
import { ELEMENT_TIER } from './data/elements'
import { FARM_L5_USD_MICRO, FARM_MAX_LEVEL } from './data/farms'
import { GOLDEN_AERIE, HABITAT_L5_USD_MICRO, HABITAT_MAX_LEVEL } from './data/habitats'
import { HEAL_ALL_MICRO_USD } from './data/trials'
import { skipPriceMicroUsd } from './data/speedups'
import { isUnlocked } from './data/unlocks'
import type { Placement, PlayerState } from './state'

export type StoreItem =
  | { kind: 'skip'; target: SkipTarget; index: number }
  | { kind: 'foodPack' }
  /** Level 4 to level 5, instant (§5.2). */
  | { kind: 'habitatL5'; habitatId: string }
  /** Farm level 4 to level 5, instant (§5.3). */
  | { kind: 'farmL5'; index: number }
  /** A level 5 habitat that takes any element, placed where the player chooses (§5.2). */
  | { kind: 'goldenAerie'; placement: Placement }
  /** The fifth Hatchery slot: once, at any Hatchery level (§5.4, Q5 a). */
  | { kind: 'hatcheryL5' }
  /** Grove level 2 to level 3, instant (§5.4). */
  | { kind: 'groveL3'; index: number }
  /** Roost Tier 4 to Tier 5: 10M Gold plus $2.00, a 48 h build (§4.2, §7.4, R35). */
  | { kind: 'ascension' }
  /** Clears every dragon's fatigue (§6.3, R78). */
  | { kind: 'healAll' }

export type SkipTarget = 'breeder' | 'hatchery' | 'farm' | 'construction'

export const FOOD_PACK = 1_000

/** One Golden Aerie per player (M1 Q2). */
export const ownsAerie = (s: PlayerState): boolean => s.habitats.some(h => h.element === 'aerie')

/** Ready time of a skip target, or `null` if the slot holds nothing. */
export function skipTargetReadyAt(s: PlayerState, target: SkipTarget, index: number): number | null {
  if (target === 'construction') return s.constructions[index]?.readyAtMs ?? null
  if (target === 'breeder') return s.breeders[index]?.egg?.readyAtMs ?? null
  if (target === 'hatchery') return s.hatchery[index]?.readyAtMs ?? null
  const plot = s.farms[index]
  return plot && plot.crop !== null ? plot.readyAtMs : null
}

/** Price in micro-USD, or `null` when the item can't be bought now. */
export function priceMicroUsd(item: StoreItem, s: PlayerState, nowMs: number): number | null {
  switch (item.kind) {
    case 'skip': {
      const readyAt = skipTargetReadyAt(s, item.target, item.index)
      if (readyAt === null || readyAt <= nowMs) return null
      return skipPriceMicroUsd(readyAt - nowMs)
    }
    case 'foodPack':
      return 500_000
    case 'habitatL5': {
      const h = s.habitats.find(x => x.id === item.habitatId)
      return h && h.element !== 'aerie' && h.level === HABITAT_MAX_LEVEL - 1 ? HABITAT_L5_USD_MICRO[ELEMENT_TIER[h.element]] : null
    }
    case 'farmL5': {
      const f = s.farms[item.index]
      return f && f.level === FARM_MAX_LEVEL - 1 ? FARM_L5_USD_MICRO : null
    }
    case 'goldenAerie':
      return ownsAerie(s) ? null : GOLDEN_AERIE.usdMicro
    case 'hatcheryL5':
      return !s.hatcheryFifthSlot && isUnlocked('hatcheryFifthSlot', s.level) ? HATCHERY_FIFTH_SLOT.usdMicro : null
    case 'groveL3': {
      const g = s.breeders[item.index]
      return g && g.kind === 'grove' && g.level === GROVE_L3.level - 1 && isUnlocked('grove:3', s.level) ? GROVE_L3.usdMicro : null
    }
    // Without the catalog and preset this can't see a fatigue that has healed by itself; `buy` and the panel use `anyHurt` for that.
    case 'healAll':
      return s.pve.active === null && s.dragons.some(d => d.fatigue) ? HEAL_ALL_MICRO_USD : null
    case 'ascension':
      return s.roostPlacement && s.roostTier === ASCENSION_TIER - 1 && !isUnderConstruction(s, { type: 'roost' }) ? ROOST_TIERS[ASCENSION_TIER - 1]!.usdMicro : null
  }
}
