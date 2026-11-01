// M3 Task 3, Review Focus 4: the reason reads `Level n` one level below the unlock table's gate, and is gone at the gate.
import { newPlayer, unlockPl, type PlayerState } from '@wyrmhaven/game-core'
import { cleanup, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { FarmPanel } from '../src/panels/FarmPanel'
import { TrialsPanel } from '../src/panels/TrialsPanel'
import { ShopPanel } from '../src/panels/ShopPanel'
import { harness } from './harness'

const base = newPlayer(0)
const rich = (level: number, over: Partial<PlayerState> = {}): PlayerState => ({ ...base, level, gold: 1_000_000_000, ...over })
const seaHab = { id: 'h3', element: 'sea' as const, level: 1, lastCollectedMs: 0, placement: { island: 'home' as const, col: 9, row: 0, facing: 0 as const } }
const shop = (s: PlayerState) => harness(s).wrap(<ShopPanel onPlace={vi.fn()} view="home" nowMs={0} />)
const button = (name: RegExp) => screen.getByRole('button', { name })

describe('Shop and panel reasons follow the unlock table', () => {
  it('habitat:war', () => {
    const pl = unlockPl('habitat:war')
    const low = shop(rich(pl - 1))
    expect(button(/war habitat/i)).toHaveAccessibleDescription(`Level ${pl}`)
    low.unmount()
    shop(rich(pl))
    expect(button(/war habitat/i)).toBeEnabled()
  })

  it('basic:sea', () => {
    const pl = unlockPl('basic:sea')
    const sea = () => within(screen.getByTestId('shop-dragons')).getByRole('button', { name: /Sea Basic/ })
    const low = shop(rich(pl - 1, { habitats: [...base.habitats, seaHab] }))
    expect(sea()).toHaveAccessibleDescription(`Level ${pl}`)
    low.unmount()
    shop(rich(pl, { habitats: [...base.habitats, seaHab] }))
    expect(sea()).toBeEnabled()
  })

  it('grove:1', () => {
    const pl = unlockPl('grove:1')
    const low = shop(rich(pl - 1))
    expect(button(/grove/i)).toHaveAccessibleDescription(`Level ${pl}`)
    low.unmount()
    shop(rich(pl))
    expect(button(/grove/i)).toBeEnabled()
  })

  it('farm:2', () => {
    const pl = unlockPl('farm:2')
    const low = shop(rich(pl - 1))
    expect(button(/farm plot/i)).toHaveAccessibleDescription(`Level ${pl}`)
    low.unmount()
    shop(rich(pl))
    expect(button(/farm plot/i)).toBeEnabled()
  })

  it('crop:seaMelon in the Farm panel', () => {
    const pl = unlockPl('crop:seaMelon')
    const low = harness(rich(pl - 1))
    low.wrap(<FarmPanel index={0} nowMs={0} />)
    expect(button(/Sea Melon/)).toHaveAccessibleDescription(`Level ${pl}`)
    cleanup()
    harness(rich(pl)).wrap(<FarmPanel index={0} nowMs={0} />)
    expect(button(/Sea Melon/)).toBeEnabled()
  })

  it('pve in the Trials panel', () => {
    const pl = unlockPl('pve')
    expect(pl).toBe(4)
    const low = harness(rich(pl - 1, { dragons: [...base.dragons, { id: 'd3', speciesId: 'terra', level: 1, feeds: 0, habitatId: 'h1' }] }))
    render(<TrialsPanel nowMs={0} onFight={() => {}} onResume={() => {}} />, { wrapper: low.wrapper })
    expect(screen.getByText(`The Trials unlock at player level ${pl}.`)).toBeInTheDocument()
    cleanup()
    const ok = harness(rich(pl, { dragons: [...base.dragons, { id: 'd3', speciesId: 'terra', level: 1, feeds: 0, habitatId: 'h1' }] }))
    render(<TrialsPanel nowMs={0} onFight={() => {}} onResume={() => {}} />, { wrapper: ok.wrapper })
    expect(screen.queryByText(/The Trials unlock at player level/)).toBeNull()
  })
})

