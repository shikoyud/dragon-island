import { LAUNCH_CATALOG } from '@wyrmhaven/game-core'
import { describe, expect, it, vi } from 'vitest'
import { artSetFromManifest } from '../src/art/fromManifest'
import { animKey, artEntries, playOrStill, textureKey } from '../src/art/phaserLoader'
import { FALLBACK_ART } from '../src/art/slots'

describe('artEntries', () => {
  it('flattens every slot with a texture key and a fallback slot', () => {
    const rows = artEntries(FALLBACK_ART)
    const keys = rows.map(r => r.key)
    expect(keys).toContain(textureKey('egg.fire'))
    expect(keys).toContain(textureKey('dragon.water'))
    expect(keys).toContain(textureKey('building.hoard'))
    expect(keys).toContain(textureKey('crop.bounty'))
    expect(keys).toContain(textureKey('island.base'))
    expect(new Set(keys).size).toBe(keys.length)
    // 9 eggs + 9 hatchlings + 9 dragons + 9 habitats + 3 buildings + 4 crops + hoard + 9 icons + 3 ui + island
    expect(rows).toHaveLength(9 * 5 + 3 + 4 + 1 + 3 + 1)
    expect(rows.find(r => r.key === textureKey('dragon.ice'))!.element).toBe('ice')
    expect(rows.find(r => r.key === textureKey('egg.dark'))!.slot).toBe('egg')
  })

  it('includes island layers in order', () => {
    const art = artSetFromManifest('v3', {
      assets: {
        'island.layer.0': { file: 'a.png', w: 480, h: 270, frames: 2, fps: 2 },
        'island.layer.1': { file: 'b.png', w: 480, h: 270, frames: 2, fps: 2 },
      },
    }, LAUNCH_CATALOG)
    const keys = artEntries(art).map(r => r.key)
    expect(keys.indexOf(textureKey('island.layer.0'))).toBeLessThan(keys.indexOf(textureKey('island.layer.1')))
  })
})

function stubSprite(existing = false) {
  const create = vi.fn()
  const generateFrameNumbers = vi.fn(() => [{ key: 'k', frame: 0 }])
  const sprite = {
    scene: { anims: { exists: vi.fn(() => existing), create, generateFrameNumbers } },
    anims: { stop: vi.fn() },
    setTexture: vi.fn(),
    play: vi.fn(),
  }
  return { sprite: sprite as unknown as Phaser.GameObjects.Sprite, create, raw: sprite }
}

describe('playOrStill', () => {
  it('shows frame 0 and never animates for static sheets or reduced motion', () => {
    const a = stubSprite()
    playOrStill(a.sprite, 'art:egg.fire', 1, 0, false)
    expect(a.raw.setTexture).toHaveBeenCalledWith('art:egg.fire', 0)
    expect(a.raw.play).not.toHaveBeenCalled()
    const b = stubSprite()
    playOrStill(b.sprite, 'art:egg.fire', 6, 8, true)
    expect(b.raw.play).not.toHaveBeenCalled()
    expect(b.raw.anims.stop).toHaveBeenCalled()
  })

  it('creates the idle animation once and plays it', () => {
    const a = stubSprite(false)
    playOrStill(a.sprite, 'art:egg.fire', 6, 8, false)
    expect(a.create).toHaveBeenCalledWith(expect.objectContaining({ key: animKey('art:egg.fire'), frameRate: 8, repeat: -1 }))
    expect(a.raw.play).toHaveBeenCalledWith(animKey('art:egg.fire'))
    const b = stubSprite(true)
    playOrStill(b.sprite, 'art:egg.fire', 6, 8, false)
    expect(b.create).not.toHaveBeenCalled()
  })
})
