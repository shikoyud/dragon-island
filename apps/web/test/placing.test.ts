import { FOOTPRINT, newPlayer } from '@wyrmhaven/game-core'
import { describe, expect, it } from 'vitest'
import { nearestLegalCell, placingAction, placingReducer } from '../src/state/placing'
import { FREE } from './land'

describe('placing', () => {
  it('a new building opens on the legal cell nearest the given one, so Confirm works at once', () => {
    const s = newPlayer(0)
    // (0,0) is fog; the nearest legal 3x3 farm spot to it is the first clear cell past the Mountain (cols 8-12, rows 12-16).
    const c = nearestLegalCell(s, { kind: 'farm' }, 'home', { col: 0, row: 0 })!
    expect(placingAction(s, 'home', { what: { kind: 'farm' }, size: 3, ...c, facing: 0 })).not.toBeNull()
    expect(c).toEqual({ col: 13, row: 12 })
    const mid = nearestLegalCell(s, { kind: 'farm' }, 'home', { col: FREE.col, row: FREE.row })!
    expect(mid).toEqual({ col: FREE.col, row: FREE.row })
    // The start event puts the ghost on that cell.
    expect(placingReducer(null, { type: 'start', what: { kind: 'farm' }, size: 3, island: 'home', cell: mid })).toMatchObject(mid)
    // Nowhere legal: a full grid gives null.
    expect(nearestLegalCell({ ...s, gold: 0 }, { kind: 'habitat', element: 'flame' }, 'isle2', { col: 0, row: 0 })).toBeNull()
  })

  it('placing reducer tracks the cursor, turns and cancels', () => {
    const p = placingReducer(null, { type: 'start', what: { kind: 'farm' }, size: FOOTPRINT.farm, island: 'home' })!
    expect(placingReducer(p, { type: 'cell', col: 6, row: 8 })).toMatchObject({ col: 6, row: 8 })
    expect(placingReducer(placingReducer(p, { type: 'turn' })!, { type: 'turn' })!.facing).toBe(2)
    expect(placingReducer(p, { type: 'cancel' })).toBeNull()
    expect(placingReducer(p, { type: 'confirm' })).toBe(p)
    expect(placingReducer(null, { type: 'cell', col: 1, row: 1 })).toBeNull()
  })

  it('a move start pre-fills the current cell and facing; turn wraps at 4', () => {
    const p = placingReducer(null, {
      type: 'start', what: { kind: 'move', target: { type: 'farm', index: 0 } }, size: FOOTPRINT.farm, island: 'home', from: { island: 'home', col: 3, row: 4, facing: 3 },
    })!
    expect(p).toMatchObject({ col: 3, row: 4, facing: 3 })
    expect(placingReducer(p, { type: 'turn' })!.facing).toBe(0)
  })

  it('placingAction builds the right action and refuses illegal spots', () => {
    const s = newPlayer(0)
    expect(placingAction(s, 'home', { what: { kind: 'farm' }, size: 3, col: FREE.col, row: FREE.row, facing: 1 })).toEqual({ type: 'placeBuilding', building: { kind: 'farm' }, placement: { ...FREE, facing: 1 } })
    expect(placingAction(s, 'home', { what: { kind: 'farm' }, size: FOOTPRINT.farm, col: 0, row: 0, facing: 0 })).toBeNull()
    expect(placingAction(s, 'home', { what: { kind: 'move', target: { type: 'habitat', id: 'h1' } }, size: 4, col: 13, row: 8, facing: 0 })).toEqual({ type: 'moveBuilding', target: { type: 'habitat', id: 'h1' }, placement: { island: 'home', col: 13, row: 8, facing: 0 } })
    expect(placingAction(s, 'isle2', { what: { kind: 'farm' }, size: FOOTPRINT.farm, col: 1, row: 1, facing: 0 })).toBeNull()
  })

  it('sends the Grove as a placeBuilding', () => {
    const s = newPlayer(0)
    expect(placingAction(s, 'home', { what: { kind: 'grove' }, size: 5, col: FREE.col, row: FREE.row, facing: 0 })).toEqual({ type: 'placeBuilding', building: { kind: 'grove' }, placement: FREE })
    expect(placingAction(s, 'home', { what: { kind: 'grove' }, size: 5, col: 20, row: 12, facing: 0 })).toBeNull()
  })

  it('placing the Golden Aerie buys it with the placement, on a free habitat-sized spot', () => {
    const s = newPlayer(0)
    const spot = nearestLegalCell(s, { kind: 'goldenAerie' }, 'home', { col: 4, row: 4 })!
    expect(spot).not.toBeNull()
    expect(placingAction(s, 'home', { what: { kind: 'goldenAerie' }, size: 4, ...spot, facing: 2 })).toEqual({
      type: 'buy', item: { kind: 'goldenAerie', placement: { island: 'home', ...spot, facing: 2 } },
    })
    expect(placingAction(s, 'home', { what: { kind: 'goldenAerie' }, size: 4, col: 0, row: 0, facing: 0 })).toBeNull()
  })
})
