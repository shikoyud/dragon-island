import { newPlayer, type PlayerState } from '@wyrmhaven/game-core'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createBridge } from '../src/game/bridge'
import { buildIslandModel } from '../src/game/islandModel'
import { FALLBACK_ART } from '../src/art/slots'
import { DragonPanel } from '../src/panels/DragonPanel'
import { RoostPanel } from '../src/panels/RoostPanel'
import { ShopPanel } from '../src/panels/ShopPanel'
import { StartPlacingProvider } from '../src/state/startPlacing'
import { LAUNCH_CATALOG } from '@wyrmhaven/game-core'
import { harness, openInfo, TestHost } from './harness'
import { FREE, FREE_2 } from './land'

const base = newPlayer(0)
const AT = FREE
const roosted = (tier: number, over: Partial<PlayerState> = {}): PlayerState => ({ ...base, roostPlacement: AT, roostTier: tier, level: 30, gold: 50_000_000, ...over })
const maxed = (s: PlayerState): PlayerState => ({ ...s, dragons: s.dragons.map(d => d.id === 'd1' ? { ...d, level: s.roostTier === 0 ? 7 : 10 } : d) })

describe('RoostPanel', () => {
  it('shows the tier, the cap and the next tier with its cost', () => {
    harness(roosted(2)).wrap(<RoostPanel nowMs={0} />)
    expect(screen.getByText('Tier 2 · cap 15')).toBeInTheDocument()
    expect(screen.getByText(/Next: Tier 3 · cap 20 · 400,000 gold/)).toBeInTheDocument()
  })

  it('upgrades Tiers 2 to 4 with startUpgrade', async () => {
    const { wrap, action } = harness(roosted(1, { level: 10, gold: 75_000 }))
    wrap(<RoostPanel nowMs={0} />)
    await userEvent.click(screen.getByRole('button', { name: /Upgrade to Tier 2 · 75,000 gold/ }))
    expect(action).toHaveBeenCalledWith({ type: 'startUpgrade', building: { type: 'roost' } }, expect.any(String))
  })

  it('names the reason when the upgrade is out of reach', () => {
    harness(roosted(1, { level: 9 })).wrap(<RoostPanel nowMs={0} />)
    const up = screen.getByRole('button', { name: /Upgrade to Tier 2/ })
    expect(up).toBeDisabled()
    expect(up).toHaveAccessibleDescription('Needs player level 10')
  })

  it('shows Tier 5 as 10,000,000 gold + $2.00 and sends the Ascension purchase', async () => {
    const { wrap, action } = harness(roosted(4))
    wrap(<RoostPanel nowMs={0} />)
    expect(screen.getByText(/Next: Tier 5 · cap 40 · 10,000,000 gold \+ \$2\.00/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Ascend · 10,000,000 gold \+ \$2\.00/ }))
    expect(action).toHaveBeenCalledWith({ type: 'buy', item: { kind: 'ascension' } }, expect.any(String))
  })

  it('disables Ascension below PL 30 or without the Gold', () => {
    harness(roosted(4, { level: 29 })).wrap(<RoostPanel nowMs={0} />)
    expect(screen.getByRole('button', { name: /Ascend/ })).toHaveAccessibleDescription('Needs player level 30')
  })

  it('disables Ascension without the 10,000,000 Gold', () => {
    harness(roosted(4, { gold: 9_999_999 })).wrap(<RoostPanel nowMs={0} />)
    expect(screen.getByRole('button', { name: /Ascend/ })).toHaveAccessibleDescription('Not enough gold')
  })

  it('shows the construction timer while a tier is building, and Max tier at Tier 5', () => {
    const building = { kind: 'upgrade' as const, building: { type: 'roost' as const }, readyAtMs: 60_000 }
    const { unmount } = harness(roosted(4, { constructions: [building] })).wrap(<RoostPanel nowMs={0} />)
    expect(screen.getByText(/Upgrading to Tier 5/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Ascend/ })).toBeNull()
    unmount()
    harness(roosted(5)).wrap(<RoostPanel nowMs={0} />)
    expect(screen.getByText('Tier 5 · cap 40')).toBeInTheDocument()
    expect(screen.getByText('Max tier')).toBeInTheDocument()
  })

  it('renders nothing before the Roost is built', () => {
    harness(base).wrap(<RoostPanel nowMs={0} />)
    expect(screen.queryByRole('region')).toBeNull()
  })
})

