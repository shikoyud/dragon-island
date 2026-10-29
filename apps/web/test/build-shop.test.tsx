import { newPlayer, type PlayerState } from '@wyrmhaven/game-core'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { messageFor } from '../src/api/errors'
import { createBridge } from '../src/game/bridge'
import { BuildShopPanel } from '../src/panels/BuildShopPanel'
import { FarmPanel } from '../src/panels/FarmPanel'
import { HabitatPanel } from '../src/panels/HabitatPanel'
import { NestsPanel } from '../src/panels/NestsPanel'
import { PanelHost } from '../src/panels/PanelHost'
import { UpgradeSection } from '../src/panels/UpgradeSection'
import { StartPlacingProvider } from '../src/state/startPlacing'
import { harness } from './harness'

const base = newPlayer(0)
const h1 = { type: 'habitat', id: 'h1' } as const

describe('BuildShopPanel', () => {
  it('lists categories, locks by level and starts placement', async () => {
    const onPlace = vi.fn()
    const { wrap } = harness({ ...base, level: 3 })
    wrap(<BuildShopPanel onPlace={onPlace} view="home" />)
    for (const c of ['habitats', 'farming', 'breeding', 'hoard', 'decorations']) expect(screen.getByTestId(`shop-${c}`)).toBeInTheDocument()
    const hay = screen.getByRole('button', { name: /Hay cart/ })
    expect(hay).toBeDisabled()
    expect(hay).toHaveAccessibleDescription(/Level 6/)
    expect(screen.getByRole('button', { name: /fire habitat/i })).toBeDisabled() // limit 2 at level 3
    await userEvent.click(screen.getByRole('button', { name: /Flower patch/ }))
    expect(onPlace).toHaveBeenCalledWith({ kind: 'decoration', decoration: 'flowerPatch' }, 1)
  })

  it('enables habitats while under the limit', () => {
    const { wrap } = harness({ ...base, level: 7 })
    wrap(<BuildShopPanel onPlace={vi.fn()} view="home" />)
    expect(screen.getByRole('button', { name: /earth habitat/i })).toBeEnabled() // limit 3 at level 7
  })

  it('names the next multiple of 5 when the habitat limit is reached', () => {
    const { wrap } = harness({ ...base, level: 3 })
    wrap(<BuildShopPanel onPlace={vi.fn()} view="home" />)
    expect(screen.getByRole('button', { name: /fire habitat/i })).toHaveAccessibleDescription('Reach level 5 for another habitat')
  })

  it('starts habitats, farm plots, nests and the Hoard with their footprints', async () => {
    const onPlace = vi.fn()
    const { wrap } = harness({ ...base, level: 5, gold: 100_000 })
    wrap(<BuildShopPanel onPlace={onPlace} view="home" />)
    await userEvent.click(screen.getByRole('button', { name: /earth habitat/i }))
    expect(onPlace).toHaveBeenLastCalledWith({ kind: 'habitat', element: 'earth' }, 5)
    await userEvent.click(within(screen.getByTestId('shop-farming')).getByRole('button'))
    expect(onPlace).toHaveBeenLastCalledWith({ kind: 'farm' }, 2)
    await userEvent.click(within(screen.getByTestId('shop-breeding')).getByRole('button'))
    expect(onPlace).toHaveBeenLastCalledWith({ kind: 'nest' }, 2)
    await userEvent.click(within(screen.getByTestId('shop-hoard')).getByRole('button'))
    expect(onPlace).toHaveBeenLastCalledWith({ kind: 'hoard' }, 4)
  })

  it('offers Dawnspire-only items and the Nexus only on Dawnspire', () => {
    const rich = { ...base, level: 45, gold: 5_000_000 }
    const r = harness(rich).wrap(<BuildShopPanel onPlace={vi.fn()} view="home" />)
    expect(screen.queryByRole('button', { name: /Star pool/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /Nexus/ })).toBeNull()
    r.unmount()
    harness(rich).wrap(<BuildShopPanel onPlace={vi.fn()} view="dawnspire" />)
    expect(screen.getByRole('button', { name: /Star pool/ })).toBeEnabled()
    expect(screen.getByRole('button', { name: /Nexus/ })).toBeEnabled()
  })
})

