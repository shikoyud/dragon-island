import { ISLANDS } from './data/islands'
import { MAX_CLEARS, OBSTACLES, OBSTACLE_SPAWN, type ObstacleDrop } from './data/obstacles'
import type { Preset } from './data/presets'
import type { SpeedUpToken } from './data/speedups'
import { plotOrigin, TILES_PER_PLOT } from './plots'
import type { Rng } from './rng'
import type { IslandId, Obstacle, ObstacleKind } from './state'

export { MAX_CLEARS, OBSTACLES, OBSTACLE_SPAWN }
export type { ObstacleDrop }

export function obstacleMult(island: IslandId): number {
  return ISLANDS[island].obstacleMult
}

/** §5.6: base Gold × the island's multiplier (R52: Gold only). */
export function clearCost(o: Obstacle): number {
  return OBSTACLES[o.kind].gold * obstacleMult(o.island)
}

/** Classic XP, unscaled by island (R52); the preset's `xpMult` is applied where it is paid. */
export function clearReward(o: Obstacle): { xp: number } {
  return { xp: OBSTACLES[o.kind].xp }
}

/** R53: the classic timer divided by the preset's build divisor. */
export function clearTimerMs(kind: ObstacleKind, preset: Preset): number {
  return Math.floor(OBSTACLES[kind].classicMs / preset.timerDiv)
}

/** A plot is 8×8 tiles; each quadrant is 4×4, so an obstacle up to 4×4 always fits inside one. */
const QUADRANT = TILES_PER_PLOT / 2

function pickKind(rng: Rng): ObstacleKind {
  const kinds = Object.keys(OBSTACLE_SPAWN.weights) as ObstacleKind[]
  let roll = rng.int(kinds.reduce((n, k) => n + OBSTACLE_SPAWN.weights[k], 0))
  for (const k of kinds) {
    roll -= OBSTACLE_SPAWN.weights[k]
    if (roll < 0) return k
  }
  return kinds[kinds.length - 1]!
}

/**
 * R51: 2..4 obstacles on a plot, each in a different quadrant at a random offset that keeps it inside.
 * `rng` order is fixed for replay: the count, then for each obstacle its kind, quadrant, column offset, row offset.
 */
export function spawnPlotObstacles(island: IslandId, plot: number, firstId: number, rng: Rng): Obstacle[] {
  const count = OBSTACLE_SPAWN.min + rng.int(OBSTACLE_SPAWN.max - OBSTACLE_SPAWN.min + 1)
  const quadrants = [0, 1, 2, 3]
  const origin = plotOrigin(plot)
  const out: Obstacle[] = []
  for (let i = 0; i < count; i++) {
    const kind = pickKind(rng)
    const q = quadrants.splice(rng.int(quadrants.length), 1)[0]!
    const slack = QUADRANT - OBSTACLES[kind].size + 1
    const col = origin.col + (q % 2) * QUADRANT + rng.int(slack)
    const row = origin.row + Math.floor(q / 2) * QUADRANT + rng.int(slack)
    out.push({ id: `o${firstId + i}`, kind, island, col, row })
  }
  return out
}

const range = (r: [number, number], rng: Rng): number => r[0] + rng.int(r[1] - r[0] + 1)

/** R54: one roll for the chance, then one for the amount. At most one of the three fields is set. */
export function rollDrop(kind: ObstacleKind, rng: Rng): { gold?: number; food?: number; token?: SpeedUpToken } {
  const drop: ObstacleDrop | null = OBSTACLES[kind].drop
  if (!drop || rng.int(100) >= drop.percent) return {}
  if ('token' in drop) return { token: drop.token }
  if ('gold' in drop) return { gold: range(drop.gold, rng) }
  return { food: range(drop.food, rng) }
}
