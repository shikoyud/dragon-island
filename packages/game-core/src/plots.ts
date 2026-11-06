// GDD §5.5 plot geometry and ownership: each island is 4x4 plots of 8x8 tiles (32x32 tiles). Plot index = plotRow * 4 + plotCol.
import { plotPrice } from './data/islands'
import { isUnlocked } from './data/unlocks'
import type { IslandId, Placement, PlayerState } from './state'

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

/** A whole plot index on an island. */
export function isPlot(plot: unknown): plot is number {
  return Number.isInteger(plot) && (plot as number) >= 0 && (plot as number) < PLOTS_PER_SIDE * PLOTS_PER_SIDE
}

/** Two plots touch when they share an edge (R44: corners do not count). */
export function plotsTouch(a: number, b: number): boolean {
  if (!isPlot(a) || !isPlot(b)) return false
  const ac = a % PLOTS_PER_SIDE, ar = Math.floor(a / PLOTS_PER_SIDE)
  const bc = b % PLOTS_PER_SIDE, br = Math.floor(b / PLOTS_PER_SIDE)
  return Math.abs(ac - bc) + Math.abs(ar - br) === 1
}

/** The plots owned on an island; none until it opens. */
export function ownedPlots(s: PlayerState, island: IslandId): readonly number[] {
  return s.islands.plots[island] ?? []
}

/** True when every tile of the square at `p` is on an owned plot (R43: it may straddle several). False off the island. */
export function ownsFootprint(s: PlayerState, p: Pick<Placement, 'island' | 'col' | 'row'>, size: number): boolean {
  const owned = ownedPlots(s, p.island)
  const first = plotOfTile(p.col, p.row)
  const last = plotOfTile(p.col + size - 1, p.row + size - 1)
  if (first === null || last === null) return false
  for (let row = first - first % PLOTS_PER_SIDE; row <= last - last % PLOTS_PER_SIDE; row += PLOTS_PER_SIDE) {
    for (let col = first % PLOTS_PER_SIDE; col <= last % PLOTS_PER_SIDE; col++) if (!owned.includes(row + col)) return false
  }
  return true
}

/** Plots bought on an island, past the 4 it opens with. This count sets the price (R45) and Home's gate (R46). */
export function plotsBought(s: PlayerState, island: IslandId): number {
  return Math.max(0, ownedPlots(s, island).length - STARTING_PLOTS.length)
}

/** U1: the order Home reveals its 12 purchasable plots in. The first three stand on the right of the screen (U2). */
export const HOME_PLOT_ORDER: readonly number[] = [2, 7, 11, 1, 14, 13, 4, 8, 3, 15, 0, 12]

/** How many Home plots are for sale at once. */
const HOME_OFFER_SIZE = 3

/**
 * The plots that can be bought now. Home (U1): the first 3 of HOME_PLOT_ORDER that are unowned and touch owned land.
 * Other islands: every unowned plot touching owned land (M4), ascending.
 */
export function offeredPlots(s: PlayerState, island: IslandId): number[] {
  const owned = ownedPlots(s, island)
  const open = (plot: number) => !owned.includes(plot) && owned.some(o => plotsTouch(o, plot))
  if (island === 'home') return HOME_PLOT_ORDER.filter(open).slice(0, HOME_OFFER_SIZE)
  const out: number[] = []
  for (let plot = 0; plot < PLOTS_PER_SIDE * PLOTS_PER_SIDE; plot++) if (open(plot)) out.push(plot)
  return out
}

export type PlotError = 'ISLAND_LOCKED' | 'PLOT_OWNED' | 'PLOT_NOT_ADJACENT' | 'PLOT_NOT_OFFERED' | 'LEVEL_TOO_LOW' | 'MAX_PLOTS'

/** Why a plot can't be bought, Gold aside. Only Home's plots have a level gate (R47). */
export function plotError(s: PlayerState, island: IslandId, plot: number): PlotError | null {
  if (!s.islands.unlocked.includes(island)) return 'ISLAND_LOCKED'
  const owned = ownedPlots(s, island)
  if (owned.includes(plot)) return 'PLOT_OWNED'
  if (!owned.some(o => plotsTouch(o, plot))) return 'PLOT_NOT_ADJACENT'
  if (!offeredPlots(s, island).includes(plot)) return 'PLOT_NOT_OFFERED'
  const bought = plotsBought(s, island)
  if (plotPrice(island, bought) === null) return 'MAX_PLOTS'
  return island === 'home' && !isUnlocked(`home:${bought}`, s.level) ? 'LEVEL_TOO_LOW' : null
}
