import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { DECORATIONS, ELEMENTS, FOOTPRINT, ISLAND_ORDER, LAUNCH_CATALOG, newPlayer, OBSTACLES, type DecorationId, type IslandId, type ObstacleKind } from '@wyrmhaven/game-core'
import { describe, expect, it } from 'vitest'
import { drawFallback, FALLBACK_ARROW_GREEN, FALLBACK_STONE, FALLBACK_STRAW, fallbackKey, FALLBACK_PALETTE } from '../src/art/fallback'
import { artSetFromManifest, type Manifest } from '../src/art/fromManifest'
import { ART_VERSION, FALLBACK_ART } from '../src/art/slots'
import { artEntries } from '../src/art/phaserLoader'
import { SLOT_SIZES } from '../src/art/types'
import { buildIslandModel, dragonLook, groundTiles } from '../src/game/islandModel'

const manifest: Manifest = {
  assets: {
    'egg.flame': { file: 'egg-flame.png', w: 32, h: 32, frames: 6, fps: 8 },
    'dragon.flame': { file: 'dragon-flame.png', w: 48, h: 48, frames: 4, fps: 6 },
    'ui.panel': { file: 'panel.png', w: 24, h: 24, frames: 1, fps: 0 },
  },
}

// War has no sprites yet (Task B3): the drawn fallback covers it.
const ELEMENTS_WITH_ART = ELEMENTS

describe('art v1 manifest', () => {
  const dir = path.join(__dirname, '..', 'public', 'art', 'v1')
  const v1 = JSON.parse(readFileSync(path.join(dir, 'manifest.json'), 'utf8')) as Manifest
  const art = artSetFromManifest('v1', v1, LAUNCH_CATALOG)

  it('is the active art version', () => {
    expect(ART_VERSION).toBe('v1')
  })

  it('fills every slot with a real sprite', () => {
    const sprites: [string, { src: string }][] = [
      ...ELEMENTS_WITH_ART.flatMap(e => [
        [`egg.${e}`, art.egg[e]], [`hatchling.${e}`, art.hatchling[e]],
        [`habitat.${e}`, art.habitat[e]], [`icon.${e}`, art.elementIcon[e]],
      ] as [string, { src: string }][]),
      ...Object.entries(art.dragon).map(([id, s]) => [`dragon.${id}`, s] as [string, { src: string }]),
      ['nest', art.building.nest], ['hatchery', art.building.hatchery], ['farmPlot', art.building.farmPlot],
      ...Object.entries(art.building.cropStage).map(([c, s]) => [`crop.${c}`, s] as [string, { src: string }]),
      ['ui.panel', art.ui.panel], ['ui.button', art.ui.button], ['ui.cursor', art.ui.cursor], ['island.base', art.island.base],
    ]
    for (const [key, s] of sprites) expect(s.src, key).not.toBe('')
    expect(art.island.layers.length).toBeGreaterThan(0)
    for (const c of Object.values(art.building.cropStage)) expect(c.frames).toBe(3)
  })

  it('fills every base-building slot at its footprint size', () => {
    const fit = (key: string, s: { src: string; w: number; h: number }, w: number, h: number) => {
      expect(s.src, key).not.toBe('')
      expect([s.w, s.h], key).toEqual([w, h])
    }
    for (const e of ELEMENTS_WITH_ART) fit(`habitat.${e}`, art.habitat[e], 64, 64)
    fit('building.nexus', art.building.nexus, 80, 64)
    fit('building.hatchery', art.building.hatchery, 80, 96)
    for (const l of [2, 3, 4]) fit(`building.hatchery.${l}`, art.building.hatcheryLevel[l]!, 80, 96)
    fit('building.goldenAerie', art.building.goldenAerie!, 64, 64)
    fit('obstacle.ancientTree', art.obstacle.ancientTree, 64, 72)
    fit('ui.island.upgradePost', art.island.upgradePost, 24, 32)
    fit('ui.island.arrow', art.island.arrow, 32, 40)
    for (const k of ['minus', 'plus', 'thumb']) fit(`ui.zoom.${k}`, art.hud[`ui.zoom.${k}`]!, 32, 32)
    fit('building.farmPlot', art.building.farmPlot, 48, 40)
    fit('building.nest', art.building.nest, 32, 32)
    for (const id of Object.keys(DECORATIONS) as DecorationId[]) fit(id, art.decoration[id], DECORATIONS[id].size * 16, DECORATIONS[id].size * 16)
    // v1 has no art of its own for the §5.6 kinds yet: each shows the nearest old sprite, which keeps its own size.
    for (const k of Object.keys(OBSTACLES) as ObstacleKind[]) expect(art.obstacle[k].src, k).not.toBe('')
    fit('island.locked', art.island.locked, 16, 16)
    fit('island.sign', art.island.sign, 48, 48)
    for (const id of ISLAND_ORDER) fit(`map.${id}`, art.map[id], 128, 96)
  })

  it('has the floating island\'s ground art', () => {
    expect(art.ground.sky).toMatchObject({ w: 480, h: 272, frames: 1 })
    expect(art.ground.clouds).toHaveLength(3)
    expect(art.ground.rock).toMatchObject({ w: 64, h: 64 })
    expect(art.ground.rim).toHaveLength(4)
    expect(art.ground.waterfall).toMatchObject({ w: 32, h: 96, frames: 4, fps: 8 })
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
    expect(v1.assets['building.hatchery']!.top).toBe(13)
    expect(v1.assets['island.locked']!.top).toBe(0)
  })

  it('animates eggs and hatchlings at the 32x32 frame the waitlist site uses', () => {
    // Since the animation art (fb78b8c) the game's sheets are 4-frame loops; the waitlist keeps its own stills.
    for (const e of ELEMENTS_WITH_ART) {
      expect(art.egg[e]).toMatchObject({ w: 32, h: 32, frames: 4 })
      expect(art.hatchling[e]).toMatchObject({ w: 32, h: 32, frames: 4 })
    }
  })

})

