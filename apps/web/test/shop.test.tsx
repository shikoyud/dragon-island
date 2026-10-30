import { applyAction, createRng, islandSize, LAUNCH_CATALOG, newPlayer, placementRuleError, type IslandId, type PlayerState } from '@wyrmhaven/game-core'
import { cleanup, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { messageFor } from '../src/api/errors'
import { createBridge } from '../src/game/bridge'
import { FarmPanel } from '../src/panels/FarmPanel'
import { HabitatPanel } from '../src/panels/HabitatPanel'
import { BreedPanel } from '../src/panels/BreedPanel'
import { HatcheryPanel } from '../src/panels/HatcheryPanel'
import { ShopPanel } from '../src/panels/ShopPanel'
import { UpgradeSection } from '../src/panels/UpgradeSection'
import { StartPlacingProvider } from '../src/state/startPlacing'
import * as placing from '../src/state/placing'
import { harness, TestHost } from './harness'

const base = newPlayer(0)
const h1 = { type: 'habitat', id: 'h1' } as const

describe('ShopPanel Build tab', () => {
  it('lists categories, locks by level and starts placement', async () => {
    const onPlace = vi.fn()
    const { wrap } = harness({ ...base, level: 3 })
    wrap(<ShopPanel onPlace={onPlace} view="home" nowMs={0} />)
    for (const c of ['habitats', 'breeding', 'farming', 'decorations']) expect(screen.getByTestId(`shop-${c}`)).toBeInTheDocument()
    expect(screen.queryByTestId('shop-hoard')).toBeNull()
    const hay = screen.getByRole('button', { name: /Hay cart/ })
    expect(hay).toBeDisabled()
    expect(hay).toHaveAccessibleDescription(/Level 6/)
    expect(screen.getByRole('button', { name: /flame habitat/i })).toBeDisabled() // 2,000 gold, base has 1,000
    await userEvent.click(screen.getByRole('button', { name: /Flower patch/ }))
    expect(onPlace).toHaveBeenCalledWith({ kind: 'decoration', decoration: 'flowerPatch' }, 1)
  })

  it('has no habitat count limit', () => {
    const { wrap } = harness({ ...base, level: 7 })
    wrap(<ShopPanel onPlace={vi.fn()} view="home" nowMs={0} />)
    expect(screen.getByRole('button', { name: /terra habitat/i })).toBeEnabled()
  })

  it('locks a habitat below its unlock player level and names the level', () => {
    const { wrap } = harness({ ...base, level: 3, gold: 1_000_000 })
    wrap(<ShopPanel onPlace={vi.fn()} view="home" nowMs={0} />)
    expect(screen.getByRole('button', { name: /electric habitat/i })).toHaveAccessibleDescription('Level 6')
    expect(screen.getByRole('button', { name: /sea habitat/i })).toBeEnabled()
  })

  it('starts habitats and farm plots with their footprints', async () => {
    const onPlace = vi.fn()
    const { wrap } = harness({ ...base, level: 5, gold: 100_000 })
    wrap(<ShopPanel onPlace={onPlace} view="home" nowMs={0} />)
    await userEvent.click(screen.getByRole('button', { name: /terra habitat/i }))
    expect(onPlace).toHaveBeenLastCalledWith({ kind: 'habitat', element: 'terra' }, 5)
    await userEvent.click(within(screen.getByTestId('shop-farming')).getByRole('button'))
    expect(onPlace).toHaveBeenLastCalledWith({ kind: 'farm' }, 2)
  })

  it('sells one Grove from PL 12 (§5.4)', async () => {
    const grove = () => within(screen.getByTestId('shop-breeding')).getByRole('button', { name: /Breeding Grove · 400,000 gold/ })
    const low = harness({ ...base, level: 11, gold: 1_000_000 }).wrap(<ShopPanel onPlace={vi.fn()} view="home" nowMs={0} />)
    expect(grove()).toBeDisabled()
    expect(grove()).toHaveAccessibleDescription('Level 12')
    low.unmount()
    const poor = harness({ ...base, level: 12, gold: 399_999 }).wrap(<ShopPanel onPlace={vi.fn()} view="home" nowMs={0} />)
    expect(grove()).toHaveAccessibleDescription('Not enough gold')
    poor.unmount()
    const onPlace = vi.fn()
    const ok = harness({ ...base, level: 12, gold: 400_000 }).wrap(<ShopPanel onPlace={onPlace} view="home" nowMs={0} />)
    await userEvent.click(grove())
    expect(onPlace).toHaveBeenCalledWith({ kind: 'grove' }, 2)
    ok.unmount()
    const placement = base.breeders[0]!.placement
    harness({ ...base, level: 12, gold: 400_000, breeders: [...base.breeders, { kind: 'grove', egg: null, level: 1, placement }] }).wrap(<ShopPanel onPlace={vi.fn()} view="home" nowMs={0} />)
    expect(grove()).toBeDisabled()
    expect(grove()).toHaveAccessibleDescription('Already built')
  })

  it('shows Dawnspire-only items greyed off the Dawnspire, enabled on it', () => {
    const rich = { ...base, level: 45, gold: 5_000_000 }
    const r = harness(rich).wrap(<ShopPanel onPlace={vi.fn()} view="home" nowMs={0} />)
    for (const name of [/Star pool/, /Dawn obelisk/, /Dragon colossus/]) {
      const b = screen.getByRole('button', { name })
      expect(b).toBeDisabled()
      expect(b).toHaveAccessibleDescription('Dawnspire only')
    }
    r.unmount()
    harness(rich).wrap(<ShopPanel onPlace={vi.fn()} view="dawnspire" nowMs={0} />)
    expect(screen.getByRole('button', { name: /Star pool/ })).toBeEnabled()
  })
})

const l4 = (): PlayerState => ({
  ...base,
  habitats: base.habitats.map(h => (h.id === 'h1' ? { ...h, level: 4 } : h)),
  farms: base.farms.map((f, i) => (i === 0 ? { ...f, level: 4 } : f)),
})

describe('ShopPanel Dragons section (buy a Basic)', () => {
  const seaHab = { id: 'h3', element: 'sea' as const, level: 1, lastCollectedMs: 0, placement: { island: 'home' as const, col: 9, row: 0, facing: 0 as const } }
  const sea = () => within(screen.getByTestId('shop-dragons')).getByRole('button', { name: /Sea Basic/ })
  const show = (s: PlayerState) => harness(s).wrap(<ShopPanel onPlace={vi.fn()} view="home" nowMs={0} />)

  it('sits above Habitats and prices each Basic at its habitat build Gold', () => {
    show({ ...base, level: 3, gold: 5_000, habitats: [...base.habitats, seaHab] })
    const dragons = screen.getByTestId('shop-dragons')
    expect(dragons.compareDocumentPosition(screen.getByTestId('shop-habitats')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(sea()).toHaveTextContent('Sea Basic · 5,000 gold')
    expect(sea()).toBeEnabled()
  })

  it('buys the Basic on click', async () => {
    const { action, wrap } = harness({ ...base, level: 3, gold: 5_000, habitats: [...base.habitats, seaHab] })
    wrap(<ShopPanel onPlace={vi.fn()} view="home" nowMs={0} />)
    await userEvent.click(sea())
    expect(action).toHaveBeenCalledWith({ type: 'buyBasic', element: 'sea' }, expect.any(String))
  })

  it('names the Player Level, then the missing habitat, then the Gold', () => {
    const low = show({ ...base, level: 1, gold: 5_000, habitats: [...base.habitats, seaHab] })
    expect(sea()).toBeDisabled()
    expect(sea()).toHaveAccessibleDescription('Level 3')
    low.unmount()
    const none = show({ ...base, level: 3, gold: 5_000 })
    expect(sea()).toHaveAccessibleDescription('Build a Sea habitat first')
    none.unmount()
    const full = show({ ...base, level: 3, gold: 5_000, habitats: [...base.habitats, seaHab],
      dragons: [...base.dragons, ...['d8', 'd9'].map(id => ({ id, speciesId: 'sea', level: 1, feeds: 0, habitatId: 'h3' }))] })
    expect(sea()).toHaveAccessibleDescription('No free Sea habitat')
    full.unmount()
    const building = show({ ...base, level: 3, gold: 5_000, habitats: [...base.habitats, seaHab],
      constructions: [{ kind: 'build', building: { type: 'habitat', id: 'h3' }, readyAtMs: 9_999 }] })
    expect(sea()).toHaveAccessibleDescription('No free Sea habitat')
    building.unmount()
    show({ ...base, level: 3, gold: 4_999, habitats: [...base.habitats, seaHab] })
    expect(sea()).toHaveAccessibleDescription('Not enough gold')
  })
})

/** Every free cell on an island taken by a 1-cell decoration: a state with truly no room for anything. */
const fill = (s: PlayerState, island: IslandId): PlayerState => {
  const { w, h } = islandSize(s, island)
  const decorations = [...s.decorations]
  for (let row = 0; row < h; row++) for (let col = 0; col < w; col++) {
    const at = { island, col, row, facing: 0 as const }
    if (placementRuleError({ ...s, decorations }, { kind: 'decoration', decoration: 'flowerPatch' }, at) === null) {
      decorations.push({ id: `fill-${island}-${col}-${row}`, kind: 'flowerPatch', placement: at })
    }
  }
  return { ...s, decorations }
}
const act = (s: PlayerState, a: Parameters<typeof applyAction>[1]): PlayerState => {
  const r = applyAction(s, a, 0, createRng(1), LAUNCH_CATALOG)
  if (!r.ok) throw new Error(r.error)
  return r.state
}
const terra = { kind: 'habitat', element: 'terra' } as const
const atHome = (col: number, row: number) => ({ island: 'home' as const, col, row, facing: 0 as const })

describe('the Shop checks for room once', () => {
  it('agrees with nearestLegalCell on a fresh island and on a full one', () => {
    const fresh = { ...base, level: 7, gold: 1_000_000 }
    const full = fill(fresh, 'home')
    expect(placing.hasLegalCell(fresh, terra)).toBe(true)
    expect(placing.hasLegalCell(full, terra)).toBe(false)
    for (const st of [fresh, full]) {
      expect(placing.hasLegalCell(st, terra)).toBe(placing.nearestLegalCell(st, terra, 'home', { col: 0, row: 0 }) !== null)
    }
  })

  it('scans once per footprint it sells (5x5 rows, the Grove, the Roost) and not again on a clock tick', () => {
    const spy = vi.spyOn(placing, 'hasLegalCell')
    const st = { ...base, level: 7, gold: 1_000_000 }
    const h = harness(st)
    const ui = (nowMs: number) => <ShopPanel onPlace={vi.fn()} view="home" nowMs={nowMs} />
    const r = h.wrap(ui(0))
    expect(spy).toHaveBeenCalledTimes(3)
    r.rerender(ui(1_000))
    r.rerender(ui(2_000))
    expect(spy).toHaveBeenCalledTimes(3)
    spy.mockRestore()
  })
})

describe('ShopPanel rows that need a free grid cell', () => {
  const rich = { ...base, level: 7, gold: 1_000_000 }
  const rows = () => [
    within(screen.getByTestId('shop-habitats')).getByRole('button', { name: /terra habitat/i }),
    within(screen.getByTestId('shop-habitats')).getByRole('button', { name: /flame habitat/i }),
  ]

  it('does not say no room on a fresh island at step 0, PL 3 (R9)', () => {
    const fresh = { ...base, level: 3, gold: 5_000 }
    harness(fresh).wrap(<ShopPanel onPlace={vi.fn()} view="home" nowMs={0} />)
    const sea = within(screen.getByTestId('shop-habitats')).getByRole('button', { name: /sea habitat/i })
    expect(sea).toBeEnabled()
    expect(sea).not.toHaveAccessibleDescription('No room: expand the island')
  })

  it('disables habitats only when no cell really exists', () => {
    harness(fill(rich, 'home')).wrap(<ShopPanel onPlace={vi.fn()} view="home" nowMs={0} />)
    for (const b of rows()) {
      expect(b).toBeDisabled()
      expect(b).toHaveAccessibleDescription('No room: expand the island')
    }
  })

  it('disables the Golden Aerie there too', () => {
    harness(fill(rich, 'home')).wrap(<ShopPanel tab="store" onPlace={vi.fn()} view="home" nowMs={0} />)
    const aerie = screen.getByRole('button', { name: /golden aerie/i })
    expect(aerie).toBeDisabled()
    expect(aerie).toHaveAccessibleDescription('No room: expand the island')
  })

  it('opens them again once real expansions make room', () => {
    // The third habitat takes the only 5x5 spot at step 0; the next one appears at step 3.
    let st = act(rich, { type: 'placeBuilding', building: terra, placement: atHome(6, 5) })
    expect(placing.hasLegalCell(st, terra)).toBe(false)
    const none = harness(st).wrap(<ShopPanel onPlace={vi.fn()} view="home" nowMs={0} />)
    for (const b of rows()) expect(b).toHaveAccessibleDescription('No room: expand the island')
    none.unmount()
    for (let i = 0; i < 3; i++) st = act(st, { type: 'expandIsland' })
    expect(st.islands.homeStep).toBe(3)
    const r = harness(st).wrap(<ShopPanel onPlace={vi.fn()} view="home" nowMs={0} />)
    for (const b of rows()) expect(b).toBeEnabled()
    r.unmount()
    harness(st).wrap(<ShopPanel tab="store" onPlace={vi.fn()} view="home" nowMs={0} />)
    expect(screen.getByRole('button', { name: /golden aerie/i })).not.toHaveAccessibleDescription('No room: expand the island')
  })

  it('sells the Grove where a 2-cell spot is left, though no 5x5 cell is (R9)', () => {
    const st = act({ ...base, level: 12, gold: 1_000_000 }, { type: 'placeBuilding', building: terra, placement: atHome(6, 5) })
    const r = harness(st).wrap(<ShopPanel onPlace={vi.fn()} view="home" nowMs={0} />)
    expect(rows()[0]).toHaveAccessibleDescription('No room: expand the island')
    const grove = within(screen.getByTestId('shop-breeding')).getByRole('button', { name: /Breeding Grove/ })
    expect(grove).toBeEnabled()
    r.unmount()
    harness(fill(st, 'home')).wrap(<ShopPanel onPlace={vi.fn()} view="home" nowMs={0} />)
    expect(within(screen.getByTestId('shop-breeding')).getByRole('button', { name: /Breeding Grove/ })).toHaveAccessibleDescription('No room: expand the island')
  })
})

describe('room on another island (hasLegalCell scans them all)', () => {
  const rich = { ...base, level: 12, gold: 1_000_000 }

  it('opens the ghost on the island that has the cell', () => {
    const st = fill(act(rich, { type: 'unlockIsland' }), 'home')
    expect(placing.hasLegalCell(st, terra)).toBe(true)
    const start = placing.placementStart(st, terra, 5, 'home', null)
    expect(start.island).toBe('isle2')
    expect(placementRuleError(st, terra, { island: 'isle2', ...start.cell!, facing: 0 })).toBeNull()
  })

  it('stays on the viewed island when it has room, and with no room anywhere', () => {
    const st = act(rich, { type: 'unlockIsland' })
    expect(placing.placementStart(st, terra, 5, 'home', null).island).toBe('home')
    expect(placing.placementStart(st, terra, 5, 'isle2', null).island).toBe('isle2')
    const none = fill(rich, 'home')
    expect(placing.placementStart(none, terra, 5, 'home', null)).toEqual({ island: 'home' })
  })

  it('a move stays where the building is, and starts from no suggested cell', () => {
    const from = base.habitats[0]!.placement
    expect(placing.placementStart(base, { kind: 'move', target: h1 }, 5, 'isle2', null, from)).toEqual({ island: 'home' })
  })
})

describe('ShopPanel tabs', () => {
  it('has Build and Store tabs, Build first', async () => {
    harness(base).wrap(<ShopPanel onPlace={vi.fn()} view="home" nowMs={0} />)
    const tabs = screen.getAllByRole('tab')
    expect(tabs.map(t => t.textContent)).toEqual(['Build', 'Store'])
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByTestId('shop-habitats')).toBeInTheDocument()
    await userEvent.click(tabs[1]!)
    expect(tabs[1]).toHaveAttribute('aria-selected', 'true')
    expect(screen.queryByTestId('shop-habitats')).toBeNull()
    expect(screen.getByRole('button', { name: /food pack/i })).toBeInTheDocument()
  })

  it('opens on the Store tab when asked', () => {
    harness(base).wrap(<ShopPanel tab="store" onPlace={vi.fn()} view="home" nowMs={0} />)
    expect(screen.getByRole('tab', { name: 'Store' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.queryByTestId('shop-habitats')).toBeNull()
  })

  it('opens on the Store tab from a shop dialog key with tab: store', () => {
    harness(base).wrap(<TestHost bridge={createBridge()} initial={{ kind: 'panel', id: 'shop', tab: 'store' }} />)
    expect(screen.getByRole('tab', { name: 'Store' })).toHaveAttribute('aria-selected', 'true')
  })
})

describe('ShopPanel Store tab', () => {
  const store = (s: PlayerState, extra: Partial<Parameters<typeof ShopPanel>[0]> = {}) => {
    const onPlace = vi.fn()
    const h = harness(s)
    h.wrap(<ShopPanel tab="store" onPlace={onPlace} view="home" nowMs={0} {...extra} />)
    return { ...h, onPlace }
  }

  it('prices the food pack in USD and buys it', async () => {
    const { action } = store(base)
    expect(screen.getByRole('button', { name: /food pack/i })).toHaveTextContent('$0.50')
    await userEvent.click(screen.getByRole('button', { name: /food pack/i }))
    expect(action).toHaveBeenCalledWith({ type: 'buy', item: { kind: 'foodPack' } }, expect.any(String))
  })

  it('lists only level 4 habitats and farms with their L5 price, and buys them', async () => {
    const { action } = store(l4())
    const hab = screen.getByRole('button', { name: /level 5.*terra habitat/i })
    expect(hab).toHaveTextContent('$1.50')
    const farm = screen.getByRole('button', { name: /level 5.*farm plot 1/i })
    expect(farm).toHaveTextContent('$2.00')
    expect(screen.queryByRole('button', { name: /level 5.*(flame|sea) habitat/i })).toBeNull()
    await userEvent.click(hab)
    expect(action).toHaveBeenLastCalledWith({ type: 'buy', item: { kind: 'habitatL5', habitatId: 'h1' } }, expect.any(String))
    await userEvent.click(farm)
    expect(action).toHaveBeenLastCalledWith({ type: 'buy', item: { kind: 'farmL5', index: 0 } }, expect.any(String))
  })

  it('offers no L5 upgrades when nothing is at level 4', () => {
    store(base)
    expect(screen.queryByRole('button', { name: /level 5/i })).toBeNull()
  })

  it('lists the Hatchery fifth slot and Grove level 3 under Level 5 upgrades only when priced, and buys them', async () => {
    const grove = { ...base.breeders[0]!, kind: 'grove' as const, level: 2 }
    const { action } = store({ ...base, level: 25, breeders: [grove] })
    const level5 = screen.getByTestId('shop-level5')
    expect(within(level5).getByRole('heading')).toHaveTextContent('Level 5 upgrades')
    const slot = within(level5).getByRole('button', { name: 'Hatchery · 5th slot · $3.00' })
    const l3 = within(level5).getByRole('button', { name: 'Grove · Level 3 · $3.50' })
    await userEvent.click(slot)
    expect(action).toHaveBeenLastCalledWith({ type: 'buy', item: { kind: 'hatcheryL5' } }, expect.any(String))
    await userEvent.click(l3)
    expect(action).toHaveBeenLastCalledWith({ type: 'buy', item: { kind: 'groveL3', index: 0 } }, expect.any(String))
  })

  it('hides the fifth slot below PL 15 and once it is bought, and Grove level 3 unless the Grove is level 2', () => {
    store({ ...base, level: 14, breeders: [{ ...base.breeders[0]!, kind: 'grove' as const, level: 2 }] })
    expect(screen.queryByRole('button', { name: /5th slot/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /Grove · Level 3/ })).toBeNull()
    cleanup()
    store({ ...base, level: 15, hatcheryFifthSlot: true, breeders: [{ ...base.breeders[0]!, kind: 'grove' as const, level: 2 }] })
    expect(screen.queryByRole('button', { name: /5th slot/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /Grove · Level 3/ })).toBeNull()
  })

  it('starts placing the Golden Aerie for $5.00', async () => {
    const { onPlace, action } = store(base)
    const aerie = screen.getByRole('button', { name: /golden aerie/i })
    expect(aerie).toHaveTextContent('$5.00')
    await userEvent.click(aerie)
    expect(onPlace).toHaveBeenCalledWith({ kind: 'goldenAerie' }, 5)
    expect(action).not.toHaveBeenCalled() // paid on Confirm, not here
  })

  it('hides the Golden Aerie row once the player owns one, and words the error', () => {
    const aerie = { id: 'h9', element: 'aerie' as const, level: 5, lastCollectedMs: 0, placement: { island: 'home' as const, col: 6, row: 7, facing: 0 as const } }
    store({ ...base, habitats: [...base.habitats, aerie] })
    expect(screen.queryByRole('button', { name: /golden aerie/i })).toBeNull()
    expect(messageFor('AERIE_EXISTS')).toBe('You already own a Golden Aerie.')
  })

  it('lists running timers with a skip price and buys the skip', async () => {
    const s = { ...base, constructions: [{ kind: 'upgrade' as const, building: h1, readyAtMs: 600_000 }] }
    const { action } = store(s)
    await userEvent.click(screen.getByRole('button', { name: /Skip.*\$0\.03/ }))
    expect(action).toHaveBeenCalledWith({ type: 'buy', item: { kind: 'skip', target: 'construction', index: 0 } }, expect.any(String))
  })
})

describe('UpgradeSection level 5', () => {
  it('points an L4 habitat and an L4 farm to the Store, and a true L5 says Max level', () => {
    const s = l4()
    const a = harness(s).wrap(<UpgradeSection building={h1} nowMs={0} />)
    expect(screen.getByText('Level 5 in the Store')).toBeInTheDocument()
    expect(screen.queryByText('Max level')).toBeNull()
    a.unmount()
    const b = harness(s).wrap(<UpgradeSection building={{ type: 'farm', index: 0 }} nowMs={0} />)
    expect(screen.getByText('Level 5 in the Store')).toBeInTheDocument()
    b.unmount()
    const l5 = { ...s, habitats: s.habitats.map(h => (h.id === 'h1' ? { ...h, level: 5 } : h)) }
    harness(l5).wrap(<UpgradeSection building={h1} nowMs={0} />)
    expect(screen.getByText('Max level')).toBeInTheDocument()
    expect(screen.queryByText('Level 5 in the Store')).toBeNull()
  })
})

describe('UpgradeSection', () => {
  it('shows the next level, then the timer and skip; finishing is left to the app-level finisher', async () => {
    const { wrap, action, setState } = harness({ ...base, gold: 25_000 })
    const r = wrap(<UpgradeSection building={h1} nowMs={0} />)
    expect(screen.getByText('Level 1')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Upgrade to 2 · 10,000 gold · 10m/ })).toBeEnabled()

    setState({ ...base, gold: 4_000, constructions: [{ kind: 'upgrade', building: h1, readyAtMs: 600_000 }] })
    r.rerender(<UpgradeSection building={h1} nowMs={0} />)
    expect(screen.getByRole('button', { name: /Skip · \$0\.03$/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Upgrade to/ })).toBeNull()
    expect(action).not.toHaveBeenCalled()

    r.rerender(<UpgradeSection building={h1} nowMs={600_000} />)
    expect(screen.getByRole('button', { name: 'Finish' })).toBeInTheDocument()
    r.rerender(<UpgradeSection building={h1} nowMs={601_000} />)
    expect(action).not.toHaveBeenCalled()
  })

  it('starts an upgrade and a construction skip', async () => {
    const { wrap, action } = harness({ ...base, gold: 25_000 })
    const r = wrap(<UpgradeSection building={h1} nowMs={0} />)
    await userEvent.click(screen.getByRole('button', { name: /Upgrade to 2/ }))
    expect(action).toHaveBeenCalledWith({ type: 'startUpgrade', building: h1 }, expect.any(String))
    r.unmount()
    const busy = harness({ ...base, constructions: [{ kind: 'upgrade', building: h1, readyAtMs: 600_000 }] })
    busy.wrap(<UpgradeSection building={h1} nowMs={0} />)
    await userEvent.click(screen.getByRole('button', { name: /Skip/ }))
    expect(busy.action).toHaveBeenCalledWith({ type: 'buy', item: { kind: 'skip', target: 'construction', index: 0 } }, expect.any(String))
  })

  it('explains why an upgrade is blocked', () => {
    const why = (s: PlayerState, ref: Parameters<typeof UpgradeSection>[0]['building'] = h1) => {
      const r = harness(s).wrap(<UpgradeSection building={ref} nowMs={0} />)
      const b = screen.getByRole('button', { name: /Upgrade to/ })
      expect(b).toBeDisabled()
      const d = b.getAttribute('aria-describedby')
      const text = d ? document.getElementById(d)?.textContent : ''
      r.unmount()
      return text
    }
    expect(why({ ...base, gold: 10 })).toBe('Not enough gold')
    expect(why({ ...base, gold: 99_999 }, { type: 'breeder', index: 0 })).toBe('Needs player level 10')
    const c1 = { kind: 'upgrade', building: { type: 'farm', index: 0 }, readyAtMs: 9 } as const
    const c2 = { kind: 'upgrade', building: { type: 'farm', index: 1 }, readyAtMs: 9 } as const
    expect(why({ ...base, gold: 25_000, constructions: [c1, c2] })).toBe('Both builders are busy')
  })

  it('shows Max level at the top', () => {
    const { wrap } = harness({ ...base, hatcheryLevel: 4 })
    wrap(<UpgradeSection building={{ type: 'hatchery' }} nowMs={0} />)
    expect(screen.getByText('Level 4')).toBeInTheDocument()
    expect(screen.getByText('Max level')).toBeInTheDocument()
  })

  it('moves from the current spot and turns by one facing step', async () => {
    const start = vi.fn()
    const s = { ...base, habitats: base.habitats.map(h => (h.id === 'h1' ? { ...h, placement: { ...h.placement, facing: 3 as const } } : h)) }
    const { wrap, action } = harness(s)
    wrap(<StartPlacingProvider value={start}><UpgradeSection building={h1} nowMs={0} /></StartPlacingProvider>)
    await userEvent.click(screen.getByRole('button', { name: 'Move' }))
    expect(start).toHaveBeenCalledWith({ kind: 'move', target: h1 }, 5, s.habitats[0]!.placement)
    await userEvent.click(screen.getByRole('button', { name: 'Turn' }))
    expect(action).toHaveBeenCalledWith({ type: 'moveBuilding', target: h1, placement: { ...s.habitats[0]!.placement, facing: 0 } }, expect.any(String))
  })
})

describe('Finish button and upgrades that keep working', () => {
  it('offers a manual Finish once the timer is up', async () => {
    const { wrap, action } = harness({ ...base, constructions: [{ kind: 'upgrade', building: h1, readyAtMs: 100 }] })
    const r = wrap(<UpgradeSection building={h1} nowMs={0} />)
    expect(screen.queryByRole('button', { name: 'Finish' })).toBeNull()
    r.rerender(<UpgradeSection building={h1} nowMs={100} />)
    expect(action).not.toHaveBeenCalled() // panels never send on their own
    await userEvent.click(screen.getByRole('button', { name: 'Finish' }))
    expect(action).toHaveBeenCalledTimes(1)
    expect(action).toHaveBeenLastCalledWith({ type: 'finishConstruction', index: 0 }, expect.any(String))
  })

  it('lets dragons move into a habitat that is only being upgraded', async () => {
    const waiting = { ...base, dragons: [...base.dragons, { id: 'd9', speciesId: 'terra', level: 1, feeds: 0, habitatId: null }], constructions: [{ kind: 'upgrade' as const, building: h1, readyAtMs: 99 }] }
    harness(waiting).wrap(<HabitatPanel habitatId="h1" nowMs={0} />)
    expect(screen.getByRole('button', { name: /d9/ })).toBeEnabled()
  })

  it('plots under upgrade can be planted but unfinished ones cannot', () => {
    const farm0 = { type: 'farm' as const, index: 0 }
    const up = harness({ ...base, constructions: [{ kind: 'upgrade', building: farm0, readyAtMs: 99 }] })
    const r = up.wrap(<FarmPanel index={0} nowMs={0} />)
    expect(screen.getByRole('button', { name: /Dragon Bush/ })).toBeEnabled()
    r.unmount()
    harness({ ...base, constructions: [{ kind: 'build', building: farm0, readyAtMs: 99 }] }).wrap(<FarmPanel index={0} nowMs={0} />)
    expect(screen.getByRole('button', { name: /Dragon Bush/ })).toBeDisabled()
  })
})

describe('Hatchery and breeder upgrades', () => {
  it('has an upgrade section for the hatchery and for each breeder', () => {
    const { wrap } = harness({ ...base, level: 12, gold: 200_000 })
    const hatchery = wrap(<HatcheryPanel nowMs={0} />)
    const hup = screen.getByRole('button', { name: /Upgrade to 2/ })
    expect(hup.textContent).toContain('2,000 gold · 10m')
    expect(hup).toBeEnabled()
    hatchery.unmount()
    harness({ ...base, level: 12, gold: 200_000 }, 0, undefined, { launchAtMs: 0 }).wrap(<BreedPanel nowMs={0} />)
    const bup = screen.getByRole('button', { name: /Upgrade to 2/ })
    expect(bup.textContent).toContain('150,000 gold · 10m')
    expect(bup).toBeEnabled()
  })
})

describe('PanelHost targets', () => {
  it('maps a decoration target to Move, Turn and Remove', async () => {
    const bridge = createBridge()
    const deco = { id: 'c3', kind: 'flowerPatch' as const, placement: { island: 'home' as const, col: 7, row: 7, facing: 0 as const } }
    const { wrap, action } = harness({ ...base, decorations: [deco] })
    wrap(<TestHost bridge={bridge} />)
    bridge.emit({ type: 'select', target: { kind: 'decoration', id: 'c3' } })
    await userEvent.click(await screen.findByRole('button', { name: /Remove · \+12 gold/ }))
    expect(action).not.toHaveBeenCalled() // first click only asks
    await userEvent.click(screen.getByRole('button', { name: /Confirm remove · \+12 gold/ }))
    expect(action).toHaveBeenCalledWith({ type: 'removeDecoration', id: 'c3' }, expect.any(String))
    expect(screen.getByRole('button', { name: 'Move' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Turn' })).toBeInTheDocument()
  })

  it('opens the Hatchery panel for the hatchery building', async () => {
    const bridge = createBridge()
    const { wrap } = harness(base)
    wrap(<TestHost bridge={bridge} />)
    bridge.emit({ type: 'select', target: { kind: 'hatcheryBuilding' } })
    expect(await screen.findByRole('region', { name: /hatchery/i })).toBeInTheDocument()
  })

  it('opens the Shop as a named panel on its Build tab', () => {
    const { wrap } = harness(base)
    wrap(<TestHost bridge={createBridge()} initial={{ kind: 'panel', id: 'shop' }} />)
    expect(screen.getByTestId('shop-habitats')).toBeInTheDocument()
  })
})

describe('error copy', () => {
  it('has human text for the building errors', () => {
    expect(messageFor('OVERLAP')).toBe('Something is already there.')
    expect(messageFor('OUT_OF_BOUNDS')).toBe('That spot is off the island.')
    expect(messageFor('BUILDERS_BUSY')).toBe('Both builders are busy. Finish or skip a build first.')
    expect(messageFor('MAX_EXPANSION')).toBe('The home island is at its full size.')
    for (const c of ['ISLAND_LOCKED', 'MAX_ISLAND', 'WRONG_ISLAND', 'UNDER_CONSTRUCTION', 'NO_LEGENDARY']) expect(messageFor(c)).not.toBe(c)
  })
})
