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

/** U7: two obstacles' footprints have at least this many empty tiles between them on one axis. */
export const OBSTACLE_GAP = 2

type Box = { col: number; row: number }

/** True when the squares at `a` (side `sizeA`) and `b` (side `sizeB`) have OBSTACLE_GAP empty tiles between them on the column or the row axis. */
export function obstaclesApart(a: Box, sizeA: number, b: Box, sizeB: number): boolean {
  return a.col + sizeA + OBSTACLE_GAP <= b.col || b.col + sizeB + OBSTACLE_GAP <= a.col
    || a.row + sizeA + OBSTACLE_GAP <= b.row || b.row + sizeB + OBSTACLE_GAP <= a.row
}

/** The kinds in the table's order, biggest first: a kind that doesn't fit falls to the one after it. */
const KINDS_BIG_TO_SMALL = Object.keys(OBSTACLE_SPAWN.weights) as ObstacleKind[]

/**
 * R51 with U7: 2..4 obstacles on a plot, each in a different quadrant, at least OBSTACLE_GAP tiles from `occupied`
 * (buildings, other plots' obstacles) and from each other. When the rolled kind has no room in its quadrant it drops
 * to the next smaller kind; with no room at any size that obstacle is skipped.
 * `rng` order is fixed for replay: the count, then for each obstacle its kind, quadrant, and one position roll.
 */
export function spawnPlotObstacles(
  island: IslandId, plot: number, firstId: number, rng: Rng, occupied: readonly { col: number; row: number; size: number }[],
): Obstacle[] {
  const count = OBSTACLE_SPAWN.min + rng.int(OBSTACLE_SPAWN.max - OBSTACLE_SPAWN.min + 1)
  const quadrants = [0, 1, 2, 3]
  const origin = plotOrigin(plot)
  const out: Obstacle[] = []
  const placed: { col: number; row: number; size: number }[] = [...occupied]
  for (let i = 0; i < count; i++) {
    const rolled = pickKind(rng)
    const q = quadrants.splice(rng.int(quadrants.length), 1)[0]!
    const qCol = origin.col + (q % 2) * QUADRANT
    const qRow = origin.row + Math.floor(q / 2) * QUADRANT
    for (const kind of KINDS_BIG_TO_SMALL.slice(KINDS_BIG_TO_SMALL.indexOf(rolled))) {
      const size = OBSTACLES[kind].size
      const slack = QUADRANT - size + 1
      const spots: Box[] = []
      for (let r = 0; r < slack; r++) for (let c = 0; c < slack; c++) {
        const at = { col: qCol + c, row: qRow + r }
        if (placed.every(p => obstaclesApart(at, size, p, p.size))) spots.push(at)
      }
      if (spots.length === 0) continue
      const at = spots[rng.int(spots.length)]!
      placed.push({ ...at, size })
      out.push({ id: `o${firstId + out.length}`, kind, island, col: at.col, row: at.row })
      break
    }
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
