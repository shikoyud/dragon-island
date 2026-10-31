import { BREEDER_LEVELS, HATCHERY_LEVELS, type BuildingLevel } from './data/breeding-buildings'
import { FARM_LEVELS } from './data/farms'
import { HABITAT_MAX_LEVEL, habitatUpgradeGold, habitatUpgradeMs } from './data/habitats'
import { ASCENSION_TIER, ROOST_TIERS } from './data/roost'
import { START_PL, unlockPl, type UnlockKey } from './data/unlocks'
import type { Preset } from './data/presets'
import type { Breeder, BuildingRef, PlayerState } from './state'

export interface UpgradeStep { cost: number; timerMs: number; minLevel: number }

/** The level's slots, plus one when the fifth slot was bought (§5.4, Q5 a). */
export function hatcherySlots(level: number, fifthSlot: boolean): number {
  return HATCHERY_LEVELS[level - 1]!.slots + (fifthSlot ? 1 : 0)
}

/** Breed time in this building. Reductions don't apply to hatching (§5.4). */
export function breederBreedMs(baseMs: number, b: Pick<Breeder, 'kind' | 'level'>): number {
  return Math.floor(baseMs * (100 - BREEDER_LEVELS[b.kind][b.level - 1]!.reductionPct) / 100)
}

/** A table row as a Gold upgrade, or null when the row is missing or isn't bought with Gold. */
const goldStep = (next: BuildingLevel | undefined, key: UnlockKey, preset: Preset): UpgradeStep | null =>
  next && next.gold !== null ? { cost: next.gold, timerMs: Math.floor(next.classicMs / preset.timerDiv), minLevel: unlockPl(key) } : null

/**
 * Next Gold upgrade of a building, or null at max level (or an unknown building). A habitat has a Gold upgrade to
 * L2..L4 only; L5 is a store item (§5.2, §5.3), so L4 and the Golden Aerie return null. Grove L3 is a store item too (§5.4).
 */
export function upgradeInfo(s: PlayerState, ref: BuildingRef, preset: Preset): UpgradeStep | null {
  switch (ref.type) {
    case 'habitat': {
      const h = s.habitats.find(x => x.id === ref.id)
      if (!h || h.element === 'aerie' || h.level >= HABITAT_MAX_LEVEL - 1) return null
      const to = (h.level + 1) as 2 | 3 | 4
      return { cost: habitatUpgradeGold(h.element, to), timerMs: habitatUpgradeMs(to, preset), minLevel: START_PL }
    }
    case 'farm': {
      // Entry `level` of the table holds the cost of reaching level + 1. L5 is a store item (§5.3), so L4 returns null.
      const f = s.farms[ref.index]
      const next = f ? FARM_LEVELS[f.level] : undefined
      return next && next.upgradeGold !== null
        ? { cost: next.upgradeGold, timerMs: Math.floor(next.classicMs / preset.timerDiv), minLevel: START_PL }
        : null
    }
    case 'breeder': {
      // As with farms, entry `level` is the next level.
      const b = s.breeders[ref.index]
      return b ? goldStep(BREEDER_LEVELS[b.kind][b.level], `${b.kind}:${b.level + 1}` as UnlockKey, preset) : null
    }
    case 'roost': {
      // Tiers 2-4 are Gold upgrades; Tier 5 is Ascension, a store item (§4.2). `roostTier` is the next tier's index.
      const next = s.roostPlacement ? ROOST_TIERS[s.roostTier] : undefined
      return next && next.tier < ASCENSION_TIER
        ? { cost: next.gold, timerMs: Math.floor(next.classicMs / preset.timerDiv), minLevel: unlockPl(`roost:${next.tier}` as UnlockKey) }
        : null
    }
    case 'hatchery':
      return goldStep(HATCHERY_LEVELS[s.hatcheryLevel], `hatchery:${s.hatcheryLevel + 1}` as UnlockKey, preset)
  }
}
