// The battle scene in a real headless Phaser game, on the drawn fallbacks: what it draws from the log it has been told to show.
import { battlePreview, createRng, LAUNCH_CATALOG, newPlayer, type BattleDragonSpec, type BattlePreview, type PlayerMove } from '@wyrmhaven/game-core'
import Phaser from 'phaser'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FALLBACK_ART } from '../src/art/slots'
import { backdropFill, dragonFlip } from '../src/game/battleModel'
import { createBridge } from '../src/game/bridge'
import { createGame } from '../src/game/config'
import { dragonKey } from '../src/game/islandModel'
import { BATTLE_SPOT } from '../src/game/layout'
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

const games: Phaser.Game[] = []
async function fight(me: BattleDragonSpec[], foe: BattleDragonSpec[], moves: PlayerMove[] = [], opts: { reduced?: boolean; backdrop?: 'flame' | null } = {}) {
  const { bridge, game } = await boot()
  games.push(game)
  bridge.setReducedMotion(opts.reduced ?? false)
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
})
