/** Pixel layout of the island at the 480×270 base. Every position is a whole pixel. */
export const BASE = { w: 480, h: 270 } as const

export interface Pos { x: number; y: number }

/** Grid cells [col, row] in fill order: the open meadow in the middle first, the edges last. */
const HABITAT_ORDER: readonly (readonly [number, number])[] = [
  [1, 1], [2, 1], [1, 0], [2, 0], [1, 2], [2, 2], [0, 1], [3, 1], [0, 0], [3, 0], [0, 2], [3, 2],
]

/** Habitat platforms (96×64 tiles, bottom-centre origin): a 4×3 grid across the island body (up to 12). */
export function habitatSlots(index: number, _count: number): Pos {
  const [col, row] = HABITAT_ORDER[index % HABITAT_ORDER.length]!
  // Rows overlap by 12 px so a front tile hides the back tile's wall; drawn back to front.
  return { x: 96 + col * 96, y: 100 + row * 52 }
}

/** Dragon spots on a platform: a 4+3 arrangement standing on the tile's top face. */
export function dragonSlots(habitatIndex: number, slot: number, _slots: number, count: number): Pos {
  const p = habitatSlots(habitatIndex, count)
  const row = slot < 4 ? 0 : 1
  const col = slot < 4 ? slot : slot - 4
  return { x: p.x - 30 + col * 20 + row * 10, y: p.y - 36 + row * 12 }
}

/** Nests along the bottom-left shore. */
export const nestPos = (i: number): Pos => ({ x: 40 + i * 36, y: 236 })
/** Hatchery slots on the bottom-right. */
export const hatcheryPos = (slot: number): Pos => ({ x: 356 + slot * 36, y: 236 })
/** Farm plots across the top strip. */
export const farmPos = (plot: number): Pos => ({ x: 48 + plot * 40, y: 36 })
/** The Hoard sits top-right. */
export const hoardPos = (): Pos => ({ x: 432, y: 40 })

/** Largest whole-number zoom that fits the viewport; never below 1. */
export function integerZoom(viewportW: number, viewportH: number): number {
  return Math.max(1, Math.floor(Math.min(viewportW / BASE.w, viewportH / BASE.h)))
}
