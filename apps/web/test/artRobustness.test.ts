import { LAUNCH_CATALOG } from '@wyrmhaven/game-core'
import { describe, expect, it, vi } from 'vitest'
import { artSetFromManifest } from '../src/art/fromManifest'
import { animKey, animateWater, loadArt, playOrStill, textureKey } from '../src/art/phaserLoader'

const WHOLE_SHEET = { exists: () => true, get: () => ({ has: () => true }) }

describe('idle loops keep their phase across the island rebuild', () => {
  /** The animation config a rebuilt sprite at (x, y) is played with when the scene clock reads `nowMs`. */
  const played = (x: number, y: number, nowMs: number, frames = 4, fps = 6) => {
    const raw = {
      x, y,
      scene: { time: { now: nowMs }, anims: { exists: () => true, create: vi.fn(), generateFrameNumbers: vi.fn() }, textures: WHOLE_SHEET },
      anims: { stop: vi.fn() },
      setTexture: vi.fn(),
      play: vi.fn(),
    }
    playOrStill(raw as unknown as Phaser.GameObjects.Sprite, 'art:habitat.terra', frames, fps, false)
    return (raw.play.mock.calls[0] as unknown as [{ key: string; startFrame: number }])[0]
  }

  it('starts at the frame the shared clock puts the loop on, not at 0', () => {
    expect(played(0, 0, 500)).toMatchObject({ key: animKey('art:habitat.terra'), startFrame: 3 }) // 0.5 s at 6 fps is frame 3
  })

  it('two rebuilds a second apart continue the cycle instead of restarting at 0', () => {
    expect(played(0, 0, 1000).startFrame).toBe(2) // 6 frames elapsed, 4-frame loop
    expect(played(0, 0, 2000).startFrame).toBe(0) // 12 frames elapsed
    expect(played(0, 0, 1500).startFrame).toBe(1) // 9 frames elapsed: not 0
  })

  it('offsets sprites by position so they are not in lockstep', () => {
    const frames = new Set([[0, 0], [1, 5], [37, 11], [90, 42], [123, 7]].map(([x, y]) => played(x!, y!, 0).startFrame))
    expect(frames.size).toBeGreaterThan(1)
    for (const f of frames) {
      expect(f).toBeGreaterThanOrEqual(0)
      expect(f).toBeLessThan(4)
    }
  })
})

describe('failed sheets and the water timer', () => {
  const sheetArt = artSetFromManifest('v1', { assets: { 'habitat.terra': { file: 'habitat-terra.png', w: 80, h: 64, frames: 4, fps: 4 } } }, LAUNCH_CATALOG)

  function stubLoadScene() {
    const handlers: Record<string, (f: { key: string }) => void> = {}
    const created: string[] = []
    const scene = {
      textures: {
        exists: (k: string) => created.includes(k),
        createCanvas: (k: string) => { created.push(k); return { context: document.createElement('canvas').getContext('2d') ?? {}, refresh: vi.fn() } },
      },
      load: { spritesheet: vi.fn(), on: vi.fn((e: string, fn: (f: { key: string }) => void) => { handlers[e] = fn }) },
    }
    return { scene: scene as unknown as Phaser.Scene, handlers, created }
  }

  it('draws the slot fallback for a sheet whose PNG failed to load', () => {
    const { scene, handlers, created } = stubLoadScene()
    loadArt(scene, sheetArt)
    expect(created).not.toContain(textureKey('habitat.terra'))
    expect(handlers.loaderror).toBeTypeOf('function')
    handlers.loaderror!({ key: textureKey('habitat.terra') })
    expect(created).toContain(textureKey('habitat.terra'))
  })

  it('ignores a failed file that is not an art slot', () => {
    const { scene, handlers, created } = stubLoadScene()
    loadArt(scene, sheetArt)
    const before = created.length
    handlers.loaderror!({ key: 'something-else' })
    expect(created).toHaveLength(before)
  })

  it('animates the water only when the texture really has its frames', () => {
    const addEvent = vi.fn()
    const mk = (has: boolean) => ({ time: { addEvent }, textures: { exists: () => has, get: () => ({ has: () => has }) } }) as unknown as Phaser.Scene
    const water = { active: true, setFrame: vi.fn() } as unknown as Phaser.GameObjects.TileSprite
    animateWater(mk(false), water, 'art:ground.water', 4, 6, false)
    expect(addEvent).not.toHaveBeenCalled()
    animateWater(mk(true), water, 'art:ground.water', 4, 6, true)
    expect(addEvent).not.toHaveBeenCalled() // reduced motion
    animateWater(mk(true), water, 'art:ground.water', 4, 6, false)
    expect(addEvent).toHaveBeenCalledTimes(1)
  })
})
