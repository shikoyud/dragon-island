// GDD §4.3 (Player XP), classic values before the preset XP multiplier; §7.2 (level by day), M3 Q1 (c), R40.
import type { Rarity } from '../rarity'
import type { PresetId } from './presets'

/** §4.3 "Hatch an egg": C 10, U 30, R 80, E 200, L 500. */
export const HATCH_XP: Record<Rarity, number> = {
  common: 10, uncommon: 30, rare: 80, epic: 200, legendary: 500,
}

/** §4.3 "Harvest a crop": crop tier x 2. */
export const HARVEST_XP_PER_TIER = 2

/** M3 Q2 (a), R31: build XP is 1 per 20 Gold spent on building, upgrading or expanding. */
export const BUILD_XP_GOLD_PER_XP = 20

/** Least build XP for any paid build (R31). */
export const BUILD_XP_MIN = 5

/** §4.3 "Start a breed". */
export const START_BREED_XP = 5

/** §4.3 XP to leave each Player Level: index = PL - 1, ceil(50 x PL^1.8) for PL 1..49, as literal integers. */
export const XP_TO_NEXT: readonly number[] = [
  50, 175, 362, 607, 906, 1258, 1661, 2112, 2610, 3155,
  3746, 4381, 5060, 5781, 6546, 7352, 8200, 9088, 10017, 10986,
  11995, 13042, 14128, 15253, 16416, 17617, 18855, 20131, 21444, 22793,
  24179, 25601, 27058, 28552, 30082, 31646, 33246, 34881, 36550, 38255,
  39993, 41766, 43573, 45414, 47289, 49197, 51139, 53114, 55122,
]

/** §7.2 Player Level column, Q1 (c), R40, R41: `[lastDay, maxLevel]` rows through Endgame. XP above the day's limit is banked. No limit from Finals on. */
export const XP_LEVEL_LIMITS: Record<PresetId, readonly (readonly [number, number])[]> = {
  flash14: [[1, 12], [2, 18], [3, 25], [4, 30], [5, 32], [6, 33], [7, 34], [8, 36], [9, 37], [10, 38], [11, 39], [12, 40]],
  flash28: [[2, 12], [3, 18], [5, 25], [7, 30], [8, 32], [10, 33], [12, 34], [14, 35], [16, 36], [18, 37], [20, 38], [22, 39], [25, 40]],
}
