import { atkAt, cropFood, DEFAULT_PRESET, goldPerMinuteX20, hpAt, makeCatalog, newPlayer, SELL_GOLD, type PlayerState } from '@wyrmhaven/game-core'
import { act, cleanup, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createBridge } from '../src/game/bridge'
import { harness, openInfo, TestHost } from './harness'
import { BreedPanel } from '../src/panels/BreedPanel'
import { DragonPanel } from '../src/panels/DragonPanel'
import { FarmPanel } from '../src/panels/FarmPanel'
import { HabitatPanel } from '../src/panels/HabitatPanel'
import { HatcheryPanel } from '../src/panels/HatcheryPanel'
import { QuestsPanel } from '../src/panels/QuestsPanel'
import { ResourcesBar } from '../src/panels/ResourcesBar'
import { ShopPanel } from '../src/panels/ShopPanel'
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
    expect(screen.getByText(/10 \/ 175 xp/i)).toBeInTheDocument()
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
    expect(screen.getByRole('button', { name: /upgrade roost/i })).toBeEnabled()
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
    const catalog = makeCatalog([{ id: 'steam', name: 'Steam', elements: ['flame', 'sea'], rarity: 'rare' }])
    const { wrap } = harness(withD1({ speciesId: 'steam' }))
    wrap(<DragonPanel dragonId="d1" catalog={catalog} />)
    expect(screen.getAllByRole('img', { name: /^(flame|sea)$/i }).map(i => i.getAttribute('aria-label'))).toEqual(['flame', 'sea'])
  })

  it('shows an enabled Upgrade Roost at the Roost cap, and a disabled one only at the top tier', () => {
    const { wrap } = harness(level(base, 'd1', 7))
    wrap(<DragonPanel dragonId="d1" />)
    expect(screen.getByRole('button', { name: /upgrade roost/i })).toBeEnabled()
    cleanup()
    harness({ ...level(base, 'd1', 40), roostTier: 5 }).wrap(<DragonPanel dragonId="d1" />)
    const top = screen.getByRole('button', { name: /upgrade roost/i })
    expect(top).toBeDisabled()
    expect(top).toHaveAccessibleDescription(/Max level/i)
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
    expect(options[0]).toHaveTextContent(/^Terra habitat \d · /)
    expect(options[0]).not.toHaveTextContent(/h3/)
    await userEvent.click(options[0]!)
    expect(action).toHaveBeenCalledWith({ type: 'moveDragon', dragonId: 'd1', habitatId: 'h3' }, expect.any(String))
  })

  it('lets a hybrid move into either of its elements, and hides Sell for a Legendary', () => {
    const catalog = makeCatalog([{ id: 'steam', name: 'Steam', elements: ['flame', 'sea'], rarity: 'legendary' }])
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
        expect.stringContaining('Flame habitat'), expect.stringContaining('Sea habitat'),
      ])
    })
  })

  it('offers Sell · n gold for a non-Legendary', () => {
    const { wrap } = harness({ ...base, dragons: [...base.dragons, { id: 'd3', speciesId: 'terra', level: 1, feeds: 0, habitatId: 'h1' }] })
    wrap(<DragonPanel dragonId="d1" />)
    expect(screen.getByRole('button', { name: /^sell/i })).toHaveTextContent(`Sell · ${formatGold(SELL_GOLD.common!)} gold`)
  })
})

const GAME = { launchAtMs: 0 }
const pl2 = (s: PlayerState): PlayerState => ({ ...level(level(s, 'd1', 4), 'd2', 4), level: 2 })
const pick = async (a: string, b: string) => {
  await userEvent.selectOptions(screen.getByLabelText(/first parent/i), a)
  await userEvent.selectOptions(screen.getByLabelText(/second parent/i), b)
}
const outcomes = () => within(screen.getByRole('list', { name: /breeding outcomes/i })).getAllByRole('listitem').map(li => li.textContent)
const DAY_MS = 86_400_000
/** Game day 14: after every Legendary event window (days 1-12), so Terra x Flame has only its four §3.2 outcomes. */
const QUIET = 13 * DAY_MS

