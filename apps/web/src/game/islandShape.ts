import { plotOfTile, plotOrigin, PLOTS_PER_SIDE, TILES_PER_PLOT } from '@wyrmhaven/game-core'
import { cellCentre, footprintDiamond, pointerToCell, type Box, type Pos } from './layout'

/** Grass and rock beyond the plots, in cells. */
export const RIM_CELLS = 3
/** World px, at the deepest. */
export const CLIFF_DEPTH = 110
/** The noise on the rim, in cells either way. */
const NOISE_CELLS = 1
/** Large land only grows bulges: from this many plots (the opening's 7 keep none), to `BULGE_CELLS` at 16. */
const BULGE_FROM = 7
const BULGE_FULL = 16
/** The deepest a bulge reaches past the rim, in cells. Between bulges the rim is its usual width: those are the bays. */
const BULGE_CELLS = 5
/** Rim rocks draw at this share of their art's size, so the back rim isn't a wall bigger than any building. */
export const RIM_ROCK_SCALE = 0.7
/** A rim rock's art at `RIM_ROCK_SCALE`, in whole px. */
export const rimRockSize = (w: number, h: number): { w: number; h: number } => ({ w: Math.round(w * RIM_ROCK_SCALE), h: Math.round(h * RIM_ROCK_SCALE) })
/** How far a rim rock's art reaches from its base point, for the widest art (48x32): `w` across, `h` up. It never covers a plot tile. */
export const RIM_ROCK_BOX = rimRockSize(48, 32)
const ROCK_HALF = Math.ceil(RIM_ROCK_BOX.w / 2)
/** Room in the bake for a rock's art outside the land, at the sides and the back. */
const ART_PAD = { x: 24, y: 40 } as const
/** The river's band, in world px above the front lip. */
const RIVER = { near: 4, far: 18 } as const
/** A fall stands this far back from the river's end by the tongue. */
const FALL_BACK = 16
/** The river keeps this far off the plots, in cells, so its 2 px bank does too. */
const RIVER_CLEAR = 0.5
/** The widest gap in a column that fills as a notch, in world px. */
const NOTCH_MAX = 40
/** A river under this many world px of front is a pond: dropped. */
const RIVER_MIN = 40
/** The lip stepping more than this between two columns is another lobe's edge, so the water stops there. */
const LIP_JUMP = 6
/** Two falls are at least this far apart. */
const FALL_APART = 48
/** World px between rim rocks along the edge, before the variation by position. */
const ROCK_GAP = 16

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

/** A broad swell of the rim, 0 in a bay and 1 on a bulge. Depends only on the position; a plot added can only add to the land. */
function rimBulge(x: number, y: number): number {
  return smooth(clamp((valueNoise(x, y * 2, 84, 71) - 0.36) / 0.3, 0, 1))
}

/** How deep this many plots of land may bulge, in cells. Never less with more land. */
export function bulgeCells(plots: number): number {
  return clamp((plots - BULGE_FROM) / (BULGE_FULL - BULGE_FROM), 0, 1) * BULGE_CELLS
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
  for (const p of plots) {
    const d = plotDistance(p, col + 0.5, row + 0.5)
    if (d < bestD || (d === bestD && p < best)) { best = p; bestD = d }
  }
  return best
}

/** World px per drift of a cloud: 2 a second, off the right bound and in again from the left. */
export function driftCloud(x: number, dtMs: number, lo: number, hi: number, halfW: number): number {
  const next = x + (2 * dtMs) / 1000
  return next - halfW > hi ? lo - halfW : next
}

/** The rim beyond the plots for this many plots of land, at its widest, in cells. */
const widestRim = (plots: number) => RIM_CELLS + NOISE_CELLS + bulgeCells(plots)

