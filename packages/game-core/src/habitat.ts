import { getSpecies, type Catalog, type Species } from './catalog'
import { goldPerMinuteX20 } from './dragon'
import { HABITAT_CAPACITY, habitatCap } from './data/habitats'
import type { Preset } from './data/presets'
import type { Dragon, Habitat, PlayerState } from './state'

export const MS_PER_MINUTE = 60_000

export function canLiveIn(sp: Species, h: Habitat): boolean {
  return h.element === 'aerie' || sp.elements.includes(h.element)
}

export function residents(s: PlayerState, habitatId: string): Dragon[] {
  return s.dragons.filter(d => d.habitatId === habitatId)
}

/** Dragons a habitat of `level` holds (§5.2): 2, 3, 4, 5, 6. */
export function habitatCapacity(level: number): number {
  return HABITAT_CAPACITY[level - 1]!
}

export function habitatSlots(h: Habitat): number {
  return habitatCapacity(h.level)
}

/**
 * Gold waiting in a habitat: whole minutes since the last collection times the residents' income (§5.1, each at its
 * primary element, wherever it lives), in twentieths (R7), capped by the habitat. 0 when the clock is behind
 * `lastCollectedMs`.
 */
export function storedGold(h: Habitat, residents: readonly Dragon[], c: Catalog, nowMs: number, preset: Preset): number {
  return settleHabitat(h, residents, c, nowMs, preset).gold
}

/**
 * What a collection at `nowMs` pays and the new `lastCollectedMs`. Only the whole minutes paid are consumed, so the
 * remainder carries over; a habitat that stopped producing (capped, or empty) restarts from now, because the time
 * since then earned nothing. Never moves the stamp back.
 */
export function settleHabitat(h: Habitat, residents: readonly Dragon[], c: Catalog, nowMs: number, preset: Preset): { gold: number; lastCollectedMs: number } {
  const minutes = Math.floor(Math.max(0, nowMs - h.lastCollectedMs) / MS_PER_MINUTE)
  const perMinuteX20 = residents.reduce((n, d) => {
    const sp = getSpecies(c, d.speciesId)
    return n + goldPerMinuteX20(sp.elements[0]!, sp.rarity, d.level, preset)
  }, 0)
  const cap = habitatCap(h.element, h.level, preset)
  const accrued = Math.floor(minutes * perMinuteX20 / 20)
  const stopped = accrued >= cap || perMinuteX20 === 0
  return {
    gold: Math.min(cap, accrued),
    lastCollectedMs: stopped ? Math.max(h.lastCollectedMs, nowMs) : h.lastCollectedMs + minutes * MS_PER_MINUTE,
  }
}