describe('BreedPanel', () => {
  it('lists Terra x Flame outcomes by chance with rarity, odds and the building timer, then breeds', async () => {
    const { wrap, action } = harness({ ...pl2(base), firstHybridDone: true }, QUIET, undefined, GAME)
    wrap(<BreedPanel nowMs={QUIET} />)
    await pick('d1', 'd2')
    expect(outcomes()).toEqual([
      'Terra Basic · Common · 41.67% · 5s',
      'Flame Basic · Common · 41.67% · 5s',
      'Terra-Flame · Rare · 8.33% · 40m',
      'Flame-Terra · Rare · 8.33% · 40m',
    ])
    expect(screen.queryByText(/odds boost|pity/i)).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: /^breed$/i }))
    expect(action).toHaveBeenCalledWith({ type: 'startBreed', parentA: 'd1', parentB: 'd2' }, expect.any(String))
  })

  it("applies the free building's reduction (Mountain L2: 36m)", async () => {
    const s = { ...pl2(base), firstHybridDone: true, breeders: [{ ...base.breeders[0]!, level: 2 }] }
    const { wrap } = harness(s, QUIET, undefined, GAME)
    wrap(<BreedPanel nowMs={QUIET} />)
    await pick('d1', 'd2')
    expect(outcomes()).toContain('Terra-Flame · Rare · 8.33% · 36m')
  })

  it('shows both hybrids at 50.00% and 1m until the first hybrid is bred', async () => {
    const { wrap } = harness(pl2(base), QUIET, undefined, GAME)
    wrap(<BreedPanel nowMs={QUIET} />)
    await pick('d1', 'd2')
    expect(outcomes()).toEqual(['Terra-Flame · Rare · 50.00% · 1m', 'Flame-Terra · Rare · 50.00% · 1m'])
  })

  it('refuses opposite Basics with the reason and no table', async () => {
    const s = pl2({ ...base, dragons: [...base.dragons, { id: 'd3', speciesId: 'ice', level: 4, feeds: 0, habitatId: 'h1' }] })
    const { wrap } = harness(s, QUIET, undefined, GAME)
    wrap(<BreedPanel nowMs={QUIET} />)
    await pick('d2', 'd3')
    expect(screen.queryByRole('list', { name: /breeding outcomes/i })).toBeNull()
    expect(screen.getByRole('button', { name: /^breed$/i })).toBeDisabled()
    expect(screen.getByText("Opposite Basics can't breed. Use a hybrid that carries one of them.")).toBeInTheDocument()
  })

  it('needs both parents at level 4', async () => {
    const { wrap } = harness(level(pl2(base), 'd2', 3), 0, undefined, GAME)
    wrap(<BreedPanel nowMs={QUIET} />)
    await pick('d1', 'd2')
    expect(screen.getByRole('button', { name: /^breed$/i })).toBeDisabled()
    expect(screen.getByText('Both parents must be level 4')).toBeInTheDocument()
  })

  it('is locked at player level 1', async () => {
    const { wrap } = harness({ ...level(level(base, 'd1', 4), 'd2', 4), level: 1 }, 0, undefined, GAME)
    wrap(<BreedPanel nowMs={QUIET} />)
    await pick('d1', 'd2')
    expect(screen.getByRole('button', { name: /^breed$/i })).toBeDisabled()
    expect(screen.getByText('Unlocks at level 2')).toBeInTheDocument()
  })

  it('disables breeding when every building is busy, naming no species in the egg state', async () => {
    const busy = { ...pl2(base), breeders: [{ ...base.breeders[0]!, egg: { speciesId: 'flame', readyAtMs: QUIET + 99_000, hatchMs: 1, xpFree: false } }] }
    const { wrap } = harness(busy, 0, undefined, GAME)
    wrap(<BreedPanel nowMs={QUIET} />)
    await pick('d1', 'd2')
    expect(screen.getByRole('button', { name: /^breed$/i })).toBeDisabled()
    expect(screen.getByText('Every breeding building is busy')).toBeInTheDocument()
    const row = screen.getByTestId('breeder-0')
    expect(row).toHaveTextContent(/Breeding Mountain/)
    expect(row).toHaveTextContent(/Egg · /)
    expect(row).not.toHaveTextContent(/flame/i)
    expect(within(row).getByRole('button', { name: /^skip · \$/i })).toBeInTheDocument()
  })

  it('shows an idle building', () => {
    const { wrap } = harness(pl2(base), QUIET, undefined, GAME)
    wrap(<BreedPanel nowMs={QUIET} />)
    expect(screen.getByTestId('breeder-0')).toHaveTextContent(/Breeding Mountain.*idle/)
  })

  it('lists a Legendary only on event days', async () => {
    const s = { ...pl2(base), firstHybridDone: true }
    const open = harness(s, DAY_MS, undefined, GAME).wrap(<BreedPanel nowMs={DAY_MS} />)
    await pick('d1', 'd2')
    expect(outcomes().filter(o => o?.includes('Legendary'))).toHaveLength(1)
    open.unmount()
    harness(s, QUIET, undefined, GAME).wrap(<BreedPanel nowMs={QUIET} />)
    await pick('d1', 'd2')
    expect(outcomes().some(o => o?.includes('Legendary'))).toBe(false)
  })

  it('shows an undiscovered result by name and odds', async () => {
    const { wrap } = harness({ ...pl2(base), firstHybridDone: true, discovered: ['terra', 'flame'] }, QUIET, undefined, GAME)
    wrap(<BreedPanel nowMs={QUIET} />)
    await pick('d1', 'd2')
    expect(outcomes()).toContain('Flame-Terra · Rare · 8.33% · 40m')
  })

  it('moves a finished egg to the Hatchery on a tap', async () => {
    const s = { ...pl2(base), breeders: [{ ...base.breeders[0]!, egg: { speciesId: 'flame', readyAtMs: 0, hatchMs: 5_000, xpFree: false } }] }
    const { wrap, action } = harness(s, QUIET, undefined, GAME)
    wrap(<BreedPanel nowMs={QUIET} />)
    const row = screen.getByTestId('breeder-0')
    expect(row).toHaveTextContent(/Egg ready/)
    expect(row).not.toHaveTextContent(/flame/i)
    await userEvent.click(within(row).getByRole('button', { name: 'Move to Hatchery' }))
    expect(action).toHaveBeenCalledWith({ type: 'collectEgg', breeder: 0 }, expect.any(String))
  })

  it('disables Move to Hatchery with a reason when the Hatchery is full', () => {
    const s = { ...pl2(base), breeders: [{ ...base.breeders[0]!, egg: { speciesId: 'flame', readyAtMs: 0, hatchMs: 5_000, xpFree: false } }], hatchery: [{ speciesId: 'sea', readyAtMs: 99 }] }
    const { wrap } = harness(s, QUIET, undefined, GAME)
    wrap(<BreedPanel nowMs={QUIET} />)
    const row = screen.getByTestId('breeder-0')
    expect(within(row).getByRole('button', { name: 'Move to Hatchery' })).toBeDisabled()
    expect(within(row).getByText('Hatchery is full')).toBeInTheDocument()
  })
})

