import { ISLAND_ORDER, ISLANDS, unlockPl, type IslandId, type PlayerState } from '@wyrmhaven/game-core'
import { cameraBounds, groundCell, landBox } from './camera'
import type { Box, Pos } from './layout'
import { mapPrice } from './mapModel'

/**
 * Where each island's own (0, 0) sits in the one island scene's world (R99): Home at the origin, the chain zig-zagging
 * right and back, every island's camera box clear of the others. Display only; each island keeps its own cells.
 */
export const ISLAND_AT: Record<IslandId, Pos> = {
  home: { x: 0, y: 0 },
  isle2: { x: 820, y: -310 },
  isle3: { x: 1640, y: 0 },
  isle4: { x: 1640, y: 620 },
  isle5: { x: 820, y: 310 },
  isle6: { x: 0, y: 620 },
}

/** Sky kept round the archipelago at the camera's edges. */
const WORLD_MARGIN = 48

export const isOpenIsland = (s: PlayerState | null, id: IslandId): boolean => id === 'home' || Boolean(s?.islands.unlocked.includes(id))

/** An island's full box (all 16 plots, rim and cliff) in world px. */
export function islandFrame(id: IslandId): Box {
  const b = cameraBounds(id)
  return { x: b.x + ISLAND_AT[id].x, y: b.y + ISLAND_AT[id].y, w: b.w, h: b.h }
}

/** The box the island camera may show: every island, and a margin of sky. */
export function worldBounds(): Box {
  const frames = ISLAND_ORDER.map(islandFrame)
  const x0 = Math.min(...frames.map(f => f.x)) - WORLD_MARGIN
  const y0 = Math.min(...frames.map(f => f.y)) - WORLD_MARGIN
  const x1 = Math.max(...frames.map(f => f.x + f.w)) + WORLD_MARGIN
  const y1 = Math.max(...frames.map(f => f.y + f.h)) + WORLD_MARGIN
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
}

/** A world point in an island's own coordinates. */
export const toIsland = (id: IslandId, p: Pos): Pos => ({ x: p.x - ISLAND_AT[id].x, y: p.y - ISLAND_AT[id].y })
/** An island's own point in the world. */
export const fromIsland = (id: IslandId, p: Pos): Pos => ({ x: p.x + ISLAND_AT[id].x, y: p.y + ISLAND_AT[id].y })

/** The island under a world point: the one whose shown land is there, else whose frame holds it; null over open sky. */
export function islandUnder(s: PlayerState | null, x: number, y: number): IslandId | null {
  for (const id of ISLAND_ORDER) {
    if (!isOpenIsland(s, id)) continue
    const p = toIsland(id, { x, y })
    if (groundCell(s, id, p.x, p.y)) return id
  }
  for (const id of ISLAND_ORDER) {
    const f = islandFrame(id)
    if (x >= f.x && x <= f.x + f.w && y >= f.y && y <= f.y + f.h) return id
  }
  return null
}

/** The middle of an island's shown land, in world px. */
export function landCentre(s: PlayerState | null, id: IslandId): Pos {
  const b = landBox(s, id)
  return fromIsland(id, { x: b.x + b.w / 2, y: b.y + b.h / 2 })
}

/** The open island whose land's middle is nearest a world point: what the camera is looking at (R100). */
export function nearestIsland(s: PlayerState | null, x: number, y: number): IslandId {
  let best: IslandId = 'home'
  let bestD = Infinity
  for (const id of ISLAND_ORDER) {
    if (!isOpenIsland(s, id)) continue
    const c = landCentre(s, id)
    const d = (c.x - x) ** 2 + (c.y - y) ** 2
    if (d < bestD) { best = id; bestD = d }
  }
  return best
}

/** A locked island's caption: its name and level gate, and for the next in the chain its Bridge price. */
export function lockedLabel(s: PlayerState, id: IslandId): string {
  const i = ISLAND_ORDER.indexOf(id)
  const info = ISLANDS[id]
  const gate = `Level ${unlockPl(`island:${id}`)}`
  const next = i > 0 && isOpenIsland(s, ISLAND_ORDER[i - 1]!)
  return next ? `${info.name} · ${gate} · Bridge ${mapPrice(info.bridgeGold!)}` : `${info.name} · ${gate}`
}
