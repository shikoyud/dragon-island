import { applyAction, createRng, LAUNCH_CATALOG, newPlayer, type PlayerState } from '@wyrmhaven/game-core'
import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
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
