// GDD §5.6 obstacle table and R50/R51 spawn weights. Gold, XP and drops are integers; timers are classic ms.
import type { Footprint } from '../island'
import type { ObstacleKind } from '../state'
import type { SpeedUpToken } from './speedups'

export type { ObstacleKind }

/** `percent` is a whole-number chance (R54); a range is inclusive. */
export type ObstacleDrop =
  | { percent: number; token: SpeedUpToken } | { percent: number; gold: [number, number] } | { percent: number; food: [number, number] }

export const OBSTACLES: Record<ObstacleKind, { size: Footprint; gold: number; classicMs: number; xp: number; drop: ObstacleDrop | null }> = {
  ancientTree: { size: 4, gold: 25_000, classicMs: 14_400_000, xp: 1_250, drop: { percent: 10, token: '3h' } },
  boulder: { size: 4, gold: 25_000, classicMs: 14_400_000, xp: 1_250, drop: { percent: 10, token: '3h' } },
  largeRock: { size: 3, gold: 5_000, classicMs: 3_600_000, xp: 250, drop: { percent: 5, token: '1h' } },
  tree: { size: 2, gold: 1_000, classicMs: 900_000, xp: 50, drop: { percent: 5, token: '15m' } },
  smallRock: { size: 2, gold: 500, classicMs: 300_000, xp: 25, drop: { percent: 10, gold: [100, 300] } },
  bush: { size: 1, gold: 100, classicMs: 30_000, xp: 5, drop: { percent: 10, food: [10, 25] } },
}

/** R51: 2..4 obstacles per plot, one per quadrant, kinds by weight. */
export const OBSTACLE_SPAWN: { min: 2; max: 4; weights: Record<ObstacleKind, number> } = {
  min: 2, max: 4,
  weights: { ancientTree: 1, boulder: 1, largeRock: 2, tree: 4, smallRock: 4, bush: 8 },
}

/** §5.6: clears running at once, apart from the builders (M4 Q1 a). */
export const MAX_CLEARS = 2
