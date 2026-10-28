import { newPlayer, type PlayerState } from '@wyrmhaven/game-core'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { ApiProvider } from '../src/api/ApiProvider'
import type { Api } from '../src/api/client'
import { sessionStore } from '../src/api/session'
import { BreedPanel } from '../src/panels/BreedPanel'
import { DragonPanel } from '../src/panels/DragonPanel'
import { FarmPanel } from '../src/panels/FarmPanel'
import { HabitatPanel } from '../src/panels/HabitatPanel'
import { NestsPanel } from '../src/panels/NestsPanel'
import { ResourcesBar } from '../src/panels/ResourcesBar'
import { StorePanel } from '../src/panels/StorePanel'
import { ME_KEY } from '../src/state/me'
import { formatGold, formatMicroUsd, formatWei } from '../src/ui/Money'

function harness(state: PlayerState, nowMs = 0) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  qc.setQueryData(ME_KEY, { playerId: 'p1', address: '0xabc', state, balanceWei: 10n ** 18n * 5n, earningUnlocked: false, banned: false, season: null })
  sessionStore.set({ token: 't', playerId: 'p1', address: '0xabc' })
  const action = vi.fn(async () => ({ state, effects: [] }))
  const api = { action } as unknown as Api
  const wrap = (ui: ReactNode) => render(
    <QueryClientProvider client={qc}><ApiProvider api={api}>{ui}</ApiProvider></QueryClientProvider>,
  )
  return { wrap, action, nowMs }
}

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
  it('shows gold with the eligible share, food, level/xp, trophies and tokens', () => {
    const { wrap } = harness({ ...base, gold: 1500, eligibleGold: 500, trophies: 42, xp: 10, level: 2 })
    wrap(<ResourcesBar />)
    expect(screen.getByText('1,500')).toBeInTheDocument()
    expect(screen.getByText(/500 eligible/)).toBeInTheDocument()
    expect(screen.getByText(/10 \/ 200 xp/i)).toBeInTheDocument()
    expect(screen.getByText('42')).toBeInTheDocument()
    expect(screen.getByText(/5 WYRM/)).toBeInTheDocument()
  })
})

describe('HabitatPanel', () => {
  it('shows stored gold and upgrade cost, and collects', async () => {
    const { wrap, action } = harness(base, 600_000)
    wrap(<HabitatPanel habitatId="h1" nowMs={600_000} />)
    expect(screen.getByText(/20 gold stored/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /upgrade/i })).toHaveTextContent('1,000')
    await userEvent.click(screen.getByRole('button', { name: /collect/i }))
    expect(action).toHaveBeenCalledWith({ type: 'collectGold', habitatId: 'h1' }, expect.any(String))
  })

  it('offers moves only for dragons that fit and disables building at the limit', () => {
    const waiting: PlayerState = { ...base, dragons: [...base.dragons, { id: 'd9', speciesId: 'water', level: 1, habitatId: null }] }
    const { wrap } = harness(waiting)
    wrap(<HabitatPanel habitatId="h2" nowMs={0} />)
    const move = screen.getByRole('group', { name: /move a dragon here/i })
    expect(within(move).getByRole('button', { name: /d9/ })).toBeEnabled()
    expect(within(move).queryByRole('button', { name: /d1/ })).toBeNull() // fire cannot live in water
    const build = screen.getByRole('button', { name: /build new habitat/i })
    expect(build).toBeDisabled()
    expect(build).toHaveAccessibleDescription(/level/i)
  })
})

describe('DragonPanel', () => {
  it('shows feed cost and refuses to sell below two dragons', () => {
    const { wrap } = harness(base)
    wrap(<DragonPanel dragonId="d1" />)
    expect(screen.getByRole('button', { name: /feed/i })).toHaveTextContent('4 food')
    const sell = screen.getByRole('button', { name: /sell/i })
    expect(sell).toBeDisabled()
    expect(sell).toHaveAccessibleDescription(/at least two dragons/i)
  })

  it('feeds and marks max level', async () => {
    const { wrap, action } = harness(level(base, 'd1', 30))
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
  it('shows exact odds for the chosen pair, notes boosts, and breeds', async () => {
    const s4 = level(level(base, 'd1', 4), 'd2', 4)
    const { wrap, action } = harness({ ...s4, oddsBoosts: 1 })
    wrap(<BreedPanel />)
    await userEvent.selectOptions(screen.getByLabelText(/first parent/i), 'd1')
    await userEvent.selectOptions(screen.getByLabelText(/second parent/i), 'd2')
    const table = screen.getByRole('table', { name: /odds/i })
    expect(within(table).getAllByText('50.00%')).toHaveLength(2)
    expect(within(table).getAllByRole('row')).toHaveLength(3) // header + fire + water
    expect(screen.getByText(/odds boost active/i)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /^breed$/i }))
    expect(action).toHaveBeenCalledWith({ type: 'startBreed', parentA: 'd1', parentB: 'd2' }, expect.any(String))
  })

  it('disables breeding without a free nest or with low-level parents', async () => {
    const busy = { ...level(level(base, 'd1', 4), 'd2', 4), nests: [{ speciesId: 'fire', readyAtMs: 99 }] }
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
    const s = { ...base, nests: [{ speciesId: 'fire', readyAtMs: 1_800_001 }], hatchery: [{ speciesId: 'water', readyAtMs: 0 }] }
    const { wrap, action } = harness(s)
    wrap(<NestsPanel nowMs={0} />)
    expect(screen.getByRole('button', { name: /skip.*\$0\.20/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /collect egg/i })).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: /^hatch$/i }))
    expect(action).toHaveBeenCalledWith({ type: 'hatch', slot: 0 }, expect.any(String))
  })

  it('plants, harvests when ready and buys plots', async () => {
    const { wrap, action } = harness(base)
    wrap(<FarmPanel nowMs={0} />)
    await userEvent.selectOptions(screen.getAllByLabelText(/crop/i)[0]!, 'sprout')
    await userEvent.click(screen.getAllByRole('button', { name: /^plant$/i })[0]!)
    expect(action).toHaveBeenCalledWith({ type: 'plant', plot: 0, crop: 'sprout' }, expect.any(String))
    expect(screen.getByRole('button', { name: /buy plot/i })).toHaveTextContent('500')

    const growing = { ...base, farms: [{ crop: 'sprout' as const, readyAtMs: 60_000 }, { crop: null, readyAtMs: 0 }] }
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
    expect(screen.getByRole('button', { name: /extra nest/i })).toHaveTextContent('$2.00')
    expect(screen.getByRole('button', { name: /hoard/i })).toBeDisabled() // player level 1 < 5
    await userEvent.click(screen.getByRole('button', { name: /odds boost/i }))
    expect(action).toHaveBeenCalledWith({ type: 'buy', item: { kind: 'oddsBoost' } }, expect.any(String))
  })
})
