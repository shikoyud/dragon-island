import { applyAction, createRng, ISLAND_ORDER, LAUNCH_CATALOG, newPlayer, type IslandId, type PlayerState } from '@wyrmhaven/game-core'
import { describe, expect, it } from 'vitest'
import { artSetFromManifest } from '../src/art/fromManifest'
import { artEntries, textureKey } from '../src/art/phaserLoader'
import { FALLBACK_ART } from '../src/art/slots'
import {
  buildMapModel, MAP_CELL, MAP_ICON_W, MAP_SPOTS, mapBoxOf, mapIslandAt, mapOpeningView, mapPrice, wantedScene,
} from '../src/game/mapModel'

const fresh = newPlayer(0)
const by = (m: ReturnType<typeof buildMapModel>, id: IslandId) => m.islands.find(i => i.id === id)!
const bridged = (s: PlayerState): PlayerState => {
  const r = applyAction({ ...s, level: 12, gold: 150_000 }, { type: 'buyBridge', island: 'isle2' }, 0, createRng(1), LAUNCH_CATALOG)
  if (!r.ok) throw new Error(r.error)
  return r.state
}

describe('buildMapModel on a fresh player', () => {
  const m = buildMapModel(fresh, FALLBACK_ART, 'home')

  it('has six islands in the GDD\'s order, 96 plots in all, 4 owned', () => {
    expect(m.islands.map(i => i.id)).toEqual(ISLAND_ORDER)
    const plots = m.islands.flatMap(i => i.plots)
    expect(plots).toHaveLength(96)
    expect(plots.filter(p => p.owned)).toHaveLength(4)
    expect(by(m, 'home').plots.filter(p => p.owned).map(p => p.plot)).toEqual([5, 6, 9, 10])
    expect(by(m, 'home').owned).toBe(4)
    expect(by(m, 'isle2').owned).toBe(0)
  })

  it('lays each island\'s plots out as an isometric diamond around its spot', () => {
    for (const i of m.islands) {
      expect({ x: i.x, y: i.y }).toEqual(MAP_SPOTS[i.id])
      const at = (plot: number) => { const p = i.plots.find(q => q.plot === plot)!; return { x: p.x - i.x, y: p.y - i.y } }
      // Plot index = row * 4 + col. Corners: 0 on top, 3 on the right, 15 at the bottom, 12 on the left.
      expect(at(0).x).toBe(0)
      expect(at(15).x).toBe(0)
      expect(at(0).y).toBe(-at(15).y)
      expect(at(0).y).toBeLessThan(0)
      expect(at(3).y).toBe(0)
      expect(at(12).y).toBe(0)
      expect(at(3).x).toBe(-at(12).x)
      expect(at(3).x).toBeGreaterThan(0)
      // A plot one column on is half a plot to the right and down; one row on, half a plot to the left and down.
      expect(at(1).x - at(0).x).toBe(at(4).y - at(0).y + at(1).y - at(0).y)
      expect(at(4).x).toBe(-at(1).x)
      expect(new Set(i.plots.map(p => `${p.x},${p.y}`)).size).toBe(16)
    }
  })

  it('labels Home current, Ember Reach next with its gate and Bridge, and the rest locked with the level only', () => {
    expect(by(m, 'home')).toMatchObject({ state: 'current', label: 'Home Isle · 4 / 16', name: 'Home Isle' })
    expect(by(m, 'isle2')).toMatchObject({ state: 'next', label: 'Ember Reach · Level 12 · Bridge 150,000' })
    expect(by(m, 'isle3')).toMatchObject({ state: 'locked', label: 'Frostspire · Level 18' })
    expect(by(m, 'isle4')).toMatchObject({ state: 'locked', label: 'Ironhold · Level 25' })
    expect(by(m, 'isle5')).toMatchObject({ state: 'locked', label: 'Shadowmere · Level 32' })
    expect(by(m, 'isle6')).toMatchObject({ state: 'locked', label: "Warlord's Crown · Level 40" })
  })

  it('chains five Bridges, none built', () => {
    expect(m.bridges).toEqual([
      { from: 'home', to: 'isle2', built: false }, { from: 'isle2', to: 'isle3', built: false }, { from: 'isle3', to: 'isle4', built: false },
      { from: 'isle4', to: 'isle5', built: false }, { from: 'isle5', to: 'isle6', built: false },
    ])
  })

  it('bounds contain every island whole', () => {
    for (const i of m.islands) {
      const b = mapBoxOf(i.id)
      expect(b.x).toBeGreaterThanOrEqual(m.bounds.x)
      expect(b.y).toBeGreaterThanOrEqual(m.bounds.y)
      expect(b.x + b.w).toBeLessThanOrEqual(m.bounds.x + m.bounds.w)
      expect(b.y + b.h).toBeLessThanOrEqual(m.bounds.y + m.bounds.h)
    }
  })
})

