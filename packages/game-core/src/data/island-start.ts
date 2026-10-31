// GDD §5.5 (the start owns Home's centre 2x2), §5.4 (footprints), R50 (a fixed table: newPlayer has no Rng).
// §5.6's starting obstacles join this table in M4 Task 3.

/** Top-left cell of each starting building on Home Isle. */
export const HOME_START = {
  terra: { col: 8, row: 8 },
  flame: { col: 12, row: 8 },
  hatchery: { col: 16, row: 8 },
  farm: { col: 20, row: 8 },
  mountain: { col: 8, row: 12 },
} as const
