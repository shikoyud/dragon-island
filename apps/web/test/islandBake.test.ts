import { newPlayer, type PlayerState } from '@wyrmhaven/game-core'
import Phaser from 'phaser'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FALLBACK_ART } from '../src/art/slots'
import { createBridge } from '../src/game/bridge'
import { createGame } from '../src/game/config'
import { landmass } from '../src/game/islandShape'
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

describe('the Home bake', () => {
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

  it('other islands have no waterfalls; coming home brings them back', async () => {
    const { bridge, game, scene } = await boot()
    games.push(game)
    const home = fallsOf(scene).length
    bridge.setView('isle2')
    expect(fallsOf(scene)).toHaveLength(0)
    bridge.setView('home')
    expect(fallsOf(scene)).toHaveLength(home)
  })

  it('shows the plain sky colour behind everything when the sky art is absent', async () => {
    const { game, scene } = await boot()
    games.push(game)
    const c = scene.cameras.main.backgroundColor
    expect([c.red, c.green, c.blue]).toEqual([0x8f, 0xd0, 0xee])
    expect(scene.children.list.some(o => o.name === 'sea')).toBe(false)
  })
})
