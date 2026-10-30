import { islandSize, placementRuleError, type Facing, type Footprint, type IslandId, type Placement, type PlayerState } from '@wyrmhaven/game-core'
import type { ClientAction } from '@wyrmhaven/shared'
import { placementSubject, type Placing } from '../game/bridge'

export type PlacingEvent =
  | {
    type: 'start'; what: Placing['what']; size: Footprint; island: IslandId
    /** A move starts on the building's current spot; a new building on `cell` (see nearestLegalCell). */
    from?: Placement; cell?: { col: number; row: number }
  }
  | { type: 'cell'; col: number; row: number }
  | { type: 'turn' }
  | { type: 'cancel' }
  | { type: 'confirm' }

/** Pure reducer for the placement ghost. `confirm` leaves the ghost for the caller to send, then cancel. */
export function placingReducer(p: Placing | null, e: PlacingEvent): Placing | null {
  switch (e.type) {
    case 'start': return { what: e.what, size: e.size, col: e.from?.col ?? e.cell?.col ?? 0, row: e.from?.row ?? e.cell?.row ?? 0, facing: e.from?.facing ?? 0 }
    case 'cell': return p && { ...p, col: e.col, row: e.row }
    case 'turn': return p && { ...p, facing: ((p.facing + 1) % 4) as Facing }
    case 'cancel': return null
    case 'confirm': return p
  }
}

/** The action to send on confirm, or null when the ghost is illegal. */
export function placingAction(s: PlayerState, view: IslandId, p: Placing): ClientAction | null {
  const placement: Placement = { island: view, col: p.col, row: p.row, facing: p.facing }
  const w = p.what
  // The same grid and island rules the server runs; level, gold and limits are the handlers' to judge.
  if (placementRuleError(s, placementSubject(w), placement) !== null) return null
  switch (w.kind) {
    case 'move': return { type: 'moveBuilding', target: w.target, placement }
    case 'goldenAerie': return { type: 'buy', item: { kind: 'goldenAerie', placement } }
    default: return { type: 'placeBuilding', building: w, placement }
  }
}

/** True when `what` has a legal cell on some unlocked island (the Shop disables rows that would open a red ghost). */
export function hasLegalCell(s: PlayerState, what: Placing['what']): boolean {
  return s.islands.unlocked.some(island => nearestLegalCell(s, what, island, { col: 0, row: 0 }) !== null)
}

/** The legal top-left cell for `what` closest to `near` on an island (by straight-line distance), or null when none is. */
export function nearestLegalCell(s: PlayerState, what: Placing['what'], island: IslandId, near: { col: number; row: number }): { col: number; row: number } | null {
  const { w, h } = islandSize(s, island)
  let best: { col: number; row: number } | null = null
  let bestD = Infinity
  for (let row = 0; row < h; row++) for (let col = 0; col < w; col++) {
    const d = (col - near.col) ** 2 + (row - near.row) ** 2
    if (d >= bestD || placementRuleError(s, placementSubject(what), { island, col, row, facing: 0 }) !== null) continue
    best = { col, row }
    bestD = d
  }
  return best
}
