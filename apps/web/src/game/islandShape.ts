import { plotOfTile, plotOrigin, TILES_PER_PLOT } from '@wyrmhaven/game-core'
import { footprintDiamond, pointerToCell, type Box, type Pos } from './layout'

/** Grass and rock beyond the plots, in cells. */
export const RIM_CELLS = 3
/** World px, at the deepest. */
export const CLIFF_DEPTH = 110
/** The noise on the rim, in cells either way. */
const NOISE_CELLS = 1
/** How far a rim rock's art reaches from its base point: `w` across, `h` up. It never covers a plot tile. */
export const RIM_ROCK_BOX = { w: 48, h: 32 } as const
/** Room in the bake for a rock's art outside the land, at the sides and the back. */
const ART_PAD = { x: 24, y: 40 } as const
/** The river's band, in world px above the front lip. */
const RIVER = { near: 4, far: 18 } as const
/** A fall stands this far back from the river's end by the tongue. */
const FALL_BACK = 16
/** The river keeps this far off the plots, in cells, so its 2 px bank does too. */
const RIVER_CLEAR = 0.5
/** World px between rim rocks along the edge, before the variation by position. */
const ROCK_GAP = 19

/** Bits of `Landmass.mask`. */
export const MASK_LAND = 1
export const MASK_RIVER = 2

export interface Landmass {
  /** World box of the bake. */
  box: Box
  /** Top surface, in world px. */
  isLand(x: number, y: number): boolean
  /** Cells from the outer boundary, 0 at it and off the land. */
  edge(x: number, y: number): number
  /** The lowest top-surface pixel row in a column, or null when the column has no land. */
  frontY(x: number): number | null
  backY(x: number): number | null
  /** Jagged, deepest mid-island, tapering to the sides. */
  cliffBottomY(x: number): number | null
  isRiver(x: number, y: number): boolean
  /** Waterfall tops, on the front lip, world px. */
  falls: Pos[]
  /** By `y`, back to front. `x, y` is the middle of the rock's base; `variant` is any whole number (the painter takes it modulo its art). */
  rimRocks: { x: number; y: number; variant: number }[]
  /** One byte per pixel of `box`, row by row: `MASK_LAND`, `MASK_RIVER`. What the painter reads instead of asking per pixel. */
  mask: Uint8Array
}

/** A number in 0..1 from two whole numbers; the same pair always gives the same number. */
function hash(a: number, b: number): number {
  let h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1)
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b)
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35)
  return ((h ^ (h >>> 16)) >>> 0) / 0x100000000
}

const smooth = (t: number) => t * t * (3 - 2 * t)
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/** Value noise in 0..1, smooth, with a lattice `period` world px apart. */
function valueNoise(x: number, y: number, period: number, seed: number): number {
  const u = x / period, v = y / period
  const iu = Math.floor(u), iv = Math.floor(v)
  const fu = smooth(u - iu), fv = smooth(v - iv)
  const at = (a: number, b: number) => hash(a + seed, b - seed)
  const top = at(iu, iv) * (1 - fu) + at(iu + 1, iv) * fu
  const low = at(iu, iv + 1) * (1 - fu) + at(iu + 1, iv + 1) * fu
  return top * (1 - fv) + low * fv
}

/** The rim's wander at a world position, in cells: broad bays with smaller bites on them. Depends only on the position, so land only ever grows. */
function rimNoise(x: number, y: number): number {
  const n = valueNoise(x, y, 40, 11) * 0.7 + valueNoise(x, y, 15, 29) * 0.3
  return clamp((n - 0.5) * 6, -1, 1) * NOISE_CELLS
}

/** Continuous cell coordinates of a world position (`pointerToCell` before the floor). */
const toCell = (x: number, y: number) => ({ col: (y / 4 + x / 8) / 2, row: (y / 4 - x / 8) / 2 })

