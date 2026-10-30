// Ruling A9: dragons keep selling for Gold. The values are the existing sell prices carried over per rarity;
// a Legendary cannot be sold (null).
import type { Rarity } from '../rarity'

export const SELL_GOLD: Record<Rarity, number | null> = {
  common: 100, uncommon: 500, rare: 2500, epic: 10000, legendary: null,
}
