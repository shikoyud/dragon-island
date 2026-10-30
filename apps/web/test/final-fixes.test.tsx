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

const base = newPlayer(0)
const unlocked = ['home', 'dawnspire'] as PlayerState['islands']['unlocked']
const dp: Placement = { island: 'dawnspire', col: 0, row: 0, facing: 0 }
const home = { island: 'home' as const, col: 6, row: 7, facing: 0 as const }
const both: PlayerState = { ...base, level: 45, gold: 5_000_000, islands: { ...base.islands, unlocked } }
const nexus = { id: 'h3', element: 'any' as const, level: 5, lastCollectedMs: 0, placement: dp }

const ghost = (s: PlayerState, view: 'home' | 'dawnspire', p: Placing) => buildIslandModel(s, FALLBACK_ART, LAUNCH_CATALOG, 0, view, p).objects.find(o => o.id === 'ghost')!.tint
const at = (what: Placing['what'], size: Placing['size'], col: number, row: number): Placing => ({ what, size, col, row, facing: 0 })

describe('client placement preview matches the server island rules', () => {
  const cases: { name: string; s: PlayerState; view: 'home' | 'dawnspire'; p: Placing; legalView: 'home' | 'dawnspire'; legalP: Placing }[] = [
    { name: 'the Nexus off the Dawnspire', s: both, view: 'home', p: at({ kind: 'nexus' }, 5, 6, 7), legalView: 'dawnspire', legalP: at({ kind: 'nexus' }, 5, 0, 0) },
    { name: 'a Dawnspire decoration at home', s: both, view: 'home', p: at({ kind: 'decoration', decoration: 'starPool' }, 3, 6, 7), legalView: 'dawnspire', legalP: at({ kind: 'decoration', decoration: 'starPool' }, 3, 0, 0) },
    { name: 'moving the hatchery off home', s: both, view: 'dawnspire', p: at({ kind: 'move', target: { type: 'hatchery' } }, 4, 0, 0), legalView: 'home', legalP: at({ kind: 'move', target: { type: 'hatchery' } }, 4, 6, 7) },
    { name: 'moving the Nexus home', s: { ...both, habitats: [...both.habitats, nexus] }, view: 'home', p: at({ kind: 'move', target: { type: 'habitat', id: 'h3' } }, 5, 6, 7), legalView: 'dawnspire', legalP: at({ kind: 'move', target: { type: 'habitat', id: 'h3' } }, 5, 1, 0) },
    { name: 'moving a Dawnspire decoration home', s: { ...both, decorations: [{ id: 'c3', kind: 'starPool', placement: dp }] }, view: 'home', p: at({ kind: 'move', target: { type: 'decoration', id: 'c3' } }, 3, 6, 7), legalView: 'dawnspire', legalP: at({ kind: 'move', target: { type: 'decoration', id: 'c3' } }, 3, 1, 0) },
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

  it('titles the Nexus habitat by name', () => {
    harness({ ...both, habitats: [...both.habitats, nexus] }).wrap(<HabitatPanel habitatId="h3" nowMs={0} />)
    expect(screen.getByRole('region', { name: 'Nexus habitat' })).toBeInTheDocument()
  })
})
