import { newPlayer } from '@wyrmhaven/game-core'
import { describe, expect, it } from 'vitest'
import { nearestLegalCell, placingAction, placingReducer } from '../src/state/placing'

describe('placing', () => {
  it('a new building opens on the free cell nearest the given one, so Confirm works at once', () => {
    const s = newPlayer(0)
    // (0,0) is under habitat h1; the nearest free 2x2 spot to it is just below the habitats.
    const c = nearestLegalCell(s, { kind: 'farm' }, 'home', { col: 0, row: 0 })!
    expect(placingAction(s, 'home', { what: { kind: 'farm' }, size: 2, ...c, facing: 0 })).not.toBeNull()
    expect(Math.hypot(c.col, c.row)).toBeLessThan(8)
    const mid = nearestLegalCell(s, { kind: 'farm' }, 'home', { col: 6, row: 7 })!
    expect(mid).toEqual({ col: 6, row: 7 })
    // The start event puts the ghost on that cell.
    expect(placingReducer(null, { type: 'start', what: { kind: 'farm' }, size: 2, island: 'home', cell: mid })).toMatchObject(mid)
    // Nowhere legal: a full grid gives null.
    expect(nearestLegalCell({ ...s, gold: 0 }, { kind: 'habitat', element: 'fire' }, 'isle2', { col: 0, row: 0 })).toBeNull()
  })

  it('placing reducer tracks the cursor, turns and cancels', () => {
    const p = placingReducer(null, { type: 'start', what: { kind: 'farm' }, size: 2, island: 'home' })!
    expect(placingReducer(p, { type: 'cell', col: 6, row: 8 })).toMatchObject({ col: 6, row: 8 })
    expect(placingReducer(placingReducer(p, { type: 'turn' })!, { type: 'turn' })!.facing).toBe(2)
    expect(placingReducer(p, { type: 'cancel' })).toBeNull()
    expect(placingReducer(p, { type: 'confirm' })).toBe(p)
    expect(placingReducer(null, { type: 'cell', col: 1, row: 1 })).toBeNull()
  })

  it('a move start pre-fills the current cell and facing; turn wraps at 4', () => {
    const p = placingReducer(null, {
      type: 'start', what: { kind: 'move', target: { type: 'farm', index: 0 } }, size: 2, island: 'home', from: { island: 'home', col: 3, row: 4, facing: 3 },
    })!
    expect(p).toMatchObject({ col: 3, row: 4, facing: 3 })
    expect(placingReducer(p, { type: 'turn' })!.facing).toBe(0)
  })

  it('placingAction builds the right action and refuses illegal spots', () => {
    const s = newPlayer(0)
    expect(placingAction(s, 'home', { what: { kind: 'farm' }, size: 2, col: 6, row: 8, facing: 1 })).toEqual({ type: 'placeBuilding', building: { kind: 'farm' }, placement: { island: 'home', col: 6, row: 8, facing: 1 } })
    expect(placingAction(s, 'home', { what: { kind: 'farm' }, size: 2, col: 0, row: 0, facing: 0 })).toBeNull()
    expect(placingAction(s, 'home', { what: { kind: 'move', target: { type: 'habitat', id: 'h1' } }, size: 5, col: 0, row: 1, facing: 0 })).toEqual({ type: 'moveBuilding', target: { type: 'habitat', id: 'h1' }, placement: { island: 'home', col: 0, row: 1, facing: 0 } })
    expect(placingAction(s, 'home', { what: { kind: 'nest' }, size: 2, col: 6, row: 8, facing: 0 })).toEqual({ type: 'buy', item: { kind: 'nest', placement: { island: 'home', col: 6, row: 8, facing: 0 } } })
    expect(placingAction(s, 'home', { what: { kind: 'hoard' }, size: 4, col: 6, row: 8, facing: 0 })).toEqual({ type: 'buy', item: { kind: 'hoard', placement: { island: 'home', col: 6, row: 8, facing: 0 } } })
    expect(placingAction(s, 'isle2', { what: { kind: 'farm' }, size: 2, col: 1, row: 1, facing: 0 })).toBeNull()
  })
})
