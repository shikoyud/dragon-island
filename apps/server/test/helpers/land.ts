import { FOOTPRINT, ISLAND_TILES, newPlayer, placementError, type Placement } from '@wyrmhaven/game-core'

/** A free cell on a new player's Home that fits any footprint (the same idea as game-core's test/helpers/land.ts). */
export const FREE: Placement = (() => {
  const s = newPlayer(0)
  for (let row = 0; row < ISLAND_TILES; row++) for (let col = 0; col < ISLAND_TILES; col++) {
    const p: Placement = { island: 'home', col, row, facing: 0 }
    if (placementError(s, p, FOOTPRINT.breeder) === null) return p
  }
  throw new Error('no free cell on a new Home')
})()
