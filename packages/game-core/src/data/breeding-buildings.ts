// GDD §5.4 (Hatchery, Breeding Mountain, Breeding Grove), §4.4 (unlocks). Rulings: R15 (5x5 footprint), R16 (timers),
// M2 Q5 (a) (the fifth Hatchery slot). Timers are classic; the preset divides them by `timerDiv` (§7.2).
import type { BreederKind } from '../state'

/** One row: what reaching this level costs. Both prices null: free, it comes with the game. */
export interface BuildingLevel {
  /** Gold to reach this level (null: not a Gold purchase). */
  gold: number | null
  /** Store price in micro-USD to reach this level (null: not a store item). */
  usdMicro: number | null
  /** Player level that unlocks this level. */
  minPl: number
  /** Classic build or upgrade timer to reach this level; 0 is instant. */
  classicMs: number
}

/** Index = level - 1. */
export const HATCHERY_LEVELS: readonly (BuildingLevel & { slots: number })[] = [
  { slots: 1, gold: null, usdMicro: null, minPl: 1, classicMs: 0 },
  { slots: 2, gold: 2_000, usdMicro: null, minPl: 4, classicMs: 3_600_000 },
  { slots: 3, gold: 250_000, usdMicro: null, minPl: 13, classicMs: 14_400_000 },
  { slots: 4, gold: 2_000_000, usdMicro: null, minPl: 21, classicMs: 43_200_000 },
]

/** §5.4's "L5": one extra slot, bought once at any Hatchery level (Q5 a). Not a level. */
export const HATCHERY_FIFTH_SLOT: { usdMicro: number; minPl: number } = { usdMicro: 3_000_000, minPl: 15 }

/** Index = level - 1. The Mountain's L1 is there from the start (R1); its PL 2 gates breeding. */
export const BREEDER_LEVELS: Record<BreederKind, readonly (BuildingLevel & { reductionPct: number })[]> = {
  mountain: [
    { reductionPct: 0, gold: null, usdMicro: null, minPl: 2, classicMs: 0 },
    { reductionPct: 10, gold: 150_000, usdMicro: null, minPl: 10, classicMs: 3_600_000 },
    { reductionPct: 20, gold: 1_500_000, usdMicro: null, minPl: 20, classicMs: 14_400_000 },
  ],
  grove: [
    { reductionPct: 0, gold: 400_000, usdMicro: null, minPl: 12, classicMs: 14_400_000 },
    { reductionPct: 10, gold: 1_500_000, usdMicro: null, minPl: 20, classicMs: 3_600_000 },
    { reductionPct: 20, gold: null, usdMicro: 3_500_000, minPl: 25, classicMs: 0 },
  ],
}

/** The Grove's store level (§5.4), read from its row. */
const groveTop = BREEDER_LEVELS.grove[BREEDER_LEVELS.grove.length - 1]!
export const GROVE_L3 = { level: BREEDER_LEVELS.grove.length, usdMicro: groveTop.usdMicro!, minPl: groveTop.minPl }

export const BREEDER_FOOTPRINT = 5
