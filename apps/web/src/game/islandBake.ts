import { MASK_LAND, MASK_RIVER, rimRockSize, type Landmass } from './islandShape'
import { cellTop, footprintDiamond, pointerToCell, type Pos } from './layout'

/** A bitmap to sample: `w` x `h` from its top-left corner (frame 0 of a sheet). */
export interface BakeImage { source: CanvasImageSource; w: number; h: number }

export interface BakeArt {
  /** One per grass variant; empty draws the fallback colours. */
  grass: BakeImage[]
  /** Which grass variant a cell takes. */
  variant(col: number, row: number, n: number): number
  rock: BakeImage | null
  rim: BakeImage[]
  water: BakeImage | null
}

/** Offered land is the same tile darkened (the design: the reference's dark ground for sale, in our own art). */
export const LOCKED_MULTIPLY = 0.55
const BANK: readonly [number, number, number] = [0xc9, 0xb2, 0x7c]
const WATER: readonly [number, number, number] = [0x3f, 0xa6, 0xe0]
const FALLBACK_GRASS = ['#5f9e3f', '#579538'] as const
const FALLBACK_ROCK: readonly [number, number, number] = [0x8d, 0x93, 0xa0]

function pixels(img: BakeImage): Uint8ClampedArray | null {
  const c = document.createElement('canvas')
  c.width = img.w
  c.height = img.h
  const g = c.getContext('2d', { willReadFrequently: true })
  if (!g) return null
  g.drawImage(img.source, 0, 0, img.w, img.h, 0, 0, img.w, img.h)
  return g.getImageData(0, 0, img.w, img.h).data
}

const stable = (a: number, b: number) => {
  let h = Math.imul(a + 7, 0x9e3779b1) ^ Math.imul(b + 13, 0x85ebca77)
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae3d)
  return ((h ^ (h >>> 16)) >>> 0) / 0x100000000
}

/**
 * The cliff under the land. The rock is draped from the lip, so its rows follow the edge; it is cut into facets 9 to 23 px
 * wide, each sampling the tile from its own place, since the 64 px tile repeats plainly when laid out straight. Lit on the
 * left of the island's middle and in shade on the right, with a dark line under the lip.
 */
function paintCliff(out: ImageData, land: Landmass, rockImg: BakeImage | null): void {
  const { box } = land
  const rock = rockImg ? pixels(rockImg) : null
  const rw = rockImg?.w ?? 1, rh = rockImg?.h ?? 1
  const data = out.data
  const facetAt = new Int32Array(box.w)
  let edgeAt = 0, facet = 0
  for (let i = 0; i < box.w; i++) {
    if (i >= edgeAt) { facet = i; edgeAt = i + 9 + Math.floor(stable(i, 1) * 15) }
    facetAt[i] = facet
  }
  let lo = box.w, hi = 0
  for (let i = 0; i < box.w; i++) if (land.frontY(box.x + i) !== null) { lo = Math.min(lo, i); hi = Math.max(hi, i) }
  const mid = (lo + hi) / 2, half = Math.max(1, (hi - lo) / 2)

  for (let i = lo; i <= hi; i++) {
    const x = box.x + i
    const front = land.frontY(x)
    const bottom = land.cliffBottomY(x)
    if (front === null || bottom === null) continue
    const f = facetAt[i]!
    const offX = Math.floor(stable(f, 2) * rw), offY = Math.floor(stable(f, 3) * rh)
    const facetShade = 0.88 + stable(f, 4) * 0.2
    const light = 1.12 - 0.42 * ((i - mid) / half + 1) / 2
    const paint = (y: number, shade: number, lipY: number) => {
      const u = ((i + offX) % rw + rw) % rw
      const v = ((y - lipY + offY) % rh + rh) % rh
      const k = (y - box.y) * box.w + i
      const p = k * 4
      const r = rock ? rock[(v * rw + u) * 4]! : FALLBACK_ROCK[0]
      const g = rock ? rock[(v * rw + u) * 4 + 1]! : FALLBACK_ROCK[1]
      const b = rock ? rock[(v * rw + u) * 4 + 2]! : FALLBACK_ROCK[2]
      data[p] = r * shade; data[p + 1] = g * shade; data[p + 2] = b * shade; data[p + 3] = 255
    }
    const fall = Math.max(1, bottom - front)
    for (let y = front + 1; y <= bottom && y < box.y + box.h; y++) {
      const d = y - front
      const lip = d <= 2 ? 0.5 : d === 3 ? 0.72 : 1
      // Darker into the depth, as light comes from above; and a dark last row, so the jagged bottom reads against the sky.
      const fade = 1 - 0.28 * (d / fall)
      paint(y, light * facetShade * fade * (y === bottom ? 0.6 : lip), front)
    }
  }
}

