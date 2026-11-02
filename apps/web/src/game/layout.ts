import { OBSTACLES, plotOrigin, TILES_PER_PLOT, type ObstacleKind } from '@wyrmhaven/game-core'

/**
 * Isometric (2:1) projection of an island's logical grid. game-core keeps square cells and footprints; only the
 * picture is angled. Each cell is a 16x8 diamond whose top vertex for (col, row) sits at
 * ((col - row) * 8, (col + row) * 4) in world pixels, so the island's top corner is the world origin.
 */
export const ISO = { w: 16, h: 8 } as const
const HW = ISO.w / 2
const HH = ISO.h / 2

/** The fixed portrait stage the battle scene draws on (R80); it is zoomed by whole numbers to fit above the controls. */
export const BATTLE = { w: 360, h: 420 } as const
/** The React controls under the stage: turn line, 2x2 moves, Swap. Fits 360x640 under the stage at zoom 1. */
export const BATTLE_CONTROLS_H = 192
/** Screen px between the stage's bottom edge and the controls. */
export const BATTLE_STAGE_GAP = 8
/** Where each active dragon's feet stand, in stage pixels: enemy upper right, yours lower left (R80). */
export const BATTLE_SPOT = { attacker: { x: 96, y: 376 }, defender: { x: 264, y: 196 } } as const
/** The React title row and Exit button over the stage's top (4 px down, a 44 px tap): nothing the scene floats there is legible. */
export const BATTLE_HEADER_H = 48
/** Dragons draw at this scale on the stage, so a 48 px adult is 144 and a 32 px hatchling 96. */
export const BATTLE_DRAGON_SCALE = 3
/** The code-drawn platform under a dragon, until `battle.platform` has art. */
export const BATTLE_PLATFORM = { w: 140, h: 36 } as const
/** Stage y where the sky meets the ground of the code-drawn backdrop. */
export const BATTLE_HORIZON_Y = 150

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

/** True when a cell is one of a footprint's, whose top-left cell is (col, row). */
export function footprintContains(cell: { col: number; row: number }, placing: { col: number; row: number; size: number }): boolean {
  return cell.col >= placing.col && cell.col < placing.col + placing.size && cell.row >= placing.row && cell.row < placing.row + placing.size
}

/** Back-to-front order of footprints: by col + row + size, then col. */
export function depthOrder(p: { col: number; row: number; size: number }, q: { col: number; row: number; size: number }): number {
  return p.col + p.row + p.size - (q.col + q.row + q.size) || p.col - q.col
}

/**
 * Dragon spots on a 4x4 habitat's top face, from its anchor (the diamond's bottom vertex): the diamond is 64 wide and 32
 * tall, so its centre is (0, -16) and every spot's feet stay inside it. The first four stand at the front middle, left, right
 * and back, on the face rather than behind it (their art rises 24 px from the feet). Callers draw residents back to front by y.
 */
const DRAGON_SPOTS: readonly Pos[] = [
  { x: 0, y: -11 }, { x: -17, y: -13 }, { x: 17, y: -13 }, { x: 0, y: -22 }, { x: -9, y: -6 }, { x: 9, y: -6 }, { x: -26, y: -16 },
]

/**
 * The scale a resident draws at on a habitat, by its sheet's width, so every stage stands about 24 px: a 48 px adult at 0.5,
 * a 40 px juvenile at 0.625, a 32 px baby at 0.75. Battles and panels keep their own.
 */
export function habitatDragonScale(sheetW: number): number {
  if (sheetW <= 32) return 0.75
  return sheetW <= 40 ? 0.625 : 0.5
}

export function dragonSpot(a: Pos, slot: number): Pos {
  const s = DRAGON_SPOTS[Math.min(slot, DRAGON_SPOTS.length - 1)]!
  return { x: a.x + s.x, y: a.y + s.y }
}

/** An egg in a breeder's nest is drawn at half size so it sits inside the 32x32 nest art. */
export const NEST_EGG_SCALE = 0.5
/** Eggs and waiting hatchlings in the Hatchery's courtyard nest. */
export const NEST_EGG_HATCHERY_SCALE = 0.5
/** A crowd stays on the nest: from this many eggs they draw at three quarters of `NEST_EGG_HATCHERY_SCALE`. */
const NEST_CROWD = 4
export const hatcheryEggScale = (eggs: number): number => (eggs >= NEST_CROWD ? NEST_EGG_HATCHERY_SCALE * 0.75 : NEST_EGG_HATCHERY_SCALE)

/**
 * Where each egg stands in the castle's nest, from its anchor. The nest is about 28x14, centred 14 px above the anchor and
 * pixel-identical on all four levels. The first egg sits in the hollow's middle; the rest gather round it, an egg (about
 * 11 px wide at half size) staying over the straw.
 */
const HATCHERY_NEST: readonly Pos[] = [
  { x: 0, y: -10 }, { x: -9, y: -12 }, { x: 9, y: -12 }, { x: -5, y: -16 }, { x: 5, y: -16 },
]

/** Egg and hatchling spot for a Hatchery slot; slots past the last share it. */
export function hatcheryNestSpot(a: Pos, slot: number): Pos {
  const n = HATCHERY_NEST[Math.min(slot, HATCHERY_NEST.length - 1)]!
  return { x: a.x + n.x, y: a.y + n.y }
}

