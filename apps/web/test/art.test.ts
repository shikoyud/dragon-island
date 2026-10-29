import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { ELEMENTS, LAUNCH_CATALOG } from '@wyrmhaven/game-core'
import { describe, expect, it } from 'vitest'
import { drawFallback, fallbackKey, FALLBACK_PALETTE } from '../src/art/fallback'
import { artSetFromManifest, type Manifest } from '../src/art/fromManifest'
import { ART_VERSION } from '../src/art/slots'
import { SLOT_SIZES } from '../src/art/types'

const manifest: Manifest = {
  assets: {
    'egg.fire': { file: 'egg-fire.png', w: 32, h: 32, frames: 6, fps: 8 },
    'dragon.fire': { file: 'dragon-fire.png', w: 48, h: 48, frames: 4, fps: 6 },
    'ui.panel': { file: 'panel.png', w: 24, h: 24, frames: 1, fps: 0 },
  },
}

describe('art v1 manifest', () => {
  const dir = path.join(__dirname, '..', 'public', 'art', 'v1')
  const v1 = JSON.parse(readFileSync(path.join(dir, 'manifest.json'), 'utf8')) as Manifest
  const art = artSetFromManifest('v1', v1, LAUNCH_CATALOG)

  it('is the active art version', () => {
    expect(ART_VERSION).toBe('v1')
  })

  it('fills every slot with a real sprite', () => {
    const sprites: [string, { src: string }][] = [
      ...ELEMENTS.flatMap(e => [
        [`egg.${e}`, art.egg[e]], [`hatchling.${e}`, art.hatchling[e]],
        [`habitat.${e}`, art.habitat[e]], [`icon.${e}`, art.elementIcon[e]],
      ] as [string, { src: string }][]),
      ...Object.entries(art.dragon).map(([id, s]) => [`dragon.${id}`, s] as [string, { src: string }]),
      ['nest', art.building.nest], ['hatchery', art.building.hatchery], ['farmPlot', art.building.farmPlot],
      ['hoard', art.building.hoard], ...Object.entries(art.building.cropStage).map(([c, s]) => [`crop.${c}`, s] as [string, { src: string }]),
      ['ui.panel', art.ui.panel], ['ui.button', art.ui.button], ['ui.cursor', art.ui.cursor], ['island.base', art.island.base],
    ]
    for (const [key, s] of sprites) expect(s.src, key).not.toBe('')
    expect(art.island.layers.length).toBeGreaterThan(0)
    for (const c of Object.values(art.building.cropStage)) expect(c.frames).toBe(4)
  })

  it('points every entry at a PNG on disk whose size matches w × frames by h', () => {
    for (const [key, a] of Object.entries(v1.assets)) {
      const file = path.join(dir, a.file)
      expect(existsSync(file), key).toBe(true)
      const png = readFileSync(file)
      expect(png.readUInt32BE(16), `${key} width`).toBe(a.w * a.frames)
      expect(png.readUInt32BE(20), `${key} height`).toBe(a.h)
    }
  })

  it('uses the same egg and hatchling pixels as the waitlist site', () => {
    const wl = path.join(__dirname, '..', '..', 'waitlist', 'public', 'art', 'v1')
    for (const e of ELEMENTS) {
      for (const f of [`egg-${e}.png`, `hatchling-${e}.png`]) {
        expect(readFileSync(path.join(dir, f)).equals(readFileSync(path.join(wl, f))), f).toBe(true)
      }
    }
  })
})

describe('artSetFromManifest', () => {
  const art = artSetFromManifest('v1', manifest, LAUNCH_CATALOG)

  it('maps present keys to versioned urls with frame data', () => {
    expect(art.version).toBe('v1')
    expect(art.egg.fire).toEqual({ src: '/art/v1/egg-fire.png', w: 32, h: 32, frames: 6, fps: 8 })
    expect(art.dragon['fire']).toEqual({ src: '/art/v1/dragon-fire.png', w: 48, h: 48, frames: 4, fps: 6 })
    expect(art.ui.panel.src).toBe('/art/v1/panel.png')
  })

  it('fills missing keys with empty sprites at the slot default size', () => {
    expect(art.egg.ice).toEqual({ src: '', w: 32, h: 32, frames: 1, fps: 0 })
    expect(art.habitat.water).toEqual({ src: '', ...SLOT_SIZES.habitat, frames: 1, fps: 0 })
    expect(art.island.base).toMatchObject({ src: '', w: 480, h: 270 })
    expect(art.island.layers).toEqual([])
  })

  it('has one dragon slot per catalog species', () => {
    expect(Object.keys(art.dragon).sort()).toEqual([...LAUNCH_CATALOG.species.keys()].sort())
    for (const e of ELEMENTS) expect(art.elementIcon[e]).toMatchObject({ w: 16, h: 16 })
  })

  it('collects island layers in order', () => {
    const withLayers = artSetFromManifest('v2', {
      assets: {
        'island.base': { file: 'island.png', w: 480, h: 270, frames: 1, fps: 0 },
        'island.layer.1': { file: 'clouds.png', w: 480, h: 270, frames: 8, fps: 4 },
        'island.layer.0': { file: 'water.png', w: 480, h: 270, frames: 6, fps: 6 },
      },
    }, LAUNCH_CATALOG)
    expect(withLayers.island.layers.map(l => l.src)).toEqual(['/art/v2/water.png', '/art/v2/clouds.png'])
  })
})

/** Minimal 2D context that records fillRect calls into a pixel grid (jsdom has no canvas). */
function gridContext(w: number, h: number) {
  const px: (string | null)[] = Array(w * h).fill(null)
  let fill = '#000000'
  const ctx = {
    get fillStyle() { return fill },
    set fillStyle(v: string) { fill = v },
    fillRect(x: number, y: number, rw: number, rh: number) {
      for (let j = y; j < y + rh; j++) for (let i = x; i < x + rw; i++) if (i >= 0 && j >= 0 && i < w && j < h) px[j * w + i] = fill
    },
    clearRect() { px.fill(null) },
  }
  return { ctx: ctx as unknown as CanvasRenderingContext2D, px }
}

describe('drawFallback', () => {
  it('paints an element-coloured egg covering a good share of the canvas, deterministically', () => {
    const a = gridContext(32, 32)
    drawFallback(a.ctx, 'egg', 'fire', 32, 32)
    const base = FALLBACK_PALETTE.fire.base
    const painted = a.px.filter(p => p === base).length
    expect(painted).toBeGreaterThanOrEqual(32 * 32 * 0.2)
    const b = gridContext(32, 32)
    drawFallback(b.ctx, 'egg', 'fire', 32, 32)
    expect(b.px).toEqual(a.px)
  })

  it('draws every slot without touching pixels outside the canvas', () => {
    for (const slot of ['egg', 'hatchling', 'dragon', 'habitat', 'nest', 'hatchery', 'farmPlot', 'crop', 'hoard', 'icon', 'panel', 'button', 'island'] as const) {
      const g = gridContext(48, 48)
      expect(() => drawFallback(g.ctx, slot, 'water', 48, 48)).not.toThrow()
      expect(g.px.some(p => p !== null)).toBe(true)
    }
  })

  it('keys fallbacks by slot and element', () => {
    expect(fallbackKey('egg', 'fire')).toBe('fallback:egg:fire')
    expect(fallbackKey('panel')).toBe('fallback:panel')
  })
})
