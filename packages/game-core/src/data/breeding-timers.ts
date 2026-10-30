// GDD §3.5 (breeding timers). Hatch time equals breed time.
import { highestTier } from '../elements'
import type { Element, ElementTier } from './elements'
import type { Preset } from './presets'
import type { Rarity } from '../rarity'

const SEC = 1000
const MIN = 60 * SEC
const HOUR = 60 * MIN

/** §3.5 "Classic base" column: Tier A / B / C. Flash-14 divides by 6, Flash-28 by 4 (`Preset.timerDiv`). */
export const BREED_TIMER_CLASSIC_MS: Record<Rarity, Record<ElementTier, number>> = {
  common: { A: 30 * SEC, B: 15 * MIN, C: 1 * HOUR },
  uncommon: { A: 30 * MIN, B: 1 * HOUR, C: 2 * HOUR },
  rare: { A: 4 * HOUR, B: 6 * HOUR, C: 8 * HOUR },
  epic: { A: 12 * HOUR, B: 18 * HOUR, C: 24 * HOUR },
  legendary: { A: 48 * HOUR, B: 48 * HOUR, C: 48 * HOUR },
}

/** The offspring's rarity and its highest element tier set the timer (C over B over A). */
export function breedTimerMs(r: Rarity, elements: readonly Element[], preset: Preset): number {
  return Math.floor(BREED_TIMER_CLASSIC_MS[r][highestTier(elements)] / preset.timerDiv)
}
