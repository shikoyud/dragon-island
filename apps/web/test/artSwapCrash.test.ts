import { LAUNCH_CATALOG, newPlayer } from '@wyrmhaven/game-core'
import Phaser from 'phaser'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { artSetFromManifest } from '../src/art/fromManifest'
import { animKey, playOneShot, playOrStill, textureKey } from '../src/art/phaserLoader'
import { FALLBACK_ART } from '../src/art/slots'
import { createBridge } from '../src/game/bridge'
import { createGame } from '../src/game/config'

// Node resolves `phaser` to its unbundled source, which needs an optional module; the browser build is what the game runs.
vi.mock('phaser', async () => {
  const bundle = await vi.importActual<{ default?: unknown }>('phaser/dist/phaser.js')
  return { default: bundle.default ?? bundle }
})

// jsdom never loads images, and Phaser's texture manager waits for its two built-in ones before the game boots.
class LoadedImage {
  width = 2
  height = 2
  onload: (() => void) | null = null
  set src(_: string) { setTimeout(() => this.onload?.()) }
}
vi.stubGlobal('Image', LoadedImage)

/** The real manifest's shape for the sheet the playtest crashed on: four frames, four fps. */
const SHEET_ART = artSetFromManifest('v1', { assets: { 'habitat.terra': { file: 'habitat-terra.png', w: 80, h: 64, frames: 4, fps: 4 } } }, LAUNCH_CATALOG)
const TERRA = textureKey('habitat.terra')

/** A real headless Phaser game booted on the drawn fallbacks, with its island scene up. */
async function bootOnFallbacks() {
  const bridge = createBridge()
  bridge.setArt(FALLBACK_ART)
  bridge.setState(newPlayer(0))
  // A headless game has no renderer to upload a canvas to, and the drawn fallbacks refresh themselves.
  vi.spyOn(Phaser.Textures.CanvasTexture.prototype, 'refresh').mockReturnThis()
  const host = document.createElement('div')
  document.body.append(host)
  const up = new Promise<void>(resolve => { const off = bridge.on('ready', () => { off(); resolve() }) })
  const game = createGame(host, bridge, { headless: true })
  await up
  return { bridge, game, scene: game.scene.getScene('island') as Phaser.Scene }
}

describe('the art swap: a game waiting to be destroyed', () => {
  const games: Phaser.Game[] = []
  beforeEach(() => { vi.spyOn(console, 'warn').mockImplementation(() => {}) })
  afterEach(() => { games.splice(0).forEach(g => g.destroy(true)); vi.restoreAllMocks() })

  it('does not draw the new art on the textures of the old one when a state update lands before its last frame', async () => {
    const { bridge, game, scene } = await bootOnFallbacks()
    games.push(game)
    const sprites = vi.spyOn(scene.add, 'sprite')
    // GameCanvas on `art` changing: Phaser only marks the old game (it dies on its next step), then the bridge gets the new art.
    game.destroy(true)
    bridge.setArt(SHEET_ART)
    // The state effect of the same commit, or an action reply within the same frame.
    expect(() => bridge.setState({ ...newPlayer(0) })).not.toThrow()
    expect(sprites).not.toHaveBeenCalled()
    expect(console.warn).not.toHaveBeenCalledWith('Frame "%s" not found in texture "%s"', expect.anything(), TERRA)
  })

  it('keeps drawing while the game is alive', async () => {
    const { bridge, game, scene } = await bootOnFallbacks()
    games.push(game)
    const sprites = vi.spyOn(scene.add, 'sprite')
    // Something new to draw: a sprite whose look did not change is kept.
    const s = newPlayer(0)
    bridge.setState({ ...s, islands: { ...s.islands, obstacles: [...s.islands.obstacles, { id: 'new', kind: 'bush', island: 'home', col: 16, row: 13 }] } })
    expect(sprites).toHaveBeenCalled()
  })
})

describe('playOrStill and playOneShot on real Phaser textures', () => {
  let game: Phaser.Game
  let scene: Phaser.Scene
  const sprite = (key: string) => scene.add.sprite(0, 0, key)
  /** A texture with numbered frames, as a loaded sprite sheet has. */
  const sheet = (key: string, frames: number) => {
    const tex = scene.textures.createCanvas(key, 8 * frames, 8)!
    for (let i = 0; i < frames; i++) tex.add(i, 0, 8 * i, 0, 8, 8)
    return tex
  }

  beforeEach(async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const booted = await bootOnFallbacks()
    game = booted.game
    scene = booted.scene
  })
  afterEach(() => { game.destroy(true); vi.restoreAllMocks() })

  it('shows a still, without an animation, for a texture with no numbered frames (a drawn fallback)', () => {
    const s = sprite(TERRA)
    expect(() => playOrStill(s, TERRA, 4, 4, false)).not.toThrow()
    expect(s.anims.isPlaying).toBe(false)
    expect(s.texture.key).toBe(TERRA)
    expect(scene.anims.exists(animKey(TERRA))).toBe(false)
  })

  it('shows a still for a texture that never loaded', () => {
    const s = sprite('art:failed')
    expect(() => playOrStill(s, 'art:failed', 4, 4, false)).not.toThrow()
    expect(s.anims.isPlaying).toBe(false)
    expect(scene.anims.exists(animKey('art:failed'))).toBe(false)
  })

  it('shows a still for a sheet with fewer frames than the manifest says', () => {
    sheet('art:short', 2)
    const s = sprite('art:short')
    expect(() => playOrStill(s, 'art:short', 4, 4, false)).not.toThrow()
    expect(s.anims.isPlaying).toBe(false)
    expect(s.frame.name).toBe(0)
  })

  it('stops a sprite already playing when its sheet turns out to be short', () => {
    sheet('art:full', 4)
    sheet('art:short', 2)
    const s = sprite('art:full')
    playOrStill(s, 'art:full', 4, 4, false)
    expect(s.anims.isPlaying).toBe(true)
    playOrStill(s, 'art:short', 4, 4, false)
    expect(s.anims.isPlaying).toBe(false)
  })

  it('still animates a complete sheet', () => {
    sheet('art:full', 4)
    const s = sprite('art:full')
    playOrStill(s, 'art:full', 4, 4, false)
    expect(s.anims.isPlaying).toBe(true)
    expect(s.anims.currentAnim?.frames).toHaveLength(4)
  })

  it('a one-shot on missing frames says no, so the caller uses its tween, and never throws', () => {
    const coins = { src: '/art/v1/fx-coins.png', w: 32, h: 32, frames: 8, fps: 12 }
    const s = sprite(TERRA)
    expect(playOneShot(s, TERRA, coins)).toBe(false)
    const t = sprite('art:failed')
    expect(playOneShot(t, 'art:failed', coins)).toBe(false)
    expect(scene.anims.exists(`${TERRA}:once`)).toBe(false)
  })
})