/** A tile on its own canvas multiplied by `LOCKED_MULTIPLY`, so a whole cell darkens without an antialiased path at its edges. */
function darkened(tile: BakeImage): BakeImage {
  const c = document.createElement('canvas')
  c.width = tile.w
  c.height = tile.h
  const g = c.getContext('2d')!
  g.drawImage(tile.source, 0, 0, tile.w, tile.h, 0, 0, tile.w, tile.h)
  const v = Math.round(255 * LOCKED_MULTIPLY)
  g.globalCompositeOperation = 'multiply'
  g.fillStyle = `rgb(${v},${v},${v})`
  g.fillRect(0, 0, tile.w, tile.h)
  g.globalCompositeOperation = 'destination-in'
  g.drawImage(tile.source, 0, 0, tile.w, tile.h, 0, 0, tile.w, tile.h)
  return { source: c, w: tile.w, h: tile.h }
}

/** Every cell that touches the land, back to front. The mask's grid is 2 px, so every other pixel will do. */
function cellsOnLand(land: Landmass): { col: number; row: number }[] {
  const { box, mask } = land
  const seen = new Set<number>()
  const out: { col: number; row: number }[] = []
  for (let j = 0; j < box.h; j += 2) for (let i = 0; i < box.w; i += 2) {
    if (!(mask[j * box.w + i]! & MASK_LAND)) continue
    const c = pointerToCell(box.x + i + 0.5, box.y + j + 0.5)
    const k = (c.col + 64) * 256 + (c.row + 64)
    if (seen.has(k)) continue
    seen.add(k)
    out.push(c)
  }
  return out.sort((a, b) => a.col + a.row - (b.col + b.row))
}

/** How far owned grass frays into the offered land's dark, in cells: 0.4 is about 3 world px across the cell's edge. */
const EDGE_FRAY = 0.4

/**
 * The owned pixels that take the offered land's dark, so the line between them is a dithered edge and not a straight one:
 * those within `EDGE_FRAY` of a cell edge shared with an offered cell, more of them the nearer the edge. Deterministic.
 */
export function edgeDither(cells: readonly { col: number; row: number }[], isLocked: (col: number, row: number) => boolean): Pos[] {
  const known = new Map<number, boolean>()
  const key = (col: number, row: number) => (col + 64) * 256 + (row + 64)
  for (const c of cells) known.set(key(c.col, c.row), isLocked(c.col, c.row))
  const out: Pos[] = []
  for (const { col, row } of cells) {
    if (known.get(key(col, row))) continue
    const sides = { up: known.get(key(col + 1, row)) === true, down: known.get(key(col - 1, row)) === true, right: known.get(key(col, row + 1)) === true, left: known.get(key(col, row - 1)) === true }
    if (!sides.up && !sides.down && !sides.right && !sides.left) continue
    const t = cellTop(col, row)
    for (let y = t.y; y < t.y + 8; y++) for (let x = t.x - 8; x < t.x + 8; x++) {
      const c = pointerToCell(x + 0.5, y + 0.5)
      if (c.col !== col || c.row !== row) continue
      const fc = ((y + 0.5) / 4 + (x + 0.5) / 8) / 2 - col, fr = ((y + 0.5) / 4 - (x + 0.5) / 8) / 2 - row
      const depth = Math.min(sides.up ? 1 - fc : 1, sides.down ? fc : 1, sides.right ? 1 - fr : 1, sides.left ? fr : 1)
      if (depth < EDGE_FRAY && stable(x, y) < 1 - depth / EDGE_FRAY) out.push({ x, y })
    }
  }
  return out
}

/** Grass over every cell touching the land, the dithered edge on it, then cut per pixel to the land's own outline. */
function paintTop(land: Landmass, art: BakeArt, isLocked: (col: number, row: number) => boolean): HTMLCanvasElement {
  const { box } = land
  const top = document.createElement('canvas')
  top.width = box.w
  top.height = box.h
  const g = top.getContext('2d')!
  const dark = art.grass.map(darkened)
  const cells = cellsOnLand(land)
  for (const { col, row } of cells) {
    const locked = isLocked(col, row)
    const t = cellTop(col, row)
    if (art.grass.length > 0) {
      const v = art.variant(col, row, art.grass.length)
      const tile = locked ? dark[v]! : art.grass[v]!
      g.drawImage(tile.source, 0, 0, tile.w, tile.h, t.x - 8 - box.x, t.y - box.y, tile.w, tile.h)
    } else {
      const shade = locked ? 'rgba(0,0,0,0.45)' : null
      g.fillStyle = FALLBACK_GRASS[(col + row) % 2 === 0 ? 0 : 1]!
      const pts = footprintDiamond(col, row, 1)
      g.beginPath()
      pts.forEach((p, n) => (n === 0 ? g.moveTo(p.x - box.x, p.y - box.y) : g.lineTo(p.x - box.x, p.y - box.y)))
      g.closePath()
      g.fill()
      if (shade) { g.fillStyle = shade; g.fill() }
    }
  }
  const v = Math.round(255 * LOCKED_MULTIPLY)
  g.globalCompositeOperation = 'multiply'
  g.fillStyle = `rgb(${v},${v},${v})`
  for (const p of edgeDither(cells, isLocked)) g.fillRect(p.x - box.x, p.y - box.y, 1, 1)
  g.globalCompositeOperation = 'source-over'
  // Land is whole down a column, on a 2 px grid: its outline is one rectangle per 2 columns.
  g.globalCompositeOperation = 'destination-in'
  g.beginPath()
  for (let i = 0; i < box.w; i += 2) {
    const back = land.backY(box.x + i), front = land.frontY(box.x + i)
    if (back !== null && front !== null) g.rect(i, back - box.y, 2, front - back + 1)
  }
  g.fillStyle = '#000'
  g.fill()
  g.globalCompositeOperation = 'source-over'
  return top
}

