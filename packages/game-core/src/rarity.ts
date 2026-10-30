export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'

/** GDD §2.4 order, weakest first. */
export const RARITIES: readonly Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary']

export * from './data/stats'
