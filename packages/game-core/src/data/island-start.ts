// GDD §5.5 (the start owns Home's centre 2x2), §5.4 (footprints), §5.6 and R50 (a fixed table: newPlayer has no Rng).
import type { Obstacle, ObstacleKind } from '../state'

/** Top-left cell of each starting building on Home Isle. */
export const HOME_START = {
  terra: { col: 8, row: 8 },
  flame: { col: 12, row: 8 },
  hatchery: { col: 16, row: 8 },
  farm: { col: 20, row: 8 },
  mountain: { col: 8, row: 12 },
} as const

/** R50: 21 obstacles, 77 of the starting plots' 256 tiles, to the south and east of the buildings, as `[col, row]`. */
const HOME_OBSTACLE_CELLS: readonly (readonly [ObstacleKind, readonly (readonly [number, number])[]])[] = [
  ['ancientTree', [[20, 20]]],
  ['boulder', [[8, 20]]],
  ['largeRock', [[20, 16]]],
  ['tree', [[13, 21], [17, 20], [8, 18]]],
  ['smallRock', [[15, 22], [10, 18], [18, 22]]],
  ['bush', [[23, 9], [23, 11], [21, 11], [12, 18], [12, 21], [14, 20], [16, 21], [13, 23], [17, 23], [19, 20], [23, 16], [20, 19]]],
]

/** Ids `os1..` stay clear of the `o${nextId}` ids spawns take, so `nextId` is untouched by the start. */
export const HOME_OBSTACLES: readonly Obstacle[] = HOME_OBSTACLE_CELLS
  .flatMap(([kind, cells]) => cells.map(([col, row]) => ({ kind, col, row })))
  .map((o, i) => ({ id: `os${i + 1}`, kind: o.kind, island: 'home' as const, col: o.col, row: o.row }))