function plotDistance(plot: number, col: number, row: number): number {
  const o = plotOrigin(plot)
  const dc = Math.max(o.col - col, 0, col - (o.col + TILES_PER_PLOT))
  const dr = Math.max(o.row - row, 0, row - (o.row + TILES_PER_PLOT))
  return Math.hypot(dc, dr)
}

/** The plot closest to a cell's centre; the lowest index on a tie. A rim cell takes its look from it. */
export function nearestPlot(plots: readonly number[], col: number, row: number): number {
  let best = plots[0] ?? 0, bestD = Infinity
  for (const p of [...plots].sort((a, b) => a - b)) {
    const d = plotDistance(p, col + 0.5, row + 0.5)
    if (d < bestD) { best = p; bestD = d }
  }
  return best
}

/** World px per drift of a cloud: 2 a second, off the right bound and in again from the left. */
export function driftCloud(x: number, dtMs: number, lo: number, hi: number, halfW: number): number {
  const next = x + (2 * dtMs) / 1000
  return next - halfW > hi ? lo - halfW : next
}

/**
 * The island's shape for a set of plots, pure and deterministic. A pixel is land when its Euclidean distance in cell space
 * from the nearest plot rectangle is at most `RIM_CELLS` plus the noise, so edges are rounded and irregular. Cell space is
 * what the game's rules live in, so a plot tile is always land and land never reaches an unowned tile's far side.
 */