describe('DragonPanel Upgrade Roost', () => {
  it('opens the Roost when it is built', async () => {
    const onOpen = vi.fn()
    harness(maxed(roosted(1))).wrap(<DragonPanel dragonId="d1" onOpen={onOpen} />)
    await userEvent.click(screen.getByRole('button', { name: /upgrade roost/i }))
    expect(onOpen).toHaveBeenCalledWith({ kind: 'upgrade', target: { type: 'roost' } })
  })

  it('opens the Shop Build tab when there is no Roost yet', async () => {
    const onOpen = vi.fn()
    harness(maxed(base)).wrap(<DragonPanel dragonId="d1" onOpen={onOpen} />)
    await userEvent.click(screen.getByRole('button', { name: /upgrade roost/i }))
    expect(onOpen).toHaveBeenCalledWith({ kind: 'panel', id: 'shop', tab: 'build' })
  })
})

describe('Shop Build tab Roost row', () => {
  const row = () => within(screen.getByTestId('shop-roost')).getByRole('button', { name: /Dragon Roost/ })

  it('is locked below PL 5, then starts placement on its 4x4 footprint', async () => {
    const onPlace = vi.fn()
    const low = harness({ ...base, level: 4, gold: 5_000 }).wrap(<ShopPanel onPlace={onPlace} view="home" nowMs={0} />)
    expect(row()).toBeDisabled()
    expect(row()).toHaveAccessibleDescription('Level 5')
    low.unmount()
    harness({ ...base, level: 5, gold: 5_000 }).wrap(<ShopPanel onPlace={onPlace} view="home" nowMs={0} />)
    expect(row()).toHaveTextContent('5,000 gold')
    await userEvent.click(row())
    expect(onPlace).toHaveBeenCalledWith({ kind: 'roost' }, 4)
  })

  it('says Already built once it stands', () => {
    harness(roosted(1)).wrap(<ShopPanel onPlace={vi.fn()} view="home" nowMs={0} />)
    expect(row()).toBeDisabled()
    expect(row()).toHaveAccessibleDescription('Already built')
  })
})

describe('Roost on the island', () => {
  it('draws the Roost with the nest placeholder, selectable, and as a ghost', () => {
    const s = roosted(1)
    const m = buildIslandModel(s, FALLBACK_ART, LAUNCH_CATALOG, 0, 'home', null)
    const roost = m.objects.find(o => o.id === 'roost')!
    expect(roost.target).toEqual({ kind: 'roost' })
    expect(roost.key).toBe(buildIslandModel(s, FALLBACK_ART, LAUNCH_CATALOG, 0, 'home', { what: { kind: 'roost' }, size: 4, col: FREE_2.col, row: FREE_2.row, facing: 0 }).objects.find(o => o.id === 'ghost')!.key)
    const moving = buildIslandModel(s, FALLBACK_ART, LAUNCH_CATALOG, 0, 'home', { what: { kind: 'move', target: { type: 'roost' } }, size: 4, col: FREE_2.col, row: FREE_2.row, facing: 0 })
    expect(moving.markers.ghost).toEqual({ legal: true, col: FREE_2.col, row: FREE_2.row, size: 4 })
    expect(buildIslandModel(base, FALLBACK_ART, LAUNCH_CATALOG, 0, 'home', null).objects.find(o => o.id === 'roost')).toBeUndefined()
  })

  it('tapping the Roost opens the RoostPanel', async () => {
    const bridge = createBridge()
    const { wrap } = harness(roosted(2))
    wrap(<StartPlacingProvider value={vi.fn()}><TestHost bridge={bridge} /></StartPlacingProvider>)
    openInfo(bridge, { kind: 'roost' })
    expect(await screen.findByText('Tier 2 · cap 15')).toBeInTheDocument()
  })
})
