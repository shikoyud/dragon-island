import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { DECORATIONS, ELEMENTS, ISLAND_ORDER, LAUNCH_CATALOG, OBSTACLES, type DecorationId, type ObstacleKind } from '@wyrmhaven/game-core'
import { describe, expect, it } from 'vitest'
import { drawFallback, fallbackKey, FALLBACK_PALETTE } from '../src/art/fallback'
import { artSetFromManifest, type Manifest } from '../src/art/fromManifest'
import { ART_VERSION } from '../src/art/slots'
import { artEntries } from '../src/art/phaserLoader'
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

  it('fills every base-building slot at its footprint size', () => {
    const fit = (key: string, s: { src: string; w: number; h: number }, w: number, h: number) => {
      expect(s.src, key).not.toBe('')
      expect([s.w, s.h], key).toEqual([w, h])
    }
    for (const e of ELEMENTS) fit(`habitat.${e}`, art.habitat[e], 80, 64)
    fit('building.nexus', art.building.nexus, 80, 64)
    fit('building.hatchery', art.building.hatchery, 64, 64)
    fit('building.hoard', art.building.hoard, 64, 64)
    fit('building.farmPlot', art.building.farmPlot, 32, 32)
    fit('building.nest', art.building.nest, 32, 32)
    for (const id of Object.keys(DECORATIONS) as DecorationId[]) fit(id, art.decoration[id], DECORATIONS[id].size * 16, DECORATIONS[id].size * 16)
    for (const k of Object.keys(OBSTACLES) as ObstacleKind[]) fit(k, art.obstacle[k], OBSTACLES[k].size * 16, OBSTACLES[k].size * 16)
    fit('island.locked', art.island.locked, 16, 16)
    fit('island.sign', art.island.sign, 32, 32)
    for (const id of ISLAND_ORDER) fit(`map.${id}`, art.map[id], 32, 32)
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

  it('records the transparent top rows of each sprite so badges can sit on the art', () => {
    for (const [key, a] of Object.entries(v1.assets)) {
      expect(a.top, key).toBeDefined()
      expect(a.top!, key).toBeGreaterThanOrEqual(0)
      expect(a.top!, key).toBeLessThan(a.h)
    }
    expect(v1.assets['building.hatchery']!.top).toBe(17)
    expect(v1.assets['island.locked']!.top).toBe(0)
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

  it('carries a manifest top inset onto the sprite only when present', () => {
    const a = artSetFromManifest('v1', { assets: { 'building.hatchery': { file: 'hatchery.png', w: 64, h: 64, frames: 1, fps: 0, top: 17 } } }, LAUNCH_CATALOG)
    expect(a.building.hatchery.top).toBe(17)
    expect(a.building.hoard.top).toBeUndefined()
  })

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

  it('maps the base-building keys from a manifest', () => {
    const e = (file: string, w: number, h: number) => ({ file, w, h, frames: 1, fps: 0 })
    const a = artSetFromManifest('v2', { assets: {
      'building.nexus': e('nexus.png', 80, 64), 'decoration.moonwell': e('moonwell.png', 48, 48), 'obstacle.ruin': e('ruin.png', 48, 48),
      'island.locked': e('locked.png', 16, 16), 'island.sign': e('sign.png', 32, 32), 'map.dawnspire': e('map-dawn.png', 32, 32),
    } }, LAUNCH_CATALOG)
    expect(a.building.nexus.src).toBe('/art/v2/nexus.png')
    expect(a.decoration.moonwell.src).toBe('/art/v2/moonwell.png')
    expect(a.obstacle.ruin.src).toBe('/art/v2/ruin.png')
    expect(a.island.locked.src).toBe('/art/v2/locked.png')
    expect(a.island.sign.src).toBe('/art/v2/sign.png')
    expect(a.map.dawnspire.src).toBe('/art/v2/map-dawn.png')
  })

  it('falls back to footprint-sized blank sprites for every base-building slot', () => {
    const blank = (w: number, h: number) => ({ src: '', w, h, frames: 1, fps: 0 })
    expect(SLOT_SIZES.habitat).toEqual({ w: 80, h: 64 })
    expect(art.building.nexus).toEqual(blank(80, 64))
    for (const id of Object.keys(DECORATIONS) as DecorationId[]) {
      const n = DECORATIONS[id].size * 16
      expect(art.decoration[id], id).toEqual(blank(n, n))
    }
    for (const k of Object.keys(OBSTACLES) as ObstacleKind[]) {
      const n = OBSTACLES[k].size * 16
      expect(art.obstacle[k], k).toEqual(blank(n, n))
    }
    expect(art.island.locked).toEqual(blank(16, 16))
    expect(art.island.sign).toEqual(blank(32, 32))
    expect(Object.keys(art.map)).toEqual([...ISLAND_ORDER])
    for (const id of ISLAND_ORDER) expect(art.map[id]).toEqual(blank(32, 32))
  })

  it('registers every base-building key with the Phaser loader', () => {
    const keys = artEntries(art).map(r => r.key)
    for (const k of ['building.nexus', 'island.locked', 'island.sign', ...Object.keys(DECORATIONS).map(d => `decoration.${d}`),
      ...Object.keys(OBSTACLES).map(o => `obstacle.${o}`), ...ISLAND_ORDER.map(i => `map.${i}`)]) {
      expect(keys, k).toContain(`art:${k}`)
    }
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
    for (const slot of ['egg', 'hatchling', 'dragon', 'habitat', 'nest', 'hatchery', 'farmPlot', 'crop', 'hoard', 'icon', 'panel', 'button', 'island', 'nexus', 'decoration', 'obstacle', 'locked', 'sign', 'map', 'fx'] as const) {
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