/** The bar under an egg, in world px: a dark frame and one row of fill. */
export const PROGRESS_BAR = { w: 16, h: 3 } as const
/** Whole px of fill inside the bar's frame at a progress of 0..1. */
export const progressFill = (progress: number): number => Math.round((PROGRESS_BAR.w - 2) * progress)

/** The post on a habitat with an upgrade open: from its anchor, at the left corner, drawn at this scale. */
export const UPGRADE_POST = { x: -26, y: -12, scale: 0.5 } as const

/**
 * On-screen height in CSS px of a plot sign's 'Tap to buy' caption at a zoom: small when the whole island shows (there it
 * would outweigh the signs and cover the dragons), the badge's 14 px from zoom 3.
 */
export function captionPx(zoom: number): number {
  return zoom >= 3 ? 14 : zoom >= 2 ? 12 : 9
}

/**
 * The 48 px sign art draws at half size: its 33 px board is then 66 px wide at the desktop's zoom 4, the reference's size.
 * At full size it stands over the owned land beside its plot, its box taking taps meant for the starting Farm.
 */
export const SIGN_SCALE = 0.5

/** A sprite's size, as much of it as a box needs: `top` empty rows above its art. */
export interface SpriteBox { w: number; h: number; top?: number }
/** The sizes `signSpot` reads. A `GameArtSet` is one. */
export interface SignArt { obstacle: Record<ObstacleKind, SpriteBox>; island: { sign: SpriteBox } }

export const boxesOverlap = (a: Box, b: Box): boolean => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
const overlapArea = (a: Box, b: Box): number => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y))

/** The world box of an obstacle's art, standing on its footprint's bottom vertex. */
export function obstacleBox(o: { kind: ObstacleKind; col: number; row: number }, art: SignArt): Box {
  const s = art.obstacle[o.kind]
  const a = anchor(o.col, o.row, OBSTACLES[o.kind].size)
  const h = s.h - (s.top ?? 0)
  return { x: a.x - s.w / 2, y: a.y - h, w: s.w, h }
}

/** The world box of a plot's sign at its drawn size, standing on a cell's centre. */
export function signBox(col: number, row: number, art: SignArt): Box {
  const w = art.island.sign.w * SIGN_SCALE, h = art.island.sign.h * SIGN_SCALE
  const c = cellCentre(col, row)
  return { x: c.x - w / 2, y: c.y - h, w, h }
}

/**
 * The world box of a sign's caption, at its widest at an opening zoom (a landscape phone's 2: 46 x 9): under the sign's foot.
 * It is a constant size on screen, so it covers less at a closer zoom.
 */
export function captionBox(col: number, row: number): Box {
  const c = cellCentre(col, row)
  return { x: c.x - 23, y: c.y + 2, w: 46, h: 9 }
}

/**
 * The cell a plot's sign stands on: the one of its cells whose sign box overlaps no obstacle's art on any plot, and whose sign
 * and caption overlap no building in `buildings` (their sprite boxes), nearest the plot's middle, or, with no clear cell, the
 * one with the least overlap. Ties go to the lower row, then the lower column.
 */
export function signSpot(plot: number, obstacles: readonly { kind: ObstacleKind; col: number; row: number }[], art: SignArt, buildings: readonly Box[] = []): { col: number; row: number } {
  const o = plotOrigin(plot)
  const boxes = obstacles.map(x => obstacleBox(x, art))
  const mid = TILES_PER_PLOT / 2
  let best = { col: o.col, row: o.row }, bestOver = Infinity, bestD = Infinity
  for (let row = o.row; row < o.row + TILES_PER_PLOT; row++) for (let col = o.col; col < o.col + TILES_PER_PLOT; col++) {
    const sign = signBox(col, row, art)
    const caption = captionBox(col, row)
    const over = boxes.reduce((n, b) => n + overlapArea(sign, b), 0) + buildings.reduce((n, b) => n + overlapArea(sign, b) + overlapArea(caption, b), 0)
    const d = (col + 0.5 - o.col - mid) ** 2 + (row + 0.5 - o.row - mid) ** 2
    if (over < bestOver || (over === bestOver && d < bestD)) { best = { col, row }; bestOver = over; bestD = d }
  }
  return best
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

/**
 * Where the stage sits on a screen: zoomed to fit the room above the controls, resting BATTLE_STAGE_GAP above them with the spare
 * room over it (so stage and controls read as one block), by whole pixels. React's plates
 * and the scene's camera both read this, so they agree. On a screen too short for both it pins to the top, and the controls,
 * anchored to the bottom, stay reachable over it.
 */
export function battleStage(viewportW: number, viewportH: number): Box & { zoom: number } {
  const room = Math.max(0, viewportH - BATTLE_CONTROLS_H)
  const zoom = integerZoom(viewportW, room)
  const w = BATTLE.w * zoom
  const h = BATTLE.h * zoom
  return { zoom, x: Math.floor((viewportW - w) / 2), y: Math.max(0, room - h - BATTLE_STAGE_GAP), w, h }
}

/** The world point the camera centres on to put the stage at `battleStage`'s box. */
export function battleCamera(viewportW: number, viewportH: number): Pos {
  const box = battleStage(viewportW, viewportH)
  return { x: (viewportW / 2 - box.x) / box.zoom, y: (viewportH / 2 - box.y) / box.zoom }
}
