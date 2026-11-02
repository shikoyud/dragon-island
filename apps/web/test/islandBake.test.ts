import { newPlayer, type PlayerState } from '@wyrmhaven/game-core'
import Phaser from 'phaser'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FALLBACK_ART } from '../src/art/slots'
import { createBridge } from '../src/game/bridge'
import { createGame } from '../src/game/config'
import { edgeDither } from '../src/game/islandBake'
import { landmass } from '../src/game/islandShape'
import { pointerToCell } from '../src/game/layout'
import type { IslandScene } from '../src/game/scenes/IslandScene'
import { landPlots } from '../src/game/camera'

// As artSwapCrash.test.ts: the browser bundle, and images that always load, so a real headless game boots.
vi.mock('phaser', async () => {
  const bundle = await vi.importActual<{ default?: unknown }>('phaser/dist/phaser.js')
  return { default: bundle.default ?? bundle }
})
class LoadedImage {
  width = 2
  height = 2
  onload: (() => void) | null = null
  set src(_: string) { setTimeout(() => this.onload?.()) }
}
vi.stubGlobal('Image', LoadedImage)

async function boot() {
  const bridge = createBridge()
  bridge.setArt(FALLBACK_ART)
  bridge.setState(newPlayer(0))
  vi.spyOn(Phaser.Textures.CanvasTexture.prototype, 'refresh').mockReturnThis()
  const host = document.createElement('div')
  document.body.append(host)
  const up = new Promise<void>(resolve => { const off = bridge.on('ready', () => { off(); resolve() }) })
  const game = createGame(host, bridge, { headless: true })
  await up
  return { bridge, game, scene: game.scene.getScene('island') as IslandScene }
}

const fallsOf = (scene: Phaser.Scene) => scene.children.list.filter(o => o.name === 'waterfall')
const buying = (s: PlayerState, plot: number): PlayerState => ({ ...s, islands: { ...s.islands, plots: { ...s.islands.plots, home: [...s.islands.plots.home!, plot] } } } as PlayerState)

describe('the edge between owned and offered land', () => {
  // Cells col 0..3, row 0..3; offered from col 2 on.
  const cells = Array.from({ length: 16 }, (_, i) => ({ col: i % 4, row: Math.floor(i / 4) }))
  const locked = (col: number) => col >= 2
  const px = edgeDither(cells, col => locked(col))

  it('darkens only owned pixels, within about 3 world px of the line, thinning away from it', () => {
    expect(px.length).toBeGreaterThan(20)
    const depths = px.map(p => {
      const c = pointerToCell(p.x + 0.5, p.y + 0.5)
      expect(locked(c.col)).toBe(false)
      expect(c.col).toBe(1)
      return 2 - ((p.y + 0.5) / 4 + (p.x + 0.5) / 8) / 2 // in cells from col = 2
    })
    expect(Math.max(...depths)).toBeLessThanOrEqual(0.4)
    expect(depths.filter(d => d < 0.2).length).toBeGreaterThan(depths.filter(d => d >= 0.2).length)
  })

  it('is a dither: not every pixel along the line, and the same each time', () => {
    const near = new Set(px.map(p => `${p.x},${p.y}`))
    let holes = 0
    for (let row = 0; row < 4; row++) for (let d = 0; d < 16; d++) {
      // Walk the cells beside the line on a row; count pixels in the fray left undarkened.
      const x = (1 - row) * 8 - 8 + d, y = (1 + row) * 4 + Math.floor(d / 4)
      const c = pointerToCell(x + 0.5, y + 0.5)
      const depth = 2 - ((y + 0.5) / 4 + (x + 0.5) / 8) / 2
      if (c.col === 1 && depth < 0.4 && !near.has(`${x},${y}`)) holes++
    }
    expect(holes).toBeGreaterThan(0)
    expect(edgeDither(cells, col => locked(col))).toEqual(px)
  })

  it('all owned or all offered land has no edge', () => {
    expect(edgeDither(cells, () => false)).toEqual([])
    expect(edgeDither(cells, () => true)).toEqual([])
  })
})