describe('buildMapModel after the Bridge to Ember Reach', () => {
  const s = bridged(fresh)

  it('opens Ember Reach, builds its Bridge, and makes Frostspire next', () => {
    const m = buildMapModel(s, FALLBACK_ART, 'home')
    expect(by(m, 'isle2')).toMatchObject({ state: 'open', label: 'Ember Reach · 4 / 16', owned: 4 })
    expect(by(m, 'isle2').plots.filter(p => p.owned).map(p => p.plot)).toEqual([5, 6, 9, 10])
    expect(m.bridges[0]).toEqual({ from: 'home', to: 'isle2', built: true })
    expect(m.bridges[1]!.built).toBe(false)
    expect(by(m, 'isle3')).toMatchObject({ state: 'next', label: 'Frostspire · Level 18 · Bridge 750,000' })
    expect(by(m, 'isle4').state).toBe('locked')
  })

  it('the viewed island is the current one; Home turns open', () => {
    const m = buildMapModel(s, FALLBACK_ART, 'isle2')
    expect(by(m, 'isle2').state).toBe('current')
    expect(by(m, 'home').state).toBe('open')
  })
})

describe('labels', () => {
  it('format prices of a million and up as M, in whole numbers where they are', () => {
    expect(mapPrice(150_000)).toBe('150,000')
    expect(mapPrice(999_999)).toBe('999,999')
    expect(mapPrice(1_000_000)).toBe('1M')
    expect(mapPrice(2_500_000)).toBe('2.5M')
    expect(mapPrice(100_000_000)).toBe('100M')
    const late: PlayerState = { ...fresh, level: 40, islands: { ...fresh.islands, unlocked: ['home', 'isle2', 'isle3', 'isle4', 'isle5'] } }
    expect(by(buildMapModel(late, FALLBACK_ART, 'home'), 'isle6').label).toBe("Warlord's Crown · Level 40 · Bridge 100M")
    const mid: PlayerState = { ...fresh, islands: { ...fresh.islands, unlocked: ['home', 'isle2', 'isle3'] } }
    expect(by(buildMapModel(mid, FALLBACK_ART, 'home'), 'isle4').label).toBe('Ironhold · Level 25 · Bridge 5M')
  })
})

describe('MAP_SPOTS', () => {
  it('no island\'s box (icon, plots, label) touches another\'s', () => {
    const boxes = ISLAND_ORDER.map(mapBoxOf)
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i]!, b = boxes[j]!
      const apart = a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y
      expect(apart, `${ISLAND_ORDER[i]} and ${ISLAND_ORDER[j]}`).toBe(true)
    }
  })

  it('an island\'s box holds the 128 px icon at today\'s square art, the 128 px plot diamond and the label', () => {
    expect(MAP_ICON_W).toBe(128)
    expect(MAP_CELL.right - MAP_CELL.left).toBeGreaterThanOrEqual(128)
    expect(MAP_CELL.iconBottom - MAP_CELL.top).toBeGreaterThanOrEqual(128) // today's art is square: 32 x 32 at 4x
    expect(MAP_CELL.iconBottom).toBeLessThanOrEqual(MAP_CELL.plotsTop)
    expect(MAP_CELL.plotsBottom).toBeLessThanOrEqual(MAP_CELL.labelTop)
    expect(MAP_CELL.labelTop).toBeLessThan(MAP_CELL.bottom)
  })
})

