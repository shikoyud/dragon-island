// GDD §2.4 (rarity scaling, stat curve) and §5.1 (rarity income multipliers); R6 fixes the rounding.
import type { Rarity } from '../rarity'

/** §5.1 "Rarity multipliers", in tenths: Common 1.0, Uncommon 1.2, Rare 1.5, Epic 2.0, Legendary 2.5. */
export const GPM_RARITY_MULT_TENTHS: Record<Rarity, number> = {
  common: 10, uncommon: 12, rare: 15, epic: 20, legendary: 25,
}

/** §2.4 table, HP at Lv 40. */
export const HP_AT_40: Record<Rarity, number> = {
  common: 8000, uncommon: 9000, rare: 10000, epic: 12000, legendary: 14000,
}

/** §2.4: ATK is always 0.40 x HP (2/5, exact in integers for every value above). */
export const ATK_AT_40: Record<Rarity, number> = {
  common: HP_AT_40.common * 2 / 5,
  uncommon: HP_AT_40.uncommon * 2 / 5,
  rare: HP_AT_40.rare * 2 / 5,
  epic: HP_AT_40.epic * 2 / 5,
  legendary: HP_AT_40.legendary * 2 / 5,
}

/**
 * §2.4: Stat(L) = Stat40 x [0.20 + 0.80 x (L-1)/39] = Stat40 x (780 + 80(L-1)) / 3900,
 * rounded to the nearest integer, halves up (R6). Integer arithmetic throughout.
 */
export function statAt(stat40: number, level: number): number {
  const num = stat40 * (780 + 80 * (level - 1))
  return Math.floor((2 * num + 3900) / 7800)
}

export function hpAt(r: Rarity, level: number): number {
  return statAt(HP_AT_40[r], level)
}

export function atkAt(r: Rarity, level: number): number {
  return statAt(ATK_AT_40[r], level)
}
