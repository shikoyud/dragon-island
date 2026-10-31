import { FOOTPRINT, ISLAND_TILES, newPlayer, placementError, STARTING_PLOTS, type Footprint, type IslandId, type Placement, type PlayerState } from '@wyrmhaven/game-core'

/** The first legal cell on owned land for a footprint (the same idea as game-core's test/helpers/land.ts). */
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

/** The state with `island` open and its 4 centre plots owned, as a Bridge leaves it. */
export function withIsland(s: PlayerState, island: Exclude<IslandId, 'home'>): PlayerState {
  return { ...s, islands: { ...s.islands, unlocked: [...s.islands.unlocked, island], plots: { ...s.islands.plots, [island]: [...STARTING_PLOTS] } } }
}

/** A free cell on a new player's Home that fits any footprint. */
export const FREE: Placement = freeCell(newPlayer(0), FOOTPRINT.breeder)
/** A second one, clear of `FREE`. */
export const FREE_2: Placement = { ...FREE, col: FREE.col + FOOTPRINT.breeder }
