import { newPlayer, type PlayerState } from '@wyrmhaven/game-core'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { harness } from './harness'
import { BreedPanel } from '../src/panels/BreedPanel'
import { DragonPanel } from '../src/panels/DragonPanel'
import { FarmPanel } from '../src/panels/FarmPanel'
import { HabitatPanel } from '../src/panels/HabitatPanel'
import { NestsPanel } from '../src/panels/NestsPanel'
import { ResourcesBar } from '../src/panels/ResourcesBar'
import { StorePanel } from '../src/panels/StorePanel'
import { StartPlacingProvider } from '../src/state/startPlacing'
import { formatGold, formatMicroUsd, formatWei } from '../src/ui/Money'

const base = newPlayer(0)
const level = (s: PlayerState, id: string, lvl: number): PlayerState =>
  ({ ...s, dragons: s.dragons.map(d => (d.id === id ? { ...d, level: lvl } : d)) })

describe('Money formatting', () => {
  it('formats without floats', () => {
    expect(formatGold(1234567)).toBe('1,234,567')
    expect(formatMicroUsd(500_000)).toBe('$0.50')
    expect(formatMicroUsd(2_000_000)).toBe('$2.00')
    expect(formatMicroUsd(1)).toBe('$0.000001')
    expect(formatWei(10n ** 18n * 5n)).toBe('5')
    expect(formatWei(1_234_500_000_000_000_000n)).toBe('1.2345')
    expect(formatWei(123456789012345678901234567890n)).toBe('123,456,789,012.3456')
  })
})

describe('ResourcesBar', () => {
  it('shows gold, food, level/xp, trophies and tokens', () => {
    const { wrap } = harness({ ...base, gold: 1500, trophies: 42, xp: 10, level: 2 })
    wrap(<ResourcesBar />)
    expect(screen.getByText('1,500')).toBeInTheDocument()
    expect(screen.queryByText(/eligible/)).toBeNull()
    expect(screen.getByText(/10 \/ 200 xp/i)).toBeInTheDocument()
    expect(screen.getByText('42')).toBeInTheDocument()
    expect(screen.getByText(/5 DRIS/)).toBeInTheDocument()
  })
})

describe('HabitatPanel', () => {
  it('shows stored gold and upgrade cost, and collects', async () => {
    const { wrap, action } = harness(base, 600_000)
    wrap(<HabitatPanel habitatId="h1" nowMs={600_000} />)
    expect(screen.getByText('1,800 / 80,000')).toBeInTheDocument()
    expect(screen.queryByText('FULL')).toBeNull()
    expect(screen.getByText(/Level 1 · 1\/2 dragons/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /upgrade to 2/i })).toHaveTextContent('10,000')
    await userEvent.click(screen.getByRole('button', { name: /collect/i }))
    expect(action).toHaveBeenCalledWith({ type: 'collectGold', habitatId: 'h1' }, expect.any(String))
  })

  it('shows FULL and stored / cap for a capped habitat', () => {
    const { wrap } = harness(base, 10_000_000_000)
    wrap(<HabitatPanel habitatId="h1" nowMs={10_000_000_000} />)
    expect(screen.getByText('80,000 / 80,000')).toBeInTheDocument()
    expect(screen.getByText('FULL')).toBeInTheDocument()
  })

  it('shows Gold/min as the residents sum and lists residents that open the dragon panel', async () => {
    const two: PlayerState = { ...base, dragons: base.dragons.map(d => ({ ...d, speciesId: 'terra', level: 5, habitatId: 'h1' })) }
    const { wrap } = harness(two)
    const onOpenDragon = vi.fn()
    wrap(<HabitatPanel habitatId="h1" nowMs={0} onOpenDragon={onOpenDragon} />)
    expect(screen.getByText('1,320 gold/min')).toBeInTheDocument()
    const list = screen.getByRole('list', { name: /residents/i })
    expect(within(list).getAllByRole('listitem')).toHaveLength(2)
    const first = within(list).getAllByRole('button')[0]!
    expect(first).toHaveTextContent(/Terra Basic · Lv 5 · juvenile/)
    await userEvent.click(first)
    expect(onOpenDragon).toHaveBeenCalledWith('d1')
  })

  it('disables Collect with the reason when nothing is stored', () => {
    const { wrap } = harness(base)
    wrap(<HabitatPanel habitatId="h1" nowMs={0} />)
    expect(screen.getByRole('button', { name: /collect/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /collect/i })).toHaveAccessibleDescription('Nothing to collect yet')
  })

  it('offers moves only for dragons that fit', () => {
    const waiting: PlayerState = { ...base, dragons: [...base.dragons, { id: 'd9', speciesId: 'flame', level: 1, feeds: 0, habitatId: null }] }
    const { wrap } = harness(waiting)
    wrap(<HabitatPanel habitatId="h2" nowMs={0} />)
    const move = screen.getByRole('group', { name: /move a dragon here/i })
    expect(within(move).getByRole('button', { name: /d9/ })).toBeEnabled()
    expect(within(move).queryByRole('button', { name: /d1/ })).toBeNull() // terra cannot live in flame
    expect(screen.queryByRole('button', { name: /build new habitat/i })).toBeNull() // the Build shop owns new habitats
  })
})

