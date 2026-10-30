import { applyAction, createRng, foodPerFeed, LAUNCH_CATALOG, newPlayer, type PlayerState } from '@wyrmhaven/game-core'
import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { DragonPanel } from '../src/panels/DragonPanel'
import { HabitatPanel } from '../src/panels/HabitatPanel'
import { harness } from './harness'

describe('the client prediction follows the Gold carry-over', () => {
  it('a server collect at 1:59 leaves the panel showing a minute of Gold at 2:00, none at 1:59', () => {
    const r = applyAction(newPlayer(0), { type: 'collectGold', habitatId: 'h1' }, 119_000, createRng(1), LAUNCH_CATALOG)
    if (!r.ok) throw new Error(r.error)
    const state: PlayerState = r.state
    const early = harness(state).wrap(<HabitatPanel habitatId="h1" nowMs={119_000} />)
    expect(screen.getByText(/^0 \/ /)).toBeInTheDocument()
    early.unmount()
    harness(state).wrap(<HabitatPanel habitatId="h1" nowMs={120_000} />)
    expect(screen.getByText(/^180 \/ /)).toBeInTheDocument()
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
