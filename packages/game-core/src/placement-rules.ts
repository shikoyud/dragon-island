import type { MovableRef, Placeable } from './actions/types'
import { DECORATIONS } from './decorations'
import { FOOTPRINT, placementError, type Footprint, type PlacementError } from './island'
import type { IslandId, Placement, PlayerState } from './state'

/** What is being put on the grid: a new building, a store purchase (nest, first Hoard) or a move. */
export type PlacementSubject = Placeable | { kind: 'nest' } | { kind: 'hoard' } | { kind: 'move'; target: MovableRef }
export type PlacementRuleError = PlacementError | 'WRONG_ISLAND' | 'NOT_FOUND'

/** Footprint of a building already on the grid, or null when it does not exist. */
export function movableFootprint(s: PlayerState, t: MovableRef): Footprint | null {
  switch (t.type) {
    case 'habitat': return s.habitats.some(h => h.id === t.id) ? FOOTPRINT.habitat : null
    case 'farm': return s.farms[t.index] ? FOOTPRINT.farm : null
    case 'nest': return s.nests[t.index] ? FOOTPRINT.nest : null
    case 'hatchery': return FOOTPRINT.hatchery
    case 'hoard': return s.hoardLevel > 0 && s.hoardPlacement ? FOOTPRINT.hoard : null
    case 'decoration': {
      const d = s.decorations.find(x => x.id === t.id)
      return d ? DECORATIONS[d.kind].size : null
    }
    default: return null
  }
}

/** Footprint of the subject, or null for a move of something missing. */
export function subjectFootprint(s: PlayerState, subject: PlacementSubject): Footprint | null {
  switch (subject.kind) {
    case 'move': return movableFootprint(s, subject.target)
    case 'decoration': return DECORATIONS[subject.decoration].size
    case 'farm': return FOOTPRINT.farm
    case 'nest': return FOOTPRINT.nest
    case 'hoard': return FOOTPRINT.hoard
    default: return FOOTPRINT.habitat
  }
}

/** The one island the subject may stand on, or null when any island will do (spec section 2). */
export function requiredIsland(s: PlayerState, subject: PlacementSubject): IslandId | null {
  switch (subject.kind) {
    case 'hoard': return 'home'
    case 'nexus': return 'dawnspire'
    case 'decoration': return DECORATIONS[subject.decoration].island ?? null
    case 'move': {
      const t = subject.target
      if (t.type === 'hatchery' || t.type === 'hoard') return 'home'
      if (t.type === 'habitat') return s.habitats.find(h => h.id === t.id)?.element === 'any' ? 'dawnspire' : null
      if (t.type === 'decoration') {
        const d = s.decorations.find(x => x.id === t.id)
        return d ? DECORATIONS[d.kind].island ?? null : null
      }
      return null
    }
    default: return null
  }
}

/**
 * Grid legality of putting `subject` at `p`, shared by the server handlers and the client ghost.
 * The grid error (lock, bounds, overlap; a move ignores the mover) comes before WRONG_ISLAND.
 * Level, gold and count limits stay in the handlers.
 */
export function placementRuleError(s: PlayerState, subject: PlacementSubject, p: Placement): PlacementRuleError | null {
  const size = subjectFootprint(s, subject)
  if (size === null) return 'NOT_FOUND'
  const bad = placementError(s, p, size, subject.kind === 'move' ? subject.target : undefined)
  if (bad) return bad
  const only = requiredIsland(s, subject)
  return only && p.island !== only ? 'WRONG_ISLAND' : null
}
