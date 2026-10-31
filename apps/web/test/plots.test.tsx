import { ISLAND_TILES, LAUNCH_CATALOG, newPlayer, plotOfTile, plotOrigin, type IslandId, type PlayerState } from '@wyrmhaven/game-core'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { messageFor } from '../src/api/errors'
import { artSetFromManifest } from '../src/art/fromManifest'
import { FALLBACK_ART } from '../src/art/slots'
import { createBridge, type Placing } from '../src/game/bridge'
import { cameraBounds, groundCell, lockedTiles, shownSize } from '../src/game/camera'
import { buildIslandModel } from '../src/game/islandModel'
import { cellCentre, cellTop, islandBox } from '../src/game/layout'
import { levelUnlockLines } from '../src/hud/hudModel'
import { MapIslandPanel } from '../src/panels/MapIslandPanel'
import { PlotPanel } from '../src/panels/PlotPanel'
import { placingAction, placementStart } from '../src/state/placing'
import { harness, TestHost } from './harness'
import { withPlots } from './land'

const base = newPlayer(0)
const model = (s: PlayerState, view: IslandId = 'home', placing: Placing | null = null) => buildIslandModel(s, FALLBACK_ART, LAUNCH_CATALOG, 0, view, placing)

describe('fog and ground on 32x32 (R43, R58)', () => {
  it('lockedTiles lists every tile not on an owned plot', () => {
    const tiles = lockedTiles(base, 'home')
    expect(tiles).toHaveLength(ISLAND_TILES * ISLAND_TILES - 4 * 64)
    for (const t of tiles) expect([5, 6, 9, 10]).not.toContain(plotOfTile(t.col, t.row))
    expect(lockedTiles(null, 'home')).toEqual([])
    expect(lockedTiles(withPlots(base, Array.from({ length: 16 }, (_, i) => i)), 'home')).toEqual([])
  })
  it('groundCell returns tiles anywhere on 32x32, so a red ghost can go over fog', () => {
    const at = (col: number, row: number) => { const c = cellCentre(col, row); return groundCell(base, c.x, c.y) }
    expect(at(0, 0)).toEqual({ col: 0, row: 0 })
    expect(at(31, 31)).toEqual({ col: 31, row: 31 })
    expect(at(32, 0)).toBeNull()
    expect(groundCell(null, 0, 4)).toBeNull()
  })
  it('the shown size is always 32x32', () => {
    expect(shownSize()).toEqual({ w: 32, h: 32 })
    expect(cameraBounds().w).toBeGreaterThan(islandBox(32, 32).w)
  })
})

describe('plot signs', () => {
  it('each unowned plot touching owned land yields one sign at its centre', () => {
    const { objects, markers } = model(base)
    const signs = objects.filter(o => o.id.startsWith('sign:'))
    expect(signs.map(o => o.id).sort()).toEqual([1, 2, 4, 7, 8, 11, 13, 14].map(p => `sign:${p}`).sort())
    expect(markers.signs.map(s => s.plot).sort((a, b) => a - b)).toEqual([1, 2, 4, 7, 8, 11, 13, 14])
    const four = objects.find(o => o.id === 'sign:4')!
    const o = plotOrigin(4)
    expect(four.target).toEqual({ kind: 'plot', island: 'home', plot: 4 })
    expect({ x: four.x, y: four.y }).toEqual(cellTop(o.col + 4, o.row + 4))
  })
  it('a plot bought loses its sign and opens the plots around it', () => {
    const { markers } = model(withPlots(base, [5, 6, 9, 10, 4]))
    expect(markers.signs.map(s => s.plot).sort((a, b) => a - b)).toEqual([0, 1, 2, 7, 8, 11, 13, 14])
  })
  it('a fully owned island has no signs', () => {
    expect(model(withPlots(base, Array.from({ length: 16 }, (_, i) => i))).markers.signs).toEqual([])
  })
  it('signs belong to the viewed island', () => {
    const s = withPlots({ ...base, islands: { ...base.islands, unlocked: ['home', 'isle2'] } }, [5], 'isle2')
    const four = model(s, 'isle2').objects.filter(o => o.id.startsWith('sign:'))
    expect(four.map(o => o.id).sort()).toEqual(['sign:1', 'sign:4', 'sign:6', 'sign:9'])
    expect(four[0]!.target).toMatchObject({ kind: 'plot', island: 'isle2' })
  })
  it('opens PlotPanel from the bridge', async () => {
    const bridge = createBridge()
    const { wrap } = harness({ ...base, level: 2 })
    wrap(<TestHost bridge={bridge} />)
    bridge.emit({ type: 'select', target: { kind: 'plot', island: 'home', plot: 4 } })
    expect(await screen.findByRole('button', { name: /Buy plot · 100 gold/ })).toBeInTheDocument()
  })
})

