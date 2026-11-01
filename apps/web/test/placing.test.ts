import { act, renderHook } from '@testing-library/react'
import { FOOTPRINT, newPlayer, type PlayerState } from '@wyrmhaven/game-core'
import { describe, expect, it } from 'vitest'
import { createBridge } from '../src/game/bridge'
import { nearestLegalCell, placementIslands, placementStart, placingAction, placingReducer } from '../src/state/placing'
import { usePlacing } from '../src/state/usePlacing'
import { FREE, withIsland, withPlots } from './land'

describe('placing', () => {
  it('a new building opens on the legal cell nearest the given one, so OK works at once', () => {
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

  it('placing reducer takes a cell, turns and cancels', () => {
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

describe('moving between plots and islands (R57)', () => {
  const two = withIsland(newPlayer(0), 'isle2')
  const h1 = { kind: 'move', target: { type: 'habitat', id: 'h1' } } as const
  const start = (s: PlayerState, what: typeof h1 | { kind: 'move'; target: { type: 'hatchery' } } = h1) =>
    placingReducer(null, { type: 'start', what, size: 4, island: 'home', from: { island: 'home', col: 13, row: 8, facing: 0 } })!

  it('a move ghost starts on the current spot, and across a plot border it is still a free moveBuilding', () => {
    const p = start(two)
    expect(p).toMatchObject({ col: 13, row: 8 })
    const across = placingReducer(p, { type: 'cell', col: 14, row: 13 })!
    expect(placingAction(two, 'home', across)).toEqual({ type: 'moveBuilding', target: h1.target, placement: { island: 'home', col: 14, row: 13, facing: 0 } })
    expect(placingAction(two, 'home', { ...p, col: 0, row: 0 })).toBeNull()
  })

  it('offers an Island button per unlocked island a mover may stand on, with the viewed one marked', () => {
    expect(placementIslands(two, h1, 'home').map(c => [c.island, c.name, c.current, c.room])).toEqual([
      ['home', 'Home Isle', true, true], ['isle2', 'Ember Reach', false, true],
    ])
    // One unlocked island: nothing to switch to. The Hatchery stays on Home, so it has no choice either.
    expect(placementIslands(newPlayer(0), h1, 'home')).toEqual([])
    expect(placementIslands(two, { kind: 'move', target: { type: 'hatchery' } }, 'home')).toEqual([])
    // A new building has the Shop's own island choice, not these buttons.
    expect(placementIslands(two, { kind: 'farm' }, 'home')).toEqual([])
  })

  it("a Warlord's Crown decoration may not leave isle6, so it offers no switch", () => {
    const s = { ...withIsland(two, 'isle6'), decorations: [{ id: 'c1', kind: 'starPool' as const, placement: { island: 'isle6' as const, col: 8, row: 8, facing: 0 as const } }] }
    expect(placementIslands(s, { kind: 'move', target: { type: 'decoration', id: 'c1' } }, 'isle6')).toEqual([])
  })

  it('an island with no legal cell for the mover is listed without room', () => {
    const noLand = withPlots(two, [], 'isle2')
    expect(placementIslands(noLand, h1, 'home').find(c => c.island === 'isle2')).toMatchObject({ room: false })
  })

  it('a new building opens on an outer island with room after a Bridge, and OK sends that island (pin)', () => {
    const s = withPlots(withIsland(newPlayer(0), 'isle2'), [5], 'home')
    const { island, cell } = placementStart(s, { kind: 'habitat', element: 'terra' }, 4, 'home', null)
    expect(island).toBe('isle2')
    expect(cell).toBeDefined()
    const p = placingReducer(null, { type: 'start', what: { kind: 'habitat', element: 'terra' }, size: 4, island, cell })!
    expect(placingAction(s, 'isle2', p)).toMatchObject({ type: 'placeBuilding', placement: { island: 'isle2', ...cell } })
  })

  it('switching to Ember Reach changes the view, opens on the nearest legal cell, and OK sends that island', () => {
    const bridge = createBridge()
    const { result } = renderHook(() => usePlacing(bridge))
    act(() => result.current.dispatch({ type: 'start', what: h1, size: 4, island: 'home', from: { island: 'home', col: 13, row: 8, facing: 2 } }))
    act(() => result.current.moveToIsland(two, 'isle2'))
    expect(result.current.view).toBe('isle2')
    expect(bridge.view).toBe('isle2')
    // The nearest legal cell to where the ghost was; the facing carries over. Ember Reach is empty, so it is the same spot.
    expect(result.current.placing).toMatchObject({ col: 13, row: 8, facing: 2 })
    expect(placingAction(two, result.current.view, result.current.placing!)).toEqual({
      type: 'moveBuilding', target: h1.target, placement: { island: 'isle2', col: 13, row: 8, facing: 2 },
    })
  })

  it('a switch has the ghost on its new cell by the time the view changes, so the scene reveals the right spot', () => {
    const bridge = createBridge()
    const { result } = renderHook(() => usePlacing(bridge))
    act(() => result.current.dispatch({ type: 'start', what: h1, size: 4, island: 'home', from: { island: 'home', col: 13, row: 8, facing: 0 } }))
    act(() => result.current.dispatch({ type: 'cell', col: 0, row: 0 }))
    let atView: unknown = null
    const off = bridge.on('view', () => { atView = bridge.placing })
    act(() => result.current.moveToIsland(two, 'isle2'))
    off()
    expect(atView).toMatchObject(nearestLegalCell(two, h1, 'isle2', { col: 0, row: 0 })!)
  })

  it('a switch snaps a ghost sitting in the fog to the nearest legal cell', () => {
    const bridge = createBridge()
    const { result } = renderHook(() => usePlacing(bridge))
    act(() => result.current.dispatch({ type: 'start', what: h1, size: 4, island: 'home', from: { island: 'home', col: 13, row: 8, facing: 0 } }))
    act(() => result.current.dispatch({ type: 'cell', col: 0, row: 0 }))
    act(() => result.current.moveToIsland(two, 'isle2'))
    const p = result.current.placing!
    expect(placingAction(two, 'isle2', p)).not.toBeNull()
    expect(p).toMatchObject(nearestLegalCell(two, h1, 'isle2', { col: 0, row: 0 })!)
  })

  it('Cancel goes back to Home after the view was changed elsewhere (bridge.setView), and a second start keeps that origin', () => {
    const bridge = createBridge()
    const { result } = renderHook(() => usePlacing(bridge))
    const start = { type: 'start' as const, what: h1, size: 4 as const, island: 'home' as const, from: { island: 'home' as const, col: 13, row: 8, facing: 0 as const } }
    act(() => result.current.dispatch(start))
    act(() => bridge.setView('isle2'))
    act(() => result.current.dispatch({ type: 'cancel' }))
    expect(result.current.view).toBe('home')
    // A second start while placing must not take the view it finds (isle2) as the way back.
    act(() => result.current.dispatch(start))
    act(() => bridge.setView('isle2'))
    act(() => result.current.dispatch(start))
    act(() => result.current.dispatch({ type: 'cancel' }))
    expect(result.current.view).toBe('home')
    // And after a finished placement the origin is forgotten: a later cancel does not jump the view.
    act(() => result.current.dispatch(start))
    act(() => result.current.dispatch({ type: 'done' }))
    act(() => bridge.setView('isle3'))
    act(() => result.current.dispatch({ type: 'cancel' }))
    expect(result.current.view).toBe('isle3')
  })

  it('Cancel puts the view back where the move started; a finished move stays on its new island', () => {
    const bridge = createBridge()
    const { result } = renderHook(() => usePlacing(bridge))
    act(() => result.current.dispatch({ type: 'start', what: h1, size: 4, island: 'home', from: { island: 'home', col: 13, row: 8, facing: 0 } }))
    act(() => result.current.moveToIsland(two, 'isle2'))
    act(() => result.current.dispatch({ type: 'cancel' }))
    expect(result.current.placing).toBeNull()
    expect(result.current.view).toBe('home')
    expect(bridge.view).toBe('home')
    act(() => result.current.dispatch({ type: 'start', what: h1, size: 4, island: 'home', from: { island: 'home', col: 13, row: 8, facing: 0 } }))
    act(() => result.current.moveToIsland(two, 'isle2'))
    act(() => result.current.dispatch({ type: 'done' }))
    expect(result.current.placing).toBeNull()
    expect(result.current.view).toBe('isle2')
  })
})
