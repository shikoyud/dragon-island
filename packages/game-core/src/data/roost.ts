// GDD §4.2 (Dragon Roost), §7.4 (Ascension $2.00). Rulings: R33 (2 cells until M4), R34 (PL 5 is the Tier 1 gate), R35 (Ascension).
// Unlock levels live in data/unlocks.ts (`roost:n`). Timers are classic; the preset divides them by `timerDiv` (§7.2).

export interface RoostTier {
  /** 1..5; `roostTier` holds the highest finished one (0 = none yet). */
  tier: number
  /** Highest dragon level this tier allows. */
  levelCap: number
  /** Gold to reach this tier. */
  gold: number
  /** Store price in micro-USD to reach this tier (Tier 5 is Ascension, 100 % burned, R35). */
  usdMicro: number | null
  /** Classic build or upgrade timer. */
  classicMs: number
}

const H = 3_600_000

export const ROOST_TIERS: readonly RoostTier[] = [
  { tier: 1, levelCap: 10, gold: 5_000, usdMicro: null, classicMs: 30 * 60_000 },
  { tier: 2, levelCap: 15, gold: 75_000, usdMicro: null, classicMs: 4 * H },
  { tier: 3, levelCap: 20, gold: 400_000, usdMicro: null, classicMs: 12 * H },
  { tier: 4, levelCap: 30, gold: 2_500_000, usdMicro: null, classicMs: 24 * H },
  { tier: 5, levelCap: 40, gold: 10_000_000, usdMicro: 2_000_000, classicMs: 48 * H },
]

/** Tier 5 is bought through the store as Ascension. */
export const ASCENSION_TIER = ROOST_TIERS.length

/** Dragon level cap with no Roost at all (§4.2). */
export const BASE_LEVEL_CAP = 7

/** 2 cells until M4 changes every footprint together (R33). */
export const ROOST_FOOTPRINT = 2
