// The battle scene in a real headless Phaser game, on the drawn fallbacks: what it draws from the log it has been told to show.
import { battlePreview, createRng, LAUNCH_CATALOG, newPlayer, type BattleDragonSpec, type BattlePreview, type PlayerMove } from '@wyrmhaven/game-core'
import Phaser from 'phaser'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { artEntries } from '../src/art/phaserLoader'
import { artSetFromManifest } from '../src/art/fromManifest'
import { FALLBACK_ART } from '../src/art/slots'
import type { GameArtSet } from '../src/art/types'
import { backdropFill, dragonFlip } from '../src/game/battleModel'
import { createBridge } from '../src/game/bridge'
import { createGame } from '../src/game/config'
import { dragonKey } from '../src/game/islandModel'
import { BATTLE, BATTLE_HEADER_H, BATTLE_SPOT } from '../src/game/layout'
import type { BattleScene } from '../src/game/scenes/BattleScene'

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

const c = LAUNCH_CATALOG
const three = (id: string, level: number): BattleDragonSpec[] => [0, 1, 2].map(() => ({ speciesId: id, level }))
const STRIKE: PlayerMove = { kind: 'attack', move: 0 }

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

const games: Phaser.Game[] = []
async function fight(me: BattleDragonSpec[], foe: BattleDragonSpec[], moves: PlayerMove[] = [], opts: { reduced?: boolean; backdrop?: 'flame' | null; art?: GameArtSet } = {}) {
  const { bridge, game } = await boot(opts.art)
  games.push(game)
  bridge.setReducedMotion(opts.reduced ?? false)
  // jsdom loads no images: the battle sheets the art set names stand in as blank canvases, as if they had loaded.
  if (opts.art) for (const e of artEntries(opts.art).filter(x => x.optional)) game.textures.createCanvas(e.key, e.sprite.w, e.sprite.h)
  const preview: BattlePreview = battlePreview(me, foe, moves, createRng(7), c)
  bridge.setBattle(preview, opts.backdrop ?? null)
  await vi.waitFor(() => expect(game.scene.isActive('battle')).toBe(true), { timeout: 3000 })
  return { bridge, game, preview, scene: game.scene.getScene('battle') as BattleScene }
}

