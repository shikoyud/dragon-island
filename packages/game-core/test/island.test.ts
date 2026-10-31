import { describe, expect, it } from 'vitest'
import { bridgeError, FOOTPRINT, ISLAND_ORDER, occupants, placementError } from '../src/island'
import { newPlayer } from '../src/state'

const P = (col: number, row: number) => ({ island: 'home' as const, col, row, facing: 0 as const })

describe('island geometry', () => {
  it('lists the starting occupants', () => {
    const o = occupants(newPlayer(0), 'home').filter(x => x.ref.type !== 'obstacle')
    expect(o).toHaveLength(5)
    expect(o.find(x => x.ref.type === 'hatchery')).toEqual({ ref: { type: 'hatchery' }, col: 8, row: 13, size: 4 })
  })
  it('rejects placements off the island, on a locked island, off owned land, or over something', () => {
    const s = newPlayer(0)
    expect(placementError(s, P(30, 8), 5)).toBe('OUT_OF_BOUNDS')
    expect(placementError(s, P(-1, 0), 1)).toBe('OUT_OF_BOUNDS')
    expect(placementError(s, { island: 'isle2', col: 0, row: 0, facing: 0 }, 1)).toBe('ISLAND_LOCKED')
    expect(placementError(s, P(0, 0), 1)).toBe('NOT_OWNED')
    expect(placementError(s, P(8, 8), 2)).toBe('OVERLAP')
    expect(placementError(s, P(20, 12), FOOTPRINT.habitat)).toBeNull()
    expect(placementError(s, P(17, 8), FOOTPRINT.habitat, { type: 'habitat', id: 'h2' })).toBeNull()
  })
  it('a Bridge reads the one before it, then its level', () => {
    const s = newPlayer(0)
    expect(ISLAND_ORDER.slice(1).map(i => bridgeError({ ...s, level: 50 }, i as 'isle2'))).toEqual([null, 'ISLAND_LOCKED', 'ISLAND_LOCKED', 'ISLAND_LOCKED', 'ISLAND_LOCKED'])
    expect(bridgeError(s, 'isle2')).toBe('LEVEL_TOO_LOW')
    expect(bridgeError({ ...s, islands: { ...s.islands, unlocked: ['home', 'isle2'] } }, 'isle2')).toBe('PLOT_OWNED')
  })
})
