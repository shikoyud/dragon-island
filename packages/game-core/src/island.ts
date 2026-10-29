import type { BuildingRef, IslandId, Placement, PlayerState } from './state'
import { DECORATIONS } from './decorations'
import { OBSTACLES } from './obstacles'

export const CELL_PX = 16
export const ISLAND_ORDER: readonly IslandId[] = ['home', 'isle2', 'isle3', 'isle4', 'isle5', 'dawnspire']
export const OUTER_SIZE = 16
export const HOME_MAX_STEP = 12

/** Index = step - 1 (spec section 3). */
export const HOME_EXPANSION: readonly { minLevel: number; cost: number }[] = [
  { minLevel: 2, cost: 1_000 }, { minLevel: 4, cost: 2_500 }, { minLevel: 7, cost: 5_000 },
  { minLevel: 10, cost: 10_000 }, { minLevel: 14, cost: 20_000 }, { minLevel: 18, cost: 40_000 },
  { minLevel: 22, cost: 75_000 }, { minLevel: 27, cost: 125_000 }, { minLevel: 32, cost: 200_000 },
  { minLevel: 37, cost: 325_000 }, { minLevel: 42, cost: 500_000 }, { minLevel: 47, cost: 750_000 },
]

/** Spec section 4; `mult` is the obstacle multiplier m. */
export const OUTER_ISLANDS: Record<Exclude<IslandId, 'home'>, { minLevel: number; cost: number; mult: number }> = {
  isle2: { minLevel: 12, cost: 40_000, mult: 2 },
  isle3: { minLevel: 20, cost: 150_000, mult: 5 },
  isle4: { minLevel: 30, cost: 500_000, mult: 12 },
  isle5: { minLevel: 40, cost: 1_200_000, mult: 25 },
  dawnspire: { minLevel: 45, cost: 3_000_000, mult: 40 },
}

export function homeSize(step: number): { w: number; h: number } {
  return { w: 12 + 2 * Math.ceil(step / 2), h: 12 + 2 * Math.floor(step / 2) }
}

export function islandSize(s: PlayerState, island: IslandId): { w: number; h: number } {
  return island === 'home' ? homeSize(s.islands.homeStep) : { w: OUTER_SIZE, h: OUTER_SIZE }
}

export type Footprint = 1 | 2 | 3 | 4 | 5
export const FOOTPRINT = { habitat: 5, hatchery: 4, hoard: 4, farm: 2, nest: 2 } as const

export type OccupantRef = BuildingRef | { type: 'hoard' } | { type: 'decoration'; id: string } | { type: 'obstacle'; id: string }
export interface Occupant { ref: OccupantRef; col: number; row: number; size: Footprint }


export function occupants(s: PlayerState, island: IslandId): Occupant[] {
  const out: Occupant[] = []
  const add = (ref: OccupantRef, p: { col: number; row: number }, size: Footprint) => out.push({ ref, col: p.col, row: p.row, size })
  for (const h of s.habitats) if (h.placement.island === island) add({ type: 'habitat', id: h.id }, h.placement, FOOTPRINT.habitat)
  s.farms.forEach((f, index) => { if (f.placement.island === island) add({ type: 'farm', index }, f.placement, FOOTPRINT.farm) })
  s.nests.forEach((n, index) => { if (n.placement.island === island) add({ type: 'nest', index }, n.placement, FOOTPRINT.nest) })
  if (s.hatcheryPlacement.island === island) add({ type: 'hatchery' }, s.hatcheryPlacement, FOOTPRINT.hatchery)
  if (s.hoardLevel > 0 && s.hoardPlacement && s.hoardPlacement.island === island) add({ type: 'hoard' }, s.hoardPlacement, FOOTPRINT.hoard)
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
    case 'nest': return a.index === (b as typeof a).index
    default: return true
  }
}

export function overlaps(a: { col: number; row: number; size: number }, b: { col: number; row: number; size: number }): boolean {
  return a.col < b.col + b.size && b.col < a.col + a.size && a.row < b.row + b.size && b.row < a.row + a.size
}

export type PlacementError = 'ISLAND_LOCKED' | 'OUT_OF_BOUNDS' | 'OVERLAP'

export function placementError(s: PlayerState, p: Placement, size: Footprint, ignore?: OccupantRef): PlacementError | null {
  if (!s.islands.unlocked.includes(p.island)) return 'ISLAND_LOCKED'
  const { w, h } = islandSize(s, p.island)
  if (p.col < 0 || p.row < 0 || p.col + size > w || p.row + size > h) return 'OUT_OF_BOUNDS'
  const me = { col: p.col, row: p.row, size }
  for (const o of occupants(s, p.island)) {
    if (ignore && sameRef(o.ref, ignore)) continue
    if (overlaps(me, o)) return 'OVERLAP'
  }
  return null
}

export function outerIslandsUnlocked(s: PlayerState): number {
  return s.islands.unlocked.length - 1
}
