import { CROPS, LAUNCH_CATALOG, newPlayer, outerObstacles, type Dragon } from '@wyrmhaven/game-core'
import { describe, expect, it } from 'vitest'
import { artSetFromManifest } from '../src/art/fromManifest'
import { textureKey } from '../src/art/phaserLoader'
import { FALLBACK_ART } from '../src/art/slots'
import { createBridge } from '../src/game/bridge'
import { badgeY, buildIslandModel, timerLabel } from '../src/game/islandModel'

const C = LAUNCH_CATALOG
const model = (state: Parameters<typeof buildIslandModel>[0], nowMs = 0) => buildIslandModel(state, FALLBACK_ART, C, nowMs, 'home', null)

describe('island model', () => {
  it('puts a badge 2 px above the top of the visible art, scaled', () => {
    const sprite = { src: 'x', w: 64, h: 64, frames: 1, fps: 0 }
    expect(badgeY({ y: 100, sprite: { ...sprite, top: 17 } })).toBe(51)
    expect(badgeY({ y: 100, sprite })).toBe(34)
    expect(badgeY({ y: 100, sprite: { ...sprite, w: 32, h: 32, top: 1 }, scale: 0.25 })).toBe(90)
  })

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
    const withEgg = model({ ...newPlayer(0), nests: [{ ...newPlayer(0).nests[0]!, egg: { speciesId: 'fire', readyAtMs: 15_000 } }] }, 1_000)
    expect(withEgg.objects.find(o => o.id === 'egg:0')!.badge).toBe('14s')
    expect(withEgg.markers.nests).toEqual([{ index: 0, egg: true }])
    expect(timerLabel(0, 5)).toBe('ready')
    expect(timerLabel(3_600_000 * 4, 0)).toBe('4h')
    expect(timerLabel(90_000, 0)).toBe('2m')
  })

  it('places a waiting hatchling in the hatchery, badges the hatchery no room and never overlaps dragons', () => {
    const base = newPlayer(0)
    const waiting: Dragon = { id: 'd9', speciesId: 'fire', level: 1, habitatId: null }
    const three: Dragon[] = ['d3', 'd4', 'd5'].map(id => ({ id, speciesId: 'fire', level: 1, habitatId: 'h1' }))
    const { markers, objects } = model({ ...base, dragons: [...base.dragons, ...three, waiting] })
    expect(markers.dragons).toHaveLength(6)
    expect(markers.waiting).toEqual([{ id: 'd9', noRoom: true }])
    const dragons = objects.filter(o => o.id.startsWith('dragon:'))
    expect(new Set(dragons.map(o => `${o.x},${o.y}`)).size).toBe(dragons.length)
    const wait = dragons.find(o => o.id === 'dragon:d9')!
    const hatch = objects.find(o => o.id === 'hatchery')!
    expect(Math.abs(wait.x - hatch.x)).toBeLessThanOrEqual(32)
    expect(wait.scale).toBe(0.25)
    expect(wait.y).toBeLessThan(hatch.y)
    expect(wait.badge).toBeUndefined()
    expect(hatch.badge).toBe('no room')
    expect(wait.key).toBe(textureKey('hatchling.fire'))
  })

  it('gives the hatchery one badge with its soonest egg timer instead of one per egg', () => {
    const s = { ...newPlayer(0), hatcheryLevel: 3, hatchery: [{ speciesId: 'water', readyAtMs: 3_600_000 }, { speciesId: 'fire', readyAtMs: 540_000 }, { speciesId: 'nature', readyAtMs: 1_200_000 }] }
    const { objects } = model(s, 0)
    expect(objects.find(o => o.id === 'hatchery')!.badge).toBe('9m')
    expect(objects.filter(o => o.id.startsWith('hatchery:')).map(o => o.badge)).toEqual([undefined, undefined, undefined])
    expect(model(newPlayer(0)).objects.find(o => o.id === 'hatchery')!.badge).toBeUndefined()
  })

  it('shows the hoard, hatchery eggs and crops with growth', () => {
    const s = {
      ...newPlayer(0), hoardLevel: 2, hoardPlacement: { island: 'home' as const, col: 8, row: 8, facing: 0 as const },
      hatchery: [{ speciesId: 'water', readyAtMs: 30_000 }],
      farms: [{ ...newPlayer(0).farms[0]!, crop: 'sprout' as const, readyAtMs: 60_000 }, newPlayer(0).farms[1]!],
    }
    const { markers, objects } = model(s, 30_000)
    expect(markers.hoard).toBe(true)
    expect(objects.find(o => o.id === 'hoard')!.badge).toBe('Hoard 2')
    expect(markers.hatchery).toEqual([{ slot: 0 }])
    expect(objects.find(o => o.id === 'hatchery:0')!.badge).toBeUndefined()
    expect(objects.find(o => o.id === 'hatchery')!.badge).toBe('ready')
    expect(objects.find(o => o.id === 'hatchery:0')!.scale).toBe(0.25) // sits in a niche of the hatchery
    const crop = objects.find(o => o.id === 'crop:0')!
    expect(crop.scale).toBeCloseTo(0.75, 5) // half grown
    expect(crop.badge).toBe('30s')
  })

  it('draws objects ordered by anchor y, a habitat before its own dragons', () => {
    const ids = model(newPlayer(0)).objects.map(o => o.id)
    const at = (id: string) => ids.indexOf(id)
    expect(at('habitat:h1')).toBeLessThan(at('dragon:d1'))
    expect(at('habitat:h2')).toBeLessThan(at('dragon:d2'))
    expect(at('farm:0')).toBeLessThan(at('farm:1'))
    expect(at('hatchery')).toBeGreaterThan(at('habitat:h1'))
  })

  it('picks the growth-stage frame when the crop sprite is a stage sheet', () => {
    const art = artSetFromManifest('v1', {
      assets: { 'crop.sprout': { file: 'crop-sprout.png', w: 16, h: 16, frames: 4, fps: 0 } },
    }, C)
    const s = (readyAtMs: number) => ({ ...newPlayer(0), farms: [{ ...newPlayer(0).farms[0]!, crop: 'sprout' as const, readyAtMs }] })
    const crop = (readyAtMs: number, nowMs: number) =>
      buildIslandModel(s(readyAtMs), art, C, nowMs, 'home', null).objects.find(o => o.id === 'crop:0')!
    const grow = CROPS.sprout.growMs
    expect(crop(grow, 0)).toMatchObject({ frame: 0 })
    expect(crop(grow, 0).scale).toBeUndefined()
    expect(crop(grow, grow / 2)).toMatchObject({ frame: 1 })
    expect(crop(grow, grow - 1)).toMatchObject({ frame: 2 }) // not ripe-looking until it is ready
    expect(crop(grow, grow)).toMatchObject({ frame: 3 })
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
    expect(model(null).markers.sign).toBeNull()
  })

  it('draws the home view from placements, with a sign and no other islands', () => {
    const s = { ...newPlayer(0), islands: { homeStep: 0, unlocked: ['home', 'isle2'] as ('home' | 'isle2')[], obstacles: outerObstacles('isle2') } }
    const home = buildIslandModel(s, FALLBACK_ART, C, 0, 'home', null)
    expect(home.objects.find(o => o.id === 'habitat:h2')).toMatchObject({ x: 120, y: 80, key: textureKey('habitat.water') })
    expect(home.markers.obstacles).toEqual([])
    expect(home.markers.sign).toEqual({ cost: 1_000, minLevel: 2 })
    const isle = buildIslandModel(s, FALLBACK_ART, C, 0, 'isle2', null)
    expect(isle.markers.habitats).toEqual([])
    expect(isle.markers.obstacles).toHaveLength(30)
    expect(isle.markers.sign).toBeNull()
  })

  it('shows a ghost with legality and flips mirrored facings', () => {
    const s = newPlayer(0)
    const bad = buildIslandModel(s, FALLBACK_ART, C, 0, 'home', { what: { kind: 'farm' }, size: 2, col: 0, row: 0, facing: 0 })
    expect(bad.markers.ghost).toEqual({ legal: false })
    const good = buildIslandModel(s, FALLBACK_ART, C, 0, 'home', { what: { kind: 'farm' }, size: 2, col: 6, row: 8, facing: 1 })
    expect(good.objects.find(o => o.id === 'ghost')).toMatchObject({ tint: 'ok', flipX: true })
    expect(good.markers.ghost).toEqual({ legal: true })
    expect(good.objects.at(-1)!.id).toBe('ghost')
  })

  it('ignores the mover itself when previewing a move', () => {
    const s = newPlayer(0)
    const p = { what: { kind: 'move' as const, target: { type: 'habitat' as const, id: 'h1' } }, size: 5 as const, col: 0, row: 1, facing: 0 as const }
    expect(buildIslandModel(s, FALLBACK_ART, C, 0, 'home', p).markers.ghost).toEqual({ legal: true })
    expect(buildIslandModel(s, FALLBACK_ART, C, 0, 'home', { ...p, col: 4, row: 0 }).markers.ghost).toEqual({ legal: false })
  })

  it('badges constructions with their timer', () => {
    const s = { ...newPlayer(0), constructions: [{ kind: 'upgrade' as const, building: { type: 'habitat' as const, id: 'h1' }, readyAtMs: 90_000 }] }
    const m = buildIslandModel(s, FALLBACK_ART, C, 0, 'home', null)
    expect(m.objects.find(o => o.id === 'habitat:h1')).toMatchObject({ badge: '2m', tint: 'building' })
    expect(m.markers.constructions).toBe(1)
  })

  it('draws obstacles with their own keys and badges a clear in progress', () => {
    const obstacles = outerObstacles('isle2')
    const s = {
      ...newPlayer(0),
      islands: { homeStep: 0, unlocked: ['home', 'isle2'] as ('home' | 'isle2')[], obstacles },
      constructions: [{ kind: 'clear' as const, obstacleId: obstacles[0]!.id, readyAtMs: 30_000 }],
    }
    const m = buildIslandModel(s, FALLBACK_ART, C, 0, 'isle2', null)
    const o = m.objects.find(x => x.id === `obstacle:${obstacles[0]!.id}`)!
    expect(o.key).toBe(textureKey(`obstacle.${obstacles[0]!.kind}`))
    expect(o).toMatchObject({ tint: 'building', badge: '30s', target: { kind: 'obstacle', id: obstacles[0]!.id } })
    expect(m.objects.find(x => x.id === `obstacle:${obstacles[1]!.id}`)!.tint).toBeUndefined()
  })

  it('shows the expand sign as a target and drops it at the maximum step', () => {
    const at0 = buildIslandModel(newPlayer(0), FALLBACK_ART, C, 0, 'home', null)
    expect(at0.objects.find(o => o.id === 'sign')).toMatchObject({ target: { kind: 'expandSign' } })
    const maxed = { ...newPlayer(0), islands: { homeStep: 12, unlocked: ['home' as const], obstacles: [] } }
    const m = buildIslandModel(maxed, FALLBACK_ART, C, 0, 'home', null)
    expect(m.markers.sign).toBeNull()
    expect(m.objects.find(o => o.id === 'sign')).toBeUndefined()
  })
})
