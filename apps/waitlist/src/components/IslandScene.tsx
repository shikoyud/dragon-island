import { ELEMENT_COLORS } from '../domain/elements'

/**
 * Fallback hero art: a floating island at night drawn as a pixel grid in SVG, so the hero looks
 * finished before the generated `hero.base` sprite exists. Deterministic (fixed-seed LCG), so the
 * server and client render the same markup.
 */

export const ISLAND_W = 96
export const ISLAND_H = 64

type Grid = (string | null)[][]

function lcg(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 2 ** 32
  }
}

function paint(): Grid {
  const g: Grid = Array.from({ length: ISLAND_H }, () => Array<string | null>(ISLAND_W).fill(null))
  const set = (x: number, y: number, c: string) => {
    if (x >= 0 && x < ISLAND_W && y >= 0 && y < ISLAND_H) g[y]![x] = c
  }
  const rect = (x: number, y: number, w: number, h: number, c: string) => {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) set(x + i, y + j, c)
  }
  const rnd = lcg(46630)
  const { terra, nature, sea, ice, flame, metal } = ELEMENT_COLORS

  // Rock body: tapers from a wide top to a point, banded light → dark.
  const top = 26
  const bottom = 60
  const cx = 47
  for (let y = top; y <= bottom; y++) {
    const t = (y - top) / (bottom - top)
    const half = Math.round(38 * (1 - t ** 1.6)) + (rnd() < 0.3 ? 1 : 0)
    const shift = Math.round(Math.sin(t * 5) * 2)
    for (let x = cx - half + shift; x <= cx + half + shift; x++) {
      const edge = x === cx - half + shift || x === cx + half + shift
      const band = t < 0.18 ? terra.light : t < 0.55 ? terra.base : terra.dark
      set(x, y, edge ? terra.dark : band)
      if (!edge && rnd() < 0.05) set(x, y, metal.dark)
    }
  }
  // Hanging roots / drips under the rock.
  for (const [x, len] of [
    [38, 4],
    [44, 6],
    [53, 3],
    [58, 5],
  ] as const)
    rect(x, bottom - 6, 1, len + 6, terra.dark)

  // Grass cap with a bumpy upper edge.
  for (let x = 8; x <= 87; x++) {
    const bump = rnd() < 0.25 ? 1 : 0
    rect(x, top - 3 - bump, 1, 3 + bump, nature.base)
    set(x, top - 3 - bump, nature.light)
    set(x, top, nature.dark)
  }

  // Waterfall off the right edge, with a small pool on top.
  rect(70, top - 3, 8, 1, sea.light)
  for (let y = top - 2; y < ISLAND_H; y++) {
    rect(76, y, 3, 1, sea.base)
    if (y % 3 === 0) set(77, y, sea.light)
  }

  // Tree on the left.
  rect(19, 12, 2, 11, terra.dark)
  rect(13, 6, 14, 6, nature.dark)
  rect(14, 4, 12, 3, nature.base)
  rect(16, 2, 8, 2, nature.light)
  rect(12, 8, 16, 3, nature.base)

  // Ice crystals.
  rect(33, 16, 2, 7, ice.base)
  rect(36, 18, 2, 5, ice.light)
  rect(31, 19, 1, 4, ice.dark)

  // Nest with an egg.
  rect(53, 21, 12, 2, terra.dark)
  rect(54, 20, 10, 1, terra.base)
  rect(56, 13, 6, 7, flame.base)
  rect(57, 12, 4, 1, flame.base)
  rect(57, 14, 2, 2, flame.light)
  rect(60, 18, 2, 2, flame.dark)

  return g
}

/** Row-wise runs of one colour → one <rect> each. */
function toRects(g: Grid) {
  const out: { x: number; y: number; w: number; c: string }[] = []
  g.forEach((row, y) => {
    let x = 0
    while (x < row.length) {
      const c = row[x]
      if (!c) {
        x++
        continue
      }
      let w = 1
      while (row[x + w] === c) w++
      out.push({ x, y, w, c })
      x += w
    }
  })
  return out
}

const RECTS = toRects(paint())

export function IslandScene() {
  return (
    <svg
      className="island-svg"
      viewBox={`0 0 ${ISLAND_W} ${ISLAND_H}`}
      shapeRendering="crispEdges"
      role="img"
      aria-label="A floating island at night with a tree, ice crystals, a waterfall and a nest holding an egg"
    >
      {RECTS.map((r) => (
        <rect key={`${r.x}-${r.y}`} x={r.x} y={r.y} width={r.w} height={1} fill={r.c} />
      ))}
    </svg>
  )
}
