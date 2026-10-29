/** Grid layout of an island. Cells are 16 px; every position is a whole pixel. */
export const BASE = { w: 480, h: 270 } as const
/** Edge of one grid cell in world pixels. */
export const CELL = 16

export interface Pos { x: number; y: number }

/** World size in pixels of a grid of `w` x `h` cells. */
export function worldSize(w: number, h: number): { w: number; h: number } {
  return { w: w * CELL, h: h * CELL }
}

/** Bottom-centre of a `size` x `size` building whose top-left cell is (col, row). */
export function anchor(col: number, row: number, size: number): Pos {
  return { x: col * CELL + size * (CELL / 2), y: (row + size) * CELL }
}

/** Dragon spots on a platform: a 4+3 arrangement standing on the top face of a 5x5 habitat. */
export function dragonSpot(a: Pos, slot: number): Pos {
  const row = slot < 4 ? 0 : 1
  const col = slot < 4 ? slot : slot - 4
  return { x: a.x - 30 + col * 20 + row * 10, y: a.y - 36 + row * 12 }
}

/** Eggs and waiting hatchlings in the hatchery are drawn at this scale so they fit its egg niches. */
export const HATCHERY_ITEM_SCALE = 0.25

/**
 * Bottom-centre of each egg niche on the 64x64 hatchery art, from its anchor, left to right along the front
 * arc. The art has four niches; the fifth slot (level 3) stands on the stone just right of them.
 */
const HATCHERY_NICHES: readonly Pos[] = [
  { x: -15, y: -24 }, { x: -10, y: -20 }, { x: -4, y: -19 }, { x: 3, y: -19 }, { x: 10, y: -20 },
]

/** Egg and hatchling spot for a hatchery slot; slots past the last niche share it. */
export function hatcherySpot(a: Pos, slot: number): Pos {
  const n = HATCHERY_NICHES[Math.min(slot, HATCHERY_NICHES.length - 1)]!
  return { x: a.x + n.x, y: a.y + n.y }
}

/** The grid cell under a world position (floor division, so negatives fall outside the island). */
export function pointerToCell(worldX: number, worldY: number): { col: number; row: number } {
  return { col: Math.floor(worldX / CELL), row: Math.floor(worldY / CELL) }
}

/** Largest whole-number zoom that fits the viewport; never below 1. */
export function integerZoom(viewportW: number, viewportH: number): number {
  return Math.max(1, Math.floor(Math.min(viewportW / BASE.w, viewportH / BASE.h)))
}
