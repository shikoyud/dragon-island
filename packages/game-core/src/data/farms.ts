// GDD §5.3 (crops, farm levels, farm costs), §4.4 (farm unlocks by Player Level), ruling R10 (Flash-28 timer rounding).
// Every value is classic; the preset multiplies yields and divides grow timers (§7.2).
import type { CropId } from '../state'

export interface CropSpec {
  tier: 1 | 2 | 3 | 4 | 5 | 6
  name: string
  /** Player level that unlocks planting it. */
  unlockPl: number
  growClassicMs: number
  /** Gold to plant. */
  gold: number
  /** Food at Farm L1, before the preset yield multiplier. */
  food: number
}

/** §5.3 crop table, T1 to T6. */
export const CROPS: Record<CropId, CropSpec> = {
  dragonBush: { tier: 1, name: 'Dragon Bush', unlockPl: 1, growClassicMs: 30_000, gold: 50, food: 5 },
  emberWheat: { tier: 2, name: 'Ember Wheat', unlockPl: 3, growClassicMs: 300_000, gold: 250, food: 30 },
  seaMelon: { tier: 3, name: 'Sea Melon', unlockPl: 5, growClassicMs: 1_800_000, gold: 1_000, food: 120 },
  thunderPumpkin: { tier: 4, name: 'Thunder Pumpkin', unlockPl: 8, growClassicMs: 7_200_000, gold: 3_000, food: 360 },
  frostBerries: { tier: 5, name: 'Frost Berries', unlockPl: 12, growClassicMs: 28_800_000, gold: 8_000, food: 1_000 },
  warlordPepper: { tier: 6, name: 'Warlord Pepper', unlockPl: 15, growClassicMs: 86_400_000, gold: 20_000, food: 2_600 },
}

export interface FarmLevelSpec {
  /** Yield as a percent of the L1 crop Food. */
  yieldPct: number
  /** Gold to upgrade to this level (null: not a Gold upgrade). */
  upgradeGold: number | null
  /** Store price in micro-USD to reach this level (null: not a store item). */
  upgradeUsdMicro: number | null
  /** Classic upgrade timer to reach this level (L1: the first farm's build time; L5 is instant). */
  classicMs: number
}

/** §5.3 farm levels; index = level - 1, and an entry holds the cost of reaching that level. */
export const FARM_LEVELS: readonly FarmLevelSpec[] = [
  { yieldPct: 100, upgradeGold: null, upgradeUsdMicro: null, classicMs: 60_000 },
  { yieldPct: 125, upgradeGold: 15_000, upgradeUsdMicro: null, classicMs: 3_600_000 },
  { yieldPct: 150, upgradeGold: 75_000, upgradeUsdMicro: null, classicMs: 14_400_000 },
  { yieldPct: 175, upgradeGold: 400_000, upgradeUsdMicro: null, classicMs: 43_200_000 },
  { yieldPct: 200, upgradeGold: null, upgradeUsdMicro: 2_000_000, classicMs: 0 },
]

/** Player level that unlocks farm n + 1 (§5.3: PL 1, 3, 4, 7, then one every 5 PL, up to 8). */
export const FARM_UNLOCK_PL: readonly number[] = [1, 3, 4, 7, 10, 15, 20, 25]
export const MAX_FARMS = 8

/** §5.3 L1: 1,000 Gold for the first farm (x3 for each additional farm), built in 1 minute. */
export const FIRST_FARM_GOLD = 1_000
export const FIRST_FARM_CLASSIC_MS = 60_000
