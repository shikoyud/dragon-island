// GDD §5.4 (Hatchery, Breeding Mountain, Breeding Grove), §4.4 (unlocks). Rulings: R16 (timers),
// M2 Q5 (a) (the fifth Hatchery slot). Unlock levels live in data/unlocks.ts (R32). Timers are classic; the preset divides them by `timerDiv` (§7.2).
import type { BreederKind } from '../state'

/** One row: what reaching this level costs. Both prices null: free, it comes with the game. */
export interface BuildingLevel {
  /** Gold to reach this level (null: not a Gold purchase). */
  gold: number | null
  /** Store price in micro-USD to reach this level (null: not a store item). */
  usdMicro: number | null
  /** Classic build or upgrade timer to reach this level; 0 is instant. */
  classicMs: number
}

/** Index = level - 1. */
export const HATCHERY_LEVELS: readonly (BuildingLevel & { slots: number })[] = [
  { slots: 1, gold: null, usdMicro: null, classicMs: 0 },
  { slots: 2, gold: 2_000, usdMicro: null, classicMs: 3_600_000 },
  { slots: 3, gold: 250_000, usdMicro: null, classicMs: 14_400_000 },
  { slots: 4, gold: 2_000_000, usdMicro: null, classicMs: 43_200_000 },
]

/** §5.4's "L5": one extra slot, bought once at any Hatchery level (Q5 a). Not a level. */
export const HATCHERY_FIFTH_SLOT: { usdMicro: number } = { usdMicro: 3_000_000 }

/** Index = level - 1. The Mountain's L1 is there from the start (R1); `mountain:1` gates breeding. Unlock levels: data/unlocks.ts. */
export const BREEDER_LEVELS: Record<BreederKind, readonly (BuildingLevel & { reductionPct: number })[]> = {
  mountain: [
    { reductionPct: 0, gold: null, usdMicro: null, classicMs: 0 },
    { reductionPct: 10, gold: 150_000, usdMicro: null, classicMs: 3_600_000 },
    { reductionPct: 20, gold: 1_500_000, usdMicro: null, classicMs: 14_400_000 },
  ],
  grove: [
    { reductionPct: 0, gold: 400_000, usdMicro: null, classicMs: 14_400_000 },
    { reductionPct: 10, gold: 1_500_000, usdMicro: null, classicMs: 3_600_000 },
    { reductionPct: 20, gold: null, usdMicro: 3_500_000, classicMs: 0 },
  ],
}

/** The Grove's store level (§5.4), read from its row. */
const groveTop = BREEDER_LEVELS.grove[BREEDER_LEVELS.grove.length - 1]!
export const GROVE_L3 = { level: BREEDER_LEVELS.grove.length, usdMicro: groveTop.usdMicro! }

/** §5.4: Mountain and Grove stand on 5x5 tiles. */
export const BREEDER_FOOTPRINT = 5
