export type Rarity = 'common' | 'rare' | 'epic' | 'legendary'

export interface RarityInfo {
  breedMs: number
  hatchMs: number
  /** Gold per minute at effective level 1. */
  baseGold: number
  /** Battle stat multiplier in percent (100 = ×1.0). */
  statPct: number
  /** Rarity score S used in breeding tier weights. */
  score: number
  sellGold: number
  /** Player XP for breeding or hatching a dragon of this rarity. */
  xp: number
}

export const RARITY: Record<Rarity, RarityInfo> = {
  common: { breedMs: 120_000, hatchMs: 120_000, baseGold: 2, statPct: 100, score: 0, sellGold: 100, xp: 10 },
  rare: { breedMs: 1_800_000, hatchMs: 1_800_000, baseGold: 5, statPct: 120, score: 1, sellGold: 500, xp: 30 },
  epic: { breedMs: 14_400_000, hatchMs: 14_400_000, baseGold: 12, statPct: 150, score: 2, sellGold: 2_500, xp: 100 },
  legendary: { breedMs: 43_200_000, hatchMs: 43_200_000, baseGold: 30, statPct: 200, score: 3, sellGold: 10_000, xp: 300 },
}

export const RARITIES: readonly Rarity[] = ['common', 'rare', 'epic', 'legendary']
