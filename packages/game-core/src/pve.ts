import type { BattleDragonSpec } from './battle/stats'
import type { Catalog } from './catalog'
import { MAX_DRAGON_LEVEL } from './dragon'
import { RARITIES, type Rarity } from './rarity'
import { createRng } from './rng'

export const PVE_STAGES = 30
export const PVE_REPLAYS_PER_DAY = 10
export const PVE_MIN_PLAYER_LEVEL = 5
export const PVP_MIN_PLAYER_LEVEL = 8
export const PVP_ATTACKS_PER_DAY = 20

const STAGE_SEED_BASE = 1_000

export function stageLevel(stage: number): number {
  return Math.min(MAX_DRAGON_LEVEL, stage + 2)
}

export function stageRarity(stage: number): Rarity {
  return stage <= 10 ? 'common' : stage <= 20 ? 'rare' : 'epic'
}

/** Fixed per stage (seeded by stage number); falls back to the best rarity the catalog has. */
export function stageTeam(stage: number, c: Catalog): BattleDragonSpec[] {
  const nonLegendary = [...c.species.values()].filter(s => s.rarity !== 'legendary')
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  let rarityIndex = RARITIES.indexOf(stageRarity(stage))
  let pool = nonLegendary.filter(s => s.rarity === RARITIES[rarityIndex])
  while (pool.length === 0 && rarityIndex > 0) pool = nonLegendary.filter(s => s.rarity === RARITIES[--rarityIndex])
  const rng = createRng(STAGE_SEED_BASE + stage)
  return Array.from({ length: 3 }, () => ({ speciesId: pool[rng.int(pool.length)]!.id, level: stageLevel(stage) }))
}

export interface StageRewards { gold: number; food: number; xp: number }

/** First clear: 100·stage gold, 20·stage food, 15 XP (spec §8). Replay: a quarter of the gold only. */
export function stageRewards(stage: number, firstClear: boolean): StageRewards {
  return firstClear ? { gold: 100 * stage, food: 20 * stage, xp: 15 } : { gold: 25 * stage, food: 0, xp: 0 }
}
