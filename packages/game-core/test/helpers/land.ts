import { FOOTPRINT, placementError, type Footprint } from '../../src/island'
import { ISLAND_TILES, PLOTS_PER_SIDE } from '../../src/plots'
import { newPlayer, type IslandId, type Placement, type PlayerState } from '../../src/state'

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