/** The world box `landmass` paints for these plots, with nothing rasterised: the plots' diamonds, the widest rim, room for the art and the cliff. */
export function landmassBox(plots: readonly number[]): Box {
  if (plots.length === 0) return { x: 0, y: 0, w: 0, h: 0 }
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (const plot of plots) {
    const o = plotOrigin(plot)
    for (const p of footprintDiamond(o.col, o.row, TILES_PER_PLOT)) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y) }
  }
  // A circle of radius r in cell space is at most r * sqrt(2) * 8 px wide either way and half that tall.
  const rimX = Math.ceil(widestRim(plots.length) * Math.SQRT2 * 8), rimY = Math.ceil(rimX / 2)
  // On the even grid the mask is rasterised on, so a pixel's cell is the same whatever the land.
  const left = (x0 - rimX - ART_PAD.x) & ~1, top = (y0 - rimY - ART_PAD.y) & ~1
  const right = x1 + rimX + ART_PAD.x, bottom = y1 + rimY + CLIFF_DEPTH + 4
  return { x: left, y: top, w: (right - left + 1) & ~1, h: (bottom - top + 1) & ~1 }
}

const EMPTY_LAND: Landmass = {
  box: { x: 0, y: 0, w: 0, h: 0 }, isLand: () => false, edge: () => 0, frontY: () => null, backY: () => null, cliffBottomY: () => null, isRiver: () => false,
  falls: [], rimRocks: [], mask: new Uint8Array(0),
}

/**
 * The island's shape for a set of plots, pure and deterministic. A pixel is land when its Euclidean distance in cell space
 * from the nearest plot rectangle is at most `RIM_CELLS` plus the noise, so edges are rounded and irregular, plus, on large
 * land, the broad bulges of `bulgeCells`. Cell space is what the game's rules live in, so a plot tile is always land.
 * The mask is rasterised on a 2 px grid: chunkier edges suit the art, at a quarter of the cost. Land is whole down each
 * column, back to front: a notch between plots is grass, not a wedge of rock.
 */