describe('DragonPanel', () => {
  it('shows feed cost and refuses to sell below two dragons', () => {
    const { wrap } = harness(base)
    wrap(<DragonPanel dragonId="d1" />)
    expect(screen.getByRole('button', { name: /feed/i })).toHaveTextContent('5 food')
    const sell = screen.getByRole('button', { name: /sell/i })
    expect(sell).toBeDisabled()
    expect(sell).toHaveAccessibleDescription(/at least two dragons/i)
  })

  it('feeds and marks max level', async () => {
    const { wrap, action } = harness(level(base, 'd1', 7))
    wrap(<DragonPanel dragonId="d1" />)
    expect(screen.getByRole('button', { name: /feed/i })).toBeDisabled()
    const { wrap: wrap2, action: a2 } = harness(base)
    wrap2(<DragonPanel dragonId="d2" />)
    await userEvent.click(screen.getAllByRole('button', { name: /feed/i })[1]!)
    expect(a2).toHaveBeenCalledWith({ type: 'feed', dragonId: 'd2' }, expect.any(String))
    expect(action).not.toHaveBeenCalled()
  })
})

describe('BreedPanel', () => {
  it('shows exact odds for the chosen pair, with no boost or pity copy, and breeds', async () => {
    const s4 = level(level(base, 'd1', 4), 'd2', 4)
    const { wrap, action } = harness(s4)
    wrap(<BreedPanel />)
    await userEvent.selectOptions(screen.getByLabelText(/first parent/i), 'd1')
    await userEvent.selectOptions(screen.getByLabelText(/second parent/i), 'd2')
    const table = screen.getByRole('table', { name: /odds/i })
    expect(within(table).getAllByText('50.00%')).toHaveLength(2)
    expect(within(table).getAllByRole('row')).toHaveLength(3) // header + flame + sea
    expect(screen.queryByText(/odds boost|pity/i)).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: /^breed$/i }))
    expect(action).toHaveBeenCalledWith({ type: 'startBreed', parentA: 'd1', parentB: 'd2' }, expect.any(String))
  })

  it('disables breeding without a free nest or with low-level parents', async () => {
    const busy = { ...level(level(base, 'd1', 4), 'd2', 4), nests: [{ ...base.nests[0]!, egg: { speciesId: 'flame', readyAtMs: 99 } }] }
    const { wrap } = harness(busy)
    wrap(<BreedPanel />)
    await userEvent.selectOptions(screen.getByLabelText(/first parent/i), 'd1')
    await userEvent.selectOptions(screen.getByLabelText(/second parent/i), 'd2')
    expect(screen.getByRole('button', { name: /^breed$/i })).toBeDisabled()
    expect(screen.getByText(/every nest is busy/i)).toBeInTheDocument()
  })
})

describe('NestsPanel and FarmPanel', () => {
  it('shows nest timers, collects ready eggs and prices skips', async () => {
    const s = { ...base, nests: [{ ...base.nests[0]!, egg: { speciesId: 'flame', readyAtMs: 1_800_001 } }], hatchery: [{ speciesId: 'sea', readyAtMs: 0 }] }
    const { wrap, action } = harness(s)
    wrap(<NestsPanel nowMs={0} />)
    expect(screen.getByRole('button', { name: /skip.*\$0\.062417/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /collect egg/i })).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: /^hatch$/i }))
    expect(action).toHaveBeenCalledWith({ type: 'hatch', slot: 0 }, expect.any(String))
  })

  it('plants and harvests when ready', async () => {
    const { wrap, action } = harness(base)
    wrap(<FarmPanel nowMs={0} />)
    await userEvent.selectOptions(screen.getAllByLabelText(/crop/i)[0]!, 'dragonBush')
    await userEvent.click(screen.getAllByRole('button', { name: /^plant$/i })[0]!)
    expect(action).toHaveBeenCalledWith({ type: 'plant', plot: 0, crop: 'dragonBush' }, expect.any(String))

    const growing = { ...base, farms: [{ ...base.farms[0]!, crop: 'dragonBush' as const, readyAtMs: 60_000 }] }
    const h2 = harness(growing, 30_000)
    h2.wrap(<FarmPanel nowMs={30_000} />)
    const harvest = screen.getAllByRole('button', { name: /harvest/i })[0]!
    expect(harvest).toBeDisabled()
    expect(screen.getByText('30s')).toBeInTheDocument()
  })
})

describe('StorePanel', () => {
  it('prices items in USD from game-core and buys', async () => {
    const { wrap, action } = harness(base)
    wrap(<StorePanel nowMs={0} />)
    expect(screen.getByRole('button', { name: /food pack/i })).toHaveTextContent('$0.50')
    expect(screen.getAllByRole('button')).toHaveLength(1) // the food pack is the only store item
    expect(screen.queryByRole('button', { name: /nest|hoard|boost/i })).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: /food pack/i }))
    expect(action).toHaveBeenCalledWith({ type: 'buy', item: { kind: 'foodPack' } }, expect.any(String))
  })


})
