import { LAUNCH_CATALOG } from '@wyrmhaven/game-core'
import { describe, expect, it, vi } from 'vitest'
import { artSetFromManifest } from '../src/art/fromManifest'
import { animKey, artEntries, isSheet, playOneShot, playOrStill, textureKey } from '../src/art/phaserLoader'
import { FALLBACK_ART } from '../src/art/slots'

describe('artEntries', () => {
  it('flattens every slot with a texture key and a fallback slot', () => {
    const rows = artEntries(FALLBACK_ART)
    const keys = rows.map(r => r.key)
    expect(keys).toContain(textureKey('egg.flame'))
    expect(keys).toContain(textureKey('dragon.sea'))
    expect(keys).not.toContain(textureKey('building.hoard'))
    expect(keys).toContain(textureKey('crop.warlordPepper'))
    expect(keys).toContain(textureKey('island.base'))
    expect(new Set(keys).size).toBe(keys.length)
    // base: 10 eggs + 10 hatchlings + 10 dragons + 10 habitats + 10 icons + ...; plus nexus, 15 decorations, 6 obstacles, 6 map icons, locked + sign + the placement arrow; was: 3 buildings + 4 crops + 10 icons + 3 ui + island
    expect(rows).toHaveLength(10 * 5 + 3 + 6 + 3 + 1 + 1 + 1 + 15 + 6 + 6 + 3 + 3) // + fx.construction, fx.hatch, fx.coins
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

/** A texture manager whose every sheet has all its frames; test/artSwapCrash.test.ts covers the ones that do not. */
const WHOLE_SHEET = { exists: () => true, get: () => ({ has: () => true }) }

function stubSprite(existing = false) {
  const create = vi.fn()
  const generateFrameNumbers = vi.fn(() => [{ key: 'k', frame: 0 }])
  const sprite = {
    scene: { anims: { exists: vi.fn(() => existing), create, generateFrameNumbers }, textures: WHOLE_SHEET },
    anims: { stop: vi.fn() },
    setTexture: vi.fn(),
    play: vi.fn(),
  }
  return { sprite: sprite as unknown as Phaser.GameObjects.Sprite, create, raw: sprite }
}

describe('playOrStill', () => {
  it('shows frame 0 and never animates for static sheets or reduced motion', () => {
    const a = stubSprite()
    playOrStill(a.sprite, 'art:egg.flame', 1, 0, false)
    expect(a.raw.setTexture).toHaveBeenCalledWith('art:egg.flame', 0)
    expect(a.raw.play).not.toHaveBeenCalled()
    const b = stubSprite()
    playOrStill(b.sprite, 'art:egg.flame', 6, 8, true)
    expect(b.raw.play).not.toHaveBeenCalled()
    expect(b.raw.anims.stop).toHaveBeenCalled()
  })

  it('creates the idle animation once and plays it', () => {
    const a = stubSprite(false)
    playOrStill(a.sprite, 'art:egg.flame', 6, 8, false)
    expect(a.create).toHaveBeenCalledWith(expect.objectContaining({ key: animKey('art:egg.flame'), frameRate: 8, repeat: -1 }))
    expect(a.raw.play).toHaveBeenCalledWith(expect.objectContaining({ key: animKey('art:egg.flame') }))
    const b = stubSprite(true)
    playOrStill(b.sprite, 'art:egg.flame', 6, 8, false)
    expect(b.create).not.toHaveBeenCalled()
  })
})

describe('playOneShot', () => {
  const coins = { src: '/art/v1/fx-coins.png', w: 32, h: 32, frames: 8, fps: 12 }
  const stub = (exists = false) => {
    const handlers: Record<string, () => void> = {}
    const create = vi.fn()
    const raw = {
      scene: { anims: { exists: () => exists, create, generateFrameNumbers: (_: string, o: { start: number; end: number }) => [o.start, o.end] }, textures: WHOLE_SHEET },
      play: vi.fn(() => raw),
      once: vi.fn((e: string, h: () => void) => { handlers[e] = h; return raw }),
      destroy: vi.fn(),
    }
    return { sprite: raw as unknown as Phaser.GameObjects.Sprite, raw, create, handlers }
  }

  it('plays a sheet once, on an animation apart from the looping idle one, and destroys the sprite at the end', () => {
    const s = stub()
    expect(playOneShot(s.sprite, 'art:fx.coins', coins)).toBe(true)
    expect(s.create).toHaveBeenCalledWith(expect.objectContaining({ key: 'art:fx.coins:once', frameRate: 12, repeat: 0, frames: [0, 7] }))
    expect(s.raw.play).toHaveBeenCalledWith('art:fx.coins:once')
    expect('art:fx.coins:once').not.toBe(animKey('art:fx.coins'))
    expect(s.raw.destroy).not.toHaveBeenCalled()
    s.handlers.animationcomplete!()
    expect(s.raw.destroy).toHaveBeenCalledOnce()
  })

  it('reuses the animation once created', () => {
    const s = stub(true)
    playOneShot(s.sprite, 'art:fx.coins', coins)
    expect(s.create).not.toHaveBeenCalled()
  })

  it('leaves a still alone and says so, so the caller can use its tween', () => {
    const s = stub()
    expect(playOneShot(s.sprite, 'art:fx.coins', { ...coins, frames: 1, fps: 0 })).toBe(false)
    expect(s.raw.play).not.toHaveBeenCalled()
  })

  it('isSheet tells a sheet from a still or the drawn fallback', () => {
    expect(isSheet(coins)).toBe(true)
    expect(isSheet(FALLBACK_ART.fx.coins)).toBe(false)
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
    expect(FALLBACK_ART.ground).toEqual({ grass: [], fog: null, water: null, cliffSw: null, cliffSe: null, island: {}, plotEdge: null, sky: null, clouds: [], rock: null, rim: [], waterfall: null })
  })

  it('collects present icon.* and ui.* keys for the HUD', () => {
    const art = artSetFromManifest('v9', manifest, LAUNCH_CATALOG)
    expect(art.hud['icon.gold.32']).toMatchObject({ src: '/art/v9/icon-gold-32.png', w: 32 })
    expect(art.hud['ui.button.round']).toMatchObject({ src: '/art/v9/ui-button-round.png' })
    expect(art.hud['icon.food.32']).toBeUndefined()
  })
})
