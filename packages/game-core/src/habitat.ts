import { getSpecies, type Catalog, type Species } from './catalog'
import { goldPerMinute } from './dragon'
import type { Element } from './elements'
import type { Dragon, Habitat, PlayerState } from './state'

export const MS_PER_MINUTE = 60_000

/** Index = habitat level − 1 (spec §7). */
export const HABITAT_LEVELS: readonly { cap: number; slots: number; upgradeCost: number | null }[] = [
  { cap: 500, slots: 3, upgradeCost: 1_000 },
  { cap: 2_500, slots: 4, upgradeCost: 5_000 },
  { cap: 10_000, slots: 5, upgradeCost: 20_000 },
  { cap: 40_000, slots: 6, upgradeCost: 80_000 },
  { cap: 120_000, slots: 7, upgradeCost: null },
]

export function canLiveIn(sp: Species, h: Habitat): boolean {
  return h.element === 'any' || sp.elements.includes(h.element)
}

export function residents(s: PlayerState, habitatId: string): Dragon[] {
  return s.dragons.filter(d => d.habitatId === habitatId)
}

export function habitatSlots(h: Habitat): number {
  return HABITAT_LEVELS[h.level - 1]!.slots
}

/** Gold waiting in a habitat; 0 when the clock is behind `lastCollectedMs`. */
export function storedGold(h: Habitat, residents: readonly Dragon[], c: Catalog, nowMs: number): number {
  const minutes = Math.floor(Math.max(0, nowMs - h.lastCollectedMs) / MS_PER_MINUTE)
  const perMinute = residents.reduce((n, d) => n + goldPerMinute(getSpecies(c, d.speciesId).rarity, d.level), 0)
  return Math.min(HABITAT_LEVELS[h.level - 1]!.cap, minutes * perMinute)
}

export function habitatBuildCost(s: PlayerState, e: Element): number {
  return 500 * 2 ** s.habitats.filter(h => h.element === e).length
}

export function maxHabitats(playerLevel: number): number {
  return 2 + Math.floor(playerLevel / 5)
}
