import { OBSTACLES, type IslandId, type MovableRef, type PlayerState } from '@wyrmhaven/game-core'
import type { Target } from './bridge'
import { footprintOfMovable, placementOf } from './buildingInfo'

/** The squares a selection outline goes round: the selected thing's footprint, on its island. */
export interface Outline { island: IslandId; col: number; row: number; size: number }

const MOVABLE: Partial<Record<Target['kind'], (t: Target) => MovableRef>> = {
  habitat: t => ({ type: 'habitat', id: (t as { id: string }).id }),
  farm: t => ({ type: 'farm', index: (t as { plot: number }).plot }),
  breeder: t => ({ type: 'breeder', index: (t as { index: number }).index }),
  hatcheryBuilding: () => ({ type: 'hatchery' }),
  roost: () => ({ type: 'roost' }),
  decoration: t => ({ type: 'decoration', id: (t as { id: string }).id }),
}

/** Where the yellow outline of a selection goes (UI rework Phase 4), or null when the thing is gone or has no footprint. */
export function selectionOutline(s: PlayerState, t: Target | null): Outline | null {
  if (!t) return null
  if (t.kind === 'obstacle') {
    const o = s.islands.obstacles.find(x => x.id === t.id)
    return o ? { island: o.island, col: o.col, row: o.row, size: OBSTACLES[o.kind].size } : null
  }
  const ref = MOVABLE[t.kind]?.(t)
  if (!ref) return null
  const p = placementOf(s, ref)
  return p ? { island: p.island, col: p.col, row: p.row, size: footprintOfMovable(s, ref) } : null
}
