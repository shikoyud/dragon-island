import { atkAt, cropFood, DEFAULT_PRESET, goldPerMinuteX20, hpAt, makeCatalog, newPlayer, SELL_GOLD, type PlayerState } from '@wyrmhaven/game-core'
import { act, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createBridge } from '../src/game/bridge'
import { harness, TestHost } from './harness'
import { BreedPanel } from '../src/panels/BreedPanel'
import { DragonPanel } from '../src/panels/DragonPanel'
import { FarmPanel } from '../src/panels/FarmPanel'
import { HabitatPanel } from '../src/panels/HabitatPanel'
import { NestsPanel } from '../src/panels/NestsPanel'
import { ResourcesBar } from '../src/panels/ResourcesBar'
import { StorePanel } from '../src/panels/StorePanel'
import { StartPlacingProvider } from '../src/state/startPlacing'
import { formatDuration, formatGold, formatMicroUsd, formatPerMinuteX20, formatSkipPrice, formatWei } from '../src/ui/Money'

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

  it('shows a skip price rounded to the nearest cent, never below $0.01', () => {
    expect(formatSkipPrice(29_570)).toBe('$0.03')
    expect(formatSkipPrice(62_417)).toBe('$0.06')
    expect(formatSkipPrice(1)).toBe('$0.01')
    expect(formatSkipPrice(0)).toBe('$0.01')
    expect(formatSkipPrice(1_234_567)).toBe('$1.23')
    expect(formatSkipPrice(1_235_000)).toBe('$1.24')
    expect(formatSkipPrice(1_234_567_000_000)).toBe('$1,234,567.00')
  })

  it('formats durations as 15s, 2m 30s, 1h', () => {
    expect(formatDuration(15_000)).toBe('15s')
    expect(formatDuration(150_000)).toBe('2m 30s')
    expect(formatDuration(900_000)).toBe('15m')
    expect(formatDuration(3_600_000)).toBe('1h')
    expect(formatDuration(5_400_000)).toBe('1h 30m')
    expect(formatDuration(43_200_000)).toBe('12h')
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
    expect(screen.getByRole('button', { name: /upgrade roost/i })).toBeDisabled()
    const { wrap: wrap2, action: a2 } = harness(base)
    wrap2(<DragonPanel dragonId="d2" />)
    await userEvent.click(screen.getByRole('button', { name: /^feed/i }))
    expect(a2).toHaveBeenCalledWith({ type: 'feed', dragonId: 'd2' }, expect.any(String))
    expect(action).not.toHaveBeenCalled()
  })
})

