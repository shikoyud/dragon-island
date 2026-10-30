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
 * A dragon's income in `h`, in twentieths of Gold per minute (§5.1, A13, R21): at its primary element, and with
 * `preset.habitatRateCap` set, at most that percent of the native rate (same rarity and level at the habitat's element).
 * The Golden Aerie is uncapped.
 */
export function dragonRateX20(sp: Species, level: number, h: Habitat, preset: Preset): number {
  const rate = goldPerMinuteX20(sp.elements[0]!, sp.rarity, level, preset)
  if (preset.habitatRateCap === null || h.element === 'aerie') return rate
  const native = goldPerMinuteX20(h.element, sp.rarity, level, preset)
  return Math.min(rate, Math.floor(native * preset.habitatRateCap / 100))
}

/**
 * Gold waiting in a habitat: the time since the last collection, to the millisecond, times the residents' income (§5.1,
 * each at its primary element, wherever it lives), in twentieths (R7), capped by the habitat. 0 when the clock is behind
 * `lastCollectedMs`. A collection floors to whole Gold, so it loses under 1 Gold and each segment pays only its residents.
 */
export function storedGold(h: Habitat, residents: readonly Dragon[], c: Catalog, nowMs: number, preset: Preset): number {
  const elapsedMs = Math.max(0, nowMs - h.lastCollectedMs)
  const perMinuteX20 = residents.reduce((n, d) => {
    const sp = getSpecies(c, d.speciesId)
    return n + dragonRateX20(sp, d.level, h, preset)
  }, 0)
  // Multiply first: at most ~1.7e15 (six Lv 40 Legendaries for a 21-day game), well under 2^53, so the product is exact.
  return Math.min(habitatCap(h.element, h.level, preset), Math.floor(elapsedMs * perMinuteX20 / (20 * MS_PER_MINUTE)))
}
