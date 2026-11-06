import { newPlayer, type BattlePreview } from '@wyrmhaven/game-core'
import Phaser from 'phaser'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { textureKey } from '../src/art/phaserLoader'
import { FALLBACK_ART } from '../src/art/slots'
import type { GameArtSet } from '../src/art/types'
import { createBridge } from '../src/game/bridge'
import { createGame } from '../src/game/config'
import { ISLAND_AT, islandFrame } from '../src/game/archipelago'

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

const PREVIEW = { state: { sides: { attacker: { team: [], active: 0 }, defender: { team: [], active: 0 } }, log: [] }, done: null } as unknown as BattlePreview

describe('the island scene (R99, R100)', () => {
  const games: Phaser.Game[] = []
  const shown = async (game: Phaser.Game, key: string) => vi.waitFor(() => expect(game.scene.isActive(key)).toBe(true), { timeout: 3000 })

  beforeEach(() => { vi.spyOn(console, 'warn').mockImplementation(() => {}) })
  afterEach(() => { games.splice(0).forEach(g => g.destroy(true)); vi.restoreAllMocks() })

  it('draws every island at once, each in a container at its own offset (R99)', async () => {
    const { game } = await boot()
    games.push(game)
    await shown(game, 'island')
    const island = game.scene.getScene('island') as unknown as { isleRoot(id: string): Phaser.GameObjects.Container }
    for (const id of ['home', 'isle2', 'isle3', 'isle4', 'isle5', 'isle6'] as const) {
      const root = island.isleRoot(id)
      expect([root.x, root.y]).toEqual([ISLAND_AT[id].x, ISLAND_AT[id].y])
    }
  })

  it('a locked island shows its picture and a caption with its level, whose tap opens the island (R99)', async () => {
    const { bridge, game } = await boot()
    games.push(game)
    await shown(game, 'island')
    const island = game.scene.getScene('island') as unknown as { isleRoot(id: string): Phaser.GameObjects.Container; onUp(p: unknown, over: unknown[]): void; onDown(p: unknown): void }
    const layer = island.isleRoot('isle2').list.find(o => o instanceof Phaser.GameObjects.Container && o.list.some(c => c.getData?.('caption'))) as Phaser.GameObjects.Container
    const caption = layer.list.find(c => c.getData('caption')) as Phaser.GameObjects.Text
    expect(caption.text).toMatch(/Level \d+ · Bridge/)
    const seen: unknown[] = []
    bridge.on('select', e => seen.push(e.target))
    const p = { x: 5, y: 5, wasTouch: false, isDown: true, id: 1 }
    island.onDown(p)
    island.onUp({ ...p, isDown: false }, [caption])
    expect(seen).toEqual([{ kind: 'mapIsland', id: 'isle2' }])
    // A locked island is never the one being worked on.
    expect(bridge.view).toBe('home')
  })

  it('a tap on an open island makes it the view without moving the camera (R100)', async () => {
    const { bridge, game } = await boot()
    games.push(game)
    const s = newPlayer(0)
    bridge.setState({ ...s, islands: { ...s.islands, unlocked: [...s.islands.unlocked, 'isle2'], plots: { ...s.islands.plots, isle2: [5, 6, 9, 10] } } } as typeof s)
    await shown(game, 'island')
    const island = game.scene.getScene('island') as unknown as { view: { cx: number; cy: number }; isleRoot(id: string): Phaser.GameObjects.Container; onUp(p: unknown, over: unknown[]): void; onDown(p: unknown): void }
    const layer = island.isleRoot('isle2').list.filter(o => o instanceof Phaser.GameObjects.Container).at(-1) as Phaser.GameObjects.Container
    const spr = layer.list.find(o => o.getData?.('target'))!
    const seen: unknown[] = []
    bridge.on('select', e => seen.push(e.target))
    const before = { ...island.view }
    const p = { x: 5, y: 5, wasTouch: false, isDown: true, id: 1 }
    island.onDown(p)
    island.onUp({ ...p, isDown: false }, [spr])
    expect(bridge.view).toBe('isle2')
    expect(seen).toEqual([spr.getData('target')])
    expect({ ...island.view }).toEqual(before)
  })

  it('a view set from outside brings that island into sight at the same zoom (R100)', async () => {
    const { bridge, game } = await boot()
    games.push(game)
    await shown(game, 'island')
    const island = game.scene.getScene('island') as unknown as { view: { cx: number; cy: number; zoom: number } }
    const zoom = island.view.zoom
    bridge.setView('isle2')
    const f = islandFrame('isle2')
    expect(island.view.zoom).toBe(zoom)
    expect(island.view.cx).toBeGreaterThan(f.x)
    expect(island.view.cx).toBeLessThan(f.x + f.w)
  })

  it('a sleeping island draws nothing; it catches up on the state when it wakes', async () => {
    const { bridge, game } = await boot()
    games.push(game)
    await shown(game, 'island')
    const island = game.scene.getScene('island') as Phaser.Scene
    bridge.setBattle(PREVIEW)
    await shown(game, 'battle')
    const sprites = vi.spyOn(island.add, 'sprite')
    const fresh = newPlayer(0)
    bridge.setState({ ...fresh, islands: { ...fresh.islands, obstacles: [...fresh.islands.obstacles, { id: 'new', kind: 'bush', island: 'home', col: 16, row: 13 }] } })
    expect(sprites).not.toHaveBeenCalled()
    bridge.setBattle(null)
    await shown(game, 'island')
    await vi.waitFor(() => expect(sprites).toHaveBeenCalled())
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

  describe('placing input', () => {
    type Scene = Phaser.Scene & {
      drawn: Phaser.GameObjects.Sprite[]; live: Map<string, { obj: Phaser.GameObjects.Sprite }>
      onDown(p: unknown): void; onMove(p: unknown, over?: unknown[]): void; onUp(p: unknown, over: unknown[]): void; reveal(p: unknown): void
    }
    const MOVE_H1 = { what: { kind: 'move', target: { type: 'habitat', id: 'h1' } }, size: 4, col: 13, row: 8, facing: 0 } as const

    /** The island with h1 being moved, and a list of the cells it emits, which the ghost follows as the React side would. */
    async function moving() {
      const { bridge, game } = await boot()
      games.push(game)
      await shown(game, 'island')
      const island = game.scene.getScene('island') as unknown as Scene
      bridge.setPlacing(MOVE_H1)
      const cells: { col: number; row: number }[] = []
      bridge.on('cell', e => { cells.push({ col: e.col, row: e.row }); bridge.setPlacing({ ...bridge.placing!, col: e.col, row: e.row }) })
      const at = (col: number, row: number, isDown = true) => ({ ...bridge.cellToScreen!(col, row), wasTouch: false, isDown, id: 1 })
      return { bridge, island, cells, at }
    }

    it('hover does nothing', async () => {
      const { island, cells, at } = await moving()
      for (const [c, r] of [[14, 13], [15, 14], [22, 13]] as const) island.onMove(at(c, r, false), [])
      expect(cells).toEqual([])
    })

    it('a tap on land centres the footprint there, also over a sprite that would open a dialog', async () => {
      const { bridge, island, cells, at } = await moving()
      const selects: unknown[] = []
      bridge.on('select', e => selects.push(e))
      const tap = (col: number, row: number, over: unknown[]) => {
        const down = at(col, row)
        const up = at(col, row, false)
        island.onDown(down)
        island.onUp(up, over)
      }
      tap(15, 14, [])
      expect(cells).toEqual([{ col: 14, row: 13 }])
      tap(20, 15, [island.drawn.find(o => o.getData?.('target'))!])
      expect(cells).toEqual([{ col: 14, row: 13 }, { col: 19, row: 14 }])
      expect(selects).toEqual([])
    })

    it('a drag from the footprint carries it, keeping the grabbed cell under the pointer, and leaves the camera alone', async () => {
      const { island, cells, at, bridge } = await moving()
      const before = bridge.cellToScreen!(20, 20)
      const down = at(14, 9) // one cell in from the footprint's top-left
      const to = at(15, 14)
      island.onDown(down)
      island.onMove(to)
      island.onUp({ ...to, isDown: false }, [])
      expect(cells).toEqual([{ col: 14, row: 13 }])
      expect(bridge.cellToScreen!(20, 20)).toEqual(before)
    })

    it('a drag elsewhere pans and moves no ghost', async () => {
      const { island, cells, at, bridge } = await moving()
      const before = bridge.cellToScreen!(20, 20)
      const down = at(20, 16)
      island.onDown(down)
      island.onMove({ ...down, y: down.y + 40 })
      expect(cells).toEqual([])
      expect(bridge.cellToScreen!(20, 20).y).not.toBe(before.y)
    })

    it('a drag that leaves the land keeps the last good cell, and the next tap still works', async () => {
      const { island, cells, at, bridge } = await moving()
      const down = at(14, 9)
      const to = at(15, 14)
      const off = at(-40, -40)
      const next = at(20, 15)
      island.onDown(down)
      island.onMove(to)
      island.onMove(off)
      island.onUp({ ...off, isDown: false }, [])
      expect(bridge.placing).toMatchObject({ col: 14, row: 13 })
      expect(cells).toHaveLength(1)
      island.onDown(next)
      island.onUp({ ...next, isDown: false }, [])
      expect(bridge.placing).toMatchObject({ col: 19, row: 14 })
    })

    it('a press released outside the canvas ends the grab', async () => {
      const { island, cells, at } = await moving()
      const down = at(14, 9)
      const to = at(15, 14)
      island.onDown(down)
      island.input.emit('pointerupoutside', { ...down, isDown: false })
      island.onMove(to)
      expect(cells).toEqual([])
    })

    it('reveals the ghost when placing starts and on a change of island, never on a cell or a turn', async () => {
      const { bridge, game } = await boot()
      games.push(game)
      await shown(game, 'island')
      const island = game.scene.getScene('island') as unknown as Scene
      const reveal = vi.spyOn(island as unknown as { reveal(p: unknown): void }, 'reveal')
      bridge.setPlacing(MOVE_H1)
      expect(reveal).toHaveBeenCalledTimes(1)
      bridge.setPlacing({ ...MOVE_H1, col: 14 })
      bridge.setPlacing({ ...MOVE_H1, col: 14, facing: 1 })
      expect(reveal).toHaveBeenCalledTimes(1)
      bridge.setView('isle2')
      expect(reveal).toHaveBeenCalledTimes(2)
      bridge.setPlacing(null)
      bridge.setView('home')
      expect(reveal).toHaveBeenCalledTimes(2)
    })

    describe('the camera and the HUD insets', () => {
      type CamScene = Scene & { view: { cx: number; cy: number; zoom: number }; gestures: { wheel(p: unknown, dy: number): void } }
      async function island() {
        const { bridge, game } = await boot()
        games.push(game)
        await shown(game, 'island')
        // A desktop's room: the headless default is too short a band to hold a ghost without a reveal, and a headless game
        // takes its size from its zero-sized parent, so the size is stood in for here.
        const size = { w: 1280, h: 720 }
        Object.defineProperty(game.scale, 'width', { get: () => size.w, configurable: true })
        Object.defineProperty(game.scale, 'height', { get: () => size.h, configurable: true })
        const resize = (w: number, h: number) => { size.w = w; size.h = h; game.scale.emit(Phaser.Scale.Events.RESIZE) }
        resize(1280, 720)
        return { bridge, game, resize, scene: game.scene.getScene('island') as unknown as CamScene }
      }
      const farmAt = (c: { col: number; row: number }) => ({ what: { kind: 'farm' }, size: 3, ...c, facing: 0 }) as const

      it('the first measure of the HUD still fits the opening view to the real insets', async () => {
        const { bridge, scene } = await island()
        const before = scene.view
        bridge.setInsets({ top: 100, bottom: 300 })
        expect(scene.view.cy).not.toBe(before.cy)
      })

      it('zoomed in: starting placing, the insets changing and ending placing keep the zoom and the centre', async () => {
        const { bridge, scene } = await island()
        bridge.setInsets({ top: 90, bottom: 80 })
        scene.gestures.wheel({ x: 640, y: 360 }, -100)
        const view = scene.view
        expect(view.zoom).toBeGreaterThan(1)
        bridge.setPlacing(farmAt(bridge.focusCell!()))
        expect(scene.view).toEqual(view)
        bridge.setInsets({ top: 90, bottom: 130 })
        expect(scene.view).toEqual(view)
        bridge.setPlacing(null)
        bridge.setInsets({ top: 90, bottom: 80 })
        expect(scene.view).toEqual(view)
      })

      it('not zoomed either: Move at the opening view keeps it', async () => {
        const { bridge, scene } = await island()
        bridge.setInsets({ top: 90, bottom: 80 })
        const view = scene.view
        bridge.setPlacing(farmAt(bridge.focusCell!()))
        bridge.setInsets({ top: 90, bottom: 130 })
        expect(scene.view).toEqual(view)
      })

      it('a screen resize opens fresh and refits to the measure after it', async () => {
        const { bridge, scene, resize } = await island()
        bridge.setInsets({ top: 90, bottom: 80 })
        scene.gestures.wheel({ x: 640, y: 360 }, -100)
        const zoomed = scene.view.zoom
        resize(844, 390)
        const resized = scene.view
        expect(resized.zoom).toBeLessThan(zoomed)
        bridge.setInsets({ top: 150, bottom: 80 })
        expect(scene.view.cy).not.toBe(resized.cy)
      })
    })

    it('a game torn down mid-placement takes the arrow and its tween with it', async () => {
      const { bridge, game } = await boot()
      await shown(game, 'island')
      bridge.setPlacing(MOVE_H1)
      const arrow = (game.scene.getScene('island') as unknown as Scene).live.get('arrow')!.obj
      const gone = new Promise(resolve => game.events.once(Phaser.Core.Events.DESTROY, resolve))
      game.destroy(true)
      await gone
      expect(arrow.active).toBe(false)
    })

    it('the ghost and arrow take no taps and the ghost is opaque; the arrow bobs, unless motion is reduced', async () => {
      const { bridge, game } = await boot()
      games.push(game)
      await shown(game, 'island')
      const island = game.scene.getScene('island') as unknown as Scene
      bridge.setPlacing(MOVE_H1)
      const ghost = island.live.get('ghost')!.obj
      const arrow = island.live.get('arrow')!.obj
      expect(ghost.alpha).toBe(1)
      expect(ghost.input).toBeNull()
      expect(arrow.input).toBeNull()
      expect(island.tweens.getTweensOf(arrow)).toHaveLength(1)
      bridge.setPlacing(null)
      bridge.setReducedMotion(true)
      bridge.setPlacing(MOVE_H1)
      expect(island.tweens.getTweensOf(island.live.get('arrow')!.obj)).toHaveLength(0)
    })
  })

  it('a battle takes over from the island, and ends on it', async () => {
    const { bridge, game } = await boot()
    games.push(game)
    await shown(game, 'island')
    bridge.setBattle(PREVIEW)
    await shown(game, 'battle')
    expect(game.scene.isSleeping('island')).toBe(true)
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
      bridge.setBattle(PREVIEW)
      await shown(game, 'battle')
      bridge.setBattle(null)
      await shown(game, 'island')
      expect(played(sprites)).toBe(1)
    })

    it('a level-up screen closed while the island sleeps plays nothing on return', async () => {
      const { bridge, game } = await boot(WITH_FX)
      games.push(game)
      await shown(game, 'island')
      const sprites = vi.spyOn((game.scene.getScene('island') as Phaser.Scene).add, 'sprite')
      bridge.setBattle(PREVIEW)
      await shown(game, 'battle')
      bridge.emit({ type: 'levelUp' }) // the screen opens over the battle
      bridge.emit({ type: 'levelUpClosed' }) // and is dismissed there
      bridge.setBattle(null)
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
})
