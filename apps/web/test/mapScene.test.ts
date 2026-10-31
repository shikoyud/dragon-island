import { newPlayer, type BattlePreview } from '@wyrmhaven/game-core'
import Phaser from 'phaser'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FALLBACK_ART } from '../src/art/slots'
import { createBridge } from '../src/game/bridge'
import { createGame } from '../src/game/config'
import { MAP_SPOTS } from '../src/game/mapModel'

// As in artSwapCrash.test.ts: the browser build of Phaser, in a real headless game, on the drawn fallbacks.
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
  return { bridge, game }
}

describe('the scene switch', () => {
  const games: Phaser.Game[] = []
  const shown = async (game: Phaser.Game, key: string) => vi.waitFor(() => expect(game.scene.isActive(key)).toBe(true), { timeout: 3000 })

  beforeEach(() => { vi.spyOn(console, 'warn').mockImplementation(() => {}) })
  afterEach(() => { games.splice(0).forEach(g => g.destroy(true)); vi.restoreAllMocks() })

  it('runs the Map in place of the island, and the island sleeps with its state rather than dying', async () => {
    const { bridge, game } = await boot()
    games.push(game)
    await shown(game, 'island')
    const island = game.scene.getScene('island')
    bridge.setMapOpen(true)
    await shown(game, 'map')
    expect(game.scene.isSleeping('island')).toBe(true)
    bridge.setMapOpen(false)
    await shown(game, 'island')
    expect(game.scene.isSleeping('map')).toBe(true)
    expect(game.scene.getScene('island')).toBe(island)
  })

  it('a sleeping island draws nothing; it catches up on the state when it wakes', async () => {
    const { bridge, game } = await boot()
    games.push(game)
    await shown(game, 'island')
    const island = game.scene.getScene('island') as Phaser.Scene
    bridge.setMapOpen(true)
    await shown(game, 'map')
    const sprites = vi.spyOn(island.add, 'sprite')
    bridge.setState({ ...newPlayer(0), gold: 5 })
    expect(sprites).not.toHaveBeenCalled()
    bridge.setMapOpen(false)
    await shown(game, 'island')
    await vi.waitFor(() => expect(sprites).toHaveBeenCalled())
  })

  it('the Map opens on the viewed island every time, whatever was panned before', async () => {
    const { bridge, game } = await boot()
    games.push(game)
    bridge.setMapOpen(true)
    await shown(game, 'map')
    const home = bridge.mapIslandToScreen!('home')
    expect(home.x).toBe(game.scale.width / 2)
    const scene = game.scene.getScene('map') as unknown as { apply(v: { cx: number; cy: number; zoom: number }): void }
    scene.apply({ cx: MAP_SPOTS.isle6.x, cy: MAP_SPOTS.isle6.y, zoom: 1 })
    expect(bridge.mapIslandToScreen!('isle6').y).not.toBe(bridge.mapIslandToScreen!('home').y)
    const panned = bridge.mapIslandToScreen!('home')
    expect(panned).not.toEqual(home)
    bridge.setMapOpen(false)
    await shown(game, 'island')
    bridge.setMapOpen(true)
    await shown(game, 'map')
    expect(bridge.mapIslandToScreen!('home')).toEqual(home)
  })

  it('open, close, open within one frame lands on the Map, with no restart of either scene', async () => {
    const { bridge, game } = await boot()
    games.push(game)
    await shown(game, 'island')
    bridge.setMapOpen(true)
    await shown(game, 'map')
    const map = game.scene.getScene('map')
    const created = vi.fn()
    map.events.on(Phaser.Scenes.Events.START, created)
    bridge.setMapOpen(false)
    bridge.setMapOpen(true)
    bridge.setMapOpen(false)
    await shown(game, 'island')
    bridge.setMapOpen(true)
    bridge.setMapOpen(false)
    bridge.setMapOpen(true)
    await shown(game, 'map')
    expect(game.scene.isSleeping('island')).toBe(true)
    expect(created).not.toHaveBeenCalled()
  })

  it('a battle takes over from the Map, and ends on the island', async () => {
    const { bridge, game } = await boot()
    games.push(game)
    bridge.setMapOpen(true)
    await shown(game, 'map')
    bridge.setMapOpen(false)
    bridge.setBattle({ attacker: [], defender: [], log: [] } as unknown as BattlePreview)
    await shown(game, 'battle')
    expect(game.scene.isActive('map')).toBe(false)
    bridge.setBattle(null)
    await shown(game, 'island')
    expect(game.scene.isActive('battle')).toBe(false)
  })

  it('the art swap with the Map up: the next game comes back to the Map', async () => {
    const { bridge, game } = await boot()
    bridge.setMapOpen(true)
    await shown(game, 'map')
    game.destroy(true)
    await new Promise(r => setTimeout(r, 50))
    const host = document.createElement('div')
    document.body.append(host)
    const next = createGame(host, bridge, { headless: true })
    games.push(next)
    await shown(next, 'map')
    expect(next.scene.isSleeping('island')).toBe(true)
  })

  it('a tap on an island selects it; open water does nothing', async () => {
    const { bridge, game } = await boot()
    games.push(game)
    bridge.setMapOpen(true)
    await shown(game, 'map')
    const seen: unknown[] = []
    bridge.on('select', e => seen.push(e.target))
    const scene = game.scene.getScene('map') as unknown as { tap(p: { x: number; y: number }): void }
    scene.tap(bridge.mapIslandToScreen!('home'))
    expect(seen).toEqual([{ kind: 'mapIsland', id: 'home' }])
    const home = bridge.mapIslandToScreen!('home')
    scene.tap({ x: home.x + 400, y: home.y })
    expect(seen).toHaveLength(1)
  })

  it('the plots are drawn once for a holding, and again only when it changes', async () => {
    const { bridge, game } = await boot()
    games.push(game)
    bridge.setMapOpen(true)
    await shown(game, 'map')
    const scene = game.scene.getScene('map') as unknown as { plots: Phaser.GameObjects.Graphics }
    const clear = vi.spyOn(scene.plots, 'clear')
    const s = newPlayer(0)
    bridge.setState({ ...s, gold: 7 })
    bridge.setState({ ...s, gold: 8 })
    expect(clear).not.toHaveBeenCalled()
    bridge.setState({ ...s, islands: { ...s.islands, plots: { home: [5, 6, 9, 10, 4] } } })
    expect(clear).toHaveBeenCalledTimes(1)
  })
})
