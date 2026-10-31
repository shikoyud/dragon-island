import { OBSTACLES } from '../../src/data/obstacles'
import { FOOTPRINT, placementError, type Footprint } from '../../src/island'
import { clearCost } from '../../src/obstacles'
import { placementRuleError, subjectFootprint, type PlacementSubject } from '../../src/placement-rules'
import { ISLAND_TILES, PLOTS_PER_SIDE } from '../../src/plots'
import { newPlayer, type IslandId, type Obstacle, type Placement, type PlayerState } from '../../src/state'

/**
 * The obstacles to clear so `subject` fits somewhere on an island: the cell that needs the fewest, ties by lowest Gold.
 * Null when no cell fits even with every obstacle gone; an empty list means it already fits.
 */
export function cheapestClears(s: PlayerState, subject: PlacementSubject, island: IslandId = 'home'): Obstacle[] | null {
  const size = subjectFootprint(s, subject)!
  const bare: PlayerState = { ...s, islands: { ...s.islands, obstacles: [] } }
  const here = s.islands.obstacles.filter(o => o.island === island)
  let best: Obstacle[] | null = null
  let bestCost = Infinity
  for (let row = 0; row < ISLAND_TILES; row++) for (let col = 0; col < ISLAND_TILES; col++) {
    if (placementRuleError(bare, subject, { island, col, row, facing: 0 }) !== null) continue
    const hit = here.filter(o => {
      const n = OBSTACLES[o.kind].size
      return col < o.col + n && o.col < col + size && row < o.row + n && o.row < row + size
    })
    const cost = hit.reduce((n, o) => n + clearCost(o), 0)
    if (best === null || hit.length < best.length || (hit.length === best.length && cost < bestCost)) { best = hit; bestCost = cost }
  }
  return best
}

/** Every plot index on an island. */
export const ALL_PLOTS: readonly number[] = Array.from({ length: PLOTS_PER_SIDE * PLOTS_PER_SIDE }, (_, i) => i)

/** The first legal cell on owned land for a footprint, reading left to right, top to bottom. Tests use it instead of literal cells. */
export function freeCell(s: PlayerState, size: Footprint, island: IslandId = 'home'): Placement {
  for (let row = 0; row < ISLAND_TILES; row++) for (let col = 0; col < ISLAND_TILES; col++) {
    const p: Placement = { island, col, row, facing: 0 }
    if (placementError(s, p, size) === null) return p
  }
  throw new Error(`no legal ${size}x${size} cell on ${island}`)
}

/** The state with exactly these plots owned on an island. */
export function withPlots(s: PlayerState, plots: readonly number[], island: IslandId = 'home'): PlayerState {
  return { ...s, islands: { ...s.islands, plots: { ...s.islands.plots, [island]: [...plots] } } }
}

/** The state with the whole island owned, for tests that need more room than the start. */
export function withAllLand(s: PlayerState, island: IslandId = 'home'): PlayerState {
  return withPlots(s, ALL_PLOTS, island)
}

/** Whole island owned and a Boulder on every aligned 4x4 that is free, so any new building needs a clear. */
export function withObstacleField(s: PlayerState, island: IslandId = 'home'): PlayerState {
  const owned = withAllLand(s, island)
  const obstacles: Obstacle[] = [...owned.islands.obstacles]
  for (let row = 0; row < ISLAND_TILES; row += 4) for (let col = 0; col < ISLAND_TILES; col += 4) {
    if (placementError(owned, { island, col, row, facing: 0 }, 4) === null) obstacles.push({ id: `f${col}_${row}`, kind: 'boulder', island, col, row })
  }
  return { ...owned, islands: { ...owned.islands, obstacles } }
}

/** Home's plots in a legal buying order (each touches what came before). */
export const HOME_BUY_ORDER: readonly number[] = [4, 8, 7, 11, 1, 2, 13, 14, 0, 3, 12, 15]

/** A free cell on a new player's Home that fits any footprint. */
export const FREE: Placement = freeCell(newPlayer(0), FOOTPRINT.breeder)
/** A second one, clear of `FREE`, for tests that place two things. It fits a 4x4 (the Start has no second free 5x5, R50). */
export const FREE_2: Placement = (() => {
  const s = newPlayer(0)
  for (let row = 0; row < ISLAND_TILES; row++) for (let col = 0; col < ISLAND_TILES; col++) {
    const p: Placement = { island: 'home', col, row, facing: 0 }
    const apart = col >= FREE.col + FOOTPRINT.breeder || FREE.col >= col + FOOTPRINT.habitat || row >= FREE.row + FOOTPRINT.breeder || FREE.row >= row + FOOTPRINT.habitat
    if (apart && placementError(s, p, FOOTPRINT.habitat) === null) return p
  }
  throw new Error('no second free 4x4 cell')
})()
