import { OUTER_ISLANDS } from './island'
import type { IslandId, Obstacle, ObstacleKind } from './state'

/** Base values at multiplier 1 (spec section 4). Timers are ms. */
export const OBSTACLES: Record<ObstacleKind, { size: 1 | 2 | 3; cost: number; timerMs: number; xp: number; food: number }> = {
  bush: { size: 1, cost: 100, timerMs: 60_000, xp: 20, food: 10 },
  rock: { size: 1, cost: 250, timerMs: 300_000, xp: 40, food: 0 },
  tree: { size: 2, cost: 800, timerMs: 1_800_000, xp: 100, food: 60 },
  boulder: { size: 2, cost: 2_000, timerMs: 7_200_000, xp: 250, food: 0 },
  ruin: { size: 3, cost: 6_000, timerMs: 28_800_000, xp: 700, food: 300 },
}

export function obstacleMult(island: IslandId): number {
  return island === 'home' ? 1 : OUTER_ISLANDS[island].mult
}

export function clearCost(o: Obstacle): number {
  return OBSTACLES[o.kind].cost * obstacleMult(o.island)
}

export function clearReward(o: Obstacle): { xp: number; food: number } {
  const m = obstacleMult(o.island)
  return { xp: OBSTACLES[o.kind].xp * m, food: OBSTACLES[o.kind].food * m }
}
