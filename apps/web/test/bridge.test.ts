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
})
