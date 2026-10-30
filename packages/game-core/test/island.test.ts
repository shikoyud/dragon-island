import { describe, expect, it } from 'vitest'
import { HOME_EXPANSION, OUTER_ISLANDS, homeSize, occupants, placementError } from '../src/island'
import { newPlayer } from '../src/state'

describe('island geometry', () => {
  it('home island grows width then height by 2', () => {
    expect([homeSize(0), homeSize(1), homeSize(2), homeSize(12)]).toEqual([{ w: 12, h: 12 }, { w: 14, h: 12 }, { w: 14, h: 14 }, { w: 24, h: 24 }])
    expect(HOME_EXPANSION).toHaveLength(12)
    expect(HOME_EXPANSION.reduce((n, e) => n + e.cost, 0)).toBe(2_053_500)
    expect(HOME_EXPANSION[11]).toEqual({ cost: 750_000 })
  })
  it('lists the starting occupants', () => {
    const o = occupants(newPlayer(0), 'home')
    expect(o).toHaveLength(5)
    expect(o.find(x => x.ref.type === 'hatchery')).toEqual({ ref: { type: 'hatchery' }, col: 0, row: 8, size: 4 })
  })
  it('rejects placements off the island, on a locked island, or over something', () => {
    const s = newPlayer(0)
    expect(placementError(s, { island: 'home', col: 8, row: 8, facing: 0 }, 5)).toBe('OUT_OF_BOUNDS')
    expect(placementError(s, { island: 'home', col: -1, row: 0, facing: 0 }, 1)).toBe('OUT_OF_BOUNDS')
    expect(placementError(s, { island: 'isle2', col: 0, row: 0, facing: 0 }, 1)).toBe('ISLAND_LOCKED')
    expect(placementError(s, { island: 'home', col: 4, row: 4, facing: 0 }, 2)).toBe('OVERLAP')
    expect(placementError(s, { island: 'home', col: 9, row: 8, facing: 0 }, 2)).toBeNull()
    expect(placementError(s, { island: 'home', col: 5, row: 0, facing: 0 }, 5, { type: 'habitat', id: 'h2' })).toBeNull()
  })
  it('OUTER_ISLANDS matches the spec', () => {
    expect(OUTER_ISLANDS.isle2).toEqual({ cost: 40_000, mult: 2 })
    expect(OUTER_ISLANDS.dawnspire).toEqual({ cost: 3_000_000, mult: 40 })
  })
})
