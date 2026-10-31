import { newPlayer, type PlayerState } from '@wyrmhaven/game-core'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { ConstructionStatus } from '../src/panels/ConstructionStatus'
import { SpeedUpsRow } from '../src/panels/SpeedUpsRow'
import { useAutoFinish } from '../src/panels/useAutoFinish'
import { dropMessages } from '../src/state/drops'
import { harness } from './harness'

const base = newPlayer(0)
const own = (a: number, b: number, c: number) => ({ '15m': a, '1h': b, '3h': c })
const clear = (readyAtMs: number) => ({ kind: 'clear' as const, obstacleId: 'o1', readyAtMs })
const upgrade = (readyAtMs: number) => ({ kind: 'upgrade' as const, building: { type: 'habitat' as const, id: 'h1' }, readyAtMs })

function Finisher({ nowMs }: { nowMs: number }) {
  useAutoFinish(nowMs)
  return null
}

const after = (before: PlayerState, patch: Partial<PlayerState>): PlayerState => ({ ...before, constructions: [], ...patch })

describe('dropMessages', () => {
  it('is empty unless a clear completed, and names Gold, Food and each token', () => {
    const before: PlayerState = { ...base, gold: 10, food: 5, constructions: [clear(0)] }
    expect(dropMessages(before, after(before, { gold: 210 }))).toEqual(['Found 200 Gold'])
    expect(dropMessages(before, after(before, { food: 20 }))).toEqual(['Found 15 Food'])
    expect(dropMessages(before, after(before, { speedUps: own(0, 0, 1) }))).toEqual(['Found a 3 h speed-up'])
    expect(dropMessages(before, after(before, {}))).toEqual([])
    // Gold gained with a clear still running, or by an action that is no clear, is no drop.
    expect(dropMessages(before, { ...before, gold: 500 })).toEqual([])
    const up: PlayerState = { ...base, constructions: [upgrade(0)] }
    expect(dropMessages(up, after(up, { gold: 500 }))).toEqual([])
  })
})

describe('the drop toast comes from the action, on every completion path', () => {
  const before: PlayerState = { ...base, speedUps: own(0, 0, 0), constructions: [clear(0)] }

  it('auto-finish: Gold', async () => {
    const h = harness(before)
    h.action.mockImplementation(async () => ({ state: after(before, { gold: before.gold + 200 }), effects: [] }))
    h.wrap(<Finisher nowMs={5} />)
    expect(await screen.findByText('Found 200 Gold')).toBeInTheDocument()
  })

  it('auto-finish: a token, once', async () => {
    const h = harness(before)
    h.action.mockImplementation(async () => ({ state: after(before, { speedUps: own(0, 0, 1) }), effects: [] }))
    h.wrap(<Finisher nowMs={5} />)
    expect(await screen.findByText('Found a 3 h speed-up')).toBeInTheDocument()
    expect(h.action).toHaveBeenCalledTimes(1)
    expect(screen.getAllByText(/Found/)).toHaveLength(1)
  })

  it('manual Finish: Food', async () => {
    const h = harness(before)
    h.action.mockImplementation(async () => ({ state: after(before, { food: before.food + 15 }), effects: [] }))
    h.wrap(<ConstructionStatus index={0} readyAtMs={0} nowMs={5} id="c0" label="Clearing" />)
    await userEvent.click(screen.getByRole('button', { name: 'Finish' }))
    expect(await screen.findByText('Found 15 Food')).toBeInTheDocument()
  })

  it('a $DRIS skip of a running clear', async () => {
    const running: PlayerState = { ...before, constructions: [clear(3_600_000)] }
    const h = harness(running)
    h.action.mockImplementation(async () => ({ state: after(running, { gold: running.gold + 300 }), effects: [{ type: 'charge' }] as never }))
    h.wrap(<ConstructionStatus index={0} readyAtMs={3_600_000} nowMs={0} id="c0" label="Clearing" />)
    await userEvent.click(screen.getByRole('button', { name: /Skip/ }))
    expect(await screen.findByText('Found 300 Gold')).toBeInTheDocument()
  })

  it('a finished upgrade that gains Gold is no drop', async () => {
    const up: PlayerState = { ...base, constructions: [upgrade(0)] }
    const h = harness(up)
    h.action.mockImplementation(async () => ({ state: after(up, { gold: up.gold + 500 }), effects: [] }))
    h.wrap(<ConstructionStatus index={0} readyAtMs={0} nowMs={5} id="c0" label="Upgrading" />)
    await userEvent.click(screen.getByRole('button', { name: 'Finish' }))
    await waitFor(() => expect(h.action).toHaveBeenCalled())
    await new Promise(r => setTimeout(r, 50))
    expect(screen.queryByText(/Found/)).toBeNull()
  })
})

describe('SpeedUpsRow', () => {
  it('shows the token inventory with no timer running, zeros included', () => {
    harness({ ...base, speedUps: own(3, 0, 2) }).wrap(<SpeedUpsRow />)
    expect(screen.getByText('Speed-ups')).toBeInTheDocument()
    expect(screen.getByText('15 min × 3 · 1 h × 0 · 3 h × 2')).toBeInTheDocument()
  })
})
