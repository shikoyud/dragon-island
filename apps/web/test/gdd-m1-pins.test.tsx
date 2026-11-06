import { applyAction, createRng, foodPerFeed, LAUNCH_CATALOG, newPlayer, type Habitat, type PlayerState } from '@wyrmhaven/game-core'
import { act, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TerminalClock } from '../src/hud/TerminalClock'
import { DragonPanel, habitatName } from '../src/panels/DragonPanel'
import { HabitatPanel } from '../src/panels/HabitatPanel'
import { useGameClock } from '../src/state/clock'
import { useMe } from '../src/state/me'
import { harness } from './harness'

describe('the client clock follows the server (A12)', () => {
  const DAY = 86_400_000
  const HOUR = 3_600_000
  afterEach(() => { vi.useRealTimers() })

  function Probe() {
    const game = useMe().data?.game
    const nowMs = useGameClock(game?.serverNowMs)
    return game ? <TerminalClock game={game} nowMs={nowMs} /> : null
  }

  it('a +10 days server shows its own countdown and keeps ticking', () => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] })
    vi.setSystemTime(5_000) // the player's device still thinks it is launch day
    const h = harness(newPlayer(0), 0, 'flash14', { launchAtMs: 0, serverNowMs: 10 * DAY + HOUR })
    h.wrap(<Probe />)
    expect(screen.getByRole('timer')).toHaveTextContent('Finals lock in 3d 23:00:00')
    act(() => { vi.advanceTimersByTime(1_000) })
    expect(screen.getByRole('timer')).toHaveTextContent('Finals lock in 3d 22:59:59')
  })

  it('an action response carrying the old server time does not rewind the clock', () => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] })
    vi.setSystemTime(5_000)
    const h = harness(newPlayer(0), 0, 'flash14', { launchAtMs: 0, serverNowMs: 10 * DAY + HOUR })
    h.wrap(<Probe />)
    act(() => { vi.advanceTimersByTime(60_000) })
    h.setState(newPlayer(0)) // same `game`, new state: what applyStateFromResponse leaves
    expect(screen.getByRole('timer')).toHaveTextContent('Finals lock in 3d 22:59:00')
  })

  it('runs on the device clock until /me has a server time', () => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] })
    vi.setSystemTime(DAY)
    const seen: number[] = []
    function Now() { seen.push(useGameClock(undefined)); return null }
    harness(newPlayer(0)).wrap(<Now />)
    expect(seen.at(-1)).toBe(DAY)
  })
})

describe('the client prediction follows the Gold accrual', () => {
  it('after a server collect at 1:59 the panel shows nothing at 1:59 and 3 Gold a second later', () => {
    const r = applyAction(newPlayer(0), { type: 'collectGold', habitatId: 'h1' }, 119_000, createRng(1), LAUNCH_CATALOG)
    if (!r.ok) throw new Error(r.error)
    const state: PlayerState = r.state
    const early = harness(state).wrap(<HabitatPanel habitatId="h1" nowMs={119_000} />)
    expect(screen.getByText(/^0 \/ /)).toBeInTheDocument()
    early.unmount()
    harness(state).wrap(<HabitatPanel habitatId="h1" nowMs={120_000} />)
    expect(screen.getByText(/^3 \/ /)).toBeInTheDocument()
  })
})

describe('small panel cleanups', () => {
  it('HabitatPanel names the element with a ribbon', () => {
    harness(newPlayer(0)).wrap(<HabitatPanel habitatId="h1" nowMs={0} />)
    expect(screen.getByRole('img', { name: 'Terra' })).toBeInTheDocument()
  })

  it('a habitat reads as a name in the move picker, numbered only when there are several', () => {
    const [terra, flame] = newPlayer(0).habitats as [Habitat, Habitat]
    const second = { ...terra, id: 'h9' }
    expect(habitatName([terra, flame], terra)).toBe('Terra habitat')
    expect(habitatName([terra, flame, second], second)).toBe('Terra habitat 2')
    expect(habitatName([{ ...terra, element: 'aerie' }], { ...terra, element: 'aerie' })).toMatch(/Golden Aerie/)
  })
})

describe('Flash-28 in the panels (Review Focus 4)', () => {
  it('HabitatPanel reads income and cap from the preset', () => {
    // Terra Common Lv 1: 18 Gold/min and an 8,000 cap, times goldMult (6): 108/min and 48,000; ten minutes is 1,080.
    harness(newPlayer(0), 0, 'flash28').wrap(<HabitatPanel habitatId="h1" nowMs={600_000} />)
    expect(screen.getByText('108 gold/min')).toBeInTheDocument()
    expect(screen.getByText('1,080 / 48,000')).toBeInTheDocument()
  })
})

describe('exact Food on the Feed button (Review Focus 2)', () => {
  const withFood = (food: number): PlayerState => ({ ...newPlayer(0), food })
  const cost = foodPerFeed(1)

  it('food === cost leaves Feed enabled', () => {
    harness(withFood(cost)).wrap(<DragonPanel dragonId="d1" />)
    expect(screen.getByRole('button', { name: /^feed/i })).toBeEnabled()
    expect(screen.queryByText('Not enough food')).not.toBeInTheDocument()
  })

  it('cost - 1 disables it and says why', () => {
    harness(withFood(cost - 1)).wrap(<DragonPanel dragonId="d1" />)
    expect(screen.getByRole('button', { name: /^feed/i })).toBeDisabled()
    expect(screen.getByText('Not enough food')).toBeInTheDocument()
  })
})
