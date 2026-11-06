// GDD §5.5 (the start owns Home's centre 2x2), §5.4 (footprints), §5.6 and R50 (a fixed table: newPlayer has no Rng).
import type { Obstacle, ObstacleKind } from '../state'

/** Top-left cell of each starting building on Home Isle. */
export const HOME_START = {
  terra: { col: 13, row: 8 },
  flame: { col: 17, row: 8 },
  hatchery: { col: 8, row: 13 },
  farm: { col: 21, row: 8 },
  mountain: { col: 8, row: 8 },
} as const

/**
 * U6 (replaces R50's counts): 8 obstacles on 28 of the starting plots' 256 tiles, then 3 each on the first offered plots
 * 2, 7 and 11 (U4). Two obstacles are at least OBSTACLE_GAP tiles apart, and at the art's real sizes no two sprites overlap,
 * with room for a plot's sign beside them (apps/web/test/signSpot.test.ts pins that, as game-core has no sprite sizes).
 * As `[col, row]`.
 */
const HOME_OBSTACLE_CELLS: readonly (readonly [ObstacleKind, readonly (readonly [number, number])[]])[] = [
  // Starting land
  ['largeRock', [[16, 17]]], ['tree', [[16, 22], [9, 18]]], ['smallRock', [[8, 22], [12, 22]]], ['bush', [[21, 13], [20, 23], [23, 23]]],
  // Plot 2
  ['boulder', [[16, 0]]], ['tree', [[22, 0]]], ['bush', [[18, 7]]],
  // Plot 7
  ['ancientTree', [[28, 8]]], ['smallRock', [[24, 14]]], ['bush', [[30, 15]]],
  // Plot 11
  ['largeRock', [[29, 18]]], ['tree', [[24, 18]]], ['bush', [[26, 23]]],
]

/** Ids `os1..` stay clear of the `o${nextId}` ids spawns take, so `nextId` is untouched by the start. */
export const HOME_OBSTACLES: readonly Obstacle[] = HOME_OBSTACLE_CELLS
  .flatMap(([kind, cells]) => cells.map(([col, row]) => ({ kind, col, row })))
  .map((o, i) => ({ id: `os${i + 1}`, kind: o.kind, island: 'home' as const, col: o.col, row: o.row }))
