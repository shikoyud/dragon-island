import { HOME_MAX_STEP, homeSize, islandSize, type IslandId, type PlayerState } from '@wyrmhaven/game-core'
import { BASE, integerZoom, pointerToCell, worldSize } from './layout'

/** Cells shown on home: the unlocked square plus a two-cell ring of locked land (the next two expansions). */
function homeShown(state: PlayerState): { w: number; h: number } {
  return homeSize(Math.min(state.islands.homeStep + 2, HOME_MAX_STEP))
}

/** World size in pixels of the viewed island (the camera's scroll bounds), including home's locked ring. */
export function cameraBounds(state: PlayerState | null, view: IslandId): { w: number; h: number } {
  if (!state) return { w: BASE.w, h: BASE.h }
  const { w, h } = view === 'home' ? homeShown(state) : islandSize(state, view)
  return worldSize(w, h)
}

/** The cell under a world position, or null when it falls outside the viewed island. */
export function groundCell(state: PlayerState | null, view: IslandId, worldX: number, worldY: number): { col: number; row: number } | null {
  if (!state) return null
  const { w, h } = islandSize(state, view)
  const c = pointerToCell(worldX, worldY)
  return c.col < 0 || c.row < 0 || c.col >= w || c.row >= h ? null : c
}

/** A press that ended within 4 px of where it began is a click, not a pan. */
export function isClick(downX: number, downY: number, upX: number, upY: number): boolean {
  return Math.hypot(upX - downX, upY - downY) <= 4
}

/** Wheel zoom runs from the whole-number zoom that fits the viewport up to two steps closer. */
export function zoomRange(viewportW: number, viewportH: number): { min: number; max: number } {
  const min = integerZoom(viewportW, viewportH)
  return { min, max: min + 2 }
}

/** One wheel notch: `dir` -1 zooms in, +1 zooms out; always a whole number inside the range. */
export function stepZoom(zoom: number, dir: -1 | 1, range: { min: number; max: number }): number {
  return Math.min(range.max, Math.max(range.min, zoom - dir))
}

/** Home-island cells that are still locked and on screen: inside the shown ring but outside the current square. */
export function lockedTiles(state: PlayerState | null, view: IslandId): { col: number; row: number }[] {
  if (!state || view !== 'home') return []
  const cur = homeSize(state.islands.homeStep)
  const max = homeShown(state)
  const out: { col: number; row: number }[] = []
  for (let row = 0; row < max.h; row++) for (let col = 0; col < max.w; col++) if (col >= cur.w || row >= cur.h) out.push({ col, row })
  return out
}
