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

function islandHasLegalCell(s: PlayerState, what: Placing['what'], island: IslandId): boolean {
  const subject = placementSubject(what)
  const { w, h } = islandSize(s, island)
  for (let row = 0; row < h; row++) for (let col = 0; col < w; col++) {
    if (placementRuleError(s, subject, { island, col, row, facing: 0 }) === null) return true
  }
  return false
}

/** True when `what` has a legal cell on some unlocked island (the Shop disables rows that would open a red ghost). */
export function hasLegalCell(s: PlayerState, what: Placing['what']): boolean {
  return s.islands.unlocked.some(island => islandHasLegalCell(s, what, island))
}

/**
 * Where placement mode opens. A move stays on the building's island. A new building opens on the viewed island when that
 * has a legal cell, else on the first unlocked island that does: the Shop's `hasLegalCell` counts them all, so a row it
 * enables never opens a red ghost. `focus` is the viewed island's cell under the middle of the screen, when known.
 */
export function placementStart(
  s: PlayerState, what: Placing['what'], size: Footprint, view: IslandId, focus: { col: number; row: number } | null | undefined, from?: Placement,
): { island: IslandId; cell?: { col: number; row: number } } {
  if (from) return { island: from.island }
  const island = islandHasLegalCell(s, what, view) ? view : s.islands.unlocked.find(i => islandHasLegalCell(s, what, i)) ?? view
  // The free spot nearest the middle of the screen (the island's middle after a switch).
  const f = island === view ? focus : null
  const mid = f ? { col: f.col - Math.floor((size - 1) / 2), row: f.row - Math.floor((size - 1) / 2) } : { col: 4, row: 4 }
  // Something smaller than a habitat prefers a cell that leaves a 5x5 free (a fresh island has exactly one), else the nearest.
  const cell = (size < HABITAT_FOOTPRINT ? nearestLegalCell(s, what, island, mid, c => leavesHabitatRoom(s, island, c, size)) : null) ?? nearestLegalCell(s, what, island, mid)
  return cell ? { island, cell } : { island }
}

const HABITAT_FOOTPRINT = 5
const HABITAT_PROBE = { kind: 'habitat', element: 'terra' } as const

/** True when a thing of `size` at `cell` would still leave some legal habitat-sized spot clear of it (footprints are squares). */
function leavesHabitatRoom(s: PlayerState, island: IslandId, cell: { col: number; row: number }, size: number): boolean {
  const { w, h } = islandSize(s, island)
  for (let row = 0; row < h; row++) for (let col = 0; col < w; col++) {
    if (placementRuleError(s, HABITAT_PROBE, { island, col, row, facing: 0 }) !== null) continue
    const apart = cell.col + size <= col || col + HABITAT_FOOTPRINT <= cell.col || cell.row + size <= row || row + HABITAT_FOOTPRINT <= cell.row
    if (apart) return true
  }
  return false
}

/**
 * The legal top-left cell for `what` closest to `near` on an island (by straight-line distance), or null when none is.
 * `accept` narrows the candidates (the default cell uses it to keep room for a habitat).
 */
export function nearestLegalCell(
  s: PlayerState, what: Placing['what'], island: IslandId, near: { col: number; row: number }, accept?: (cell: { col: number; row: number }) => boolean,
): { col: number; row: number } | null {
  const { w, h } = islandSize(s, island)
  let best: { col: number; row: number } | null = null
  let bestD = Infinity
  for (let row = 0; row < h; row++) for (let col = 0; col < w; col++) {
    const d = (col - near.col) ** 2 + (row - near.row) ** 2
    if (d >= bestD || placementRuleError(s, placementSubject(what), { island, col, row, facing: 0 }) !== null || (accept && !accept({ col, row }))) continue
    best = { col, row }
    bestD = d
  }
  return best
}
