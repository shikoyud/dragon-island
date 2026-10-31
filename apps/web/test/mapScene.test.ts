import { newPlayer, type BattlePreview } from '@wyrmhaven/game-core'
import Phaser from 'phaser'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { textureKey } from '../src/art/phaserLoader'
import { FALLBACK_ART } from '../src/art/slots'
import type { GameArtSet } from '../src/art/types'
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

async function boot(art: GameArtSet = FALLBACK_ART) {
  const bridge = createBridge()
  bridge.setArt(art)
  bridge.setState(newPlayer(0))
  vi.spyOn(Phaser.Textures.CanvasTexture.prototype, 'refresh').mockReturnThis()
  const host = document.createElement('div')
  document.body.append(host)
  const up = new Promise<void>(resolve => { const off = bridge.on('ready', () => { off(); resolve() }) })
  const game = createGame(host, bridge, { headless: true })
  await up
  return { bridge, game }
}

const PREVIEW = { attacker: [], defender: [], log: [] } as unknown as BattlePreview

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
    // Something new to draw: a sprite whose look did not change is kept.
    const fresh = newPlayer(0)
    bridge.setState({ ...fresh, islands: { ...fresh.islands, obstacles: [...fresh.islands.obstacles, { id: 'new', kind: 'bush', island: 'home', col: 16, row: 13 }] } })
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

  describe('the island keeps its sprites across a sync', () => {
    type Island = Phaser.Scene & {
      drawn: Phaser.GameObjects.GameObject[]; badges: Phaser.GameObjects.Text[]; layer: Phaser.GameObjects.Container
      sync(): void; collect(b: Phaser.GameObjects.Text): void
    }
    const up = async () => {
      const { bridge, game } = await boot()
      games.push(game)
      await shown(game, 'island')
      return { bridge, island: game.scene.getScene('island') as unknown as Island }
    }
    const obstacleSprite = (s: Island, id: string) => s.drawn.find(o => (o.getData?.('target') as { id?: string } | undefined)?.id === id)!

    it('the same objects, by identity, when nothing changed: a sync makes and destroys nothing', async () => {
      const { island } = await up()
      const before = [...island.drawn]
      expect(before.length).toBeGreaterThan(5)
      const sprites = vi.spyOn(island.add, 'sprite')
      island.sync()
      island.sync()
      expect(sprites).not.toHaveBeenCalled()
      expect(island.drawn).toHaveLength(before.length)
      island.drawn.forEach((o, i) => { expect(o).toBe(before[i]); expect(o.active).toBe(true) })
    })

    it('badges too: a badge text is kept while its label is the same, and only a changed one is remade', async () => {
      const { bridge, island } = await up()
      bridge.setClock(3_600_000) // Gold to collect in the starting habitats
      island.sync()
      const first = [...island.badges]
      expect(first.length).toBeGreaterThan(0)
      const text = vi.spyOn(island.add, 'text')
      bridge.setClock(3_601_000)
      island.sync()
      expect(text).not.toHaveBeenCalled()
      island.badges.forEach((b, i) => expect(b).toBe(first[i]))
    })

    it('only what changed is remade: a removed obstacle goes, the rest stay, and a new one is drawn in the model\'s order', async () => {
      const { bridge, island } = await up()
      const s = bridge.state!
      const [gone, kept] = s.islands.obstacles
      const goneSprite = obstacleSprite(island, gone!.id)
      const keptSprite = obstacleSprite(island, kept!.id)
      const order = () => island.layer.list.map(o => JSON.stringify(o.getData('target') ?? null))
      const before = order()
      bridge.setState({ ...s, islands: { ...s.islands, obstacles: s.islands.obstacles.slice(1) } })
      expect(goneSprite.active).toBe(false)
      expect(island.drawn).not.toContain(goneSprite)
      expect(obstacleSprite(island, kept!.id)).toBe(keptSprite)
      // Back again: made last, but drawn exactly where the model puts it, not on top of everything.
      bridge.setState(s)
      expect(obstacleSprite(island, gone!.id)).not.toBe(goneSprite)
      expect(order()).toEqual(before)
      expect(island.layer.list).toEqual(island.drawn)
    })

    it('a moved sprite is remade at its new place, not left where it stood', async () => {
      const { bridge, island } = await up()
      const s = bridge.state!
      const [o] = s.islands.obstacles
      const old = obstacleSprite(island, o!.id) as Phaser.GameObjects.Sprite
      bridge.setState({ ...s, islands: { ...s.islands, obstacles: [{ ...o!, col: o!.col + 1 }, ...s.islands.obstacles.slice(1)] } })
      const moved = obstacleSprite(island, o!.id) as Phaser.GameObjects.Sprite
      expect(moved).not.toBe(old)
      expect(moved.x).not.toBe(old.x)
    })

    it('a tapped badge whose collect came to nothing comes back on the next sync', async () => {
      const { bridge, island } = await up()
      bridge.setClock(3_600_000)
      island.sync()
      const badge = island.badges.find(b => b.getData('collect'))!
      const habitat = badge.getData('collect') as string
      island.collect(badge)
      island.sync()
      const again = island.badges.find(b => b.getData('collect') === habitat)!
      expect(again).not.toBe(badge)
      expect(again.visible).toBe(true)
      expect(again.input?.enabled).toBe(true)
    })

    it('the tap targets follow: a kept sprite stays one, a removed one is gone', async () => {
      const { bridge, island } = await up()
      const targets = () => (island as unknown as { tapTargets: { spr: unknown }[] }).tapTargets.map(t => t.spr)
      const s = bridge.state!
      const [gone, kept] = s.islands.obstacles
      const goneSprite = obstacleSprite(island, gone!.id)
      expect(targets()).toContain(goneSprite)
      island.sync()
      expect(targets().filter(t => t === goneSprite)).toHaveLength(1)
      bridge.setState({ ...s, islands: { ...s.islands, obstacles: s.islands.obstacles.slice(1) } })
      expect(targets()).not.toContain(goneSprite)
      expect(targets()).toContain(obstacleSprite(island, kept!.id))
    })
  })

  it('the desktop cursor is a hand wherever a tap would open something, also between overlapping tap boxes, and an arrow off them', async () => {
    const { game } = await boot()
    games.push(game)
    await shown(game, 'island')
    const island = game.scene.getScene('island') as unknown as Phaser.Scene & { drawn: Phaser.GameObjects.Sprite[]; onMove(p: unknown, over: unknown[]): void }
    const spr = island.drawn.find(o => o.getData?.('target'))!
    const cursor = vi.spyOn(island.input, 'setDefaultCursor')
    const p = { x: 10, y: 10, wasTouch: false, isDown: false, id: 1 }
    island.onMove(p, [spr])
    expect(cursor).toHaveBeenLastCalledWith('pointer')
    island.onMove(p, [])
    expect(cursor).toHaveBeenLastCalledWith('')
    // A touch has no cursor.
    cursor.mockClear()
    island.onMove({ ...p, wasTouch: true }, [spr])
    expect(cursor).not.toHaveBeenCalled()
  })

  it('placing never shows the hand: every click there is a cell', async () => {
    const { bridge, game } = await boot()
    games.push(game)
    await shown(game, 'island')
    const island = game.scene.getScene('island') as unknown as Phaser.Scene & { drawn: Phaser.GameObjects.Sprite[]; onMove(p: unknown, over: unknown[]): void }
    const spr = island.drawn.find(o => o.getData?.('target'))!
    const p = { x: 10, y: 10, wasTouch: false, isDown: false, id: 1 }
    island.onMove(p, [spr])
    const cursor = vi.spyOn(island.input, 'setDefaultCursor')
    bridge.setPlacing({ what: { kind: 'farm' }, size: 3, col: 14, row: 14, facing: 0 })
    island.onMove(p, [spr])
    expect(cursor).toHaveBeenLastCalledWith('')
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
    // The Map is still open on the bridge when the battle starts: the battle wins.
    bridge.setBattle(PREVIEW)
    expect(bridge.mapOpen).toBe(true)
    await shown(game, 'battle')
    expect(game.scene.isActive('map')).toBe(false)
    bridge.setMapOpen(false)
    bridge.setBattle(null)
    await shown(game, 'island')
    expect(game.scene.isActive('battle')).toBe(false)
  })

  describe('fx.levelUp', () => {
    const WITH_FX: GameArtSet = { ...FALLBACK_ART, fx: { ...FALLBACK_ART.fx, levelUp: { src: '', w: 32, h: 32, frames: 1, fps: 0 } } }
    const played = (s: { mock: { calls: unknown[][] } }) => s.mock.calls.filter(c => c[2] === textureKey('fx.levelUp')).length

    it('a level gained in a battle plays on the island, once, though the screen opens before the island wakes', async () => {
      const { bridge, game } = await boot(WITH_FX)
      games.push(game)
      await shown(game, 'island')
      const island = game.scene.getScene('island') as Phaser.Scene
      bridge.setBattle(PREVIEW)
      await shown(game, 'battle')
      const sprites = vi.spyOn(island.add, 'sprite')
      // closeBattle: the battle clears and the level-up screen opens in one commit, before the next frame's switch.
      bridge.setBattle(null)
      bridge.emit({ type: 'levelUp' })
      expect(game.scene.isSleeping('island')).toBe(true)
      expect(played(sprites)).toBe(0)
      await shown(game, 'island')
      expect(played(sprites)).toBe(1)
      // It is not played again by the next sleep and wake.
      bridge.setMapOpen(true)
      await shown(game, 'map')
      bridge.setMapOpen(false)
      await shown(game, 'island')
      expect(played(sprites)).toBe(1)
    })

    it('a level gained with the Map open, whose screen is closed there, plays nothing on return', async () => {
      const { bridge, game } = await boot(WITH_FX)
      games.push(game)
      await shown(game, 'island')
      const sprites = vi.spyOn((game.scene.getScene('island') as Phaser.Scene).add, 'sprite')
      bridge.setMapOpen(true)
      await shown(game, 'map')
      bridge.emit({ type: 'levelUp' }) // the screen opens over the Map
      bridge.emit({ type: 'levelUpClosed' }) // and is dismissed there
      bridge.setMapOpen(false)
      await shown(game, 'island')
      expect(played(sprites)).toBe(0)
    })

    it('plays at once on an island that is awake', async () => {
      const { bridge, game } = await boot(WITH_FX)
      games.push(game)
      await shown(game, 'island')
      const sprites = vi.spyOn((game.scene.getScene('island') as Phaser.Scene).add, 'sprite')
      bridge.emit({ type: 'levelUp' })
      expect(played(sprites)).toBe(1)
    })
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