describe('HatcheryPanel and FarmPanel', () => {
  it('shows hatchery timers, hatches ready eggs and prices skips', async () => {
    const s = { ...base, hatchery: [{ speciesId: 'sea', readyAtMs: 0 }, { speciesId: 'sea', readyAtMs: 1_800_001 }] }
    const { wrap, action } = harness(s)
    wrap(<HatcheryPanel nowMs={0} />)
    expect(screen.getByRole('button', { name: /skip.*\$0\.06$/i })).toBeInTheDocument()
    await userEvent.click(screen.getAllByRole('button', { name: /^hatch$/i })[0]!)
    expect(action).toHaveBeenCalledWith({ type: 'hatch', slot: 0 }, expect.any(String))
  })

  const waiting = { id: 'd9', speciesId: 'flame', level: 1, feeds: 0, habitatId: null }

  it('titles the Hatchery used/slots and lists an egg without its species, a waiting dragon and empty slots (R20)', async () => {
    const s = { ...base, hatcheryLevel: 2, hatchery: [{ speciesId: 'sea', readyAtMs: 1_800_001 }], dragons: [...base.dragons, waiting] }
    const { wrap } = harness(s)
    const onOpenDragon = vi.fn()
    wrap(<HatcheryPanel nowMs={0} onOpenDragon={onOpenDragon} />)
    expect(screen.getByRole('region', { name: 'Hatchery · 2/2' })).toBeInTheDocument()
    const egg = screen.getByTestId('hatchery-slot-0')
    expect(egg).toHaveTextContent(/^Egg · /)
    expect(egg).not.toHaveTextContent(/sea/i)
    const dragon = screen.getByTestId('hatchery-slot-1')
    expect(dragon).toHaveTextContent('Flame')
    expect(dragon).toHaveTextContent('Needs a habitat')
    await userEvent.click(within(dragon).getByRole('button', { name: /flame/i }))
    expect(onOpenDragon).toHaveBeenCalledWith('d9')
  })

  it('shows Empty for a free slot', () => {
    harness({ ...base, hatcheryLevel: 2, hatchery: [] }).wrap(<HatcheryPanel nowMs={0} />)
    expect(screen.getByRole('region', { name: 'Hatchery · 0/2' })).toBeInTheDocument()
    expect(screen.getAllByText('Empty')).toHaveLength(2)
  })

  it('names the species in a toast after hatching', async () => {
    const s = { ...base, hatchery: [{ speciesId: 'sea', readyAtMs: 0 }] }
    const { wrap, action } = harness(s)
    wrap(<HatcheryPanel nowMs={0} />)
    await userEvent.click(screen.getByRole('button', { name: /^hatch$/i }))
    expect(action).toHaveBeenCalledWith({ type: 'hatch', slot: 0 }, expect.any(String))
    expect(await screen.findByRole('status')).toHaveTextContent('Hatched Sea')
  })

  it('points to the Store for the fifth slot from PL 15 until it is bought, and counts it in the title (Q5 a)', () => {
    const early = harness({ ...base, level: 14 }).wrap(<HatcheryPanel nowMs={0} />)
    expect(screen.queryByText('Fifth slot in the Store')).toBeNull()
    early.unmount()
    const open = harness({ ...base, level: 15 }).wrap(<HatcheryPanel nowMs={0} />)
    expect(screen.getByText('Fifth slot in the Store')).toBeInTheDocument()
    open.unmount()
    const bought = { ...base, level: 15, hatcheryLevel: 1, hatcheryFifthSlot: true, hatchery: [{ speciesId: 'sea', readyAtMs: 99 }] }
    harness(bought).wrap(<HatcheryPanel nowMs={0} />)
    expect(screen.getByRole('region', { name: 'Hatchery · 1/2' })).toBeInTheDocument()
    expect(screen.queryByText('Fifth slot in the Store')).toBeNull()
    expect(screen.getAllByText('Empty')).toHaveLength(1)
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
    openInfo(bridge, { kind: 'farm', plot: 1 })
    expect(screen.getByRole('button', { name: /Harvest/ })).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: /crops/i })).toBeNull()
  })
})

