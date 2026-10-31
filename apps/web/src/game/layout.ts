/**
 * Isometric (2:1) projection of an island's logical grid. game-core keeps square cells and footprints; only the
 * picture is angled. Each cell is a 16x8 diamond whose top vertex for (col, row) sits at
 * ((col - row) * 8, (col + row) * 4) in world pixels, so the island's top corner is the world origin.
 */
export const ISO = { w: 16, h: 8 } as const
const HW = ISO.w / 2
const HH = ISO.h / 2

/** The fixed stage the battle scene draws on; it is zoomed by whole numbers to fit the viewport. */
export const BATTLE = { w: 480, h: 270 } as const

export interface Pos { x: number; y: number }
export interface Box { x: number; y: number; w: number; h: number }

/** Top vertex of cell (col, row). */
export function cellTop(col: number, row: number): Pos {
  return { x: (col - row) * HW, y: (col + row) * HH }
}

/** Centre of cell (col, row). */
export function cellCentre(col: number, row: number): Pos {
  const t = cellTop(col, row)
  return { x: t.x, y: t.y + HH }
}

/** Top, right, bottom and left vertices of the size x size diamond whose top cell is (col, row). */
export function footprintDiamond(col: number, row: number, size: number): [Pos, Pos, Pos, Pos] {
  return [cellTop(col, row), cellTop(col + size, row), cellTop(col + size, row + size), cellTop(col, row + size)]
}

/** Bottom vertex of a size x size footprint: where a building's sprite stands (bottom-centre origin). */
export function anchor(col: number, row: number, size: number): Pos {
  return cellTop(col + size, row + size)
}

/** The cell under a world position: the exact inverse of `cellTop`, floored (outside cells go negative or past the edge). */
export function pointerToCell(worldX: number, worldY: number): { col: number; row: number } {
  const u = worldX / HW
  const v = worldY / HH
  return { col: Math.floor((v + u) / 2), row: Math.floor((v - u) / 2) }
}

/** Bounding box of a w x h island's top surface. */
export function islandBox(w: number, h: number): Box {
  return { x: -h * HW, y: 0, w: (w + h) * HW, h: (w + h) * HH }
}

/** Back-to-front order of footprints: by col + row + size, then col. */
export function depthOrder(p: { col: number; row: number; size: number }, q: { col: number; row: number; size: number }): number {
  return p.col + p.row + p.size - (q.col + q.row + q.size) || p.col - q.col
}

/**
 * Dragon spots on a 4x4 habitat's top face, from its anchor (the diamond's bottom vertex): the diamond is 64 wide and 32
 * tall, so its centre is (0, -16) and every spot's feet stay inside it. The first dragon stands in the middle, the rest
 * around it. Callers draw residents back to front by y.
 */
const DRAGON_SPOTS: readonly Pos[] = [
  { x: 0, y: -16 }, { x: -14, y: -20 }, { x: 14, y: -20 }, { x: 0, y: -26 }, { x: -12, y: -11 }, { x: 12, y: -11 }, { x: -22, y: -16 },
]

export function dragonSpot(a: Pos, slot: number): Pos {
  const s = DRAGON_SPOTS[Math.min(slot, DRAGON_SPOTS.length - 1)]!
  return { x: a.x + s.x, y: a.y + s.y }
}

/** Eggs and waiting hatchlings in the hatchery are drawn at this scale so they fit its egg niches. */
export const HATCHERY_ITEM_SCALE = 0.25
/** An egg in a nest is drawn at half size so it sits inside the 32x32 nest art. */
export const NEST_EGG_SCALE = 0.5

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

/** The least a finger can be asked to hit: 44 CSS px square. */
export const TAP_PX = 44

/** World size of a tap box for a thing `size` world px big at `zoom`: the thing itself, or TAP_PX on screen if that is more. */
export function tapBox(size: { w: number; h: number }, zoom: number, minPx: number = TAP_PX): { w: number; h: number } {
  return { w: Math.max(size.w, minPx / zoom), h: Math.max(size.h, minPx / zoom) }
}

/**
 * How a tap target is hit: its box in world px (the thing itself or `minPx` on screen, whichever is more) and whether the
 * pixel-perfect test still applies. That is only when the thing is already big enough and `always` (a plot sign, which
 * is easy to hit by its bounds at every zoom) is not set.
 */
export function tapHit(size: { w: number; h: number }, zoom: number, minPx: number = TAP_PX, always = false): { w: number; h: number; pixel: boolean } {
  const box = tapBox(size, zoom, minPx)
  return { ...box, pixel: !always && box.w === size.w && box.h === size.h }
}

/** Largest whole-number zoom that fits the battle stage in the viewport; never below 1. */
export function integerZoom(viewportW: number, viewportH: number): number {
  return Math.max(1, Math.floor(Math.min(viewportW / BATTLE.w, viewportH / BATTLE.h)))
}