describe('art scale until it lands at final size (R61)', () => {
  const sheet = (w: number, h: number) => ({ file: 'x.png', w, h, frames: 1, fps: 0 })
  const draw = (assets: Record<string, ReturnType<typeof sheet>>, s: PlayerState = base) => buildIslandModel(s, artSetFromManifest('t', { assets }, LAUNCH_CATALOG), LAUNCH_CATALOG, 0, 'home', null).objects
  const ghost = (assets: Record<string, ReturnType<typeof sheet>>, what: Placing['what'], size: Placing['size']) =>
    buildIslandModel(base, artSetFromManifest('t', { assets }, LAUNCH_CATALOG), LAUNCH_CATALOG, 0, 'home', { what, size, col: 20, row: 12, facing: 0 }).objects.find(o => o.id === 'ghost')!

  it('an 80x64 habitat sheet draws at 0.8, a final 64-wide one at 1', () => {
    expect(draw({ 'habitat.terra': sheet(80, 64) }).find(o => o.id === 'habitat:h1')!.scale).toBe(0.8)
    expect(draw({ 'habitat.terra': sheet(64, 64) }).find(o => o.id === 'habitat:h1')!.scale).toBe(1)
  })
  it('a 32-wide Farm sheet draws at 1.5, a final 48-wide one at 1', () => {
    expect(draw({ 'building.farmPlot': sheet(32, 32) }).find(o => o.id === 'farm:0')!.scale).toBe(1.5)
    expect(draw({ 'building.farmPlot': sheet(48, 48) }).find(o => o.id === 'farm:0')!.scale).toBe(1)
  })
  it('the Golden Aerie draws at 0.8 on its own 80-wide sheet and on the Nexus fallback, and at 1 on a 64-wide sheet', () => {
    const aerie: PlayerState = { ...base, habitats: [...base.habitats, { ...base.habitats[0]!, id: 'a1', element: 'aerie', placement: { island: 'home', col: 20, row: 12, facing: 0 } }] }
    expect(draw({ 'building.goldenAerie': sheet(80, 64) }, aerie).find(o => o.id === 'habitat:a1')!.scale).toBe(0.8)
    expect(draw({ 'building.goldenAerie': sheet(64, 64) }, aerie).find(o => o.id === 'habitat:a1')!.scale).toBe(1)
    expect(draw({}, aerie).find(o => o.id === 'habitat:a1')!.scale).toBe(0.8) // the Nexus sheet is 80 wide
  })
  it('the ghost of a habitat, a farm, a moved Aerie and a purchase of one match', () => {
    expect(ghost({ 'habitat.terra': sheet(80, 64) }, { kind: 'habitat', element: 'terra' }, 4).scale).toBe(0.8)
    expect(ghost({ 'habitat.terra': sheet(64, 64) }, { kind: 'habitat', element: 'terra' }, 4).scale).toBe(1)
    expect(ghost({ 'building.farmPlot': sheet(32, 32) }, { kind: 'farm' }, 3).scale).toBe(1.5)
    expect(ghost({ 'building.farmPlot': sheet(48, 48) }, { kind: 'farm' }, 3).scale).toBe(1)
    expect(ghost({ 'building.goldenAerie': sheet(80, 64) }, { kind: 'goldenAerie' }, 4).scale).toBe(0.8)
  })
})

describe('the ghost agrees with the server on odd land (§5.5)', () => {
  const lShape = withPlots({ ...base, level: 12, gold: 1_000_000 }, [5, 6, 9, 10, 7])
  const grove: Placing = { what: { kind: 'grove' }, size: 5, col: 22, row: 15, facing: 0 }
  it('refuses a 5x5 over the notch of an L-shape', () => {
    expect(placingAction(lShape, 'home', grove)).toBeNull()
    expect(model(lShape, 'home', grove).markers.ghost).toMatchObject({ legal: false })
  })
  it('a straddling building is sent', () => {
    expect(placingAction(lShape, 'home', { what: { kind: 'habitat', element: 'terra' }, size: 4, col: 21, row: 12, facing: 0 })).toMatchObject({ type: 'placeBuilding' })
  })
  it('a new building opens on owned land, never on the 12x12 corner', () => {
    const { cell } = placementStart(base, { kind: 'farm' }, 3, 'home', null)
    expect([5, 6, 9, 10]).toContain(plotOfTile(cell!.col, cell!.row))
    const grove = placementStart(base, { kind: 'grove' }, 5, 'home', null)
    expect(placingAction(base, 'home', { what: { kind: 'grove' }, size: 5, ...grove.cell!, facing: 0 })).not.toBeNull()
  })
})