describe('ShopPanel Store tab food pack', () => {
  it('prices items in USD from game-core and buys', async () => {
    const { wrap, action } = harness(base)
    wrap(<ShopPanel tab="store" nowMs={0} view="home" onPlace={() => {}} />)
    expect(screen.getByRole('button', { name: /food pack/i })).toHaveTextContent('$0.50')
    expect(screen.queryByRole('button', { name: /nest|hoard|boost/i })).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: /food pack/i }))
    expect(action).toHaveBeenCalledWith({ type: 'buy', item: { kind: 'foodPack' } }, expect.any(String))
  })


})

describe('QuestsPanel (§1.4)', () => {
  const done = (n: number): PlayerState => ({ ...base, goalIndex: n })
  it('shows an unmet Goal with its progress and no Claim', () => {
    harness(base).wrap(<QuestsPanel />)
    expect(screen.getByText('Goal 1 of 14')).toBeInTheDocument()
    expect(screen.getByText('Collect Gold from a habitat')).toBeInTheDocument()
    expect(screen.getByText('0 / 1')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Claim' })).toBeNull()
  })

  it('shows Claim when done, and sends claimGoal', async () => {
    const h = harness({ ...base, goalStats: { ...base.goalStats, collects: 1 } })
    h.wrap(<QuestsPanel />)
    expect(screen.getByText('1 / 1')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Claim' }))
    expect(h.action).toHaveBeenCalledWith({ type: 'claimGoal' }, expect.any(String))
  })

  it('shows XP after the preset multiplier: 300 under Flash-14, 200 under Flash-28', () => {
    harness(base, 0, 'flash14').wrap(<QuestsPanel />)
    expect(screen.getByText('+300 XP · +200 gold')).toBeInTheDocument()
    cleanup()
    harness(base, 0, 'flash28').wrap(<QuestsPanel />)
    expect(screen.getByText('+200 XP · +200 gold')).toBeInTheDocument()
  })

  it('counts through the later Goals and ends with All goals done', () => {
    harness(done(3)).wrap(<QuestsPanel />)
    expect(screen.getByText('Goal 4 of 14')).toBeInTheDocument()
    cleanup()
    harness(done(14)).wrap(<QuestsPanel />)
    expect(screen.getByText('All goals done')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Claim' })).toBeNull()
  })

  it('opens where a Goal is done: Goal 2 opens the Farm', async () => {
    const onOpen = vi.fn()
    harness(done(1)).wrap(<QuestsPanel onOpen={onOpen} />)
    await userEvent.click(screen.getByRole('button', { name: 'Go to Farm' }))
    expect(onOpen).toHaveBeenCalledWith({ kind: 'target', target: { kind: 'farm', plot: 0 } })
  })
})
