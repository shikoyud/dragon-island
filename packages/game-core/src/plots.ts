// GDD §5.5 plot geometry: each island is 4x4 plots of 8x8 tiles (32x32 tiles). Plot index = plotRow * 4 + plotCol.
export const PLOTS_PER_SIDE = 4
export const TILES_PER_PLOT = 8
export const ISLAND_TILES = PLOTS_PER_SIDE * TILES_PER_PLOT

/** The centre 2x2 every island opens with (Home Isle from the start, others via their Bridge). */
export const STARTING_PLOTS: readonly number[] = [5, 6, 9, 10]

/** The plot holding a tile, or null off the island. */
export function plotOfTile(col: number, row: number): number | null {
  if (!Number.isInteger(col) || !Number.isInteger(row)) return null
  if (col < 0 || row < 0 || col >= ISLAND_TILES || row >= ISLAND_TILES) return null
  return Math.floor(row / TILES_PER_PLOT) * PLOTS_PER_SIDE + Math.floor(col / TILES_PER_PLOT)
}

/** The top-left tile of a plot. */
export function plotOrigin(plot: number): { col: number; row: number } {
  return { col: (plot % PLOTS_PER_SIDE) * TILES_PER_PLOT, row: Math.floor(plot / PLOTS_PER_SIDE) * TILES_PER_PLOT }
}

/** Two plots touch when they share an edge (R44: corners do not count). */
export function plotsTouch(a: number, b: number): boolean {
  const ac = a % PLOTS_PER_SIDE, ar = Math.floor(a / PLOTS_PER_SIDE)
  const bc = b % PLOTS_PER_SIDE, br = Math.floor(b / PLOTS_PER_SIDE)
  return Math.abs(ac - bc) + Math.abs(ar - br) === 1
}