describe('DragonPanel (B11)', () => {
  const withD1 = (patch: Partial<PlayerState['dragons'][number]>): PlayerState =>
    ({ ...base, dragons: base.dragons.map(d => (d.id === 'd1' ? { ...d, ...patch } : d)) })
  const habitat = (id: string, element: 'terra' | 'flame' | 'sea'): PlayerState['habitats'][number] =>
    ({ ...base.habitats[0]!, id, element })

  it('shows two filled pips and Feed · 5 food for a Lv 1 dragon with 2 feeds', () => {
    const { wrap } = harness(withD1({ feeds: 2 }))
    wrap(<DragonPanel dragonId="d1" />)
    const pips = screen.getByRole('img', { name: /2 of 4 feeds/i })
    expect(pips.querySelectorAll('[data-pip]')).toHaveLength(4)
    expect(pips.querySelectorAll('[data-pip="filled"]')).toHaveLength(2)
    expect(screen.getByRole('button', { name: /^feed/i })).toHaveTextContent('Feed · 5 food')
  })

  it('shows level, stage, rarity, Gold/min, HP and ATK', () => {
    const { wrap } = harness(withD1({ level: 5 }))
    wrap(<DragonPanel dragonId="d1" />)
    expect(screen.getByText(/Level 5 · Juvenile/)).toBeInTheDocument()
    expect(screen.getByText(/common/i)).toBeInTheDocument()
    expect(screen.getByText('660 gold/min')).toBeInTheDocument()
    expect(screen.getByText(`HP ${hpAt('common', 5)} · ATK ${atkAt('common', 5)}`)).toBeInTheDocument()
  })

  it('shows Baby and Adult stages and formats fractional Gold/min like the habitat panel', () => {
    const baby = harness(withD1({ level: 1 }))
    const { unmount } = baby.wrap(<DragonPanel dragonId="d1" />)
    expect(screen.getByText(/Level 1 · Baby/)).toBeInTheDocument()
    expect(screen.getByText(`${formatPerMinuteX20(goldPerMinuteX20('terra', 'common', 1, DEFAULT_PRESET))} gold/min`)).toBeInTheDocument()
    unmount()
    const adult = harness({ ...withD1({ level: 7 }), roostTier: 1 })
    adult.wrap(<DragonPanel dragonId="d1" />)
    expect(screen.getByText(/Level 7 · Adult/)).toBeInTheDocument()
  })

  it('names the element icons, primary first', () => {
    const catalog = makeCatalog([{ id: 'steam', name: 'Steam', elements: ['flame', 'sea'], rarity: 'rare', recipeOnly: false }])
    const { wrap } = harness(withD1({ speciesId: 'steam' }))
    wrap(<DragonPanel dragonId="d1" catalog={catalog} />)
    expect(screen.getAllByRole('img', { name: /^(flame|sea)$/i }).map(i => i.getAttribute('aria-label'))).toEqual(['flame', 'sea'])
  })

  it('shows a disabled Upgrade Roost, with its reason, at the Roost cap', () => {
    const { wrap } = harness(level(base, 'd1', 7))
    wrap(<DragonPanel dragonId="d1" />)
    const up = screen.getByRole('button', { name: /upgrade roost/i })
    expect(up).toBeDisabled()
    expect(up).toHaveAccessibleDescription(/Dragon Roost arrives in a later update/i)
    expect(screen.queryByRole('button', { name: /^feed/i })).toBeNull()
  })

  it('moves only to habitats the dragon can live in with a free slot, not its own', async () => {
    const s: PlayerState = {
      ...base,
      habitats: [...base.habitats, habitat('h3', 'terra'), habitat('h4', 'terra'), habitat('h5', 'sea')],
      dragons: [...base.dragons,
        { id: 'd3', speciesId: 'terra', level: 1, feeds: 0, habitatId: 'h4' },
        { id: 'd4', speciesId: 'terra', level: 1, feeds: 0, habitatId: 'h4' }],
    }
    const { wrap, action } = harness(s)
    wrap(<DragonPanel dragonId="d1" />)
    expect(screen.queryByRole('group', { name: /move to/i })).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: /^move$/i }))
    const picker = screen.getByRole('group', { name: /move to/i })
    const options = within(picker).getAllByRole('button')
    expect(options).toHaveLength(1) // h1 is home, h2 flame, h4 full, h5 sea
    expect(options[0]).toHaveTextContent(/h3/)
    await userEvent.click(options[0]!)
    expect(action).toHaveBeenCalledWith({ type: 'moveDragon', dragonId: 'd1', habitatId: 'h3' }, expect.any(String))
  })

  it('lets a hybrid move into either of its elements, and hides Sell for a Legendary', () => {
    const catalog = makeCatalog([{ id: 'steam', name: 'Steam', elements: ['flame', 'sea'], rarity: 'legendary', recipeOnly: true }])
    const s: PlayerState = {
      ...withD1({ speciesId: 'steam' }),
      habitats: [...base.habitats, habitat('h3', 'sea'), habitat('h4', 'terra')],
    }
    const { wrap } = harness(s)
    wrap(<DragonPanel dragonId="d1" catalog={catalog} />)
    expect(screen.queryByRole('button', { name: /sell/i })).toBeNull()
    expect(screen.queryByText(/cannot be sold/i)).toBeNull()
    return userEvent.click(screen.getByRole('button', { name: /^move$/i })).then(() => {
      const picker = screen.getByRole('group', { name: /move to/i })
      expect(within(picker).getAllByRole('button').map(b => b.textContent)).toEqual([
        expect.stringContaining('h2'), expect.stringContaining('h3'),
      ])
    })
  })

  it('offers Sell · n gold for a non-Legendary', () => {
    const { wrap } = harness({ ...base, dragons: [...base.dragons, { id: 'd3', speciesId: 'terra', level: 1, feeds: 0, habitatId: 'h1' }] })
    wrap(<DragonPanel dragonId="d1" />)
    expect(screen.getByRole('button', { name: /^sell/i })).toHaveTextContent(`Sell · ${formatGold(SELL_GOLD.common!)} gold`)
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
    expect(screen.getByRole('button', { name: /skip.*\$0\.06$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /collect egg/i })).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: /^hatch$/i }))
    expect(action).toHaveBeenCalledWith({ type: 'hatch', slot: 0 }, expect.any(String))
  })

  it('lists the six crops in tier order with time, cost and yield, and locks what the player cannot plant', () => {
    const { wrap } = harness(base)
    wrap(<FarmPanel index={0} nowMs={0} />)
    const rows = within(screen.getByRole('list', { name: /crops/i })).getAllByRole('button')
    expect(rows.map(b => b.textContent?.split(' · ').slice(0, 3).join(' · '))).toEqual([
      'Dragon Bush · 15s · 50 gold → 60 food',
      'Ember Wheat · 2m 30s · 250 gold → 360 food',
      'Sea Melon · 15m · 1,000 gold → 1,440 food',
      'Thunder Pumpkin · 1h · 3,000 gold → 4,320 food',
      'Frost Berries · 4h · 8,000 gold → 12,000 food',
      'Warlord Pepper · 12h · 20,000 gold → 31,200 food',
    ])
    expect(rows[0]).toBeEnabled()
    const wheat = screen.getByRole('button', { name: /Ember Wheat/ })
    expect(wheat).toBeDisabled()
    expect(wheat).toHaveAccessibleDescription('Level 3')
    for (const b of rows) expect(b.closest('li')).not.toBeNull()
  })

  it('disables an unaffordable unlocked crop with the reason', () => {
    const { wrap } = harness({ ...base, level: 15, gold: 40 })
    wrap(<FarmPanel index={0} nowMs={0} />)
    const bush = screen.getByRole('button', { name: /Dragon Bush/ })
    expect(bush).toBeDisabled()
    expect(bush).toHaveAccessibleDescription('Not enough gold')
  })

  it('plants the tapped crop on this panel\'s farm', async () => {
    const two = { ...base, farms: [base.farms[0]!, { ...base.farms[0]!, level: 2 }] }
    const { wrap, action } = harness(two)
    wrap(<FarmPanel index={1} nowMs={0} />)
    expect(screen.getAllByRole('region')).toHaveLength(1) // one farm per panel, not a plot list
    await userEvent.click(screen.getByRole('button', { name: /Dragon Bush/ }))
    expect(action).toHaveBeenCalledWith({ type: 'plant', plot: 1, crop: 'dragonBush' }, expect.any(String))
  })

  it('cannot plant on a farm still being built', () => {
    const farm0 = { type: 'farm' as const, index: 0 }
    harness({ ...base, constructions: [{ kind: 'build', building: farm0, readyAtMs: 99 }] }).wrap(<FarmPanel index={0} nowMs={0} />)
    const bush = screen.getByRole('button', { name: /Dragon Bush/ })
    expect(bush).toBeDisabled()
    expect(bush).toHaveAccessibleDescription('Still being built')
  })

  it('shows the growing timer and a rounded Skip price, with no crop list and no Harvest yet', () => {
    const growing = { ...base, farms: [{ ...base.farms[0]!, crop: 'dragonBush' as const, readyAtMs: 600_000 }] }
    harness(growing).wrap(<FarmPanel index={0} nowMs={0} />)
    expect(screen.getByText(/Dragon Bush/)).toBeInTheDocument()
    expect(screen.getByText('10m')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Skip · $0.03' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /harvest/i })).toBeNull()
    expect(screen.queryByRole('list', { name: /crops/i })).toBeNull()
  })

  it('offers Harvest with the yield once ripe, and sends it', async () => {
    const ripe = { ...base, farms: [{ ...base.farms[0]!, crop: 'dragonBush' as const, readyAtMs: 15_000 }] }
    const { wrap, action } = harness(ripe)
    wrap(<FarmPanel index={0} nowMs={15_000} />)
    const harvest = screen.getByRole('button', { name: 'Harvest · 60 food' })
    expect(harvest).toBeEnabled()
    expect(screen.queryByRole('button', { name: /skip/i })).toBeNull()
    await userEvent.click(harvest)
    expect(action).toHaveBeenCalledWith({ type: 'harvest', plot: 0 }, expect.any(String))
  })

  it('scales yield with the farm level: a level-5 farm shows 120 food in the picker and on Harvest', () => {
    const l5 = (crop: 'dragonBush' | null) => ({ ...base, farms: [{ ...base.farms[0]!, level: 5, crop, readyAtMs: 0 }] })
    const r = harness(l5(null)).wrap(<FarmPanel index={0} nowMs={0} />)
    expect(screen.getByRole('button', { name: /^Dragon Bush · 15s · 50 gold → 120 food/ })).toBeInTheDocument()
    r.unmount()
    harness(l5('dragonBush')).wrap(<FarmPanel index={0} nowMs={0} />)
    expect(screen.getByRole('button', { name: 'Harvest · 120 food' })).toBeInTheDocument()
  })

  it('harvests at the farm level it has now, not the level it was planted at', () => {
    const planted = { ...base.farms[0]!, crop: 'dragonBush' as const, readyAtMs: 0 }
    const r = harness({ ...base, farms: [planted] }).wrap(<FarmPanel index={0} nowMs={0} />)
    expect(screen.getByRole('button', { name: 'Harvest · 60 food' })).toBeInTheDocument()
    r.unmount()
    const upgraded = { ...planted, level: 3 }
    harness({ ...base, farms: [upgraded] }).wrap(<FarmPanel index={0} nowMs={0} />)
    expect(screen.getByRole('button', { name: `Harvest · ${cropFood('dragonBush', 3, DEFAULT_PRESET)} food` })).toBeInTheDocument()
    expect(cropFood('dragonBush', 3, DEFAULT_PRESET)).toBe(90)
  })

  it('uses the Flash-28 preset from /me for time and yield', () => {
    harness(base, 0, 'flash28').wrap(<FarmPanel index={0} nowMs={0} />)
    expect(screen.getByRole('button', { name: /^Dragon Bush · 20s · 50 gold → 40 food/ })).toBeInTheDocument()
  })

  it('opens from the island with the tapped farm\'s index', () => {
    const two = { ...base, farms: [base.farms[0]!, { ...base.farms[0]!, crop: 'dragonBush' as const, readyAtMs: 0 }] }
    const bridge = createBridge()
    harness(two).wrap(<TestHost bridge={bridge} />)
    act(() => bridge.emit({ type: 'select', target: { kind: 'farm', plot: 1 } }))
    expect(screen.getByRole('button', { name: /Harvest/ })).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: /crops/i })).toBeNull()
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
