/** Pixel layout of the island at the 480×270 base. Every position is a whole pixel. */
export const BASE = { w: 480, h: 270 } as const

export interface Pos { x: number; y: number }

/** Habitat platforms: two staggered rows across the island body (up to 12). */
export function habitatSlots(index: number, _count: number): Pos {
  const col = index % 6
  const row = Math.floor(index / 6)
  const x = 56 + col * 72 + (row % 2) * 24
  const y = 96 + row * 72
  return { x, y }
}

/** Dragon spots on a platform: a 4+3 arrangement centred on the platform. */
export function dragonSlots(habitatIndex: number, slot: number, _slots: number, count: number): Pos {
  const p = habitatSlots(habitatIndex, count)
  const row = slot < 4 ? 0 : 1
  const col = slot < 4 ? slot : slot - 4
  const x = p.x - 24 + col * 16 + row * 8
  const y = p.y - 18 + row * 12
  return { x, y }
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
