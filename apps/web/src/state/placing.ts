import { placementError, type Facing, type Footprint, type IslandId, type Placement, type PlayerState } from '@wyrmhaven/game-core'
import type { ClientAction } from '@wyrmhaven/shared'
import type { Placing } from '../game/bridge'

export type PlacingEvent =
  | { type: 'start'; what: Placing['what']; size: Footprint; island: IslandId; /** A move starts on the building's current spot. */ from?: Placement }
  | { type: 'cell'; col: number; row: number }
  | { type: 'turn' }
  | { type: 'cancel' }
  | { type: 'confirm' }

/** Pure reducer for the placement ghost. `confirm` leaves the ghost for the caller to send, then cancel. */
export function placingReducer(p: Placing | null, e: PlacingEvent): Placing | null {
  switch (e.type) {
    case 'start': return { what: e.what, size: e.size, col: e.from?.col ?? 0, row: e.from?.row ?? 0, facing: e.from?.facing ?? 0 }
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
  if (placementError(s, placement, p.size, w.kind === 'move' ? w.target : undefined) !== null) return null
  switch (w.kind) {
    case 'move': return { type: 'moveBuilding', target: w.target, placement }
    case 'nest': return { type: 'buy', item: { kind: 'nest', placement } }
    case 'hoard': return view === 'home' ? { type: 'buy', item: { kind: 'hoard', placement } } : null
    default: return { type: 'placeBuilding', building: w, placement }
  }
}
