import { ISLAND_TILES, offeredPlots, ownedPlots, plotOfTile, plotOrigin, PLOTS_PER_SIDE, TILES_PER_PLOT, type IslandId, type PlayerState } from '@wyrmhaven/game-core'
import { landmass } from './islandShape'
import { footprintDiamond, islandBox, pointerToCell, type Box } from './layout'

/** Height in world pixels of the cliff drawn under the island's two front edges. */
export const SKIRT = 12
/** Sky shown around the island at the camera's edges. */
const MARGIN = 24

/** What the camera shows: the world point at the screen's centre, and a whole-number zoom. */
export interface View { cx: number; cy: number; zoom: number }

/** Tiles shown on an island: always all of it, with land not owned as fog (R58). */
export function shownSize(): { w: number; h: number } {
  return { w: ISLAND_TILES, h: ISLAND_TILES }
}

/** Home with all 16 plots: built once, as it never changes. */
let fullHome: Box | null = null

/**
 * World box the camera may show. Home: the full landmass of all 16 plots and a margin, so it doesn't change as land grows.
 * Other islands: the 32x32 diamond, its cliff skirt and a margin.
 */
export function cameraBounds(view: IslandId): Box {
  if (view === 'home') {
    const b = (fullHome ??= landmass(Array.from({ length: PLOTS_PER_SIDE * PLOTS_PER_SIDE }, (_, i) => i)).box)
    return { x: b.x - MARGIN, y: b.y - MARGIN, w: b.w + 2 * MARGIN, h: b.h + 2 * MARGIN }
  }
  const { w, h } = shownSize()
  const b = islandBox(w, h)
  return { x: b.x - MARGIN, y: b.y - MARGIN, w: b.w + 2 * MARGIN, h: b.h + SKIRT + 2 * MARGIN }
}

/**
 * The plots drawn as land on an island: Home shows what the player owns plus the plots offered for sale (U3), every other
 * island all 16 (owned ones as grass, the rest as fog).
 */
export function landPlots(state: PlayerState, view: IslandId): number[] {
  if (view !== 'home') return Array.from({ length: PLOTS_PER_SIDE * PLOTS_PER_SIDE }, (_, i) => i)
  return [...ownedPlots(state, view), ...offeredPlots(state, view)]
}

/** The tile under a world position, or null off the land shown. Locked land counts: a red ghost can go over it. */
export function groundCell(state: PlayerState | null, view: IslandId, worldX: number, worldY: number): { col: number; row: number } | null {
  if (!state) return null
  const c = pointerToCell(worldX, worldY)
  const plot = plotOfTile(c.col, c.row)
  return plot === null || !landPlots(state, view).includes(plot) ? null : c
}

/** The plot for sale under a world position, or null: a tap on its bare ground opens it (design: "Locked plot | any | opens Expand"). */
export function offeredPlotAt(state: PlayerState | null, view: IslandId, worldX: number, worldY: number): number | null {
  if (!state) return null
  const c = pointerToCell(worldX, worldY)
  const plot = plotOfTile(c.col, c.row)
  return plot !== null && offeredPlots(state, view).includes(plot) ? plot : null
}

/** World position of a screen pixel (screen = the game canvas, in CSS pixels). */
export function screenToWorld(v: View, viewportW: number, viewportH: number, sx: number, sy: number): { x: number; y: number } {
  return { x: v.cx + (sx - viewportW / 2) / v.zoom, y: v.cy + (sy - viewportH / 2) / v.zoom }
}

/** Screen pixel of a world position. */
export function worldToScreen(v: View, viewportW: number, viewportH: number, wx: number, wy: number): { x: number; y: number } {
  return { x: (wx - v.cx) * v.zoom + viewportW / 2, y: (wy - v.cy) * v.zoom + viewportH / 2 }
}

/** Drag by (dx, dy) screen pixels: the world follows the pointer. */
export function panBy(v: View, dx: number, dy: number): View {
  return { cx: v.cx - dx / v.zoom, cy: v.cy - dy / v.zoom, zoom: v.zoom }
}

/** Change zoom keeping the world point under the screen pixel (sx, sy) where it is. */
export function zoomAt(v: View, viewportW: number, viewportH: number, sx: number, sy: number, zoom: number): View {
  const w = screenToWorld(v, viewportW, viewportH, sx, sy)
  return { cx: w.x - (sx - viewportW / 2) / zoom, cy: w.y - (sy - viewportH / 2) / zoom, zoom }
}

function clampAxis(c: number, visible: number, start: number, size: number): number {
  // Larger than the screen: the view stays inside the bounds. Smaller: the bounds stay inside the view (free to drag).
  const lo = visible >= size ? start + size - visible / 2 : start + visible / 2
  const hi = visible >= size ? start + visible / 2 : start + size - visible / 2
  return Math.min(hi, Math.max(lo, c))
}

