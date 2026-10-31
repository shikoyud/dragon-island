import { LAUNCH_CATALOG, newPlayer, type Placement, type PlayerState } from '@wyrmhaven/game-core'
import { act, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { FALLBACK_ART } from '../src/art/slots'
import { createBridge, type Placing } from '../src/game/bridge'
import { buildIslandModel } from '../src/game/islandModel'
import { DecorationPanel } from '../src/panels/DecorationPanel'
import { HabitatPanel } from '../src/panels/HabitatPanel'
import { useAutoFinish } from '../src/panels/useAutoFinish'
import { placingAction } from '../src/state/placing'
import { StartPlacingProvider } from '../src/state/startPlacing'
import { harness, TestHost } from './harness'
import { FREE, withPlots } from './land'

const base = newPlayer(0)
const unlocked = ['home', 'isle6'] as PlayerState['islands']['unlocked']
const dp: Placement = { island: 'isle6', col: 8, row: 8, facing: 0 }
const home = FREE
const both: PlayerState = withPlots({ ...base, level: 45, gold: 5_000_000, islands: { ...base.islands, unlocked } }, [5, 6, 9, 10], 'isle6')
const aerie = { id: 'h3', element: 'aerie' as const, level: 5, lastCollectedMs: 0, placement: dp }

const ghost = (s: PlayerState, view: 'home' | 'isle6', p: Placing) => buildIslandModel(s, FALLBACK_ART, LAUNCH_CATALOG, 0, view, p).objects.find(o => o.id === 'ghost')!.tint
const at = (what: Placing['what'], size: Placing['size'], col: number, row: number): Placing => ({ what, size, col, row, facing: 0 })

describe('client placement preview matches the server island rules', () => {
  const cases: { name: string; s: PlayerState; view: 'home' | 'isle6'; p: Placing; legalView: 'home' | 'isle6'; legalP: Placing }[] = [
    { name: "a Warlord's Crown decoration at home", s: both, view: 'home', p: at({ kind: 'decoration', decoration: 'starPool' }, 3, FREE.col, FREE.row), legalView: 'isle6', legalP: at({ kind: 'decoration', decoration: 'starPool' }, 3, 8, 8) },
    { name: 'moving the hatchery off home', s: both, view: 'isle6', p: at({ kind: 'move', target: { type: 'hatchery' } }, 4, 8, 8), legalView: 'home', legalP: at({ kind: 'move', target: { type: 'hatchery' } }, 4, 16, 9) },
    { name: "moving a Warlord's Crown decoration home", s: { ...both, decorations: [{ id: 'c3', kind: 'starPool', placement: dp }] }, view: 'home', p: at({ kind: 'move', target: { type: 'decoration', id: 'c3' } }, 3, FREE.col, FREE.row), legalView: 'isle6', legalP: at({ kind: 'move', target: { type: 'decoration', id: 'c3' } }, 3, 9, 8) },
  ]
  for (const c of cases) {
    it(`refuses ${c.name}: red ghost and no action`, () => {
      expect(ghost(c.s, c.view, c.p)).toBe('bad')
      expect(placingAction(c.s, c.view, c.p)).toBeNull()
      expect(ghost(c.s, c.legalView, c.legalP)).toBe('ok')
      expect(placingAction(c.s, c.legalView, c.legalP)).not.toBeNull()
    })
  }
})

function Finisher({ nowMs }: { nowMs: number }) {
  useAutoFinish(nowMs)
  return null
}

describe('app-level auto-finish', () => {
  const con = (readyAtMs: number, index: number) => ({ kind: 'upgrade' as const, building: { type: 'farm' as const, index }, readyAtMs })

  it('waits until a construction is ready', () => {
    const h = harness({ ...base, constructions: [con(500, 0)] })
    h.wrap(<Finisher nowMs={100} />)
    expect(h.action).not.toHaveBeenCalled()
  })

  it('finishes ready constructions one request at a time, re-reading the index after each', async () => {
    const two = { ...base, constructions: [con(100, 0), con(200, 1)] }
    const h = harness(two)
    let release!: () => void
    h.action.mockImplementationOnce(() => new Promise(res => { release = () => res({ state: { ...two, constructions: [con(200, 1)] }, effects: [] }) }))
    h.action.mockImplementationOnce(async () => ({ state: { ...two, constructions: [] }, effects: [] }))
    const r = h.wrap(<Finisher nowMs={1_000} />)
    await waitFor(() => expect(h.action).toHaveBeenCalledTimes(1))
    r.rerender(<Finisher nowMs={2_000} />)
    r.rerender(<Finisher nowMs={3_000} />)
    expect(h.action).toHaveBeenCalledTimes(1) // still in flight
    await act(async () => { release() })
    await waitFor(() => expect(h.action).toHaveBeenCalledTimes(2))
    expect(h.action.mock.calls.map(c => (c as unknown[])[0])).toEqual([{ type: 'finishConstruction', index: 0 }, { type: 'finishConstruction', index: 0 }])
    r.rerender(<Finisher nowMs={4_000} />)
    expect(h.action).toHaveBeenCalledTimes(2)
  })

  it('does not hammer a construction the server refused, but retries later', async () => {
    const s = { ...base, constructions: [con(100, 0)] }
    const h = harness(s)
    h.action.mockImplementation(async () => { throw new Error('NOT_READY') })
    const r = h.wrap(<Finisher nowMs={1_000} />)
    await waitFor(() => expect(h.action).toHaveBeenCalledTimes(1))
    r.rerender(<Finisher nowMs={2_000} />)
    await act(async () => {})
    expect(h.action.mock.calls.length).toBeLessThanOrEqual(2) // the network retry inside run at most
    const before = h.action.mock.calls.length
    r.rerender(<Finisher nowMs={40_000} />)
    await waitFor(() => expect(h.action.mock.calls.length).toBeGreaterThan(before))
  })
})

describe('panel minors', () => {
  it('decoration Remove asks first and can be kept', async () => {
    const h = harness({ ...base, decorations: [{ id: 'c3', kind: 'hayCart', placement: home }] })
    h.wrap(<DecorationPanel decorationId="c3" />)
    await userEvent.click(screen.getByRole('button', { name: /Remove · \+250 gold/ }))
    expect(h.action).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Keep it' }))
    expect(screen.queryByRole('button', { name: /Confirm remove/ })).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: /Remove · \+250 gold/ }))
    await userEvent.click(screen.getByRole('button', { name: /Confirm remove/ }))
    expect(h.action).toHaveBeenCalledWith({ type: 'removeDecoration', id: 'c3' }, expect.any(String))
  })

  it('titles the Golden Aerie by name', () => {
    harness({ ...both, habitats: [...both.habitats, aerie] }).wrap(<HabitatPanel habitatId="h3" nowMs={0} />)
    expect(screen.getByRole('region', { name: 'Golden Aerie' })).toBeInTheDocument()
  })
})