describe('PlotPanel', () => {
  it('buys the plot at the count\'s price, and closes', async () => {
    const onClose = vi.fn()
    const h = harness({ ...base, level: 2 })
    h.wrap(<PlotPanel island="home" plot={4} onClose={onClose} />)
    await userEvent.click(screen.getByRole('button', { name: /Buy plot · 100 gold/ }))
    expect(h.action).toHaveBeenCalledWith({ type: 'buyPlot', island: 'home', plot: 4 }, expect.any(String))
    expect(onClose).toHaveBeenCalled()
  })
  it('reads the level first, then the gold, in the handler\'s order', async () => {
    const third = withPlots({ ...base, level: 2, gold: 0 }, [5, 6, 9, 10, 4, 8])
    const { wrap, setState } = harness(third)
    wrap(<PlotPanel island="home" plot={7} />)
    expect(screen.getByRole('button', { name: /Buy plot · 1,500 gold/ })).toBeDisabled()
    expect(screen.getByText('Needs player level 3')).toBeInTheDocument()
    setState({ ...third, level: 3 })
    expect(await screen.findByText('Not enough gold')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Buy plot · 1,500 gold/ })).toBeDisabled()
  })
  it('has no level gate on an outer island (R47)', () => {
    const s = withPlots({ ...base, level: 12, gold: 100_000, islands: { ...base.islands, unlocked: ['home', 'isle2'] } }, [5, 6, 9, 10], 'isle2')
    harness(s).wrap(<PlotPanel island="isle2" plot={4} />)
    expect(screen.getByRole('button', { name: /Buy plot · 100,000 gold/ })).toBeEnabled()
  })
})

describe('MapIslandPanel', () => {
  it('shows each island\'s name, level and Bridge, and Go when unlocked', async () => {
    const onView = vi.fn()
    const s = { ...base, level: 12, gold: 150_000 }
    const h = harness(s)
    h.wrap(<MapIslandPanel view="home" onView={onView} />)
    expect(screen.getByText('Ember Reach')).toBeInTheDocument()
    expect(screen.getByText('Level 12')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Bridge · 150,000 gold/ }))
    expect(h.action).toHaveBeenCalledWith({ type: 'buyBridge', island: 'isle2' }, expect.any(String))
    await userEvent.click(screen.getByRole('button', { name: 'Go to Home Isle' }))
    expect(onView).toHaveBeenCalledWith('home')
  })
  it('explains in the handler\'s order: the earlier Bridge, then the level, then the gold', async () => {
    const { wrap, setState } = harness({ ...base, level: 11, gold: 0 })
    wrap(<MapIslandPanel view="home" onView={vi.fn()} />)
    expect(screen.getByText('Needs player level 12')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Bridge · 750,000 gold/ })).toBeDisabled()
    expect(screen.getAllByText('Needs the Bridge to Ember Reach')).toHaveLength(1)
    setState({ ...base, level: 12, gold: 0 })
    expect(await screen.findByText('Not enough gold')).toBeInTheDocument()
  })
  it('needs no Legendary for Warlord\'s Crown (R42)', () => {
    const { wrap } = harness({ ...base, level: 40, gold: 100_000_000, islands: { ...base.islands, unlocked: ['home', 'isle2', 'isle3', 'isle4', 'isle5'] } })
    wrap(<MapIslandPanel view="home" onView={vi.fn()} />)
    expect(screen.getByRole('button', { name: /Bridge · 100,000,000 gold/ })).toBeEnabled()
    expect(screen.queryByText(/legendary/i)).toBeNull()
  })
})

describe('copy', () => {
  it('messageFor covers the land errors', () => {
    for (const c of ['NOT_OWNED', 'PLOT_OWNED', 'PLOT_NOT_ADJACENT']) expect(messageFor(c)).not.toBe(c)
    expect(messageFor('WRONG_ISLAND')).toContain("Warlord's Crown")
  })
  it('the level-up list names plots and Bridges, once, with no raw keys', () => {
    const two = levelUnlockLines(1, 2)
    expect(two.filter(l => l === 'Home Isle plot')).toHaveLength(1)
    expect(levelUnlockLines(11, 12)).toContain('Bridge to Ember Reach')
    expect(levelUnlockLines(39, 40)).toContain("Bridge to Warlord's Crown")
    for (const l of levelUnlockLines(0, 50)) expect(l).not.toMatch(/home:|island:|isle\d/)
  })
})
