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
    expect(keys).not.toContain(textureKey('building.hoard'))
    expect(keys).toContain(textureKey('crop.bounty'))
    expect(keys).toContain(textureKey('island.base'))
    expect(new Set(keys).size).toBe(keys.length)
    // base: 9 eggs + 9 hatchlings + 9 dragons + 9 habitats + 9 icons + ...; plus nexus, 15 decorations, 5 obstacles, 6 map icons, locked + sign; was: 3 buildings + 4 crops + 9 icons + 3 ui + island
    expect(rows).toHaveLength(9 * 5 + 3 + 4 + 3 + 1 + 1 + 15 + 5 + 6 + 2 + 2) // + fx.construction, fx.hatch
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

describe('HUD, ground and fx art keys', () => {
  const manifest = {
    assets: {
      'fx.construction': { file: 'fx-construction.png', w: 32, h: 32, frames: 4, fps: 8 },
      'ground.grass.0': { file: 'ground-grass-0.png', w: 16, h: 8, frames: 1, fps: 0 },
      'ground.grass.2': { file: 'ground-grass-2.png', w: 16, h: 8, frames: 1, fps: 0 },
      'ground.water': { file: 'ground-water.png', w: 32, h: 16, frames: 4, fps: 6 },
      'icon.gold.32': { file: 'icon-gold-32.png', w: 32, h: 32, frames: 1, fps: 0 },
      'ui.button.round': { file: 'ui-button-round.png', w: 48, h: 48, frames: 1, fps: 0 },
    },
  }

  it('maps fx sheets and falls back to drawn ones at their default sizes', () => {
    const art = artSetFromManifest('v9', manifest, LAUNCH_CATALOG)
    expect(art.fx.construction).toMatchObject({ src: '/art/v9/fx-construction.png', frames: 4, fps: 8 })
    expect(art.fx.hatch).toMatchObject({ src: '', w: 48, h: 48 })
    const keys = artEntries(art).map(r => r.key)
    expect(keys).toContain(textureKey('fx.construction'))
    expect(keys).toContain(textureKey('fx.hatch'))
    expect(artEntries(FALLBACK_ART).find(r => r.key === textureKey('fx.hatch'))!.slot).toBe('fx')
  })

  it('keeps only the ground tiles the manifest has, and loads only those', () => {
    const art = artSetFromManifest('v9', manifest, LAUNCH_CATALOG)
    expect(art.ground.grass.map(g => g.src)).toEqual(['/art/v9/ground-grass-0.png', '/art/v9/ground-grass-2.png'])
    expect(art.ground.water).toMatchObject({ frames: 4, fps: 6 })
    expect(art.ground.fog).toBeNull()
    const keys = artEntries(art).map(r => r.key)
    expect(keys).toContain(textureKey('ground.grass.0'))
    expect(keys).toContain(textureKey('ground.water'))
    expect(keys).not.toContain(textureKey('ground.fog'))
    expect(FALLBACK_ART.ground).toEqual({ grass: [], fog: null, water: null, cliffSw: null, cliffSe: null })
  })

  it('collects present icon.* and ui.* keys for the HUD', () => {
    const art = artSetFromManifest('v9', manifest, LAUNCH_CATALOG)
    expect(art.hud['icon.gold.32']).toMatchObject({ src: '/art/v9/icon-gold-32.png', w: 32 })
    expect(art.hud['ui.button.round']).toMatchObject({ src: '/art/v9/ui-button-round.png' })
    expect(art.hud['icon.food.32']).toBeUndefined()
  })
})