describe('UpgradeSection', () => {
  it('shows the next level, then the timer and skip, then auto-finishes once', async () => {
    const { wrap, action, setState } = harness({ ...base, gold: 5_000 })
    const r = wrap(<UpgradeSection building={h1} nowMs={0} />)
    expect(screen.getByText('Level 1')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Upgrade to 2 · 1,000 gold · 10m/ })).toBeEnabled()

    setState({ ...base, gold: 4_000, constructions: [{ kind: 'upgrade', building: h1, readyAtMs: 600_000 }] })
    r.rerender(<UpgradeSection building={h1} nowMs={0} />)
    expect(screen.getByRole('button', { name: /Skip · \$0\.10/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Upgrade to/ })).toBeNull()
    expect(action).not.toHaveBeenCalled()

    r.rerender(<UpgradeSection building={h1} nowMs={600_000} />)
    await waitFor(() => expect(action).toHaveBeenCalledWith({ type: 'finishConstruction', index: 0 }, expect.any(String)))
    r.rerender(<UpgradeSection building={h1} nowMs={601_000} />)
    r.rerender(<UpgradeSection building={h1} nowMs={602_000} />)
    expect(action).toHaveBeenCalledTimes(1)
  })

  it('starts an upgrade and a construction skip', async () => {
    const { wrap, action } = harness({ ...base, gold: 5_000 })
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
    expect(why({ ...base, gold: 99_999 }, { type: 'nest', index: 0 })).toBe('Needs player level 12')
    const c1 = { kind: 'upgrade', building: { type: 'farm', index: 0 }, readyAtMs: 9 } as const
    const c2 = { kind: 'upgrade', building: { type: 'farm', index: 1 }, readyAtMs: 9 } as const
    expect(why({ ...base, gold: 5_000, constructions: [c1, c2] })).toBe('Both builders are busy')
  })

  it('shows Max level at the top', () => {
    const { wrap } = harness({ ...base, hatcheryLevel: 3 })
    wrap(<UpgradeSection building={{ type: 'hatchery' }} nowMs={0} />)
    expect(screen.getByText('Level 3')).toBeInTheDocument()
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
    await waitFor(() => expect(action).toHaveBeenCalledTimes(1)) // the one automatic attempt
    await userEvent.click(screen.getByRole('button', { name: 'Finish' }))
    expect(action).toHaveBeenCalledTimes(2)
    expect(action).toHaveBeenLastCalledWith({ type: 'finishConstruction', index: 0 }, expect.any(String))
  })

  it('lets dragons move into a habitat that is only being upgraded', async () => {
    const waiting = { ...base, dragons: [...base.dragons, { id: 'd9', speciesId: 'fire', level: 1, habitatId: null }], constructions: [{ kind: 'upgrade' as const, building: h1, readyAtMs: 99 }] }
    harness(waiting).wrap(<HabitatPanel habitatId="h1" nowMs={0} />)
    expect(screen.getByRole('button', { name: /d9/ })).toBeEnabled()
  })

  it('plots under upgrade can be planted but unfinished ones cannot', () => {
    const farm0 = { type: 'farm' as const, index: 0 }
    const up = harness({ ...base, constructions: [{ kind: 'upgrade', building: farm0, readyAtMs: 99 }] })
    const r = up.wrap(<FarmPanel nowMs={0} />)
    expect(screen.getAllByRole('button', { name: /^plant$/i })[0]).toBeEnabled()
    r.unmount()
    harness({ ...base, constructions: [{ kind: 'build', building: farm0, readyAtMs: 99 }] }).wrap(<FarmPanel nowMs={0} />)
    expect(screen.getAllByRole('button', { name: /^plant$/i })[0]).toBeDisabled()
  })
})

describe('NestsPanel upgrades', () => {
  it('has an upgrade section for the hatchery and each nest', () => {
    const { wrap } = harness({ ...base, level: 12, gold: 100_000 })
    wrap(<NestsPanel nowMs={0} />)
    const ups = screen.getAllByRole('button', { name: /Upgrade to 2/ })
    expect(ups.map(b => b.textContent)).toEqual([expect.stringContaining('15,000 gold · 2h'), expect.stringContaining('12,000 gold · 2h')])
    ups.forEach(b => expect(b).toBeEnabled())
  })
})

describe('PanelHost targets', () => {
  it('maps a decoration target to Move, Turn and Remove', async () => {
    const bridge = createBridge()
    const deco = { id: 'c3', kind: 'flowerPatch' as const, placement: { island: 'home' as const, col: 7, row: 7, facing: 0 as const } }
    const { wrap, action } = harness({ ...base, decorations: [deco] })
    wrap(<PanelHost bridge={bridge} nowMs={0} named={null} onCloseNamed={() => {}} />)
    bridge.emit({ type: 'select', target: { kind: 'decoration', id: 'c3' } })
    await userEvent.click(await screen.findByRole('button', { name: /Remove · \+12 gold/ }))
    expect(action).toHaveBeenCalledWith({ type: 'removeDecoration', id: 'c3' }, expect.any(String))
    expect(screen.getByRole('button', { name: 'Move' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Turn' })).toBeInTheDocument()
  })

  it('opens the Nests panel for the hatchery building', async () => {
    const bridge = createBridge()
    const { wrap } = harness(base)
    wrap(<PanelHost bridge={bridge} nowMs={0} named={null} onCloseNamed={() => {}} />)
    bridge.emit({ type: 'select', target: { kind: 'hatcheryBuilding' } })
    expect(await screen.findByRole('region', { name: /nests/i })).toBeInTheDocument()
  })

  it('opens the Build shop as a named panel', () => {
    const { wrap } = harness(base)
    wrap(<PanelHost bridge={createBridge()} nowMs={0} named="build" onCloseNamed={() => {}} />)
    expect(screen.getByTestId('shop-habitats')).toBeInTheDocument()
  })
})

describe('error copy', () => {
  it('has human text for the building errors', () => {
    expect(messageFor('OVERLAP')).toBe('Something is already there.')
    expect(messageFor('OUT_OF_BOUNDS')).toBe('That spot is off the island.')
    expect(messageFor('BUILDERS_BUSY')).toBe('Both builders are busy. Finish or skip a build first.')
    expect(messageFor('MAX_EXPANSION')).toBe('The home island is at its full size.')
    for (const c of ['ISLAND_LOCKED', 'MAX_ISLAND', 'WRONG_ISLAND', 'UNDER_CONSTRUCTION', 'NO_LEGENDARY', 'NEXUS_EXISTS']) expect(messageFor(c)).not.toBe(c)
  })
})
