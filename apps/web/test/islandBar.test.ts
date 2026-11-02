import { breedTimerMs, DEFAULT_PRESET, getSpecies, LAUNCH_CATALOG, newPlayer } from '@wyrmhaven/game-core'
import Phaser from 'phaser'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FALLBACK_ART } from '../src/art/slots'
import { createBridge } from '../src/game/bridge'
import { createGame } from '../src/game/config'

// As in artSwapCrash.test.ts: the browser build of Phaser, and images that "load".
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

const T = breedTimerMs(getSpecies(LAUNCH_CATALOG, 'flame').rarity, ['flame'], DEFAULT_PRESET)

async function boot(state: ReturnType<typeof newPlayer>) {
  const bridge = createBridge()
  bridge.setArt(FALLBACK_ART)
  bridge.setState(state)
  vi.spyOn(Phaser.Textures.CanvasTexture.prototype, 'refresh').mockReturnThis()
  const host = document.createElement('div')
  document.body.append(host)
  const up = new Promise<void>(resolve => { const off = bridge.on('ready', () => { off(); resolve() }) })
  const game = createGame(host, bridge, { headless: true })
  await up
  const scene = game.scene.getScene('island') as unknown as { live: Map<string, { obj: Phaser.GameObjects.GameObject }>; drawn: Phaser.GameObjects.GameObject[]; sync(): void }
  return { bridge, game, scene }
}

describe('the Tap to buy label', () => {
  const games: Phaser.Game[] = []
  afterEach(() => { games.splice(0).forEach(g => g.destroy(true)); vi.restoreAllMocks() })

  it('is a tap target for its plot; while placing there are no labels', async () => {
    const { bridge, game, scene } = await boot(newPlayer(0))
    games.push(game)
    const label = scene.live.get('caption:sign:7')!.obj
    expect(label.getData('target')).toEqual({ kind: 'plot', island: 'home', plot: 7 })
    expect(label.input?.enabled).toBe(true)
    bridge.setPlacing({ what: { kind: 'farm' }, size: 3, col: 14, row: 13, facing: 0 })
    expect(scene.live.has('caption:sign:7')).toBe(false)
  })
})

describe('the progress bar under an egg', () => {
  const games: Phaser.Game[] = []
  afterEach(() => { games.splice(0).forEach(g => g.destroy(true)); vi.restoreAllMocks() })

  it('is kept through reconcile under bar:<id>, remade only when its fill changes, and goes with the egg', async () => {
    const egged = { ...newPlayer(0), hatchery: [{ speciesId: 'flame', readyAtMs: T / 2 }] }
    const { bridge, game, scene } = await boot(egged)
    games.push(game)
    const bar = scene.live.get('bar:hatchery:0')
    expect(bar?.obj).toBeInstanceOf(Phaser.GameObjects.Graphics)
    // Over the sprites, under the badges.
    const at = scene.drawn.indexOf(bar!.obj)
    expect(at).toBeGreaterThan(scene.drawn.indexOf(scene.live.get('hatchery:0')!.obj))
    expect(at).toBeLessThan(scene.drawn.indexOf(scene.live.get('badge:hatchery:0')!.obj))
    scene.sync()
    expect(scene.live.get('bar:hatchery:0')!.obj).toBe(bar!.obj)
    bridge.setState({ ...egged, hatchery: [{ speciesId: 'flame', readyAtMs: T }] }) // back to 0 %: another fill
    expect(scene.live.get('bar:hatchery:0')!.obj).not.toBe(bar!.obj)
    bridge.setState({ ...egged, hatchery: [] })
    expect(scene.live.has('bar:hatchery:0')).toBe(false)
  })
})
