import { newPlayer } from '@wyrmhaven/game-core'
import { describe, expect, it, vi } from 'vitest'
import { createBridge } from '../src/game/bridge'

describe('bridge', () => {
  it('delivers events to subscribers and honours off', () => {
    const bridge = createBridge()
    const seen: unknown[] = []
    const off = bridge.on('select', e => seen.push(e))
    bridge.emit({ type: 'select', target: { kind: 'habitat', id: 'h1' } })
    off()
    bridge.emit({ type: 'select', target: { kind: 'empty' } })
    expect(seen).toEqual([{ type: 'select', target: { kind: 'habitat', id: 'h1' } }])
  })

  it('stores state, art, clock and reduced motion and notifies on state changes', () => {
    const bridge = createBridge()
    const onState = vi.fn()
    bridge.on('state', onState)
    const s = newPlayer(0)
    bridge.setState(s)
    expect(bridge.state).toBe(s)
    expect(onState).toHaveBeenCalledWith({ type: 'state', state: s })
    bridge.setClock(1234)
    expect(bridge.nowMs).toBe(1234)
    bridge.setReducedMotion(true)
    expect(bridge.reducedMotion).toBe(true)
  })

  it('keeps the latest selection', () => {
    const bridge = createBridge()
    bridge.emit({ type: 'select', target: { kind: 'dragon', id: 'd2' } })
    expect(bridge.selected).toEqual({ kind: 'dragon', id: 'd2' })
    bridge.emit({ type: 'select', target: { kind: 'empty' } })
    expect(bridge.selected).toEqual({ kind: 'empty' })
  })

  it('stores the view and placing ghost and emits cell, view and placing events', () => {
    const bridge = createBridge()
    const seen: unknown[] = []
    bridge.on('view', e => seen.push(e))
    bridge.on('placing', e => seen.push(e))
    bridge.on('cell', e => seen.push(e))
    bridge.setView('isle2')
    const p = { what: { kind: 'farm' as const }, size: 2 as const, col: 1, row: 2, facing: 0 as const }
    bridge.setPlacing(p)
    bridge.emit({ type: 'cell', col: 3, row: 4 })
    bridge.setPlacing(null)
    expect(bridge.view).toBe('isle2')
    expect(bridge.placing).toBeNull()
    expect(seen).toEqual([
      { type: 'view', view: 'isle2' }, { type: 'placing', placing: p }, { type: 'cell', col: 3, row: 4 }, { type: 'placing', placing: null },
    ])
  })

  it('starts without a zoom, and setZoom goes to the scene hook when there is one', () => {
    const bridge = createBridge()
    expect(bridge.zoom).toBeNull()
    expect(() => bridge.setZoom(2)).not.toThrow()
    const hook = vi.fn()
    bridge.zoomTo = hook
    bridge.setZoom(3)
    expect(hook).toHaveBeenCalledWith(3)
  })
})