describe('artSetFromManifest', () => {
  const art = artSetFromManifest('v1', manifest, LAUNCH_CATALOG)

  it('carries a manifest top inset onto the sprite only when present', () => {
    const a = artSetFromManifest('v1', { assets: { 'building.hatchery': { file: 'hatchery.png', w: 64, h: 64, frames: 1, fps: 0, top: 17 } } }, LAUNCH_CATALOG)
    expect(a.building.hatchery.top).toBe(17)
    expect(a.building.nest.top).toBeUndefined()
  })

  it('maps present keys to versioned urls with frame data', () => {
    expect(art.version).toBe('v1')
    expect(art.egg.flame).toEqual({ src: '/art/v1/egg-flame.png', w: 32, h: 32, frames: 6, fps: 8 })
    expect(art.dragon['flame']).toEqual({ src: '/art/v1/dragon-flame.png', w: 48, h: 48, frames: 4, fps: 6 })
    expect(art.ui.panel.src).toBe('/art/v1/panel.png')
  })

  it('fills missing keys with empty sprites at the slot default size', () => {
    expect(art.egg.ice).toEqual({ src: '', w: 32, h: 32, frames: 1, fps: 0 })
    expect(art.habitat.sea).toEqual({ src: '', ...SLOT_SIZES.habitat, frames: 1, fps: 0 })
    expect(art.island.base).toMatchObject({ src: '', w: 480, h: 270 })
    expect(art.island.layers).toEqual([])
  })

  it('maps the base-building keys from a manifest', () => {
    const e = (file: string, w: number, h: number) => ({ file, w, h, frames: 1, fps: 0 })
    const a = artSetFromManifest('v2', { assets: {
      'building.nexus': e('nexus.png', 80, 64), 'decoration.moonwell': e('moonwell.png', 48, 48), 'obstacle.ruin': e('ruin.png', 48, 48),
      'island.locked': e('locked.png', 16, 16), 'island.sign': e('sign.png', 32, 32), 'map.isle6': e('map-dawn.png', 32, 32),
    } }, LAUNCH_CATALOG)
    expect(a.building.nexus.src).toBe('/art/v2/nexus.png')
    expect(a.decoration.moonwell.src).toBe('/art/v2/moonwell.png')
    expect(a.obstacle.largeRock.src).toBe('/art/v2/ruin.png') // the nearest old sprite until obstacle.largeRock lands
    expect(a.island.locked.src).toBe('/art/v2/locked.png')
    expect(a.island.sign.src).toBe('/art/v2/sign.png')
    expect(a.map.isle6.src).toBe('/art/v2/map-dawn.png')
  })

  it('falls back to footprint-sized blank sprites for every base-building slot', () => {
    const blank = (w: number, h: number) => ({ src: '', w, h, frames: 1, fps: 0 })
    expect(SLOT_SIZES.habitat).toEqual({ w: 64, h: 64 })
    expect(SLOT_SIZES.hatchery).toEqual({ w: 80, h: 96 })
    expect(SLOT_SIZES.upgradePost).toEqual({ w: 24, h: 32 })
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
    expect(art.island.sign).toEqual(blank(48, 48))
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

  it('has a dragon slot per Basic, and per hybrid only when the manifest has its art', () => {
    expect(Object.keys(art.dragon).sort()).toEqual(ELEMENTS.slice().sort())
    const withHybrid = artSetFromManifest('v1', { assets: { 'dragon.terra-flame': { file: 'tf.png', w: 64, h: 64, frames: 1, fps: 0 } } }, LAUNCH_CATALOG)
    expect(Object.keys(withHybrid.dragon)).toContain('terra-flame')
    expect(Object.keys(withHybrid.dragon)).not.toContain('terra-sea')
    for (const e of ELEMENTS) expect(art.elementIcon[e]).toMatchObject({ w: 16, h: 16 })
  })

  it('reads the breeder and Hatchery level sheets only when the manifest has them', () => {
    expect(art.building.breeder.mountain).toEqual({})
    expect(art.building.breeder.grove).toEqual({})
    expect(art.building.hatcheryLevel).toEqual({})
    const e = (file: string, w: number) => ({ file, w, h: w, frames: 1, fps: 0 })
    const a = artSetFromManifest('v3', { assets: {
      'building.mountain.2': e('m2.png', 80), 'building.grove.3': e('g3.png', 80), 'building.hatchery.4': e('h4.png', 64), 'building.mountain.4': e('x.png', 80),
    } }, LAUNCH_CATALOG)
    expect(Object.keys(a.building.breeder.mountain)).toEqual(['2'])
    expect(a.building.breeder.mountain[2]).toMatchObject({ src: '/art/v3/m2.png', w: 80, h: 80 })
    expect(a.building.breeder.grove[3]?.src).toBe('/art/v3/g3.png')
    expect(a.building.hatcheryLevel[4]?.src).toBe('/art/v3/h4.png')
    const keys = artEntries(a).map(r => r.key)
    for (const k of ['building.mountain.2', 'building.grove.3', 'building.hatchery.4']) expect(keys).toContain(`art:${k}`)
  })

  it('reads the Roost tier sheets (building.roost.1..5) only when the manifest has them', () => {
    expect(art.building.roostTier).toEqual({})
    const e = (file: string) => ({ file, w: 64, h: 64, frames: 1, fps: 0 })
    const a = artSetFromManifest('v3', { assets: { 'building.roost.3': e('r3.png'), 'building.roost.5': e('r5.png'), 'building.roost.6': e('x.png') } }, LAUNCH_CATALOG)
    expect(Object.keys(a.building.roostTier)).toEqual(['3', '5'])
    expect(a.building.roostTier[3]).toMatchObject({ src: '/art/v3/r3.png', w: 64, h: 64 })
    const keys = artEntries(a).map(r => r.key)
    expect(keys).toContain('art:building.roost.3')
    expect(keys).toContain('art:building.roost.5')
    expect(keys.some(k => /^art:building\.roost\.[124]$/.test(k))).toBe(false)
    expect(artEntries(art).map(r => r.key).some(k => k.startsWith('art:building.roost'))).toBe(false)
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

describe('M4 art keys (docs/art/gdd-m4-art-list.md)', () => {
  const e = (file: string, w: number, h: number, frames = 1, fps = 0) => ({ file, w, h, frames, fps })
  const C = LAUNCH_CATALOG

  it('reads each obstacle at its listed size: the sheet width is the footprint width', () => {
    const listed: Record<ObstacleKind, [number, number]> = { ancientTree: [64, 64], boulder: [64, 48], largeRock: [48, 40], tree: [32, 40], smallRock: [32, 24], bush: [16, 16] }
    const a = artSetFromManifest('m4', { assets: Object.fromEntries(Object.entries(listed).map(([k, [w, h]]) => [`obstacle.${k}`, e(`${k}.png`, w, h)])) }, C)
    for (const k of Object.keys(OBSTACLES) as ObstacleKind[]) {
      expect(a.obstacle[k].src, k).toBe(`/art/m4/${k}.png`)
      expect([a.obstacle[k].w, a.obstacle[k].h], k).toEqual(listed[k])
      expect(a.obstacle[k].w, k).toBe(OBSTACLES[k].size * 16)
    }
  })

  it('draws final-size habitat, Aerie and Farm sheets at scale 1 and missing ones scaled to the footprint', () => {
    const s = newPlayer(0)
    const farm = (art: typeof FALLBACK_ART) => buildIslandModel(s, art, C, 0, 'home', null).objects.find(o => o.id === 'farm:0')!
    const hab = (art: typeof FALLBACK_ART) => buildIslandModel(s, art, C, 0, 'home', null).objects.find(o => o.id === 'habitat:h1')!
    const final = artSetFromManifest('m4', { assets: { 'habitat.terra': e('h.png', 64, 56, 4, 4), 'building.farmPlot': e('f.png', 48, 40) } }, C)
    expect(hab(final).scale ?? 1).toBe(1)
    expect(farm(final).scale ?? 1).toBe(1)
    // A manifest with none of the new sheets: the slot sizes (64 wide, 32 wide) draw at 64 and 48 and every object still draws.
    expect(hab(FALLBACK_ART).scale).toBeCloseTo((FOOTPRINT.habitat * 16) / SLOT_SIZES.habitat.w, 5)
    expect(farm(FALLBACK_ART).scale).toBeCloseTo((FOOTPRINT.farm * 16) / SLOT_SIZES.farmPlot.w, 5)
    const aerie = artSetFromManifest('m4', { assets: { 'building.goldenAerie': e('a.png', 64, 56, 4, 4) } }, C)
    expect(aerie.building.goldenAerie).toMatchObject({ w: 64, h: 56, frames: 4, fps: 4 })
  })

  it('reads per-island ground tiles and cliffs only when the manifest has them, and registers them with the loader', () => {
    expect(FALLBACK_ART.ground.island).toEqual({})
    expect(FALLBACK_ART.ground.plotEdge).toBeNull()
    const a = artSetFromManifest('m4', { assets: {
      'ground.isle2.0': e('e0.png', 16, 8), 'ground.isle2.1': e('e1.png', 16, 8), 'ground.isle2.5': e('x.png', 16, 8), 'ground.home.0': e('x.png', 16, 8),
      'ground.cliff.isle2.sw': e('esw.png', 16, 16), 'ground.cliff.isle2.se': e('ese.png', 16, 16), 'ground.cliff.isle3.sw': e('fsw.png', 16, 16),
      'ground.plotEdge': e('pe.png', 16, 8),
    } }, C)
    expect(Object.keys(a.ground.island)).toEqual(['isle2', 'isle3'])
    expect(a.ground.island.isle2!.grass.map(g => g.src)).toEqual(['/art/m4/e0.png', '/art/m4/e1.png'])
    expect(a.ground.island.isle2!.cliffSw?.src).toBe('/art/m4/esw.png')
    expect(a.ground.island.isle3!.grass).toEqual([])
    expect(a.ground.plotEdge?.src).toBe('/art/m4/pe.png')
    const keys = artEntries(a).map(r => r.key)
    for (const k of ['ground.isle2.0', 'ground.isle2.1', 'ground.cliff.isle2.sw', 'ground.cliff.isle2.se', 'ground.cliff.isle3.sw', 'ground.plotEdge']) expect(keys, k).toContain(`art:${k}`)
    expect(keys).not.toContain('art:ground.isle2.2')
    expect(keys.some(k => k.startsWith('art:ground.home'))).toBe(false)
    expect(artEntries(FALLBACK_ART).some(r => /ground\.(isle|plotEdge)/.test(r.key))).toBe(false)
  })

  it('picks the island tiles when present and the current tiles otherwise, a cliff only as a pair', () => {
    const base = { 'ground.grass.0': e('g0.png', 16, 8), 'ground.grass.1': e('g1.png', 16, 8), 'ground.cliff.sw': e('csw.png', 16, 16), 'ground.cliff.se': e('cse.png', 16, 16) }
    const a = artSetFromManifest('m4', { assets: { ...base, 'ground.isle2.0': e('e0.png', 16, 8), 'ground.isle2.1': e('e1.png', 16, 8), 'ground.cliff.isle2.sw': e('esw.png', 16, 16), 'ground.cliff.isle3.sw': e('fsw.png', 16, 16) } }, C)
    expect(groundTiles(a, 'home')).toEqual({ grass: ['ground.grass.0', 'ground.grass.1'], cliffSw: 'ground.cliff.sw', cliffSe: 'ground.cliff.se' })
    // Ember Reach has grass but only one cliff piece: the grass is its own, the cliff pair is the current one.
    expect(groundTiles(a, 'isle2')).toEqual({ grass: ['ground.isle2.0', 'ground.isle2.1'], cliffSw: 'ground.cliff.sw', cliffSe: 'ground.cliff.se' })
    expect(groundTiles(a, 'isle3').grass).toEqual(['ground.grass.0', 'ground.grass.1'])
    const both = artSetFromManifest('m4', { assets: { ...base, 'ground.cliff.isle4.sw': e('a.png', 16, 16), 'ground.cliff.isle4.se': e('b.png', 16, 16) } }, C)
    expect(groundTiles(both, 'isle4')).toMatchObject({ cliffSw: 'ground.cliff.isle4.sw', cliffSe: 'ground.cliff.isle4.se' })
    // No ground art at all: nothing to draw, the scene's placeholder diamonds take over on every island.
    for (const i of ISLAND_ORDER as readonly IslandId[]) expect(groundTiles(FALLBACK_ART, i), i).toEqual({ grass: [], cliffSw: null, cliffSe: null })
  })

  it('draws the map icons at any size, isle6 from its own map.isle6 key', () => {
    const a = artSetFromManifest('m4', { assets: { 'map.isle6': e('d.png', 32, 32), 'map.home': e('h.png', 128, 96) } }, C)
    expect(a.map.isle6.src).toBe('/art/m4/d.png')
    expect(a.map.home).toMatchObject({ w: 128, h: 96 })
    const b = artSetFromManifest('m4', { assets: { 'map.isle6': e('i6.png', 128, 96), 'map.bridge': e('b.png', 64, 32), 'map.backdrop': e('bd.png', 256, 256) } }, C)
    expect(b.map.isle6.src).toBe('/art/m4/i6.png')
    expect(b.hud['map.bridge']).toMatchObject({ w: 64, h: 32 })
    expect(b.hud['map.backdrop']).toMatchObject({ w: 256, h: 256 })
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
    drawFallback(a.ctx, 'egg', 'flame', 32, 32)
    const base = FALLBACK_PALETTE.flame.base
    const painted = a.px.filter(p => p === base).length
    expect(painted).toBeGreaterThanOrEqual(32 * 32 * 0.2)
    const b = gridContext(32, 32)
    drawFallback(b.ctx, 'egg', 'flame', 32, 32)
    expect(b.px).toEqual(a.px)
  })

  it('draws every slot without touching pixels outside the canvas', () => {
    for (const slot of ['egg', 'hatchling', 'dragon', 'habitat', 'nest', 'hatchery', 'farmPlot', 'crop', 'icon', 'panel', 'button', 'island', 'nexus', 'decoration', 'obstacle', 'locked', 'sign', 'arrow', 'upgradePost', 'map', 'fx', 'fxCoins'] as const) {
      const g = gridContext(48, 48)
      expect(() => drawFallback(g.ctx, slot, 'sea', 48, 48)).not.toThrow()
      expect(g.px.some(p => p !== null)).toBe(true)
    }
  })

  it('a drawn habitat fills the whole 64x32 diamond of its 64x64 canvas', () => {
    const g = gridContext(64, 64)
    drawFallback(g.ctx, 'habitat', 'flame', 64, 64)
    const row = (y: number) => g.px.slice(y * 64, (y + 1) * 64)
    expect(row(47).filter(p => p !== null).length).toBeGreaterThanOrEqual(62) // the waist reaches both corners
    expect(row(63).filter(p => p !== null).length).toBeGreaterThan(0) // the bottom vertex
    expect(row(63).filter(p => p !== null).length).toBeLessThanOrEqual(4)
    expect(row(47)).toContain(FALLBACK_PALETTE.flame.base)
  })

  it('a drawn Hatchery is a stone castle with a straw nest at the front of its 80x96 canvas', () => {
    const g = gridContext(80, 96)
    drawFallback(g.ctx, 'hatchery', 'flame', 80, 96)
    expect(g.px).toContain(FALLBACK_STRAW)
    expect(g.px.slice(76 * 80).includes(FALLBACK_STRAW)).toBe(true) // at the front
    expect(g.px.filter(p => p === FALLBACK_STONE).length).toBeGreaterThan(600) // towers and ring wall
  })

  it('a drawn upgrade post has its green arrow', () => {
    const g = gridContext(24, 32)
    drawFallback(g.ctx, 'upgradePost', 'flame', 24, 32)
    expect(g.px).toContain(FALLBACK_ARROW_GREEN)
  })

  it('reads the upgrade post from the manifest and always registers it with the loader', () => {
    const a = artSetFromManifest('m', { assets: { 'ui.island.upgradePost': { file: 'p.png', w: 24, h: 32, frames: 1, fps: 0 } } }, LAUNCH_CATALOG)
    expect(a.island.upgradePost).toMatchObject({ src: '/art/m/p.png', w: 24, h: 32 })
    const none = artSetFromManifest('m', { assets: {} }, LAUNCH_CATALOG)
    expect(none.island.upgradePost).toEqual({ src: '', w: 24, h: 32, frames: 1, fps: 0 })
    expect(artEntries(none).find(r => r.key === 'art:ui.island.upgradePost')).toMatchObject({ slot: 'upgradePost' })
  })

  it('has a palette for all ten elements, with War dark red', () => {
    expect(Object.keys(FALLBACK_PALETTE).sort()).toEqual([...ELEMENTS].sort())
    expect(FALLBACK_PALETTE.war.base).toBe('#a32638')
  })

  it('draws an element from the fallback when the manifest lacks it: every slot is empty, with a drawn texture row', () => {
    const v1 = JSON.parse(readFileSync(path.join(__dirname, '..', 'public', 'art', 'v1', 'manifest.json'), 'utf8')) as Manifest
    const noWar = Object.fromEntries(Object.entries(v1.assets).filter(([k]) => !/\.war(\.|$)/.test(k)))
    const rows = artEntries(artSetFromManifest('v1', { assets: noWar }, LAUNCH_CATALOG))
    for (const slot of ['egg', 'hatchling', 'dragon', 'habitat', 'icon']) {
      const row = rows.find(r => r.key === `art:${slot}.war`)
      expect(row, slot).toMatchObject({ element: 'war', sprite: { src: '' } })
    }
    const g = gridContext(48, 48)
    drawFallback(g.ctx, 'dragon', 'war', 48, 48)
    expect(g.px).toContain(FALLBACK_PALETTE.war.base)
  })

  it('keys fallbacks by slot and element', () => {
    expect(fallbackKey('egg', 'flame')).toBe('fallback:egg:flame')
    expect(fallbackKey('panel')).toBe('fallback:panel')
  })
})

// ---- M5: combat and PvE art. Every key is read when the manifest has it and has a fallback when it does not. ----
const still = (file: string, w: number, h: number) => ({ file, w, h, frames: 1, fps: 0 })
const sheet = (file: string, w: number, h: number, frames: number, fps: number) => ({ file, w, h, frames, fps })
// `w` is one frame's width, as in the real manifest (a 6-frame fx sheet is 384 wide on disk and says 64 here).
const M5: Manifest['assets'] = {
  ...Object.fromEntries(ELEMENTS.flatMap(e => [
    [`battle.backdrop.${e}`, still(`bd-${e}.png`, 360, 420)],
    [`fx.move.${e}`, sheet(`fxm-${e}.png`, 64, 64, 6, 14)],
    [`trial.chapter.${e}`, still(`tc-${e}.png`, 64, 64)],
  ])),
  'fx.move.physical': sheet('fxm-physical.png', 64, 64, 6, 14),
  'fx.hit': sheet('fx-hit.png', 64, 64, 4, 14), 'fx.crit': sheet('fx-crit.png', 64, 64, 4, 14), 'fx.immune': sheet('fx-immune.png', 64, 64, 4, 14),
  'fx.ko': sheet('fx-ko.png', 64, 64, 6, 14), 'fx.swap': sheet('fx-swap.png', 64, 64, 5, 14),
  'battle.boss.marker': still('boss.png', 16, 16),
  'ui.battle.platform': still('plat.png', 64, 32), 'ui.battle.hpFrame': still('hp.png', 16, 16), 'ui.battle.moveButton': still('mb.png', 16, 16),
  'ui.battle.swap': still('sw.png', 16, 16), 'ui.battle.turn': still('turn.png', 96, 16), 'ui.star': still('star.png', 12, 12), 'ui.star.empty': still('star0.png', 12, 12),
  'ui.tier.1': still('t1.png', 12, 12), 'ui.tier.2': still('t2.png', 12, 12), 'ui.tier.3': still('t3.png', 12, 12),
  'trial.node': still('n.png', 16, 16), 'trial.node.boss': still('nb.png', 16, 16), 'trial.node.locked': still('nl.png', 16, 16),
  'dragon.trial-champion': sheet('dtc.png', 192, 48, 4, 6), 'juvenile.trial-champion': sheet('jtc.png', 192, 48, 4, 6),
  'hatchling.trial-champion': sheet('htc.png', 128, 32, 4, 6), 'egg.trial-champion': sheet('etc.png', 192, 32, 6, 8),
}

describe('M5 art keys', () => {
  const none = artSetFromManifest('v1', { assets: {} }, LAUNCH_CATALOG)
  const all = artSetFromManifest('v1', { assets: M5 }, LAUNCH_CATALOG)
  const m5Rows = (a: typeof all) => artEntries(a).filter(r => /^art:(battle\.|fx\.(move|hit|crit|immune|ko|swap)|ui\.battle\.platform)/.test(r.key))

  it('a manifest with none of them has no battle art, requests nothing for it, and still draws every dragon', () => {
    expect(none.battle).toEqual({ backdrop: {}, wide: {}, platform: null, moveFx: {}, fx: {} })
    expect(none.special).toEqual({ egg: {}, hatchling: {} })
    expect(m5Rows(none)).toEqual([])
    expect(Object.keys(none.hud).filter(k => /^(battle|trial)\.|^ui\.(battle|star|tier)/.test(k))).toEqual([])
    for (const id of ['trial-champion', 'flame', 'sea']) for (const level of [1, 5, 20]) {
      const look = dragonLook(id, level, none)
      expect(look.key, `${id} L${level}`).toMatch(/^art:(hatchling|dragon)\.(war|flame|sea)$/)
      expect(look.sprite.w).toBeGreaterThan(0)
    }
  })

  it('reads backdrops, move fx, the other fx and the platform when the manifest has them', () => {
    for (const e of ELEMENTS) {
      expect(all.battle.backdrop[e], e).toMatchObject({ src: `/art/v1/bd-${e}.png`, w: 360, h: 420 })
      expect(all.battle.moveFx[e], e).toMatchObject({ w: 64, h: 64, frames: 6, fps: 14 })
    }
    expect(all.battle.moveFx.physical).toMatchObject({ src: '/art/v1/fxm-physical.png' })
    expect(Object.keys(all.battle.fx).sort()).toEqual(['crit', 'hit', 'immune', 'ko', 'swap'])
    expect(all.battle.platform).toMatchObject({ w: 64, h: 32 })
    const keys = m5Rows(all).map(r => r.key)
    for (const k of ['art:battle.backdrop.sea', 'art:fx.move.war', 'art:fx.move.physical', 'art:fx.hit', 'art:fx.crit', 'art:fx.immune', 'art:fx.ko', 'art:fx.swap', 'art:ui.battle.platform']) expect(keys, k).toContain(k)
    expect(keys).toHaveLength(10 + 11 + 5 + 1)
  })

  it('a partial set gives only what is there', () => {
    const part = artSetFromManifest('v1', { assets: { 'battle.backdrop.flame': M5['battle.backdrop.flame']!, 'fx.move.sea': M5['fx.move.sea']! } }, LAUNCH_CATALOG)
    expect(Object.keys(part.battle.backdrop)).toEqual(['flame'])
    expect(Object.keys(part.battle.moveFx)).toEqual(['sea'])
    expect(part.battle.platform).toBeNull()
  })

  it('React-side keys reach the HUD record: stars, tier pips, battle ui, Boss marker, chapter cards and nodes', () => {
    const keys = ['ui.star', 'ui.star.empty', 'ui.tier.1', 'ui.tier.2', 'ui.tier.3', 'ui.battle.hpFrame', 'ui.battle.moveButton', 'ui.battle.swap', 'ui.battle.turn',
      'battle.boss.marker', 'trial.node', 'trial.node.boss', 'trial.node.locked', ...ELEMENTS.map(e => `trial.chapter.${e}`)]
    for (const k of keys) expect(all.hud[k]?.src, k).toBe(`/art/v1/${M5[k]!.file}`)
  })

  it('the Trial Champion: adult, juvenile and hatchling are read by species; its egg is kept for an egg of that species', () => {
    expect(dragonLook('trial-champion', 20, all)).toMatchObject({ key: 'art:dragon.trial-champion', sprite: { w: 192 } })
    expect(dragonLook('trial-champion', 5, all).key).toBe('art:juvenile.trial-champion')
    expect(dragonLook('trial-champion', 1, all).key).toBe('art:hatchling.trial-champion')
    expect(all.special.egg['trial-champion']).toMatchObject({ src: '/art/v1/etc.png' })
    const keys = artEntries(all).map(r => r.key)
    for (const k of ['art:dragon.trial-champion', 'art:juvenile.trial-champion', 'art:hatchling.trial-champion', 'art:egg.trial-champion']) expect(keys, k).toContain(k)
    // Without the art it is a War dragon of the primary element, like any species without its own sheet (R23).
    expect(dragonLook('trial-champion', 20, none).key).toBe('art:dragon.war')
    expect(dragonLook('trial-champion', 1, none).key).toBe('art:hatchling.war')
    expect(artEntries(none).map(r => r.key)).not.toContain('art:egg.trial-champion')
  })

  it('draws no placeholder for a battle sheet that fails to load: only its absence', () => {
    for (const r of m5Rows(all)) expect(r.optional, r.key).toBe(true)
  })
})
