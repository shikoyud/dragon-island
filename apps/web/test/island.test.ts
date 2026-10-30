import { cropGrowMs, DEFAULT_PRESET, getSpecies, goldPerMinuteX20, habitatCap, LAUNCH_CATALOG, newPlayer, outerObstacles, residents, storedGold, type Dragon } from '@wyrmhaven/game-core'
import { describe, expect, it } from 'vitest'
import { artSetFromManifest } from '../src/art/fromManifest'
import { artEntries, textureKey } from '../src/art/phaserLoader'
import { FALLBACK_ART } from '../src/art/slots'
import { createBridge } from '../src/game/bridge'
import { badgeY, buildIslandModel, dragonKey, goldBadgeThreshold, timerLabel } from '../src/game/islandModel'
import { NEST_EGG_SCALE } from '../src/game/layout'
import { nearestLegalCell } from '../src/state/placing'

const C = LAUNCH_CATALOG
const model = (state: Parameters<typeof buildIslandModel>[0], nowMs = 0) => buildIslandModel(state, FALLBACK_ART, C, nowMs, 'home', null)

describe('island model', () => {
  it('puts a badge 2 px above the top of the visible art, scaled', () => {
    const sprite = { src: 'x', w: 64, h: 64, frames: 1, fps: 0 }
    expect(badgeY({ y: 100, sprite: { ...sprite, top: 17 } })).toBe(51)
    expect(badgeY({ y: 100, sprite })).toBe(34)
    expect(badgeY({ y: 100, sprite: { ...sprite, w: 32, h: 32, top: 1 }, scale: 0.25 })).toBe(90)
  })

  it('picks the sprite by stage: hatchling for babies, juvenile when present else dragon, dragon for adults (R11)', () => {
    expect(dragonKey('terra', 2, FALLBACK_ART)).toBe(textureKey('hatchling.terra'))
    expect(dragonKey('terra', 8, FALLBACK_ART)).toBe(textureKey('dragon.terra'))
    expect(dragonKey('terra', 5, FALLBACK_ART)).toBe(textureKey('dragon.terra'))
    const withJuvenile = artSetFromManifest('t', { assets: { 'juvenile.terra': { file: 'j.png', w: 48, h: 48, frames: 1, fps: 0 } } }, C)
    expect(withJuvenile.juvenile['terra']?.src).toBe('/art/t/j.png')
    expect(withJuvenile.juvenile['flame']).toBeUndefined()
    expect(dragonKey('terra', 5, withJuvenile)).toBe(textureKey('juvenile.terra'))
    expect(dragonKey('flame', 5, withJuvenile)).toBe(textureKey('dragon.flame'))
    expect(dragonKey('terra', 8, withJuvenile)).toBe(textureKey('dragon.terra'))
    expect(artEntries(withJuvenile).some(e => e.key === textureKey('juvenile.terra'))).toBe(true)
  })

  it('draws a Lv 8 resident with the dragon sheet and a waiting Lv 2 with the hatchling sheet', () => {
    const s = newPlayer(0)
    const lv8 = { ...s, dragons: s.dragons.map(d => (d.id === 'd1' ? { ...d, level: 8 } : d)) }
    expect(model(lv8).objects.find(o => o.id === 'dragon:d1')!.key).toBe(textureKey('dragon.terra'))
    const lv2 = { ...s, dragons: s.dragons.map(d => (d.id === 'd1' ? { ...d, level: 2 } : d)) }
    expect(model(lv2).objects.find(o => o.id === 'dragon:d1')!.key).toBe(textureKey('hatchling.terra'))
  })

  it('describes the starting island', () => {
    const { markers, objects } = model(newPlayer(0))
    expect(markers.habitats).toEqual(['h1', 'h2'])
    expect(markers.dragons).toEqual(['d1', 'd2'])
    expect(markers.breeders).toEqual([{ index: 0, egg: false }])
    // The Mountain stands on its 5x5 footprint at (4, 7), still drawn with the nest sprite until its art lands (Task 11).
    expect(objects.find(o => o.id === 'breeder:0')).toMatchObject({ key: textureKey('building.nest'), x: -24, y: 84, target: { kind: 'breeder', index: 0 } })
    expect(markers.hatchery).toEqual([])
    expect(markers.farms).toHaveLength(1)
    expect(objects.find(o => o.id === 'habitat:h1')!.key).toBe(textureKey('habitat.terra'))
    expect(objects.find(o => o.id === 'dragon:d2')!.key).toBe(textureKey('hatchling.flame')) // Lv 1 is a baby (R11)
    for (const o of objects) {
      expect(Number.isInteger(o.x) && Number.isInteger(o.y)).toBe(true)
    }
  })

  it('shows stored gold and timers as badges', () => {
    const { objects } = model(newPlayer(0), 600_000)
    expect(objects.find(o => o.id === 'habitat:h1')!.badge).toBe('gold')
    expect(model(newPlayer(0), 0).objects.find(o => o.id === 'habitat:h1')!.badge).toBeUndefined()
    const withEgg = model({ ...newPlayer(0), breeders: [{ ...newPlayer(0).breeders[0]!, egg: { speciesId: 'flame', readyAtMs: 15_000, hatchMs: 1 } }] }, 1_000)
    expect(withEgg.objects.find(o => o.id === 'egg:0')!.badge).toBe('14s')
    expect(withEgg.objects.find(o => o.id === 'egg:0')!.scale).toBe(NEST_EGG_SCALE) // sits inside the 32x32 nest
    expect(withEgg.markers.breeders).toEqual([{ index: 0, egg: true }])
    expect(timerLabel(0, 5)).toBe('ready')
    expect(timerLabel(3_600_000 * 4, 0)).toBe('4h')
    expect(timerLabel(90_000, 0)).toBe('2m')
  })

  describe('GOLD badge threshold: min(one minute of the residents, 5 % of the cap), floored', () => {
    const at = (state: Parameters<typeof buildIslandModel>[0], nowMs: number) => model(state, nowMs).objects.find(o => o.id === 'habitat:h1')!
    const terra = (): ReturnType<typeof newPlayer> => {
      const s = newPlayer(0)
      return { ...s, dragons: s.dragons.map(d => (d.id === 'd1' ? { ...d, level: 5 } : d.id === 'd2' ? { ...d, speciesId: 'terra', level: 5, habitatId: 'h1' } : d)) }
    }
    it('Terra L1 with two Lv 5 Commons (1,320 gold/min, cap 80,000): no badge at 1,319, gold at 1,320', () => {
      const s = terra()
      expect(habitatCap('terra', 1, DEFAULT_PRESET)).toBe(80_000)
      expect(residents(s, 'h1')).toHaveLength(2)
      expect(at(s, 59_999).badge).toBeUndefined() // 1,319 Gold stored
      expect(storedGold(s.habitats[0]!, residents(s, 'h1'), C, 59_999, DEFAULT_PRESET)).toBe(1_319)
      expect(at(s, 60_000).badge).toBe('gold') // 1,320
      expect(at(s, 59_999).target).toEqual({ kind: 'habitat', id: 'h1' })
    })
    it('counts the capped rate when the preset has a habitatRateCap (A13)', () => {
      const war = { id: 'h1', element: 'war' as const, level: 1, lastCollectedMs: 0, placement: { island: 'home' as const, col: 0, row: 0, facing: 0 as const } }
      const d: Dragon = { id: 'x', speciesId: 'terra-war', level: 5, feeds: 0, habitatId: 'h1' }
      const capped = { ...DEFAULT_PRESET, habitatRateCap: 125 }
      expect(goldBadgeThreshold(war, [d], 10_000_000, C, DEFAULT_PRESET)).toBe(990) // 19,800 / 20
      expect(goldBadgeThreshold(war, [d], 10_000_000, C, capped)).toBe(431) // floor(8,625 / 20)
    })
    it('uses 5 % of the cap when that is smaller than a minute of income', () => {
      // The launch catalog has no Legendary yet: use its richest species at Lv 40, housed in its own element.
      const rate40 = (sp: ReturnType<typeof getSpecies>) => goldPerMinuteX20(sp.elements[0]!, sp.rarity, 40, DEFAULT_PRESET)
      const legend = [...C.species.values()].sort((a, b) => rate40(b) - rate40(a))[0]!
      const el = legend.elements[0]!
      const s = newPlayer(0)
      const strong = { ...s, habitats: s.habitats.map(h => (h.id === 'h1' ? { ...h, element: el } : h)), dragons: s.dragons.map(d => (d.id === 'd1' || d.id === 'd2' ? { ...d, speciesId: legend!.id, level: 40, habitatId: 'h1' } : d)) }
      const live = residents(strong, 'h1')
      expect(live).toHaveLength(2)
      const x20 = live.reduce((n, d) => n + goldPerMinuteX20(el, legend.rarity, d.level, DEFAULT_PRESET), 0)
      const threshold = Math.floor(habitatCap(el, 1, DEFAULT_PRESET) * 5 / 100)
      expect(Math.floor(x20 / 20)).toBeGreaterThan(threshold) // a minute of income is more than 5 % of the cap
      const msFor = (gold: number) => Math.ceil(gold * 20 * 60_000 / x20)
      expect(storedGold(strong.habitats[0]!, live, C, msFor(threshold) - 1, DEFAULT_PRESET)).toBe(threshold - 1)
      expect(at(strong, msFor(threshold) - 1).badge).toBeUndefined()
      expect(at(strong, msFor(threshold)).badge).toBe('gold')
    })
  })

  it('badges a habitat full once its stored gold reaches the cap', () => {
    const { objects } = model(newPlayer(0), 10_000_000_000)
    expect(objects.find(o => o.id === 'habitat:h1')!.badge).toBe('full')
  })

  it('places a waiting hatchling in the hatchery, badges the hatchery no room and never overlaps dragons', () => {
    const base = newPlayer(0)
    const waiting: Dragon = { id: 'd9', speciesId: 'flame', level: 1, feeds: 0, habitatId: null }
    const three: Dragon[] = ['d3', 'd4', 'd5'].map(id => ({ id, speciesId: 'flame', level: 1, feeds: 0, habitatId: 'h1' }))
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
    expect(wait.key).toBe(textureKey('hatchling.flame'))
  })

  it('gives the hatchery one badge with its soonest egg timer instead of one per egg', () => {
    const s = { ...newPlayer(0), hatcheryLevel: 3, hatchery: [{ speciesId: 'sea', readyAtMs: 3_600_000 }, { speciesId: 'flame', readyAtMs: 540_000 }, { speciesId: 'nature', readyAtMs: 1_200_000 }] }
    const { objects } = model(s, 0)
    expect(objects.find(o => o.id === 'hatchery')!.badge).toBe('9m')
    expect(objects.filter(o => o.id.startsWith('hatchery:')).map(o => o.badge)).toEqual([undefined, undefined, undefined])
    expect(model(newPlayer(0)).objects.find(o => o.id === 'hatchery')!.badge).toBeUndefined()
  })

  it('shows hatchery eggs and crops with growth', () => {
    const s = {
      ...newPlayer(0),
      hatchery: [{ speciesId: 'sea', readyAtMs: 30_000 }],
      farms: [{ ...newPlayer(0).farms[0]!, crop: 'dragonBush' as const, readyAtMs: 37_500 }],
    }
    const { markers, objects } = model(s, 30_000)
    expect(objects.find(o => o.id === 'hoard')).toBeUndefined()
    expect(markers.hatchery).toEqual([{ slot: 0 }])
    expect(objects.find(o => o.id === 'hatchery:0')!.badge).toBeUndefined()
    expect(objects.find(o => o.id === 'hatchery')!.badge).toBe('ready')
    expect(objects.find(o => o.id === 'hatchery:0')!.scale).toBe(0.25) // sits in a niche of the hatchery
    const crop = objects.find(o => o.id === 'crop:0')!
    expect(crop.scale).toBeCloseTo(0.75, 5) // half grown
    expect(crop.badge).toBe('8s') // 7.5 s left of the 15 s Flash-14 grow time
  })

  it('badges a ripe crop "ripe" (not the generic "ready" of eggs)', () => {
    const s = { ...newPlayer(0), farms: [{ ...newPlayer(0).farms[0]!, crop: 'dragonBush' as const, readyAtMs: 15_000 }] }
    expect(model(s, 14_999).objects.find(o => o.id === 'crop:0')!.badge).toBe('1s')
    expect(model(s, 15_000).objects.find(o => o.id === 'crop:0')!.badge).toBe('ripe')
    expect(model(s, 99_000).objects.find(o => o.id === 'crop:0')!.badge).toBe('ripe')
  })

  it('draws back to front by col + row + size (isometric depth), a habitat before its own dragons', () => {
    const ids = model(newPlayer(0)).objects.map(o => o.id)
    const at = (id: string) => ids.indexOf(id)
    expect(at('habitat:h1')).toBeLessThan(at('dragon:d1'))
    expect(at('habitat:h2')).toBeLessThan(at('dragon:d2'))
    expect(at('hatchery')).toBeGreaterThan(at('habitat:h1'))
    expect(at('habitat:h2')).toBeLessThan(at('farm:0')) // (5,0)x5 sums to 10, (10,0)x2 to 12
  })

  it('swaps a ripe crop to its sway loop when the art has one', () => {
    const art = artSetFromManifest('v1', {
      assets: {
        'crop.dragonBush': { file: 'crop-dragon-bush.png', w: 16, h: 16, frames: 4, fps: 0 },
        'crop.dragonBush.sway': { file: 'crop-dragon-bush-sway.png', w: 16, h: 16, frames: 4, fps: 4 },
      },
    }, C)
    const s = (readyAtMs: number) => ({ ...newPlayer(0), farms: [{ ...newPlayer(0).farms[0]!, crop: 'dragonBush' as const, readyAtMs }] })
    const crop = (nowMs: number) => buildIslandModel(s(cropGrowMs('dragonBush', DEFAULT_PRESET)), art, C, nowMs, 'home', null).objects.find(o => o.id === 'crop:0')!
    expect(crop(0)).toMatchObject({ key: textureKey('crop.dragonBush'), frame: 0 })
    const ripe = crop(cropGrowMs('dragonBush', DEFAULT_PRESET))
    expect(ripe).toMatchObject({ key: textureKey('crop.dragonBush.sway'), sprite: { fps: 4, frames: 4 } })
    expect(ripe.frame).toBeUndefined()
    expect(artEntries(art).map(r => r.key)).toContain(textureKey('crop.dragonBush.sway'))
  })

  it('picks the growth-stage frame when the crop sprite is a stage sheet', () => {
    const art = artSetFromManifest('v1', {
      assets: { 'crop.dragonBush': { file: 'crop-dragon-bush.png', w: 16, h: 16, frames: 4, fps: 0 } },
    }, C)
    const s = (readyAtMs: number) => ({ ...newPlayer(0), farms: [{ ...newPlayer(0).farms[0]!, crop: 'dragonBush' as const, readyAtMs }] })
    const crop = (readyAtMs: number, nowMs: number) =>
      buildIslandModel(s(readyAtMs), art, C, nowMs, 'home', null).objects.find(o => o.id === 'crop:0')!
    const grow = cropGrowMs('dragonBush', DEFAULT_PRESET)
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
    expect(seen).toContainEqual({ kind: 'breeder', index: 0 })
    expect(seen).toContainEqual({ kind: 'farm', plot: 0 })
  })

  it('is empty without a state', () => {
    expect(model(null).objects).toEqual([])
    expect(model(null).markers.sign).toBeNull()
  })

  it('draws the home view from placements, with a sign and no other islands', () => {
    const s = { ...newPlayer(0), islands: { homeStep: 0, unlocked: ['home', 'isle2'] as ('home' | 'isle2')[], obstacles: outerObstacles('isle2') } }
    const home = buildIslandModel(s, FALLBACK_ART, C, 0, 'home', null)
    expect(home.objects.find(o => o.id === 'habitat:h2')).toMatchObject({ x: 40, y: 60, key: textureKey('habitat.flame') }) // bottom vertex of its 5x5 diamond
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
    expect(bad.markers.ghost).toEqual({ legal: false, col: 0, row: 0, size: 2 })
    const good = buildIslandModel(s, FALLBACK_ART, C, 0, 'home', { what: { kind: 'farm' }, size: 2, col: 9, row: 8, facing: 1 })
    expect(good.objects.find(o => o.id === 'ghost')).toMatchObject({ tint: 'ok', flipX: true })
    expect(good.markers.ghost).toEqual({ legal: true, col: 9, row: 8, size: 2 })
    expect(good.objects.at(-1)!.id).toBe('ghost')
  })

  it('draws the Grove ghost with the nest sprite until its own art lands, on a 5x5 footprint', () => {
    const s = { ...newPlayer(0), islands: { ...newPlayer(0).islands, homeStep: 1 } }
    const m = buildIslandModel(s, FALLBACK_ART, C, 0, 'home', { what: { kind: 'grove' }, size: 5, col: 9, row: 7, facing: 0 })
    expect(m.markers.ghost).toEqual({ legal: true, col: 9, row: 7, size: 5 })
    expect(m.objects.find(o => o.id === 'ghost')!.key).toBe(textureKey('building.nest'))
  })

  it('draws the Golden Aerie ghost with the Nexus sprite until its own art lands', () => {
    const s = { ...newPlayer(0), islands: { ...newPlayer(0).islands, homeStep: 1 } } // the starting island has no free 5x5 spot
    const spot = nearestLegalCell(s, { kind: 'goldenAerie' }, 'home', { col: 4, row: 4 })!
    const m = buildIslandModel(s, FALLBACK_ART, C, 0, 'home', { what: { kind: 'goldenAerie' }, size: 5, ...spot, facing: 0 })
    expect(m.markers.ghost).toEqual({ legal: true, ...spot, size: 5 })
    expect(m.objects.find(o => o.id === 'ghost')!.key).toContain('building.nexus')
  })

  it('ignores the mover itself when previewing a move', () => {
    const s = newPlayer(0)
    const p = { what: { kind: 'move' as const, target: { type: 'habitat' as const, id: 'h1' } }, size: 5 as const, col: 0, row: 1, facing: 0 as const }
    expect(buildIslandModel(s, FALLBACK_ART, C, 0, 'home', p).markers.ghost).toMatchObject({ legal: true })
    expect(buildIslandModel(s, FALLBACK_ART, C, 0, 'home', { ...p, col: 4, row: 0 }).markers.ghost).toMatchObject({ legal: false })
  })

  it('badges constructions with their timer', () => {
    const s = { ...newPlayer(0), constructions: [{ kind: 'upgrade' as const, building: { type: 'habitat' as const, id: 'h1' }, readyAtMs: 90_000 }] }
    const m = buildIslandModel(s, FALLBACK_ART, C, 0, 'home', null)
    expect(m.objects.find(o => o.id === 'habitat:h1')).toMatchObject({ badge: '2m', tint: 'building' })
    expect(m.markers.constructions).toBe(1)
  })

  it('draws the construction effect over each building being built or upgraded, right after it', () => {
    const s = { ...newPlayer(0), constructions: [{ kind: 'upgrade' as const, building: { type: 'farm' as const, index: 0 }, readyAtMs: 90_000 }] }
    const { objects } = buildIslandModel(s, FALLBACK_ART, C, 0, 'home', null)
    const ids = objects.map(o => o.id)
    expect(ids.filter(id => id.startsWith('fx:'))).toEqual(['fx:farm:0'])
    expect(ids.indexOf('fx:farm:0')).toBe(ids.indexOf('farm:0') + 1)
    const farm = objects.find(o => o.id === 'farm:0')!
    expect(objects.find(o => o.id === 'fx:farm:0')).toMatchObject({ key: textureKey('fx.construction'), x: farm.x, target: farm.target })
    expect(objects.find(o => o.id === 'fx:farm:0')!.y).toBeLessThan(farm.y)
    expect(buildIslandModel(newPlayer(0), FALLBACK_ART, C, 0, 'home', null).objects.some(o => o.id.startsWith('fx:'))).toBe(false)
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