/** Keeps the view inside the bounds, or, on an axis where the island is smaller than the screen, the island whole on screen. */
export function clampView(v: View, viewportW: number, viewportH: number, b: Box): View {
  return {
    cx: clampAxis(v.cx, viewportW / v.zoom, b.x, b.w),
    cy: clampAxis(v.cy, viewportH / v.zoom, b.y, b.h),
    zoom: v.zoom,
  }
}

/**
 * Opening zoom, a whole number. Landscape: nearest to fitting the box, leaning up from x.4, and never below 2: zoom 1 is
 * unreadable, and a short screen has the rest a drag or a zoom away. Portrait (a phone): rounded up, never below 1, since
 * the wide island is width-limited with height to spare; edges are a drag away.
 */
export function fitZoom(viewportW: number, viewportH: number, b: Box): number {
  const f = Math.min(viewportW / b.w, viewportH / b.h)
  return viewportH > viewportW ? Math.max(1, Math.ceil(f)) : Math.max(2, Math.round(f + 0.1))
}

/**
 * How far to pan, in screen px, to bring a thing into the band the HUD leaves free: from the `top` of what it shows above
 * itself to its `bottom`, and its `x` from the sides. If it's taller than the band, the bottom wins: that keeps it clear of the buttons.
 */
export function revealPan(s: { x: number; top: number; bottom: number }, screen: { w: number; h: number }, insets: { top: number; bottom: number }): { dx: number; dy: number } {
  const side = 48
  const minY = insets.top + 8
  const maxY = screen.h - insets.bottom - 24
  const dx = s.x < side ? side - s.x : s.x > screen.w - side ? screen.w - side - s.x : 0
  let dy = s.top < minY ? minY - s.top : 0
  if (s.bottom + dy > maxY) dy = maxY - s.bottom
  return { dx, dy }
}

/** World px kept round owned land when fitting it: a plot sign (drawn at half size) and its caption at the corner stay clear of the HUD, a building on the edge uncropped. */
const OPENING_PAD = 32

/**
 * World box round the diamonds of the land shown on an island (`landPlots`: owned plus, on Home, the offered ones). With no
 * state it is the whole island's, so the camera has somewhere to open.
 */
export function landBox(state: PlayerState | null, view: IslandId): Box {
  const land = state ? landPlots(state, view) : []
  if (land.length === 0) return islandBox(ISLAND_TILES, ISLAND_TILES)
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (const plot of land) {
    const o = plotOrigin(plot)
    for (const p of footprintDiamond(o.col, o.row, TILES_PER_PLOT)) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y) }
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
}

/**
 * Where the camera opens (R58): the middle of the owned land, at the whole-number zoom that fits it with a margin
 * (`fitZoom`). `viewportH` is the height the HUD leaves free. Drag or zoom reaches the rest of the island.
 */
export function openingView(state: PlayerState | null, view: IslandId, viewportW: number, viewportH: number): View {
  const b = landBox(state, view)
  const padded = { x: b.x - OPENING_PAD, y: b.y - OPENING_PAD, w: b.w + 2 * OPENING_PAD, h: b.h + 2 * OPENING_PAD }
  return { cx: b.x + b.w / 2, cy: b.y + b.h / 2, zoom: fitZoom(viewportW, viewportH, padded) }
}

/** A press that ended within 4 px of where it began is a click, not a pan. */
export function isClick(downX: number, downY: number, upX: number, upY: number): boolean {
  return Math.hypot(upX - downX, upY - downY) <= 4
}

/** Zoom runs in whole numbers from 1 to three steps past the opening zoom. */
export function zoomRange(fit: number): { min: number; max: number } {
  return { min: 1, max: fit + 3 }
}

/** One wheel notch or pinch step: `dir` -1 zooms in, +1 zooms out; always a whole number inside the range. */
export function stepZoom(zoom: number, dir: -1 | 1, range: { min: number; max: number }): number {
  return Math.min(range.max, Math.max(range.min, zoom - dir))
}

/** Every tile on land shown but not owned: the offered plots on Home, the fog on other islands. */
export function lockedTiles(state: PlayerState | null, view: IslandId): { col: number; row: number }[] {
  if (!state) return []
  const owned = new Set(ownedPlots(state, view))
  const shownPlots = new Set(landPlots(state, view))
  const out: { col: number; row: number }[] = []
  for (let row = 0; row < ISLAND_TILES; row++) for (let col = 0; col < ISLAND_TILES; col++) {
    const plot = plotOfTile(col, row)!
    if (shownPlots.has(plot) && !owned.has(plot)) out.push({ col, row })
  }
  return out
}
