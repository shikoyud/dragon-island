import { CROPS, LAUNCH_CATALOG, newPlayer, type Dragon } from '@wyrmhaven/game-core'
import { describe, expect, it } from 'vitest'
import { artSetFromManifest } from '../src/art/fromManifest'
import { textureKey } from '../src/art/phaserLoader'
import { FALLBACK_ART } from '../src/art/slots'
import { createBridge } from '../src/game/bridge'
import { buildIslandModel, timerLabel } from '../src/game/islandModel'
import { hatcheryPos } from '../src/game/layout'

const C = LAUNCH_CATALOG
const model = (state: Parameters<typeof buildIslandModel>[0], nowMs = 0) => buildIslandModel(state, FALLBACK_ART, C, nowMs)

describe('island model', () => {
  it('describes the starting island', () => {
    const { markers, objects } = model(newPlayer(0))
    expect(markers.habitats).toEqual(['h1', 'h2'])
    expect(markers.dragons).toEqual(['d1', 'd2'])
    expect(markers.nests).toEqual([{ index: 0, egg: false }])
    expect(markers.hatchery).toEqual([])
    expect(markers.farms).toHaveLength(2)
    expect(markers.hoard).toBe(false)
    expect(objects.find(o => o.id === 'habitat:h1')!.key).toBe(textureKey('habitat.fire'))
    expect(objects.find(o => o.id === 'dragon:d2')!.key).toBe(textureKey('dragon.water'))
    for (const o of objects) {
      expect(Number.isInteger(o.x) && Number.isInteger(o.y)).toBe(true)
    }
  })

  it('shows stored gold and timers as badges', () => {
    const { objects } = model(newPlayer(0), 600_000)
    expect(objects.find(o => o.id === 'habitat:h1')!.badge).toBe('20g')
    const withEgg = model({ ...newPlayer(0), nests: [{ speciesId: 'fire', readyAtMs: 15_000 }] }, 1_000)
    expect(withEgg.objects.find(o => o.id === 'egg:0')!.badge).toBe('14s')
    expect(withEgg.markers.nests).toEqual([{ index: 0, egg: true }])
    expect(timerLabel(0, 5)).toBe('ready')
    expect(timerLabel(3_600_000 * 4, 0)).toBe('4h')
    expect(timerLabel(90_000, 0)).toBe('2m')
  })

  it('places a waiting hatchling in the hatchery with a no-room badge and never overlaps dragons', () => {
    const base = newPlayer(0)
    const waiting: Dragon = { id: 'd9', speciesId: 'fire', level: 1, habitatId: null }
    const three: Dragon[] = ['d3', 'd4', 'd5'].map(id => ({ id, speciesId: 'fire', level: 1, habitatId: 'h1' }))
    const { markers, objects } = model({ ...base, dragons: [...base.dragons, ...three, waiting] })
    expect(markers.dragons).toHaveLength(6)
    expect(markers.waiting).toEqual([{ id: 'd9', noRoom: true }])
    const dragons = objects.filter(o => o.id.startsWith('dragon:'))
    expect(new Set(dragons.map(o => `${o.x},${o.y}`)).size).toBe(dragons.length)
    const wait = dragons.find(o => o.id === 'dragon:d9')!
    expect({ x: wait.x, y: wait.y }).toEqual(hatcheryPos(0))
    expect(wait.badge).toBe('no room')
    expect(wait.key).toBe(textureKey('hatchling.fire'))
  })

  it('shows the hoard, hatchery eggs and crops with growth', () => {
    const s = {
      ...newPlayer(0), hoardLevel: 2,
      hatchery: [{ speciesId: 'water', readyAtMs: 30_000 }],
      farms: [{ crop: 'sprout' as const, readyAtMs: 60_000 }, { crop: null, readyAtMs: 0 }],
    }
    const { markers, objects } = model(s, 30_000)
    expect(markers.hoard).toBe(true)
    expect(objects.find(o => o.id === 'hoard')!.badge).toBe('Hoard 2')
    expect(markers.hatchery).toEqual([{ slot: 0 }])
    expect(objects.find(o => o.id === 'hatchery:0')!.badge).toBe('ready')
    const crop = objects.find(o => o.id === 'crop:0')!
    expect(crop.scale).toBeCloseTo(0.75, 5) // half grown
    expect(crop.badge).toBe('30s')
  })

  it('draws habitats back to front, each before its own dragons', () => {
    const base = newPlayer(0)
    const s = {
      ...base,
      habitats: [...base.habitats, { ...base.habitats[0]!, id: 'h3' }],
      dragons: [...base.dragons, { ...base.dragons[0]!, id: 'd3', habitatId: 'h3' }],
    }
    const ids = model(s).objects.map(o => o.id)
    const at = (id: string) => ids.indexOf(id)
    // h3 is the third habitat, which sits on the back row, so it is drawn before the middle-row ones.
    expect(at('habitat:h3')).toBeLessThan(at('habitat:h1'))
    expect(at('habitat:h3')).toBeLessThan(at('dragon:d3'))
    expect(at('dragon:d3')).toBeLessThan(at('habitat:h1'))
    expect(at('habitat:h1')).toBeLessThan(at('dragon:d1'))
    expect(model(s).markers.habitats).toEqual(['h1', 'h2', 'h3'])
  })

  it('picks the growth-stage frame when the crop sprite is a stage sheet', () => {
    const art = artSetFromManifest('v1', {
      assets: { 'crop.sprout': { file: 'crop-sprout.png', w: 16, h: 16, frames: 4, fps: 0 } },
    }, C)
    const s = (readyAtMs: number) => ({ ...newPlayer(0), farms: [{ crop: 'sprout' as const, readyAtMs }] })
    const crop = (readyAtMs: number, nowMs: number) =>
      buildIslandModel(s(readyAtMs), art, C, nowMs).objects.find(o => o.id === 'crop:0')!
    const grow = CROPS.sprout.growMs
    expect(crop(grow, 0)).toMatchObject({ frame: 0 })
    expect(crop(grow, 0).scale).toBeUndefined()
    expect(crop(grow, grow / 2)).toMatchObject({ frame: 2 })
    expect(crop(grow, grow - 1)).toMatchObject({ frame: 3 })
    expect(crop(grow, grow * 2)).toMatchObject({ frame: 3 })
  })

  it('maps every object to a click target the bridge can carry', () => {
    const bridge = createBridge()
    const seen: unknown[] = []
    bridge.on('select', e => seen.push(e.target))
    const { objects } = model(newPlayer(0))
    for (const o of objects) bridge.emit({ type: 'select', target: o.target })
    expect(seen).toContainEqual({ kind: 'habitat', id: 'h1' })
    expect(seen).toContainEqual({ kind: 'dragon', id: 'd1' })
    expect(seen).toContainEqual({ kind: 'nest', index: 0 })
    expect(seen).toContainEqual({ kind: 'farm', plot: 1 })
  })

  it('is empty without a state', () => {
    expect(model(null).objects).toEqual([])
  })
})
