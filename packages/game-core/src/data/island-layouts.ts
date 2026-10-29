import { homeSize } from '../island'
import type { IslandId, Obstacle, ObstacleKind } from '../state'

/**
 * Fixed obstacle layout shared by every outer island (16x16): 10 bush, 8 rock,
 * 6 tree, 4 boulder, 2 ruin. The 5x5 block at cols/rows 5..9 is always clear.
 */
export const OUTER_LAYOUT: readonly { kind: ObstacleKind; col: number; row: number }[] = [
  { kind: 'ruin', col: 0, row: 0 }, { kind: 'ruin', col: 12, row: 12 },
  { kind: 'boulder', col: 13, row: 1 }, { kind: 'boulder', col: 1, row: 12 },
  { kind: 'boulder', col: 12, row: 6 }, { kind: 'boulder', col: 2, row: 7 },
  { kind: 'tree', col: 6, row: 0 }, { kind: 'tree', col: 10, row: 2 }, { kind: 'tree', col: 4, row: 3 },
  { kind: 'tree', col: 7, row: 12 }, { kind: 'tree', col: 13, row: 9 }, { kind: 'tree', col: 10, row: 11 },
  { kind: 'rock', col: 3, row: 1 }, { kind: 'rock', col: 14, row: 4 }, { kind: 'rock', col: 0, row: 5 },
  { kind: 'rock', col: 3, row: 10 }, { kind: 'rock', col: 5, row: 14 }, { kind: 'rock', col: 11, row: 9 },
  { kind: 'rock', col: 15, row: 15 }, { kind: 'rock', col: 9, row: 15 },
  { kind: 'bush', col: 9, row: 3 }, { kind: 'bush', col: 8, row: 1 }, { kind: 'bush', col: 12, row: 4 },
  { kind: 'bush', col: 15, row: 8 }, { kind: 'bush', col: 1, row: 9 }, { kind: 'bush', col: 4, row: 12 },
  { kind: 'bush', col: 6, row: 11 }, { kind: 'bush', col: 10, row: 14 }, { kind: 'bush', col: 0, row: 15 },
  { kind: 'bush', col: 15, row: 1 },
]

export function outerObstacles(island: Exclude<IslandId, 'home'>): Obstacle[] {
  return OUTER_LAYOUT.map((o, i) => ({ id: `${island}-${i}`, kind: o.kind, island, col: o.col, row: o.row }))
}

/** One bush and one rock inside the strip that home expansion `step` adds. */
export function homeStripObstacles(step: number): Obstacle[] {
  const { w, h } = homeSize(step)
  const [bush, rock] = step % 2 === 1 ? [{ col: w - 2, row: 1 }, { col: w - 1, row: h - 2 }] : [{ col: 1, row: h - 2 }, { col: w - 2, row: h - 1 }]
  return [
    { id: `home-s${step}-bush`, kind: 'bush', island: 'home', ...bush },
    { id: `home-s${step}-rock`, kind: 'rock', island: 'home', ...rock },
  ]
}