describe('the island bake', () => {
  const games: Phaser.Game[] = []
  beforeEach(() => { vi.spyOn(console, 'warn').mockImplementation(() => {}) })
  afterEach(() => { games.splice(0).forEach(g => g.destroy(true)); vi.restoreAllMocks() })

  it('stands one waterfall per falls point', async () => {
    const { bridge, game, scene } = await boot()
    games.push(game)
    expect(fallsOf(scene)).toHaveLength(landmass(landPlots(bridge.state!, 'home')).falls.length)
    expect(fallsOf(scene).length).toBeGreaterThanOrEqual(2)
  })

  it('a state change that changes no plots does not re-bake', async () => {
    const { bridge, game, scene } = await boot()
    games.push(game)
    const before = fallsOf(scene)
    bridge.setState({ ...bridge.state!, gold: bridge.state!.gold + 5 })
    expect(fallsOf(scene)).toEqual(before)
    for (const f of before) expect(f.active).toBe(true)
  })

  it('re-baking leaves one set of waterfall sprites, also after a context restore', async () => {
    const { bridge, game, scene } = await boot()
    games.push(game)
    const first = fallsOf(scene)
    bridge.setState(buying(bridge.state!, 7))
    const second = fallsOf(scene)
    expect(second).toHaveLength(landmass(landPlots(bridge.state!, 'home')).falls.length)
    for (const f of first) expect(f.active).toBe(false)
    scene.rebake()
    const third = fallsOf(scene)
    expect(third).toHaveLength(second.length)
    for (const f of second) expect(f.active).toBe(false)
  })

  it('every island floats: an opened island bakes its own landmass and waterfalls; coming home brings Home\'s back', async () => {
    const { bridge, game, scene } = await boot()
    games.push(game)
    const home = fallsOf(scene).length
    const s = bridge.state!
    bridge.setState({ ...s, islands: { ...s.islands, unlocked: [...s.islands.unlocked, 'isle2'], plots: { ...s.islands.plots, isle2: [5, 6, 9, 10] } } } as PlayerState)
    bridge.setView('isle2')
    const isle = landmass(landPlots(bridge.state!, 'isle2'))
    expect(isle.falls.length).toBeGreaterThan(0)
    expect(fallsOf(scene)).toHaveLength(isle.falls.length)
    // No fog diamonds: the old tile render texture stays hidden.
    expect(scene.children.list.some(o => o instanceof Phaser.GameObjects.RenderTexture && o.visible)).toBe(false)
    scene.rebake()
    expect(fallsOf(scene)).toHaveLength(isle.falls.length)
    bridge.setView('home')
    expect(fallsOf(scene)).toHaveLength(home)
  })

  it('a locked island shows no land and no waterfalls', async () => {
    const { bridge, game, scene } = await boot()
    games.push(game)
    bridge.setView('isle3')
    expect(fallsOf(scene)).toHaveLength(0)
  })

  it('shows the plain sky colour behind everything when the sky art is absent', async () => {
    const { game, scene } = await boot()
    games.push(game)
    const c = scene.cameras.main.backgroundColor
    expect([c.red, c.green, c.blue]).toEqual([0x8f, 0xd0, 0xee])
  })
})

describe('the selection outline (UI rework Phase 4)', () => {
  const games: Phaser.Game[] = []
  beforeEach(() => { vi.spyOn(console, 'warn').mockImplementation(() => {}) })
  afterEach(() => { games.splice(0).forEach(g => g.destroy(true)); vi.restoreAllMocks() })

  it('goes round the selected thing on the island shown, not while placing, and goes when deselected', async () => {
    const { bridge, game, scene } = await boot()
    games.push(game)
    expect(scene.selectionShown()).toBeNull()
    bridge.setSelection({ kind: 'habitat', id: 'h1' })
    expect(scene.selectionShown()).toEqual({ island: 'home', col: 13, row: 8, size: 4 })
    bridge.setPlacing({ what: { kind: 'move', target: { type: 'habitat', id: 'h1' } }, size: 4, col: 13, row: 8, facing: 0 } as never)
    expect(scene.selectionShown()).toBeNull()
    bridge.setPlacing(null)
    expect(scene.selectionShown()).not.toBeNull()
    bridge.setView('isle2')
    expect(scene.selectionShown()).toBeNull()
    bridge.setView('home')
    bridge.setSelection(null)
    expect(scene.selectionShown()).toBeNull()
  })
})