describe('BattleScene', () => {
  beforeEach(() => { vi.spyOn(console, 'warn').mockImplementation(() => {}) })
  afterEach(() => { games.splice(0).forEach(g => g.destroy(true)); vi.restoreAllMocks() })

  it('draws the two active dragons at their spots, facing each other, by the stage-appropriate look', async () => {
    const { scene } = await fight(three('flame', 20), three('sea', 1))
    const mine = scene.dragon('attacker')
    const foe = scene.dragon('defender')
    expect(mine.texture.key).toBe(dragonKey('flame', 20, FALLBACK_ART))
    expect(foe.texture.key).toBe(dragonKey('sea', 1, FALLBACK_ART))
    expect(mine.flipX).toBe(dragonFlip('attacker', 20))
    expect(foe.flipX).toBe(dragonFlip('defender', 1))
    expect([mine.x, mine.y]).toEqual([BATTLE_SPOT.attacker.x, BATTLE_SPOT.attacker.y])
    expect([foe.x, foe.y]).toEqual([BATTLE_SPOT.defender.x, BATTLE_SPOT.defender.y])
    // Enemy upper right, yours lower left (R80).
    expect(foe.x).toBeGreaterThan(mine.x)
    expect(foe.y).toBeLessThan(mine.y)
  })

  it('fills the backdrop with the chapter element, a colour without art', async () => {
    const { scene } = await fight(three('flame', 20), three('sea', 1), [], { backdrop: 'flame' })
    expect(scene.cameras.main.backgroundColor.color & 0xffffff).toBe(backdropFill('flame').sky)
  })

  it('a hit floats its damage; a 2x hit tints the target and says 2x; a KO fades', async () => {
    // Sea T1 is 2x against Flame, and Flame L1 falls to it.
    const { scene, bridge, preview } = await fight(three('sea', 40), three('flame', 1), [{ kind: 'attack', move: 1 }])
    const texts = vi.spyOn(scene.add, 'text')
    const hit = preview.state.log[0]!
    expect(hit).toMatchObject({ kind: 'attack', multiplier: 2, ko: true })
    bridge.setBattleShown(1)
    const said = texts.mock.calls.map(a => a[2])
    expect(said.some(t => t === `-${(hit as { damage: number }).damage}`)).toBe(true)
    expect(said).toContain('2x')
    await vi.waitFor(() => expect(scene.dragon('defender').alpha).toBeLessThan(0.05), { timeout: 3000 })
  })

  it('IMMUNE shows the word and no number', async () => {
    const { scene, bridge, preview } = await fight(three('flame', 20), three('flame', 40), [{ kind: 'attack', move: 1 }])
    const texts = vi.spyOn(scene.add, 'text')
    expect(preview.state.log[0]).toMatchObject({ immune: true })
    bridge.setBattleShown(1)
    const said = texts.mock.calls.map(a => String(a[2]))
    expect(said).toContain('IMMUNE')
    expect(said.some(t => /^-\d/.test(t))).toBe(false)
  })

  it("IMMUNE floats above a small target's head, clear of the sprite, not over its body", async () => {
    const { scene, bridge } = await fight(three('flame', 20), three('flame', 1), [{ kind: 'attack', move: 1 }])
    const texts = vi.spyOn(scene.add, 'text')
    bridge.setBattleShown(1)
    const call = texts.mock.calls.find(a => String(a[2]) === 'IMMUNE')!
    const foe = scene.dragon('defender')
    // Origin (0.5, 1): the text's bottom edge is its y, and the sprite's top is its feet minus its height.
    expect(call[1]).toBeLessThanOrEqual(foe.y - foe.displayHeight)
  })

  it('IMMUNE on an adult stays under the title row and Exit button, above where a number sits', async () => {
    const { scene, bridge } = await fight(three('flame', 20), three('flame', 40), [{ kind: 'attack', move: 1 }])
    const texts = vi.spyOn(scene.add, 'text')
    const tweens = vi.spyOn(scene.tweens, 'add')
    bridge.setBattleShown(1)
    const call = texts.mock.calls.find(a => String(a[2]) === 'IMMUNE')!
    const foe = scene.dragon('defender')
    // The word is 20 px tall with its bottom at y: its top must clear the header, and it must not rise into it.
    expect(call[1] - 20).toBeGreaterThanOrEqual(BATTLE_HEADER_H)
    expect(call[1]).toBeLessThan(foe.y - Math.round(foe.displayHeight * 0.6))
    const tween = tweens.mock.calls.map(a => a[0] as { y?: number; alpha?: number }).find(t => t.alpha === 0 && t.y !== undefined)!
    expect(tween.y).toBe(call[1])
  })

  it('a damage number still floats over the body', async () => {
    const { scene, bridge } = await fight(three('sea', 40), three('flame', 1), [{ kind: 'attack', move: 1 }])
    const texts = vi.spyOn(scene.add, 'text')
    bridge.setBattleShown(1)
    const call = texts.mock.calls.find(a => /^-\d/.test(String(a[2])))!
    const foe = scene.dragon('defender')
    expect(call[1]).toBeGreaterThan(foe.y - foe.displayHeight)
  })

  it('a swap slides the new dragon in', async () => {
    const team: BattleDragonSpec[] = [{ speciesId: 'flame', level: 20 }, { speciesId: 'sea', level: 20 }, { speciesId: 'terra', level: 20 }]
    const { scene, bridge } = await fight(team, three('nature', 1), [{ kind: 'swap', to: 1 }])
    bridge.setBattleShown(1)
    await vi.waitFor(() => expect(scene.dragon('attacker').texture.key).toBe(dragonKey('sea', 20, FALLBACK_ART)), { timeout: 3000 })
    await vi.waitFor(() => expect(scene.dragon('attacker').x).toBe(BATTLE_SPOT.attacker.x), { timeout: 3000 })
  })

  it('reduced motion jumps to the result: no text and no tween, the sprite already right', async () => {
    const { scene, bridge } = await fight(three('sea', 40), three('flame', 1), [{ kind: 'attack', move: 1 }], { reduced: true })
    const texts = vi.spyOn(scene.add, 'text')
    const tweens = vi.spyOn(scene.tweens, 'add')
    bridge.setBattleShown(1)
    expect(texts).not.toHaveBeenCalled()
    expect(tweens).not.toHaveBeenCalled()
    expect(scene.dragon('defender').alpha).toBe(0)
  })

  it('a preview that moved on changes nothing until its event is played, so a KO is not spoiled', async () => {
    const { scene, bridge } = await fight(three('flame', 1), three('sea', 40), [])
    const look = scene.dragon('attacker').alpha
    bridge.setBattle(battlePreview(three('flame', 1), three('sea', 40), [STRIKE], createRng(7), c))
    expect(scene.dragon('attacker').alpha).toBe(look)
    expect(scene.dragon('attacker').alpha).toBe(1)
  })

  it('a resumed battle does not replay what already happened', async () => {
    const { bridge, game } = await boot()
    games.push(game)
    const preview = battlePreview(three('sea', 40), three('flame', 1), [{ kind: 'attack', move: 1 }], createRng(7), c)
    bridge.setBattleShown(preview.state.log.length)
    bridge.setBattle(preview)
    await vi.waitFor(() => expect(game.scene.isActive('battle')).toBe(true), { timeout: 3000 })
    const scene = game.scene.getScene('battle') as BattleScene
    // Slot 0 fell, and the AI's replacement is in: an event not re-run, just drawn.
    expect(scene.dragon('defender').alpha).toBeGreaterThanOrEqual(0)
    expect(bridge.battleShown).toBe(preview.state.log.length)
    expect(scene.playedEvents).toBe(0)
  })

  describe('art', () => {
    const e = (file: string, w: number, h: number, frames = 1, fps = 0) => ({ file, w, h, frames, fps })
    const withArt = (assets: Record<string, ReturnType<typeof e>>): GameArtSet => artSetFromManifest('v1', { assets }, c)
    const FX = {
      'fx.move.sea': e('a.png', 384, 64, 6, 14), 'fx.move.physical': e('b.png', 384, 64, 6, 14), 'fx.hit': e('c.png', 256, 64, 4, 14), 'fx.crit': e('d.png', 256, 64, 4, 14),
      'fx.immune': e('f.png', 256, 64, 4, 14), 'fx.ko': e('g.png', 384, 64, 6, 14), 'fx.swap': e('h.png', 320, 64, 5, 14),
    }
    /** What the scene is showing with this texture, whatever the object. */
    const showing = (scene: BattleScene, key: string) => scene.children.list.filter(o => (o as Phaser.GameObjects.Sprite).texture?.key === `art:${key}` && (o as Phaser.GameObjects.Sprite).visible)

    it('draws the chapter backdrop over the whole stage, and none without art', async () => {
      const plain = await fight(three('flame', 20), three('sea', 1), [], { backdrop: 'flame' })
      expect(showing(plain.scene, 'battle.backdrop.flame')).toHaveLength(0)
      const { scene } = await fight(three('flame', 20), three('sea', 1), [], { backdrop: 'flame', art: withArt({ 'battle.backdrop.flame': e('bd.png', 360, 420) }) })
      const [img] = showing(scene, 'battle.backdrop.flame') as Phaser.GameObjects.Image[]
      expect([img!.x, img!.y, img!.displayWidth, img!.displayHeight]).toEqual([0, 0, BATTLE.w, BATTLE.h])
      // Behind the platforms and the dragons.
      expect(scene.children.list.indexOf(img!)).toBeLessThan(scene.children.list.indexOf(scene.dragon('attacker')))
    })

    it('an Arena fight, or a chapter without its backdrop, keeps the colour fill', async () => {
      const art = withArt({ 'battle.backdrop.flame': e('bd.png', 360, 420) })
      const arena = await fight(three('flame', 20), three('sea', 1), [], { art })
      expect(showing(arena.scene, 'battle.backdrop.flame')).toHaveLength(0)
      expect(arena.scene.cameras.main.backgroundColor.color & 0xffffff).toBe(backdropFill(null).sky)
    })

    it('stands each dragon on ui.battle.platform when it exists, the drawn ellipse otherwise', async () => {
      const { scene } = await fight(three('flame', 20), three('sea', 1), [], { art: withArt({ 'ui.battle.platform': e('p.png', 64, 32) }) })
      const spots = showing(scene, 'ui.battle.platform') as Phaser.GameObjects.Image[]
      expect(spots).toHaveLength(2)
      expect(spots.map(p => p.x).sort((a, b) => a - b)).toEqual([BATTLE_SPOT.attacker.x, BATTLE_SPOT.defender.x])
      for (const p of spots) expect(p.depth).toBeLessThanOrEqual(scene.dragon('attacker').depth)
      const plain = await fight(three('flame', 20), three('sea', 1))
      expect(showing(plain.scene, 'ui.battle.platform')).toHaveLength(0)
    })

    it('a Sea move bursts fx.move.sea and fx.hit over the target; a Physical one fx.move.physical', async () => {
      const art = withArt(FX)
      const sea = await fight(three('sea', 20), three('flame', 40), [{ kind: 'attack', move: 1 }], { art })
      sea.bridge.setBattleShown(1)
      const [burst] = showing(sea.scene, 'fx.move.sea') as Phaser.GameObjects.Sprite[]
      expect(burst).toBeDefined()
      expect(burst!.x).toBe(BATTLE_SPOT.defender.x)
      expect(burst!.y).toBeLessThan(BATTLE_SPOT.defender.y)
      expect(showing(sea.scene, 'fx.hit')).toHaveLength(1)
      expect(showing(sea.scene, 'fx.move.physical')).toHaveLength(0)
      const phys = await fight(three('sea', 20), three('flame', 40), [{ kind: 'attack', move: 0 }], { art })
      phys.bridge.setBattleShown(1)
      expect(showing(phys.scene, 'fx.move.physical')).toHaveLength(1)
    })

    it('IMMUNE shows fx.immune and no hit; a KO adds fx.ko; a swap fx.swap', async () => {
      const art = withArt(FX)
      const immune = await fight(three('flame', 20), three('flame', 40), [{ kind: 'attack', move: 1 }], { art })
      immune.bridge.setBattleShown(1)
      expect(showing(immune.scene, 'fx.immune')).toHaveLength(1)
      expect(showing(immune.scene, 'fx.hit')).toHaveLength(0)
      const ko = await fight(three('sea', 40), three('flame', 1), [{ kind: 'attack', move: 1 }], { art })
      ko.bridge.setBattleShown(1)
      expect(showing(ko.scene, 'fx.ko')).toHaveLength(1)
      const team: BattleDragonSpec[] = [{ speciesId: 'flame', level: 20 }, { speciesId: 'sea', level: 20 }, { speciesId: 'terra', level: 20 }]
      const swap = await fight(team, three('nature', 1), [{ kind: 'swap', to: 1 }], { art })
      swap.bridge.setBattleShown(1)
      expect(showing(swap.scene, 'fx.swap')).toHaveLength(1)
    })

    it('a manifest with none of the M5 art plays a whole battle, swap and KO replacement included', async () => {
      const team: BattleDragonSpec[] = [{ speciesId: 'sea', level: 40 }, { speciesId: 'flame', level: 20 }, { speciesId: 'terra', level: 20 }]
      const moves: PlayerMove[] = [{ kind: 'attack', move: 1 }, { kind: 'swap', to: 1 }, { kind: 'attack', move: 1 }, { kind: 'attack', move: 1 }, { kind: 'attack', move: 1 }]
      const { scene, bridge, preview } = await fight(team, three('flame', 5), moves)
      const total = preview.state.log.length
      expect(total).toBeGreaterThan(3)
      for (let i = 1; i <= total; i++) bridge.setBattleShown(i)
      expect(scene.playedEvents).toBe(total)
      expect(scene.children.list.filter(o => /^art:(fx|battle|ui\.battle)/.test((o as Phaser.GameObjects.Sprite).texture?.key ?? ''))).toHaveLength(0)
    })

    it('with no fx art, or with reduced motion, nothing bursts and nothing throws', async () => {
      const none = await fight(three('sea', 20), three('flame', 40), [{ kind: 'attack', move: 1 }])
      none.bridge.setBattleShown(1)
      expect(none.scene.children.list.filter(o => /^art:fx\./.test((o as Phaser.GameObjects.Sprite).texture?.key ?? ''))).toHaveLength(0)
      const reduced = await fight(three('sea', 20), three('flame', 40), [{ kind: 'attack', move: 1 }], { art: withArt(FX), reduced: true })
      reduced.bridge.setBattleShown(1)
      expect(showing(reduced.scene, 'fx.move.sea')).toHaveLength(0)
    })
  })
})
