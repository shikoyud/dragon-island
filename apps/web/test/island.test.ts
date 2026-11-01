import { cropGrowMs, DEFAULT_PRESET, getSpecies, goldPerMinuteX20, habitatCap, hatcherySlots, LAUNCH_CATALOG, newPlayer, plotOfTile, residents, storedGold, type Dragon } from '@wyrmhaven/game-core'
import { describe, expect, it } from 'vitest'
import { artSetFromManifest } from '../src/art/fromManifest'
import { artEntries, textureKey } from '../src/art/phaserLoader'
import { FALLBACK_ART } from '../src/art/slots'
import { createBridge } from '../src/game/bridge'
import { lockedTiles } from '../src/game/camera'
import { ARROW_SCALE, badgeY, buildIslandModel, dragonKey, goldBadgeThreshold, groundVariant, objectSignature, timerLabel } from '../src/game/islandModel'
import { anchor, cellTop, dragonSpot, footprintContains, NEST_EGG_SCALE } from '../src/game/layout'
import { nearestLegalCell } from '../src/state/placing'
import { FREE, FREE_2, withIsland, withPlots } from './land'

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
    // The Mountain stands on its 5x5 footprint at (8, 8) (R50), still drawn with the nest sprite until its art lands.
    expect(objects.find(o => o.id === 'breeder:0')).toMatchObject({ key: textureKey('building.nest'), x: 0, y: 104, target: { kind: 'breeder', index: 0 } })
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
    const withEgg = model({ ...newPlayer(0), breeders: [{ ...newPlayer(0).breeders[0]!, egg: { speciesId: 'flame', readyAtMs: 15_000, hatchMs: 1, xpFree: false } }] }, 1_000)
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

  it('badges a finished breeder egg "ready" with a free Hatchery slot and "hatchery full" without (R18, R20)', () => {
    const p = newPlayer(0)
    const done = { ...p, breeders: [{ ...p.breeders[0]!, egg: { speciesId: 'flame', readyAtMs: 1_000, hatchMs: 1, xpFree: false } }] }
    const free = model(done, 2_000).objects.find(o => o.id === 'egg:0')!
    expect(free.badge).toBe('ready')
    expect(free.key).toBe(textureKey('egg.flame')) // the primary element's egg, never the species (R20)
    const slots = hatcherySlots(done.hatcheryLevel, done.hatcheryFifthSlot)
    const full = { ...done, hatchery: Array.from({ length: slots }, () => ({ speciesId: 'sea', readyAtMs: 9_000_000 })) }
    expect(model(full, 2_000).objects.find(o => o.id === 'egg:0')!.badge).toBe('hatchery full')
    expect(model(full, 500).objects.find(o => o.id === 'egg:0')!.badge).toBe('1s') // unfinished keeps its timer
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
    expect(at('hatchery')).toBeLessThan(at('habitat:h1')) // (8,13)x4 and (13,8)x4 both sum to 25: the lower col goes first
    expect(at('habitat:h2')).toBeLessThan(at('farm:0')) // (17,8)x4 sums to 29, (21,8)x3 to 32
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
    expect(model(null).markers.signs).toEqual([])
  })

  it('draws the home view from placements, with its signs and no other islands', () => {
    const open = withIsland(newPlayer(0), 'isle2')
    const s = { ...open, islands: { ...open.islands, obstacles: [{ id: 'o1', kind: 'bush' as const, island: 'isle2' as const, col: 8, row: 8 }] } }
    const home = buildIslandModel(s, FALLBACK_ART, C, 0, 'home', null)
    expect(home.objects.find(o => o.id === 'habitat:h2')).toMatchObject({ x: 72, y: 132, key: textureKey('habitat.flame') }) // bottom vertex of its 4x4 diamond
    expect(home.markers.obstacles).toEqual([])
    expect(home.markers.signs).toHaveLength(3)
    expect(home.markers.signs[0]).toMatchObject({ price: 100 })
    const isle = buildIslandModel(s, FALLBACK_ART, C, 0, 'isle2', null)
    expect(isle.markers.habitats).toEqual([])
    expect(isle.markers.obstacles).toEqual(['o1'])
    expect(isle.markers.signs[0]).toMatchObject({ price: 100_000 })
  })

  describe('locked land on Home', () => {
    const home = (s = newPlayer(0)) => buildIslandModel(s, FALLBACK_ART, C, 0, 'home', null)

    it('has 3 signs, each captioned Tap to buy, drawn on top of everything', () => {
      const m = home()
      expect(m.markers.signs.map(s => s.plot)).toEqual([2, 7, 11])
      const signs = m.objects.filter(o => o.id.startsWith('sign:'))
      expect(signs).toHaveLength(3)
      expect(signs.every(s => s.caption === 'Tap to buy')).toBe(true)
      const lastObstacle = Math.max(...m.objects.map((o, i) => (o.id.startsWith('obstacle:') ? i : -1)))
      expect(m.objects.findIndex(o => o.id === 'sign:2')).toBeGreaterThan(lastObstacle)
      // After every building and dragon too: the three signs are the last objects.
      expect(m.objects.slice(-3).map(o => o.id)).toEqual(['sign:2', 'sign:7', 'sign:11'])
    })

    it('puts the signs before the ghost', () => {
      const m = buildIslandModel(newPlayer(0), FALLBACK_ART, C, 0, 'home', { what: { kind: 'farm' }, size: 3, col: FREE.col, row: FREE.row, facing: 0 })
      expect(m.objects.slice(-3).map(o => o.id)).toEqual(['sign:11', 'ghost', 'arrow'])
    })

    it('an obstacle on a locked plot shows, and tapping it opens that plot', () => {
      const s = newPlayer(0)
      const locked = s.islands.obstacles.filter(o => o.island === 'home' && [2, 7, 11].includes(plotOfTile(o.col, o.row)!))
      expect(locked.length).toBeGreaterThan(0)
      const m = home(s)
      for (const o of locked) {
        const drawn = m.objects.find(x => x.id === `obstacle:${o.id}`)!
        expect(drawn.target).toEqual({ kind: 'plot', island: 'home', plot: plotOfTile(o.col, o.row) })
      }
    })

    it('an obstacle on owned land still opens itself', () => {
      const s = newPlayer(0)
      const own = s.islands.obstacles.filter(o => o.island === 'home' && [5, 6, 9, 10].includes(plotOfTile(o.col, o.row)!))
      expect(own.length).toBeGreaterThan(0)
      const m = home(s)
      for (const o of own) expect(m.objects.find(x => x.id === `obstacle:${o.id}`)!.target).toEqual({ kind: 'obstacle', id: o.id })
    })

    it('an obstacle becomes a plain obstacle once its plot is bought', () => {
      const s = newPlayer(0)
      const o = s.islands.obstacles.find(x => x.island === 'home' && plotOfTile(x.col, x.row) === 7)!
      const bought = withPlots(s, [5, 6, 9, 10, 7])
      expect(home(bought).objects.find(x => x.id === `obstacle:${o.id}`)!.target).toEqual({ kind: 'obstacle', id: o.id })
    })

    it('isle2 keeps its 8 signs, uncaptioned, and its fog', () => {
      const s = withIsland(newPlayer(0), 'isle2')
      const m = buildIslandModel(s, FALLBACK_ART, C, 0, 'isle2', null)
      expect(m.markers.signs).toHaveLength(8)
      expect(m.objects.filter(o => o.id.startsWith('sign:')).some(o => o.caption !== undefined)).toBe(false)
      expect(lockedTiles(s, 'isle2')).toHaveLength(32 * 32 - 4 * 64)
    })

    it('the caption is part of the sprite signature', () => {
      const [a] = home().objects.filter(o => o.id.startsWith('sign:'))
      expect(objectSignature(a!, false)).not.toBe(objectSignature({ ...a!, caption: undefined }, false))
    })
  })

  it('shows a ghost with legality and flips mirrored facings', () => {
    const s = newPlayer(0)
    const bad = buildIslandModel(s, FALLBACK_ART, C, 0, 'home', { what: { kind: 'farm' }, size: 3, col: 0, row: 0, facing: 0 })
    expect(bad.markers.ghost).toEqual({ legal: false, col: 0, row: 0, size: 3 })
    const good = buildIslandModel(s, FALLBACK_ART, C, 0, 'home', { what: { kind: 'farm' }, size: 3, col: FREE.col, row: FREE.row, facing: 1 })
    expect(good.objects.find(o => o.id === 'ghost')).toMatchObject({ flipX: true })
    expect(good.markers.ghost).toEqual({ legal: true, col: FREE.col, row: FREE.row, size: 3 })
    expect(good.objects.at(-2)!.id).toBe('ghost')
  })

  describe('while placing', () => {
    const h1Move = { what: { kind: 'move', target: { type: 'habitat', id: 'h1' } }, size: 4, col: 14, row: 13, facing: 0 } as const
    const resident = { id: 'd1', speciesId: 'flame', level: 1, feeds: 0, habitatId: 'h1' }
    const withResident = { ...newPlayer(0), dragons: [resident, { ...resident, id: 'd2' }] }

    it('the model hides the moved building and carries its residents on the ghost', () => {
      const m = buildIslandModel(withResident, FALLBACK_ART, C, 0, 'home', h1Move)
      expect(m.objects.some(o => o.id === 'habitat:h1')).toBe(false)
      const a = anchor(14, 13, 4)
      expect(m.objects.find(o => o.id === 'ghost')).toMatchObject(a)
      expect(m.objects.find(o => o.id === 'dragon:d1')).toMatchObject(dragonSpot(a, 0))
      expect(m.objects.find(o => o.id === 'dragon:d1')!.y).toBeLessThan(a.y)
      expect(m.objects.find(o => o.id === 'dragon:d2')).toMatchObject(dragonSpot(a, 1))
    })

    it('the ghost, its residents and the arrow go last, in that order', () => {
      const ids = buildIslandModel(withResident, FALLBACK_ART, C, 0, 'home', h1Move).objects.map(o => o.id)
      expect(ids.slice(-4)).toEqual(['ghost', 'dragon:d2', 'dragon:d1', 'arrow'])
    })

    it('leaves other buildings and their residents alone', () => {
      const m = buildIslandModel(withResident, FALLBACK_ART, C, 0, 'home', { ...h1Move, what: { kind: 'move', target: { type: 'farm', index: 0 } }, size: 3 })
      expect(m.objects.some(o => o.id === 'habitat:h1')).toBe(true)
      expect(m.objects.some(o => o.id === 'farm:0')).toBe(false)
      expect(m.objects.find(o => o.id === 'dragon:d1')).toMatchObject(dragonSpot(anchor(13, 8, 4), 0))
    })

    it('a new building hides nothing', () => {
      const m = buildIslandModel(withResident, FALLBACK_ART, C, 0, 'home', { what: { kind: 'farm' }, size: 3, col: FREE.col, row: FREE.row, facing: 0 })
      expect(m.objects.some(o => o.id === 'habitat:h1')).toBe(true)
      expect(m.objects.some(o => o.id === 'farm:0')).toBe(true)
    })

    it('moved to another island, the residents travel on the ghost there and the habitat is not drawn', () => {
      const m = buildIslandModel(withResident, FALLBACK_ART, C, 0, 'isle2', { ...h1Move, col: 13, row: 8 })
      expect(m.objects.some(o => o.id === 'habitat:h1')).toBe(false)
      expect(m.objects.find(o => o.id === 'dragon:d1')).toMatchObject(dragonSpot(anchor(13, 8, 4), 0))
    })

    it('a moved Hatchery carries its eggs', () => {
      const egg = { speciesId: 'flame', readyAtMs: 1000 }
      const hatch = buildIslandModel({ ...newPlayer(0), hatchery: [egg] } as never, FALLBACK_ART, C, 0, 'home', { what: { kind: 'move', target: { type: 'hatchery' } }, size: 4, col: 14, row: 13, facing: 0 })
      expect(hatch.objects.some(o => o.id === 'hatchery')).toBe(false)
      expect(hatch.objects.find(o => o.id === 'hatchery:0')!.y).toBeLessThan(anchor(14, 13, 4).y)
      expect(hatch.objects.find(o => o.id === 'hatchery:0')!.y).toBeGreaterThan(anchor(14, 13, 4).y - 32)
    })

    it('a legal ghost has no tint, an illegal one is red; the footprint marker says which', () => {
      const s = newPlayer(0)
      const good = buildIslandModel(s, FALLBACK_ART, C, 0, 'home', { what: { kind: 'farm' }, size: 3, col: FREE.col, row: FREE.row, facing: 0 })
      expect(good.objects.find(o => o.id === 'ghost')!.tint).toBeUndefined()
      expect(good.markers.ghost!.legal).toBe(true)
      const bad = buildIslandModel(s, FALLBACK_ART, C, 0, 'home', { what: { kind: 'farm' }, size: 3, col: 0, row: 0, facing: 0 })
      expect(bad.objects.find(o => o.id === 'ghost')!.tint).toBe('bad')
      expect(bad.markers.ghost!.legal).toBe(false)
    })

    it('the arrow, at half size, has its tip just above the footprint\'s top vertex, and shows only while placing', () => {
      const m = buildIslandModel(withResident, FALLBACK_ART, C, 0, 'home', h1Move)
      const arrow = m.objects.find(o => o.id === 'arrow')!
      const top = cellTop(14, 13)
      expect(ARROW_SCALE).toBe(0.5)
      expect(arrow.scale).toBe(ARROW_SCALE)
      expect(arrow.x).toBe(top.x)
      expect(arrow.y).toBeLessThan(top.y)
      expect(arrow.y).toBeGreaterThanOrEqual(top.y - 4)
      expect(arrow.key).toBe(textureKey('ui.island.arrow'))
      expect(buildIslandModel(withResident, FALLBACK_ART, C, 0, 'home', null).objects.some(o => o.id === 'arrow')).toBe(false)
    })

    it('the arrow has a drawn fallback at its art size, and takes the manifest art when that lands', () => {
      expect(artEntries(FALLBACK_ART).find(r => r.key === textureKey('ui.island.arrow'))).toMatchObject({ slot: 'arrow', sprite: { src: '', w: 32, h: 40 } })
      const art = artSetFromManifest('t', { assets: { 'ui.island.arrow': { file: 'a.png', w: 32, h: 40, frames: 1, fps: 0 } } }, C)
      expect(artEntries(art).find(r => r.key === textureKey('ui.island.arrow'))!.sprite.src).toContain('a.png')
    })
  })

  it('footprintContains: the cells of the footprint, from its top-left, and no others', () => {
    const p = { col: 13, row: 8, size: 4 }
    for (const c of [{ col: 13, row: 8 }, { col: 16, row: 11 }, { col: 13, row: 11 }, { col: 16, row: 8 }]) expect(footprintContains(c, p)).toBe(true)
    for (const c of [{ col: 12, row: 8 }, { col: 17, row: 8 }, { col: 13, row: 7 }, { col: 13, row: 12 }]) expect(footprintContains(c, p)).toBe(false)
  })

  it('falls back from a hybrid with no art to its primary Basic, and by stage (R23)', () => {
    const e = (file: string) => ({ file, w: 48, h: 48, frames: 1, fps: 0 })
    const none = artSetFromManifest('t', { assets: {} }, C)
    expect(dragonKey('flame-sea', 8, none)).toBe(textureKey('dragon.flame'))
    expect(dragonKey('sea-flame', 8, none)).toBe(textureKey('dragon.sea'))
    const own = artSetFromManifest('t', { assets: { 'dragon.flame-sea': e('fs.png') } }, C)
    expect(dragonKey('flame-sea', 8, own)).toBe(textureKey('dragon.flame-sea'))
    expect(dragonKey('sea-flame', 8, own)).toBe(textureKey('dragon.sea'))
    // Juvenile: the primary Basic's juvenile sheet when present, else its dragon sheet.
    expect(dragonKey('sea-flame', 5, none)).toBe(textureKey('dragon.sea'))
    const withJuv = artSetFromManifest('t', { assets: { 'juvenile.sea': e('js.png') } }, C)
    expect(dragonKey('sea-flame', 5, withJuv)).toBe(textureKey('juvenile.sea'))
    expect(dragonKey('flame-sea', 5, withJuv)).toBe(textureKey('dragon.flame'))
    // A Legendary falls back the same way, by the first element of its row.
    expect(dragonKey('glacier-warlord', 8, none)).toBe(textureKey('dragon.ice'))
    // A baby still uses the hatchling of the primary element.
    expect(dragonKey('flame-sea', 2, none)).toBe(textureKey('hatchling.flame'))
  })

  it('draws a Mountain by level: its own sheet, else a lower level, else the nest; no request for an absent key', () => {
    const b = (file: string) => ({ file, w: 80, h: 80, frames: 1, fps: 0 })
    const withLevel = (assets: Record<string, ReturnType<typeof b>>, level: number) => {
      const art = artSetFromManifest('t', { assets }, C)
      const s = newPlayer(0)
      const st = { ...s, breeders: [{ ...s.breeders[0]!, level }] }
      return { art, obj: buildIslandModel(st, art, C, 0, 'home', null).objects.find(o => o.id === 'breeder:0')! }
    }
    expect(withLevel({ 'building.mountain.1': b('m1.png'), 'building.mountain.2': b('m2.png') }, 2).obj.key).toBe(textureKey('building.mountain.2'))
    expect(withLevel({ 'building.mountain.1': b('m1.png') }, 2).obj.key).toBe(textureKey('building.mountain.1'))
    const none = withLevel({}, 2)
    expect(none.obj.key).toBe(textureKey('building.nest'))
    expect(artEntries(none.art).map(r => r.key).some(k => /^art:building\.(mountain|grove)/.test(k))).toBe(false)
    expect(artEntries(withLevel({ 'building.mountain.2': b('m2.png') }, 2).art).map(r => r.key)).toContain('art:building.mountain.2')
  })

  it('draws the 80x80 Mountain and Grove sheets at scale 1 on the 5x5 footprint, ghost and move too; the nest keeps its native scale', () => {
    const s = newPlayer(0)
    const sheet = { file: 'b.png', w: 80, h: 80, frames: 1, fps: 0 }
    const art = artSetFromManifest('t', { assets: { 'building.mountain.1': sheet, 'building.grove.1': sheet } }, C)
    expect(art.building.breeder.mountain[1]).toMatchObject({ w: 80, h: 80 })
    // 5 cells x 16 px = the sheet's 80 px: scale 1, not 0.5.
    expect(buildIslandModel(s, art, C, 0, 'home', null).objects.find(o => o.id === 'breeder:0')!.scale ?? 1).toBe(1)
    const ghost = buildIslandModel(s, art, C, 0, 'home', { what: { kind: 'grove' }, size: 5, col: FREE.col, row: FREE.row, facing: 0 }).objects.find(o => o.id === 'ghost')!
    expect(ghost.key).toBe(textureKey('building.grove.1'))
    expect(ghost.scale ?? 1).toBe(1)
    const moved = buildIslandModel(s, art, C, 0, 'home', { what: { kind: 'move', target: { type: 'breeder', index: 0 } }, size: 5, col: FREE.col, row: FREE.row, facing: 0 }).objects.find(o => o.id === 'ghost')!
    expect(moved.scale ?? 1).toBe(1)
    expect(buildIslandModel(s, FALLBACK_ART, C, 0, 'home', null).objects.find(o => o.id === 'breeder:0')!.scale).toBeUndefined()
  })

  it('draws every hatchery level sheet at scale 1 on its 4x4 footprint', () => {
    const b = { file: 'h.png', w: 64, h: 64, frames: 1, fps: 0 }
    const art = artSetFromManifest('t', { assets: { 'building.hatchery': b, 'building.hatchery.2': b, 'building.hatchery.3': b, 'building.hatchery.4': b } }, C)
    const s = newPlayer(0)
    for (const level of [1, 2, 3, 4]) {
      const h = buildIslandModel({ ...s, hatcheryLevel: level }, art, C, 0, 'home', null).objects.find(o => o.id === 'hatchery')!
      expect(h.sprite.w).toBe(64)
      expect(h.scale ?? 1).toBe(1)
    }
  })

  it('draws the Hatchery by level with the same fallbacks, and the Grove ghost with its level 1 sheet', () => {
    const b = { file: 'h.png', w: 64, h: 64, frames: 1, fps: 0 }
    const art = artSetFromManifest('t', { assets: { 'building.hatchery.2': b, 'building.grove.1': { ...b, w: 80, h: 80 } } }, C)
    const s = newPlayer(0)
    const key = (level: number) => buildIslandModel({ ...s, hatcheryLevel: level, hatcheryPlacement: { ...s.hatcheryPlacement, island: 'home' } }, art, C, 0, 'home', null).objects.find(o => o.id === 'hatchery')!.key
    expect(key(1)).toBe(textureKey('building.hatchery'))
    expect(key(2)).toBe(textureKey('building.hatchery.2'))
    expect(key(3)).toBe(textureKey('building.hatchery.2'))
    const g = buildIslandModel(s, art, C, 0, 'home', { what: { kind: 'grove' }, size: 5, col: FREE.col, row: FREE.row, facing: 0 })
    expect(g.objects.find(o => o.id === 'ghost')!.key).toBe(textureKey('building.grove.1'))
  })

  it('draws the Roost by tier: its own sheet, else a lower tier, else the nest; at scale 1; no request for an absent key', () => {
    const b = (file: string) => ({ file, w: 64, h: 64, frames: 1, fps: 0 })
    const s0 = newPlayer(0)
    const at = FREE
    const roost = (assets: Record<string, ReturnType<typeof b>>, tier: number) => {
      const art = artSetFromManifest('t', { assets }, C)
      return { art, obj: buildIslandModel({ ...s0, roostPlacement: at, roostTier: tier }, art, C, 0, 'home', null).objects.find(o => o.id === 'roost')! }
    }
    const three = roost({ 'building.roost.1': b('1.png'), 'building.roost.2': b('2.png'), 'building.roost.3': b('3.png') }, 3)
    expect(three.obj.key).toBe(textureKey('building.roost.3'))
    expect(three.obj.scale ?? 1).toBe(1)
    expect(roost({ 'building.roost.1': b('1.png'), 'building.roost.2': b('2.png') }, 3).obj.key).toBe(textureKey('building.roost.2'))
    expect(roost({ 'building.roost.1': b('1.png') }, 3).obj.key).toBe(textureKey('building.roost.1'))
    // A higher sheet is never used for a lower tier.
    expect(roost({ 'building.roost.4': b('4.png') }, 3).obj.key).toBe(textureKey('building.nest'))
    const none = roost({}, 3)
    expect(none.obj.key).toBe(textureKey('building.nest'))
    expect(none.obj.scale).toBeUndefined()
    expect(artEntries(none.art).map(r => r.key).some(k => k.startsWith('art:building.roost'))).toBe(false)
    expect(artEntries(roost({ 'building.roost.2': b('2.png') }, 2).art).map(r => r.key)).toContain('art:building.roost.2')
    // 4 cells x 16 px = the 64 px sheet.
    expect(three.art.building.roostTier[3]).toMatchObject({ w: 64, h: 64 })
    // The ghost: placing a new Roost previews Tier 1; moving one previews its own tier.
    const g1 = artSetFromManifest('t', { assets: { 'building.roost.1': b('1.png'), 'building.roost.3': b('3.png') } }, C)
    const placing = buildIslandModel(s0, g1, C, 0, 'home', { what: { kind: 'roost' }, size: 4, col: FREE_2.col, row: FREE_2.row, facing: 0 }).objects.find(o => o.id === 'ghost')!
    expect(placing.key).toBe(textureKey('building.roost.1'))
    expect(placing.scale ?? 1).toBe(1)
    const moving = buildIslandModel({ ...s0, roostPlacement: at, roostTier: 3 }, g1, C, 0, 'home', { what: { kind: 'move', target: { type: 'roost' } }, size: 4, col: FREE_2.col, row: FREE_2.row, facing: 0 }).objects.find(o => o.id === 'ghost')!
    expect(moving.key).toBe(textureKey('building.roost.3'))
  })

  it('draws the Grove ghost with the nest sprite until its own art lands, on a 5x5 footprint', () => {
    const s = newPlayer(0)
    const m = buildIslandModel(s, FALLBACK_ART, C, 0, 'home', { what: { kind: 'grove' }, size: 5, col: FREE.col, row: FREE.row, facing: 0 })
    expect(m.markers.ghost).toEqual({ legal: true, col: FREE.col, row: FREE.row, size: 5 })
    expect(m.objects.find(o => o.id === 'ghost')!.key).toBe(textureKey('building.nest'))
  })

  it('draws the Golden Aerie ghost with the Nexus sprite until its own art lands', () => {
    const s = newPlayer(0)
    const spot = nearestLegalCell(s, { kind: 'goldenAerie' }, 'home', { col: 4, row: 4 })!
    const m = buildIslandModel(s, FALLBACK_ART, C, 0, 'home', { what: { kind: 'goldenAerie' }, size: 4, ...spot, facing: 0 })
    expect(m.markers.ghost).toEqual({ legal: true, ...spot, size: 4 })
    expect(m.objects.find(o => o.id === 'ghost')!.key).toContain('building.nexus')
  })

  it('ignores the mover itself when previewing a move', () => {
    const s = newPlayer(0)
    const p = { what: { kind: 'move' as const, target: { type: 'habitat' as const, id: 'h1' } }, size: 4 as const, col: 13, row: 8, facing: 0 as const }
    expect(buildIslandModel(s, FALLBACK_ART, C, 0, 'home', p).markers.ghost).toMatchObject({ legal: true })
    expect(buildIslandModel(s, FALLBACK_ART, C, 0, 'home', { ...p, col: 12, row: 8 }).markers.ghost).toMatchObject({ legal: false })
  })

  it('badges constructions with their timer', () => {
    const s = { ...newPlayer(0), constructions: [{ kind: 'upgrade' as const, building: { type: 'habitat' as const, id: 'h1' }, readyAtMs: 90_000 }] }
    const m = buildIslandModel(s, FALLBACK_ART, C, 0, 'home', null)
    expect(m.objects.find(o => o.id === 'habitat:h1')).toMatchObject({ badge: '2m', tint: 'building' })
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
    const obstacles = [{ id: 'o1', kind: 'tree' as const, island: 'isle2' as const, col: 8, row: 8 }, { id: 'o2', kind: 'bush' as const, island: 'isle2' as const, col: 12, row: 8 }]
    const open = withIsland(newPlayer(0), 'isle2')
    const s = {
      ...open,
      islands: { ...open.islands, obstacles },
      constructions: [{ kind: 'clear' as const, obstacleId: obstacles[0]!.id, readyAtMs: 30_000 }],
    }
    const m = buildIslandModel(s, FALLBACK_ART, C, 0, 'isle2', null)
    const o = m.objects.find(x => x.id === `obstacle:${obstacles[0]!.id}`)!
    expect(o.key).toBe(textureKey(`obstacle.${obstacles[0]!.kind}`))
    expect(o).toMatchObject({ tint: 'building', badge: '30s', target: { kind: 'obstacle', id: obstacles[0]!.id } })
    expect(m.objects.find(x => x.id === `obstacle:${obstacles[1]!.id}`)!.tint).toBeUndefined()
  })

  it('ground variants are a stable hash: no diagonal of a 16x16 sample has one variant', () => {
    for (const n of [2, 3, 4]) {
      expect(groundVariant(5, 9, n)).toBe(groundVariant(5, 9, n))
      for (const [dc, dr] of [[1, 1], [1, -1]] as const) {
        for (let k = 0; k < 32; k++) {
          const seen = new Set<number>()
          for (let i = 0; i < 16; i++) {
            const col = dc === 1 ? i : i, row = dr === 1 ? i + k - 16 : 15 - i + k - 16
            seen.add(groundVariant(col + 16, row + 16, n))
          }
          expect(seen.size, `n ${n} diagonal ${dc},${dr} offset ${k}`).toBeGreaterThan(1)
        }
      }
    }
  })

})
