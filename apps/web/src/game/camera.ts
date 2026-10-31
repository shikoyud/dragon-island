import { ISLAND_TILES, ownedPlots, plotOfTile, type IslandId, type PlayerState } from '@wyrmhaven/game-core'
import { islandBox, pointerToCell, type Box } from './layout'

/** Height in world pixels of the cliff drawn under the island's two front edges. */
export const SKIRT = 12
/** Sea shown around the island at the camera's edges. */
const MARGIN = 24

/** What the camera shows: the world point at the screen's centre, and a whole-number zoom. */
export interface View { cx: number; cy: number; zoom: number }

/** Tiles shown on an island: always all of it, with land not owned as fog (R58). */
export function shownSize(): { w: number; h: number } {
  return { w: ISLAND_TILES, h: ISLAND_TILES }
}

/** World box the camera may show: the shown island's diamond, its cliff skirt and a margin of sea. */
export function cameraBounds(_state: PlayerState | null, _view: IslandId): Box {
  const { w, h } = shownSize()
  const b = islandBox(w, h)
  return { x: b.x - MARGIN, y: b.y - MARGIN, w: b.w + 2 * MARGIN, h: b.h + SKIRT + 2 * MARGIN }
}

/** The tile under a world position, or null off the island. Land not owned counts: a red ghost can go over fog. */
export function groundCell(state: PlayerState | null, _view: IslandId, worldX: number, worldY: number): { col: number; row: number } | null {
  if (!state) return null
  const c = pointerToCell(worldX, worldY)
  return plotOfTile(c.col, c.row) === null ? null : c
}

/** World position of a screen pixel (screen = the game canvas, in CSS pixels). */
export function screenToWorld(v: View, viewportW: number, viewportH: number, sx: number, sy: number): { x: number; y: number } {
  return { x: v.cx + (sx - viewportW / 2) / v.zoom, y: v.cy + (sy - viewportH / 2) / v.zoom }
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
 * Opening zoom, a whole number never below 1. Landscape: nearest to fitting the box, leaning up from x.4. Portrait
 * (a phone): rounded up, since the wide island is width-limited with height to spare; edges are a drag away.
 */
export function fitZoom(viewportW: number, viewportH: number, b: Box): number {
  const f = Math.min(viewportW / b.w, viewportH / b.h)
  return Math.max(1, viewportH > viewportW ? Math.ceil(f) : Math.round(f + 0.1))
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

/** Every tile of the viewed island not on an owned plot: the fog. */
export function lockedTiles(state: PlayerState | null, view: IslandId): { col: number; row: number }[] {
  if (!state) return []
  const owned = new Set(ownedPlots(state, view))
  const out: { col: number; row: number }[] = []
  for (let row = 0; row < ISLAND_TILES; row++) for (let col = 0; col < ISLAND_TILES; col++) if (!owned.has(plotOfTile(col, row)!)) out.push({ col, row })
  return out
}