describe('the icon', () => {
  it('has no key until the art set has the icon, and fills 128 px wide when it has', () => {
    const none = buildMapModel(fresh, FALLBACK_ART, 'home')
    expect(by(none, 'home').key).toBe('')
    const art = artSetFromManifest('v1', {
      assets: {
        'map.home': { file: 'a.png', w: 32, h: 32, frames: 1, fps: 0 },
        'map.isle2': { file: 'b.png', w: 128, h: 96, frames: 1, fps: 0 },
        'map.dawnspire': { file: 'c.png', w: 32, h: 32, frames: 1, fps: 0 },
      },
    }, LAUNCH_CATALOG)
    const m = buildMapModel(fresh, art, 'home')
    expect(by(m, 'home')).toMatchObject({ key: textureKey('map.home'), scale: 4 })
    expect(by(m, 'isle2')).toMatchObject({ key: textureKey('map.isle2'), scale: 1 })
    expect(by(m, 'isle6')).toMatchObject({ key: textureKey('map.isle6'), scale: 4 })
    expect(by(m, 'isle3').key).toBe('')
  })

  it('the backdrop and the Bridge art load into Phaser when the manifest has them', () => {
    const art = artSetFromManifest('v1', {
      assets: {
        'map.backdrop': { file: 'd.png', w: 320, h: 180, frames: 1, fps: 0 },
        'map.bridge': { file: 'e.png', w: 32, h: 16, frames: 1, fps: 0 },
      },
    }, LAUNCH_CATALOG)
    const keys = artEntries(art).map(e => e.key)
    expect(keys).toContain(textureKey('map.backdrop'))
    expect(keys).toContain(textureKey('map.bridge'))
    expect(artEntries(FALLBACK_ART).map(e => e.key)).not.toContain(textureKey('map.backdrop'))
  })
})

describe('mapIslandAt', () => {
  const m = buildMapModel(fresh, FALLBACK_ART, 'home')

  it('finds the island under its icon, its plots or its label', () => {
    for (const id of ISLAND_ORDER) {
      const { x, y } = MAP_SPOTS[id]
      expect(mapIslandAt(m, x, y)).toBe(id)
      expect(mapIslandAt(m, x, y + MAP_CELL.iconBottom - 10)).toBe(id)
      expect(mapIslandAt(m, x, y + MAP_CELL.labelTop + 2)).toBe(id)
    }
  })

  it('open water is nothing', () => {
    const { x, y } = MAP_SPOTS.home
    expect(mapIslandAt(m, x + MAP_CELL.right + 5, y)).toBeNull()
    expect(mapIslandAt(m, x, y + MAP_CELL.bottom + 5)).toBeNull()
    expect(mapIslandAt(m, m.bounds.x - 100, m.bounds.y - 100)).toBeNull()
  })
})

describe('mapOpeningView', () => {
  it('centres on the viewed island\'s box at a whole zoom of at least 1', () => {
    for (const id of ISLAND_ORDER) {
      const v = mapOpeningView(id, 390, 640)
      const b = mapBoxOf(id)
      expect(v).toEqual({ cx: b.x + b.w / 2, cy: b.y + b.h / 2, zoom: 1 })
    }
    expect(mapOpeningView('home', 200, 200).zoom).toBe(1)
    expect(Number.isInteger(mapOpeningView('home', 1440, 750).zoom)).toBe(true)
    expect(mapOpeningView('home', 3840, 2000).zoom).toBeGreaterThan(1)
  })
})

describe('wantedScene', () => {
  it('a battle beats the Map, and the Map beats the island', () => {
    expect(wantedScene({ battle: null, mapOpen: false })).toBe('island')
    expect(wantedScene({ battle: null, mapOpen: true })).toBe('map')
    expect(wantedScene({ battle: {}, mapOpen: true })).toBe('battle')
    expect(wantedScene({ battle: {}, mapOpen: false })).toBe('battle')
  })
})