export function landmass(plots: readonly number[]): Landmass {
  if (plots.length === 0) return EMPTY_LAND
  const sorted = [...plots].sort((a, b) => a - b)
  const owned = new Set(sorted)
  const rects = sorted.map(plotOrigin)
  const bulge = bulgeCells(sorted.length)
  const nearest = (col: number, row: number) => {
    // On a plot: the commonest answer, without the loop.
    if (col >= 0 && row >= 0 && col < PLOTS_PER_SIDE * TILES_PER_PLOT && row < PLOTS_PER_SIDE * TILES_PER_PLOT && owned.has(Math.floor(row / TILES_PER_PLOT) * PLOTS_PER_SIDE + Math.floor(col / TILES_PER_PLOT))) return 0
    let best = Infinity
    for (const o of rects) {
      const dc = Math.max(o.col - col, 0, col - (o.col + TILES_PER_PLOT))
      const dr = Math.max(o.row - row, 0, row - (o.row + TILES_PER_PLOT))
      const d = dc * dc + dr * dr
      if (d < best) best = d
    }
    return Math.sqrt(best)
  }
  /** Noise is the cost here, so it's only asked where it can change the answer. */
  const reach = (x: number, y: number) => {
    const c = toCell(x, y)
    const d = nearest(c.col, c.row)
    if (d <= RIM_CELLS - NOISE_CELLS) return RIM_CELLS - NOISE_CELLS - d
    if (d > RIM_CELLS + NOISE_CELLS + bulge) return RIM_CELLS + NOISE_CELLS + bulge - d
    return RIM_CELLS + rimNoise(x, y) + bulge * rimBulge(x, y) - d
  }
  const onPlot = (x: number, y: number) => {
    const c = pointerToCell(x, y)
    const plot = plotOfTile(c.col, c.row)
    return plot !== null && owned.has(plot)
  }

  const box = landmassBox(sorted)
  const mask = new Uint8Array(box.w * box.h)
  const index = (x: number, y: number) => {
    const i = Math.floor(x) - box.x, j = Math.floor(y) - box.y
    return i < 0 || j < 0 || i >= box.w || j >= box.h ? -1 : j * box.w + i
  }
  const front = new Int32Array(box.w).fill(-1) // box-relative rows
  const back = new Int32Array(box.w).fill(-1)
  // The surface stops above the cliff's own room at the bottom of the box.
  const surfaceRows = (box.h - CLIFF_DEPTH - 4) & ~1
  // The rim on the 2 px grid, then only what is joined to a plot: a far lobe of noise is no land.
  const gw = box.w >> 1, gh = surfaceRows >> 1
  const raster = new Uint8Array(gw * gh) // 1 = within reach, 2 = and joined to a plot
  for (let v = 0; v < gh; v++) for (let u = 0; u < gw; u++) if (reach(box.x + 2 * u + 1, box.y + 2 * v + 1) >= 0) raster[v * gw + u] = 1
  const stack: number[] = []
  for (const o of rects) {
    const c = cellCentre(o.col + TILES_PER_PLOT / 2, o.row + TILES_PER_PLOT / 2)
    const k = ((c.y - box.y) >> 1) * gw + ((c.x - box.x) >> 1)
    if (raster[k] === 1) { raster[k] = 2; stack.push(k) }
  }
  while (stack.length > 0) {
    const k = stack.pop()!
    const u = k % gw
    if (u > 0 && raster[k - 1] === 1) { raster[k - 1] = 2; stack.push(k - 1) }
    if (u < gw - 1 && raster[k + 1] === 1) { raster[k + 1] = 2; stack.push(k + 1) }
    if (k >= gw && raster[k - gw] === 1) { raster[k - gw] = 2; stack.push(k - gw) }
    if (k + gw < raster.length && raster[k + gw] === 1) { raster[k + gw] = 2; stack.push(k + gw) }
  }
  const rowHasPlot = (i: number, from: number, to: number) => {
    for (let j = from; j <= to; j += 2) if (onPlot(box.x + i + 1, box.y + j + 1)) return true
    return false
  }
  for (let i = 0; i < box.w; i += 2) {
    let top = -1, runEnd = -1, runStart = -1
    for (let j = 0; j < surfaceRows; j += 2) {
      if (raster[(j >> 1) * gw + (i >> 1)] !== 2) continue
      if (top === -1) { top = runStart = j; runEnd = j + 1; continue }
      // A gap in the column. A narrow one is a notch between plots: it fills. Past that, the rim's tip above it stands alone, so it goes rather than make a wall of grass.
      if (j > runEnd + 1 && j - runEnd - 1 > NOTCH_MAX && !rowHasPlot(i, runStart, runEnd)) top = j
      if (j > runEnd + 1) runStart = j
      runEnd = j + 1
    }
    back[i] = top
    front[i] = runEnd
    if (back[i] === -1) continue
    // Whole from back to front: nothing but grass between two stretches of land in a column.
    for (let j = back[i]!; j <= front[i]!; j++) { mask[j * box.w + i] = MASK_LAND; mask[j * box.w + i + 1] = MASK_LAND }
    back[i + 1] = back[i]!
    front[i + 1] = front[i]!
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
  const stretches = [{ from: lo, to: lo + third - 1, innerIsRight: true }, { from: hi - third + 1, to: hi, innerIsRight: false }]
  const clearOf = (i: number, j: number) => { const c = toCell(box.x + i + 0.5, box.y + j + 0.5); return nearest(c.col, c.row) >= RIVER_CLEAR }
  /** Can water run in this column: land, clear of the plots, at the band's full height. */
  const canRun = (i: number) => {
    if (front[i] === -1) return false
    const j = front[i]! - RIVER.near - 6
    return j >= 0 && (mask[j * box.w + i]! & MASK_LAND) !== 0 && clearOf(i, j)
  }
  /** The longest stretch of columns water can run along, without the lip jumping (another lobe's edge). Null with none. */
  const longestRun = (from: number, to: number): { from: number; to: number } | null => {
    let best: { from: number; to: number } | null = null, start = -1
    for (let i = from; i <= to + 1; i++) {
      const ok = i <= to && canRun(i) && (start === -1 || Math.abs(front[i]! - front[i - 1]!) <= LIP_JUMP)
      if (ok) { if (start === -1) start = i; continue }
      if (start !== -1 && (!best || i - start > best.to - best.from + 1)) best = { from: start, to: i - 1 }
      start = i <= to && canRun(i) ? i : -1
    }
    return best
  }
  const falls: Pos[] = []
  const riverCols = new Uint8Array(box.w)
  /** Lays one run of river and stands its fall, at the lowest lip wide enough to feed it. Without such a lip the water doesn't stay. */
  const layRiver = (run: { from: number; to: number }, innerIsRight: boolean, minBack: number): boolean => {
    const inner = innerIsRight ? run.to : run.from, far = innerIsRight ? run.from : run.to
    const len = Math.max(1, Math.abs(inner - far))
    const wetAt: number[] = []
    let bestI = -1, bestF = -1
    for (let i = run.from; i <= run.to; i++) {
      const along = Math.abs(i - far) / len // 0 at the far end, 1 at the fall
      const fromInner = Math.abs(inner - i)
      if (along < 0.1) continue // the side of the island is too steep to hold water
      const wobble = valueNoise(box.x + i, 3, 19, 53)
      let thick = 3 + 8 * smooth(Math.min(1, along * 1.6)) + 3 * wobble
      thick *= Math.sqrt(Math.min(1, (fromInner + 1) / 5)) // the rounded end by the tongue
      const bottom = front[i]! - RIVER.near
      const top = Math.max(bottom - Math.round(thick) + 1, front[i]! - RIVER.far)
      let wet = 0
      for (let j = top; j <= bottom; j++) {
        if (j < 0 || mask[j * box.w + i] !== MASK_LAND || !clearOf(i, j)) continue
        mask[j * box.w + i] = MASK_LAND | MASK_RIVER
        wet++
      }
      if (wet > 0) { riverCols[i] = 1; wetAt.push(i) }
      // A fall's sprite is 32 px wide: at least half of it back from the river's end, so the river feeds it and it doesn't stand on the tongue of grass.
      if (wet >= 5 && fromInner >= minBack && front[i]! >= bestF) { bestF = front[i]!; bestI = i }
    }
    const dry = (i: number) => {
      riverCols[i] = 0
      for (let j = Math.max(0, front[i]! - RIVER.far); j <= front[i]!; j++) mask[j * box.w + i] = mask[j * box.w + i]! & MASK_LAND
    }
    if (bestI === -1 || (falls.length > 0 && Math.abs(box.x + bestI - falls[0]!.x) < FALL_APART)) {
      for (const i of wetAt) dry(i)
      return false
    }
    falls.push({ x: box.x + bestI, y: box.y + bestF })
    // The river goes over the fall: none runs on past it (the sprite hides the last stretch).
    const dir = innerIsRight ? 1 : -1
    for (let i = bestI + dir * FALL_BACK; i >= run.from && i <= run.to; i += dir) dry(i)
    // Its last 8 columns round off towards the lip, so the cut doesn't stand square beside the sprite.
    for (let n = 1; n <= 8; n++) {
      const i = bestI + dir * (FALL_BACK - n)
      if (i === bestI || i < 0 || i >= box.w || front[i] === -1) continue
      const drop = Math.round((RIVER.far - RIVER.near) * (1 - Math.sqrt(n / 8)))
      for (let j = Math.max(0, front[i]! - RIVER.far); j < front[i]! - RIVER.near - (RIVER.far - RIVER.near) + drop; j++) mask[j * box.w + i] = mask[j * box.w + i]! & MASK_LAND
    }
    return true
  }
  // One river per side: its longest run, and only if it is a real stretch of water.
  const runs = stretches.map(s => longestRun(s.from, s.to))
  stretches.forEach((s, n) => {
    const run = runs[n]
    if (run && run.to - run.from + 1 >= RIVER_MIN) layRiver(run, s.innerIsRight, FALL_BACK)
  })
  // Every island has a fall: when neither side made one, the longer run makes one however short it is.
  if (falls.length === 0) {
    const order = stretches.map((s, n) => ({ s, run: runs[n] })).filter(r => r.run !== null).sort((a, b) => (b.run!.to - b.run!.from) - (a.run!.to - a.run!.from))
    for (const { s, run } of order) if (layRiver(run!, s.innerIsRight, 2)) break
  }
  // No water anywhere (no room beside the plots): the lowest lip of the land still drops one, from the grass.
  if (falls.length === 0) {
    const i = columnsWithLand.reduce((best, k) => (front[k]! > front[best]! ? k : best), columnsWithLand[0]!)
    falls.push({ x: box.x + i, y: box.y + front[i]! })
  }

  // Rocks along the edge, each with land under its whole base: the first spot in scan order that keeps its distance from
  // those already placed. Not along the river's lip: the water runs out to the edge there.
  const rocks: { x: number; y: number; variant: number }[] = []
  const nearRiver = (i: number) => {
    for (let k = -18 - ROCK_HALF; k <= 18 + ROCK_HALF; k += 2) if (riverCols[i + k]) return true
    return false
  }
  const landAt = (a: number, b: number) => a >= 0 && b >= 0 && a < box.w && b < surfaceRows && (mask[b * box.w + a]! & MASK_LAND) !== 0
  const baseOnLand = (i: number, j: number) => {
    for (let dx = -ROCK_HALF; dx <= ROCK_HALF; dx += 2) if (!landAt(i + dx, j) || (mask[j * box.w + i + dx]! & MASK_RIVER)) return false
    return landAt(i + ROCK_HALF, j)
  }
  const boxClear = (x: number, y: number) => {
    for (let dy = 0; dy <= RIM_ROCK_BOX.h; dy += 2) for (let dx = -ROCK_HALF; dx <= ROCK_HALF; dx += 2) {
      if (onPlot(x + dx, y - dy)) return false
      const k = index(x + dx, y - dy)
      if (k !== -1 && (mask[k]! & MASK_RIVER)) return false
    }
    return true
  }
  for (let j = 0; j < surfaceRows; j += 2) for (let i = 0; i < box.w; i += 2) {
    if (!landAt(i, j)) continue
    // At the edge: land stops just past one end of the base, or right behind or before it.
    const l = i - ROCK_HALF, r = i + ROCK_HALF
    const isFront = !landAt(l, j + 2) || !landAt(r, j + 2) || !landAt(i, j + 2)
    if (!isFront && landAt(l - 2, j) && landAt(r + 2, j) && landAt(l, j - 2) && landAt(r, j - 2) && landAt(i, j - 2)) continue
    if (!baseOnLand(i, j)) continue
    // The front is the water's and, between the falls, the tongue of grass reaching the lip.
    const lipNear = front[i]! - j <= RIVER.far + 2
    if ((isFront || lipNear) && (nearRiver(i) || (i > stretches[0]!.to && i < stretches[1]!.from))) continue
    const x = box.x + i
    const y = box.y + j
    const gap = ROCK_GAP + hash(i, j) * 12
    if (rocks.some(k => Math.hypot(k.x - x, (k.y - y) * 1.5) < gap)) continue
    if (!boxClear(x, y)) continue
    rocks.push({ x, y, variant: Math.floor(hash(j, i) * 1024) })
  }
  rocks.sort((a, b) => a.y - b.y || a.x - b.x)

  const col = (x: number) => { const i = Math.floor(x) - box.x; return i >= 0 && i < box.w && front[i] !== -1 ? i : -1 }
  return {
    box,
    isLand: (x, y) => { const k = index(x, y); return k !== -1 && (mask[k]! & MASK_LAND) !== 0 },
    edge: (x, y) => Math.max(0, reach(x, y)),
    frontY: x => { const i = col(x); return i === -1 ? null : box.y + front[i]! },
    backY: x => { const i = col(x); return i === -1 ? null : box.y + back[i]! },
    cliffBottomY: x => { const i = col(x); return i === -1 ? null : box.y + front[i]! + depth[i]! },
    isRiver: (x, y) => { const k = index(x, y); return k !== -1 && (mask[k]! & MASK_RIVER) !== 0 },
    falls,
    rimRocks: rocks,
    mask,
  }
}