export function landmass(plots: readonly number[]): Landmass {
  const sorted = [...plots].sort((a, b) => a - b)
  const owned = new Set(sorted)
  const rects = sorted.map(plotOrigin)
  const nearest = (col: number, row: number) => {
    let best = Infinity
    for (const o of rects) {
      const dc = Math.max(o.col - col, 0, col - (o.col + TILES_PER_PLOT))
      const dr = Math.max(o.row - row, 0, row - (o.row + TILES_PER_PLOT))
      const d = dc * dc + dr * dr
      if (d < best) best = d
    }
    return Math.sqrt(best)
  }
  const reach = (x: number, y: number) => {
    const c = toCell(x, y)
    return RIM_CELLS + rimNoise(x, y) - nearest(c.col, c.row)
  }
  const onPlot = (x: number, y: number) => {
    const c = pointerToCell(x, y)
    const plot = plotOfTile(c.col, c.row)
    return plot !== null && owned.has(plot)
  }

  // The plots' diamonds, grown by the largest rim: a circle of radius r in cell space is at most r * sqrt(2) * 8 px wide either way and half that tall.
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (const plot of sorted) {
    const o = plotOrigin(plot)
    for (const p of footprintDiamond(o.col, o.row, TILES_PER_PLOT)) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y) }
  }
  const rimX = Math.ceil((RIM_CELLS + NOISE_CELLS) * Math.SQRT2 * 8), rimY = Math.ceil(rimX / 2)
  const box: Box = {
    x: x0 - rimX - ART_PAD.x, y: y0 - rimY - ART_PAD.y,
    w: x1 - x0 + 2 * (rimX + ART_PAD.x), h: y1 - y0 + rimY + ART_PAD.y + rimY + CLIFF_DEPTH + 4,
  }

  const mask = new Uint8Array(box.w * box.h)
  const index = (x: number, y: number) => {
    const i = Math.floor(x) - box.x, j = Math.floor(y) - box.y
    return i < 0 || j < 0 || i >= box.w || j >= box.h ? -1 : j * box.w + i
  }
  const front = new Int32Array(box.w).fill(-1) // box-relative rows
  const back = new Int32Array(box.w).fill(-1)
  // The surface stops above the cliff's own room at the bottom of the box.
  const surfaceRows = box.h - CLIFF_DEPTH - 4
  for (let j = 0; j < surfaceRows; j++) for (let i = 0; i < box.w; i++) {
    if (reach(box.x + i + 0.5, box.y + j + 0.5) < 0) continue
    mask[j * box.w + i] = MASK_LAND
    if (back[i] === -1) back[i] = j
    front[i] = j
  }
  const columnsWithLand: number[] = []
  for (let i = 0; i < box.w; i++) if (front[i] !== -1) columnsWithLand.push(i)
  const lo = columnsWithLand[0] ?? 0, hi = columnsWithLand[columnsWithLand.length - 1] ?? 0
  const width = hi - lo + 1
  const mid = (lo + hi) / 2
  const halfW = Math.max(1, width / 2)

  // The cliff's depth at a column: a hanging belly, with teeth every 5 to 11 px.
  const toothEdges: number[] = []
  for (let i = lo; i <= hi + 12; i += 5 + Math.floor(hash(i, 7) * 7)) toothEdges.push(i)
  const depth = new Int32Array(box.w)
  let tooth = 0
  for (const i of columnsWithLand) {
    while (tooth + 1 < toothEdges.length - 1 && toothEdges[tooth + 1]! <= i) tooth++
    const a = toothEdges[tooth]!, b = toothEdges[tooth + 1] ?? a + 1
    const t = (i - a) / Math.max(1, b - a)
    const tip = hash(a, 91) * (1 - t) + hash(b, 91) * t
    const belly = Math.pow(1 - Math.min(1, Math.abs(i - mid) / halfW), 0.6)
    const room = CLIFF_DEPTH - 8
    depth[i] = Math.round(clamp(8 + belly * (room - 18) + tip * (6 + 12 * belly), 4, CLIFF_DEPTH))
  }

  // The river: along the lip, on the front's left and right thirds, leaving the middle third as a tongue of grass.
  const third = Math.floor(width / 3)
  const stretches = [{ from: lo, to: lo + third - 1, inner: lo + third - 1 }, { from: hi - third + 1, to: hi, inner: hi - third + 1 }]
  const falls: Pos[] = []
  const riverCols = new Uint8Array(box.w)
  for (const s of stretches) {
    const far = s.inner === s.to ? s.from : s.to
    const len = Math.max(1, Math.abs(s.inner - far))
    // Thickness per column, and the one with the lowest lip wide enough to feed a fall.
    let bestI = -1, bestF = -1
    for (let i = s.from; i <= s.to; i++) {
      if (front[i] === -1) continue
      const along = Math.abs(i - far) / len // 0 at the far end, 1 at the fall
      const inner = Math.abs(s.inner - i)
      if (along < 0.1) continue // the side of the island is too steep to hold water
      const wobble = valueNoise(box.x + i, 3, 19, 53)
      let thick = 3 + 8 * smooth(Math.min(1, along * 1.6)) + 3 * wobble
      thick *= Math.sqrt(Math.min(1, (inner + 1) / 5)) // the rounded end by the tongue
      const bottom = front[i]! - RIVER.near
      const top = Math.max(bottom - Math.round(thick) + 1, front[i]! - RIVER.far)
      let wet = 0
      for (let j = top; j <= bottom; j++) {
        if (j < 0 || mask[j * box.w + i] !== MASK_LAND) continue
        const c = toCell(box.x + i + 0.5, box.y + j + 0.5)
        if (nearest(c.col, c.row) < RIVER_CLEAR) continue
        mask[j * box.w + i] = MASK_LAND | MASK_RIVER
        wet++
      }
      if (wet > 0) riverCols[i] = 1
      // A fall's sprite is 32 px wide: at least half of it back from the river's end, so the river feeds it and it doesn't stand on the tongue of grass.
      if (wet >= 5 && inner >= FALL_BACK && front[i]! >= bestF) { bestF = front[i]!; bestI = i }
    }
    if (bestI === -1) continue
    falls.push({ x: box.x + bestI, y: box.y + bestF })
    // The river goes over the fall: none runs on past it (the sprite hides the last stretch).
    const dir = s.inner > far ? 1 : -1
    for (let i = bestI + dir * FALL_BACK; i >= s.from && i <= s.to; i += dir) {
      riverCols[i] = 0
      for (let j = Math.max(0, front[i]! - RIVER.far); j <= front[i]!; j++) mask[j * box.w + i] = mask[j * box.w + i]! & MASK_LAND
    }
    // Its last 8 columns round off towards the lip, so the cut doesn't stand square beside the sprite.
    for (let n = 1; n <= 8; n++) {
      const i = bestI + dir * (FALL_BACK - n)
      if (i === bestI || front[i] === -1 || front[i] === undefined) continue
      const drop = Math.round((RIVER.far - RIVER.near) * (1 - Math.sqrt(n / 8)))
      for (let j = Math.max(0, front[i]! - RIVER.far); j < front[i]! - RIVER.near - (RIVER.far - RIVER.near) + drop; j++) mask[j * box.w + i] = mask[j * box.w + i]! & MASK_LAND
    }
  }
  const apartFalls = falls.filter((f, n) => falls.slice(0, n).every(g => Math.abs(g.x - f.x) >= 48))

  // Rocks along the edge, the first boundary pixel in scan order that keeps its distance from those already placed.
  // Not along the river's lip: the water runs out to the edge there.
  const rocks: { x: number; y: number; variant: number }[] = []
  const nearRiver = (i: number) => {
    for (let k = -18; k <= 18; k += 2) if (riverCols[i + k]) return true
    return false
  }
  const boxClear = (x: number, y: number) => {
    for (let dy = 0; dy <= RIM_ROCK_BOX.h; dy += 2) for (let dx = -RIM_ROCK_BOX.w / 2; dx <= RIM_ROCK_BOX.w / 2; dx += 2) if (onPlot(x + dx, y - dy)) return false
    return true
  }
  for (let j = 0; j < surfaceRows; j += 2) for (let i = 0; i < box.w; i += 2) {
    if (!(mask[j * box.w + i]! & MASK_LAND)) continue
    const out = (a: number, b: number) => a < 0 || b < 0 || a >= box.w || b >= surfaceRows || !(mask[b * box.w + a]! & MASK_LAND)
    if (!out(i - 2, j) && !out(i + 2, j) && !out(i, j - 2) && !out(i, j + 2)) continue
    const isFront = out(i, j + 2)
    // The front is the water's and, between the falls, the tongue of grass reaching the lip.
    if (isFront && (nearRiver(i) || (i > stretches[0]!.to && i < stretches[1]!.from))) continue
    const x = box.x + i
    // A rock on the front lip hangs a little over it, so it doesn't stand on the grass behind.
    const y = box.y + j + (isFront ? 6 : 2)
    const gap = ROCK_GAP + hash(i, j) * 12
    if (rocks.some(r => Math.hypot(r.x - x, (r.y - y) * 1.5) < gap)) continue
    if (!boxClear(x, y)) continue
    rocks.push({ x, y, variant: Math.floor(hash(j, i) * 1024) })
  }
  rocks.sort((a, b) => a.y - b.y || a.x - b.x)

  const col = (x: number) => { const i = Math.floor(x) - box.x; return i >= 0 && i < box.w && front[i] !== -1 ? i : -1 }
  return {
    box,
    isLand: (x, y) => reach(x, y) >= 0,
    edge: (x, y) => Math.max(0, reach(x, y)),
    frontY: x => { const i = col(x); return i === -1 ? null : box.y + front[i]! },
    backY: x => { const i = col(x); return i === -1 ? null : box.y + back[i]! },
    cliffBottomY: x => { const i = col(x); return i === -1 ? null : box.y + front[i]! + depth[i]! },
    isRiver: (x, y) => { const k = index(x, y); return k !== -1 && (mask[k]! & MASK_RIVER) !== 0 },
    falls: apartFalls,
    rimRocks: rocks,
    mask,
  }
}
