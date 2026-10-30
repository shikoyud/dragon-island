// GDD §3.2 (breeding weights) and §8.4 (Featured Legendary windows; M2 Q2 (a): a Legendary can be bred while it is featured).
import type { Rarity } from '../rarity'
import type { PresetId } from './presets'

/** §3.2: integer weight of a qualifying species, by its rarity. */
export const BREED_WEIGHT: Record<Rarity, number> = {
  common: 1000,
  uncommon: 500,
  rare: 200,
  epic: 60,
  legendary: 40,
}

/** Inclusive game-day windows per preset. */
export const LEGENDARY_EVENTS: readonly { speciesId: string; days: Record<PresetId, readonly [number, number]> }[] = [
  { speciesId: 'magma-sovereign', days: { flash14: [1, 4], flash28: [1, 7] } },
  { speciesId: 'glacier-warlord', days: { flash14: [5, 8], flash28: [8, 15] } },
  { speciesId: 'radiant-aegis', days: { flash14: [9, 12], flash28: [16, 24] } },
]