/** A 2 px sand bank round the river, then the river sampling the water tile, on `out`. Banks only on land, never on the river itself. */
function paintRiver(out: ImageData, land: Landmass, waterImg: BakeImage | null): void {
  const { box, mask } = land
  const water = waterImg ? pixels(waterImg) : null
  const ww = waterImg?.w ?? 1, wh = waterImg?.h ?? 1
  const put = (k: number, c: readonly [number, number, number]) => {
    out.data[k * 4] = c[0]; out.data[k * 4 + 1] = c[1]; out.data[k * 4 + 2] = c[2]; out.data[k * 4 + 3] = 255
  }
  const wet: number[] = []
  for (let k = 0; k < mask.length; k++) if (mask[k]! & MASK_RIVER) wet.push(k)
  for (const k of wet) {
    const i = k % box.w, j = (k - i) / box.w
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      if (Math.abs(dx) + Math.abs(dy) > 3) continue
      const a = i + dx, b = j + dy
      if (a < 0 || b < 0 || a >= box.w || b >= box.h) continue
      const n = b * box.w + a
      if (mask[n] === MASK_LAND) put(n, BANK)
    }
  }
  for (const k of wet) {
    const i = k % box.w, j = (k - i) / box.w
    if (water) {
      const p = (((j % wh) * ww + (i % ww)) * 4)
      // Half and half with the plain colour: the tile's dark diamonds read as blotches on so thin a band. Where its corner is empty the plain colour shows.
      if (water[p + 3]! > 128) put(k, [(water[p]! + WATER[0]) >> 1, (water[p + 1]! + WATER[1]) >> 1, (water[p + 2]! + WATER[2]) >> 1])
      else put(k, WATER)
    } else put(k, WATER)
  }
}

function paintRocks(g: CanvasRenderingContext2D, land: Landmass, art: BakeArt): void {
  const { box } = land
  g.imageSmoothingEnabled = false
  for (const r of land.rimRocks) {
    const x = r.x - box.x, y = r.y - box.y
    const img = art.rim[r.variant % Math.max(1, art.rim.length)]
    if (img) {
      const size = rimRockSize(img.w, img.h)
      g.drawImage(img.source, 0, 0, img.w, img.h, x - Math.round(size.w / 2), y - size.h, size.w, size.h)
      continue
    }
    // Fallback: a grey polygon with a lighter top, at the rock's size.
    g.fillStyle = '#6d7380'
    g.beginPath(); g.moveTo(x - 9, y); g.lineTo(x - 6, y - 6); g.lineTo(x - 1, y - 9); g.lineTo(x + 6, y - 6); g.lineTo(x + 9, y); g.closePath(); g.fill()
    g.fillStyle = '#9aa0ac'
    g.beginPath(); g.moveTo(x - 5, y - 5); g.lineTo(x - 1, y - 8); g.lineTo(x + 5, y - 5); g.lineTo(x, y - 4); g.closePath(); g.fill()
  }
}

/** Paints the whole landmass on `g`, a canvas the size of `land.box`: cliff, top, river, rocks. `isLocked` says which cells show as for sale. */
export function paintLandmass(g: CanvasRenderingContext2D, land: Landmass, art: BakeArt, isLocked: (col: number, row: number) => boolean): void {
  // Cliff and river share one image: they don't overlap. The top then goes behind the river, and the cliff is outside its outline.
  const under = g.createImageData(land.box.w, land.box.h)
  paintCliff(under, land, art.rock)
  paintRiver(under, land, art.water)
  g.putImageData(under, 0, 0)
  g.globalCompositeOperation = 'destination-over'
  g.drawImage(paintTop(land, art, isLocked), 0, 0)
  g.globalCompositeOperation = 'source-over'
  paintRocks(g, land, art)
}
