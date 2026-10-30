import { DECORATIONS, FOOTPRINT, type Footprint, type MovableRef, type Placement, type PlayerState } from '@wyrmhaven/game-core'

/** Where a movable thing stands now, or null when it no longer exists. */
export function placementOf(s: PlayerState, t: MovableRef): Placement | null {
  switch (t.type) {
    case 'habitat': return s.habitats.find(h => h.id === t.id)?.placement ?? null
    case 'farm': return s.farms[t.index]?.placement ?? null
    case 'breeder': return s.breeders[t.index]?.placement ?? null
    case 'hatchery': return s.hatcheryPlacement
    case 'decoration': return s.decorations.find(d => d.id === t.id)?.placement ?? null
  }
}

export function footprintOfMovable(s: PlayerState, t: MovableRef): Footprint {
  if (t.type === 'decoration') return DECORATIONS[s.decorations.find(d => d.id === t.id)?.kind ?? 'stonePath'].size
  return FOOTPRINT[t.type]
}
