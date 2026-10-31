import { BREEDER_FOOTPRINT } from './data/breeding-buildings'
import { isUnlocked } from './data/unlocks'
import { ROOST_FOOTPRINT } from './data/roost'
import type { BuildingRef, IslandId, Placement, PlayerState } from './state'
import { DECORATIONS } from './decorations'
import { OBSTACLES } from './obstacles'
import { ISLAND_TILES, ownsFootprint } from './plots'

export const CELL_PX = 16
export const ISLAND_ORDER: readonly IslandId[] = ['home', 'isle2', 'isle3', 'isle4', 'isle5', 'isle6']
export type Footprint = 1 | 2 | 3 | 4 | 5
/** §5.4. */
export const FOOTPRINT = { habitat: 4, hatchery: 4, farm: 3, breeder: BREEDER_FOOTPRINT, roost: ROOST_FOOTPRINT } as const

export type OccupantRef = BuildingRef | { type: 'decoration'; id: string } | { type: 'obstacle'; id: string }
export interface Occupant { ref: OccupantRef; col: number; row: number; size: Footprint }


export function occupants(s: PlayerState, island: IslandId): Occupant[] {
  const out: Occupant[] = []
  const add = (ref: OccupantRef, p: { col: number; row: number }, size: Footprint) => out.push({ ref, col: p.col, row: p.row, size })
  for (const h of s.habitats) if (h.placement.island === island) add({ type: 'habitat', id: h.id }, h.placement, FOOTPRINT.habitat)
  s.farms.forEach((f, index) => { if (f.placement.island === island) add({ type: 'farm', index }, f.placement, FOOTPRINT.farm) })
  s.breeders.forEach((b, index) => { if (b.placement.island === island) add({ type: 'breeder', index }, b.placement, FOOTPRINT.breeder) })
  if (s.roostPlacement?.island === island) add({ type: 'roost' }, s.roostPlacement, FOOTPRINT.roost)
  if (s.hatcheryPlacement.island === island) add({ type: 'hatchery' }, s.hatcheryPlacement, FOOTPRINT.hatchery)
  for (const d of s.decorations) if (d.placement.island === island) add({ type: 'decoration', id: d.id }, d.placement, DECORATIONS[d.kind].size)
  for (const o of s.islands.obstacles) if (o.island === island) add({ type: 'obstacle', id: o.id }, o, OBSTACLES[o.kind].size)
  return out
}

export function sameRef(a: OccupantRef, b: OccupantRef): boolean {
  if (a.type !== b.type) return false
  switch (a.type) {
    case 'habitat': return a.id === (b as typeof a).id
    case 'decoration': return a.id === (b as typeof a).id
    case 'obstacle': return a.id === (b as typeof a).id
    case 'farm': return a.index === (b as typeof a).index
    case 'breeder': return a.index === (b as typeof a).index
    default: return true
  }
}

export function overlaps(a: { col: number; row: number; size: number }, b: { col: number; row: number; size: number }): boolean {
  return a.col < b.col + b.size && b.col < a.col + a.size && a.row < b.row + b.size && b.row < a.row + a.size
}

export type PlacementError = 'ISLAND_LOCKED' | 'OUT_OF_BOUNDS' | 'NOT_OWNED' | 'OVERLAP'

export function placementError(s: PlayerState, p: Placement, size: Footprint, ignore?: OccupantRef): PlacementError | null {
  if (!s.islands.unlocked.includes(p.island)) return 'ISLAND_LOCKED'
  if (p.col < 0 || p.row < 0 || p.col + size > ISLAND_TILES || p.row + size > ISLAND_TILES) return 'OUT_OF_BOUNDS'
  if (!ownsFootprint(s, p, size)) return 'NOT_OWNED'
  const me = { col: p.col, row: p.row, size }
  for (const o of occupants(s, p.island)) {
    if (ignore && sameRef(o.ref, ignore)) continue
    if (overlaps(me, o)) return 'OVERLAP'
  }
  return null
}

export type BridgeError = 'PLOT_OWNED' | 'ISLAND_LOCKED' | 'LEVEL_TOO_LOW'

/** Why a Bridge can't be bought, Gold aside (§5.5, R47): already open, then the Bridge before it, then its Player Level. */
export function bridgeError(s: PlayerState, island: Exclude<IslandId, 'home'>): BridgeError | null {
  if (s.islands.unlocked.includes(island)) return 'PLOT_OWNED'
  if (!s.islands.unlocked.includes(ISLAND_ORDER[ISLAND_ORDER.indexOf(island) - 1]!)) return 'ISLAND_LOCKED'
  return isUnlocked(`island:${island}`, s.level) ? null : 'LEVEL_TOO_LOW'
}
