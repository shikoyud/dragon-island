import { describe, expect, it } from 'vitest'
import { applyAction } from '../src/actions/apply'
import type { Action } from '../src/actions/types'
import { isValidAction } from '../src/index'
import { getSpecies } from '../src/catalog'
import { hatcherySlots, nestBreedMs } from '../src/buildings'
import { breedTimerMs } from '../src/data/breeding-timers'
import { FLASH_14 } from '../src/data/presets'
import { createRng } from '../src/rng'
import { newPlayer, type PlayerState } from '../src/state'
import { FIXTURE_CATALOG } from './fixtures'
import { err, ok } from './helpers'

const s = newPlayer(0)
const rng = createRng(1)
const run = (st: PlayerState, a: Action, t: number) => applyAction(st, a, t, rng, FIXTURE_CATALOG)
const P = (col: number, row: number) => ({ island: 'home' as const, col, row, facing: 0 as const })

describe('placeBuilding', () => {
  it('places a habitat under construction and charges gold', () => {
    const a = ok(run({ ...s, level: 5, gold: 5_000 }, { type: 'placeBuilding', building: { kind: 'habitat', element: 'terra' }, placement: P(6, 7) }, 1_000))
    expect(a.habitats[2]).toEqual({ id: 'h3', element: 'terra', level: 1, lastCollectedMs: 1_000, placement: P(6, 7) })
    expect(a.gold).toBe(4_500)
    expect(a.constructions).toEqual([{ kind: 'build', building: { type: 'habitat', id: 'h3' }, readyAtMs: 16_000 }])
  })
  it('rejects overlap, bounds, unlock level and gold', () => {
    err(run({ ...s, level: 5 }, { type: 'placeBuilding', building: { kind: 'habitat', element: 'terra' }, placement: P(0, 0) }, 0), 'OVERLAP')
    err(run({ ...s, level: 5 }, { type: 'placeBuilding', building: { kind: 'habitat', element: 'terra' }, placement: P(8, 8) }, 0), 'OUT_OF_BOUNDS')
    err(run({ ...s, level: 5, gold: 1e9 }, { type: 'placeBuilding', building: { kind: 'habitat', element: 'electric' }, placement: P(6, 7) }, 0), 'LEVEL_TOO_LOW')
    err(run({ ...s, level: 5, gold: 10 }, { type: 'placeBuilding', building: { kind: 'habitat', element: 'terra' }, placement: P(6, 7) }, 0), 'INSUFFICIENT_GOLD')
  })
  it('has no habitat count limit: land is the only cap (§5)', () => {
    // A level 1 player already owns two habitats; the old limit (2 + level / 5) refused a third.
    const st = ok(run({ ...s, level: 1, gold: 1_000 }, { type: 'placeBuilding', building: { kind: 'habitat', element: 'terra' }, placement: P(6, 7) }, 0))
    expect(st.habitats).toHaveLength(3)
    expect(st.gold).toBe(500)
  })
  it('charges the §5.2 build price at the unlock level and times it by tier (A5)', () => {
    const t = { ...s, level: 6, gold: 100_000, tutorial: { ...s.tutorial, buildsStarted: 2 } }
    const a = ok(run(t, { type: 'placeBuilding', building: { kind: 'habitat', element: 'electric' }, placement: P(6, 7) }, 1_000))
    expect(a.gold).toBe(75_000)
    expect(a.constructions[0]!.readyAtMs).toBe(1_000 + 600_000)
    expect(a.habitats.at(-1)).toMatchObject({ element: 'electric', level: 1 })
    const dark = ok(run({ ...t, level: 14, gold: 1e9 }, { type: 'placeBuilding', building: { kind: 'habitat', element: 'dark' }, placement: P(6, 7) }, 0))
    expect([dark.gold, dark.constructions[0]!.readyAtMs]).toEqual([1e9 - 150_000, 2_400_000])
    const flame = ok(run(t, { type: 'placeBuilding', building: { kind: 'habitat', element: 'flame' }, placement: P(6, 7) }, 0))
    expect([flame.gold, flame.constructions[0]!.readyAtMs]).toEqual([98_000, 100_000])
  })
  it('a third farm needs PL 4, costs 9,000 and takes 10 s (60 s classic / 6) after the tutorial builds', () => {
    const t = { ...s, level: 4, gold: 20_000, tutorial: { ...s.tutorial, buildsStarted: 2 } }
    const a = ok(run(t, { type: 'placeBuilding', building: { kind: 'farm' }, placement: P(6, 7) }, 0))
    expect(a.farms[2]).toEqual({ crop: null, readyAtMs: 0, level: 1, placement: P(6, 7) })
    expect([a.gold, a.constructions[0]!.readyAtMs]).toEqual([11_000, 10_000])
  })
  it('gates farms by player level (§5.3) and caps them at 8', () => {
    const t = { ...s, gold: 1e9, tutorial: { ...s.tutorial, buildsStarted: 2 } }
    err(run({ ...t, level: 3 }, { type: 'placeBuilding', building: { kind: 'farm' }, placement: P(6, 7) }, 0), 'LEVEL_TOO_LOW')
    ok(run({ ...t, level: 4 }, { type: 'placeBuilding', building: { kind: 'farm' }, placement: P(6, 7) }, 0))
    const fakeFarm = (i: number) => ({ crop: null, readyAtMs: 0, level: 1, placement: P(20 + i, 0) })
    const two = { ...t, level: 3, farms: [fakeFarm(0), fakeFarm(1)] }
    ok(run({ ...two, farms: [fakeFarm(0)] }, { type: 'placeBuilding', building: { kind: 'farm' }, placement: P(6, 7) }, 0))
    err(run(two, { type: 'placeBuilding', building: { kind: 'farm' }, placement: P(6, 7) }, 0), 'LEVEL_TOO_LOW')
    err(run({ ...t, level: 50, farms: Array.from({ length: 8 }, (_, i) => fakeFarm(i)) }, { type: 'placeBuilding', building: { kind: 'farm' }, placement: P(6, 7) }, 0), 'MAX_PLOTS')
  })
  it('unfinished habitats take no dragons', () => {
    const a = ok(run({ ...s, level: 5, gold: 5_000 }, { type: 'placeBuilding', building: { kind: 'habitat', element: 'flame' }, placement: P(6, 7) }, 0))
    err(run(a, { type: 'moveDragon', dragonId: 'd1', habitatId: 'h3' }, 0), 'UNDER_CONSTRUCTION')
    const full = { ...a, dragons: [...a.dragons, ...['d3', 'd4'].map(id => ({ id, speciesId: 'flame', level: 1, feeds: 0, habitatId: 'h1' }))], hatchery: [{ speciesId: 'flame', readyAtMs: 0 }] }
    expect(ok(run(full, { type: 'hatch', slot: 0 }, 0)).dragons.at(-1)!.habitatId).toBeNull()
  })
  it('decorations are instant, level-gated, refundable at 25%', () => {
    err(run(s, { type: 'placeBuilding', building: { kind: 'decoration', decoration: 'hayCart' }, placement: P(6, 7) }, 0), 'LEVEL_TOO_LOW')
    err(run({ ...s, level: 45 }, { type: 'placeBuilding', building: { kind: 'decoration', decoration: 'starPool' }, placement: P(6, 7) }, 0), 'WRONG_ISLAND')
    const a = ok(run({ ...s, level: 6, gold: 1_000 }, { type: 'placeBuilding', building: { kind: 'decoration', decoration: 'hayCart' }, placement: P(6, 7) }, 0))
    expect([a.gold, a.constructions.length, a.decorations[0]!.id]).toEqual([0, 0, 'c3'])
    const b = ok(run(a, { type: 'removeDecoration', id: 'c3' }, 0))
    expect([b.gold, b.decorations]).toEqual([250, []])
    err(run(a, { type: 'removeDecoration', id: 'c9' }, 0), 'NOT_FOUND')
  })
  it('the Nexus is gone: placeBuilding refuses it', () => {
    expect(isValidAction({ type: 'placeBuilding', building: { kind: 'nexus' }, placement: P(6, 7) })).toBe(false)
  })
  it('builders can all be busy', () => {
    const busy = { ...s, level: 5, constructions: [0, 1].map(i => ({ kind: 'build' as const, building: { type: 'farm' as const, index: i }, readyAtMs: 9 })) }
    err(run(busy, { type: 'placeBuilding', building: { kind: 'habitat', element: 'terra' }, placement: P(6, 7) }, 0), 'BUILDERS_BUSY')
  })
})

describe('plant on unfinished plots', () => {
  it('rejects a plot under construction', () => {
    const t = { ...s, level: 4, gold: 20_000, tutorial: { ...s.tutorial, buildsStarted: 2 } }
    const a = ok(run(t, { type: 'placeBuilding', building: { kind: 'farm' }, placement: P(6, 7) }, 0))
    err(run(a, { type: 'plant', plot: 2, crop: 'dragonBush' }, 0), 'UNDER_CONSTRUCTION')
  })
})

describe('moveBuilding', () => {
  it('moving a building over its own footprint is allowed; hatchery stays home', () => {
    const a = ok(run(s, { type: 'moveBuilding', target: { type: 'habitat', id: 'h1' }, placement: P(0, 1) }, 0))
    expect(a.habitats[0]!.placement).toEqual(P(0, 1))
    expect(ok(run(s, { type: 'moveBuilding', target: { type: 'habitat', id: 'h1' }, placement: { ...P(0, 0), facing: 3 } }, 0)).habitats[0]!.placement.facing).toBe(3)
    err(run({ ...s, islands: { ...s.islands, unlocked: ['home', 'isle2'] } }, { type: 'moveBuilding', target: { type: 'hatchery' }, placement: { island: 'isle2', col: 0, row: 0, facing: 0 } }, 0), 'WRONG_ISLAND')
    err(run(s, { type: 'moveBuilding', target: { type: 'habitat', id: 'h9' }, placement: P(1, 0) }, 0), 'NOT_FOUND')
  })
})

describe('isValidAction placements', () => {
  it('rejects malformed placements', () => {
    for (const placement of [{ island: 'home', col: 1.5, row: 0, facing: 0 }, { island: 'home', col: -1, row: 0, facing: 0 }, { island: 'home', col: 0, row: 0, facing: 4 }, { island: 'moon', col: 0, row: 0, facing: 0 }, { island: 'home', col: 1e9, row: 0, facing: 0 }])
      expect(isValidAction({ type: 'moveBuilding', target: { type: 'hatchery' }, placement })).toBe(false)
    expect(isValidAction({ type: 'placeBuilding', building: { kind: 'decoration', decoration: 'constructor' }, placement: P(0, 0) })).toBe(false)
    expect(isValidAction({ type: 'moveBuilding', target: { type: 'hatchery' }, placement: P(0, 0) })).toBe(true)
  })
})

describe('Dawnspire-only buildings stay on Dawnspire', () => {
  const dp = { island: 'dawnspire' as const, col: 0, row: 0, facing: 0 as const }
  const base = { ...s, islands: { ...s.islands, unlocked: ['home', 'dawnspire'] as PlayerState['islands']['unlocked'] } }
  it('a Golden Aerie may move to any island', () => {
    const aerie = { id: 'h3', element: 'aerie' as const, level: 5, lastCollectedMs: 0, placement: dp }
    const st = { ...base, habitats: [...base.habitats, aerie] }
    expect(ok(run(st, { type: 'moveBuilding', target: { type: 'habitat', id: 'h3' }, placement: P(6, 7) }, 0)).habitats[2]!.placement).toEqual(P(6, 7))
  })
  it('rejects moving a Dawnspire decoration home', () => {
    const st = { ...base, decorations: [{ id: 'c3', kind: 'starPool' as const, placement: dp }] }
    err(run(st, { type: 'moveBuilding', target: { type: 'decoration', id: 'c3' }, placement: P(6, 7) }, 0), 'WRONG_ISLAND')
  })
  it('rejects malformed place/move payloads', () => {
    expect(isValidAction({ type: 'placeBuilding', building: { kind: 'habitat', element: 'plasma' }, placement: P(0, 0) })).toBe(false)
    expect(isValidAction({ type: 'placeBuilding', building: { kind: 'farm' }, placement: { ...P(0, 0), facing: 4 } })).toBe(false)
    expect(isValidAction({ type: 'moveBuilding', target: { type: 'moon' }, placement: P(0, 0) })).toBe(false)
  })
})

describe('startUpgrade / finishConstruction', () => {
  it('upgrades a habitat on a timer and applies it at finish, collecting first', () => {
    // Flame L1 to L2 costs 20,000 Gold and 1 h / 6 = 600,000 ms (§5.2, A5).
    const t = { ...s, gold: 25_000, tutorial: { ...s.tutorial, buildsStarted: 2 } }
    const a = ok(run(t, { type: 'startUpgrade', building: { type: 'habitat', id: 'h1' } }, 0))
    expect([a.gold, a.habitats[0]!.level, a.constructions[0]]).toEqual([5_000, 1, { kind: 'upgrade', building: { type: 'habitat', id: 'h1' }, readyAtMs: 600_000 }])
    err(run(a, { type: 'startUpgrade', building: { type: 'habitat', id: 'h1' } }, 0), 'UNDER_CONSTRUCTION')
    err(run(a, { type: 'finishConstruction', index: 0 }, 599_999), 'NOT_READY')
    const b = ok(run(a, { type: 'finishConstruction', index: 0 }, 600_000))
    expect([b.habitats[0]!.level, b.constructions, b.gold]).toEqual([2, [], 5_700])
  })
  it('lets a player level 1 player with enough Gold upgrade a habitat to level 3 (L2 x 4), no player-level gate', () => {
    const l2 = { ...s, level: 1, gold: 100_000, habitats: s.habitats.map(h => ({ ...h, level: 2 })) }
    expect(ok(run(l2, { type: 'startUpgrade', building: { type: 'habitat', id: 'h1' } }, 0)).gold).toBe(20_000)
  })
  it('charges L2 x 16 for level 4 and refuses Gold for level 5 (the store sells L5)', () => {
    const l3 = { ...s, level: 10, gold: 400_000, tutorial: { ...s.tutorial, buildsStarted: 2 }, habitats: s.habitats.map(h => ({ ...h, level: 3 })) }
    const a = ok(run(l3, { type: 'startUpgrade', building: { type: 'habitat', id: 'h1' } }, 0))
    expect([a.gold, a.constructions[0]!.readyAtMs]).toEqual([400_000 - 320_000, 7_200_000])
    const l4 = { ...s, level: 50, gold: 1e12, habitats: s.habitats.map(h => ({ ...h, level: 4 })) }
    err(run(l4, { type: 'startUpgrade', building: { type: 'habitat', id: 'h1' } }, 0), 'MAX_LEVEL')
  })
  it('reports NOT_FOUND, MAX_LEVEL, INSUFFICIENT_GOLD and BUILDERS_BUSY in order', () => {
    err(run(s, { type: 'startUpgrade', building: { type: 'habitat', id: 'h9' } }, 0), 'NOT_FOUND')
    err(run(s, { type: 'startUpgrade', building: { type: 'nest', index: 3 } }, 0), 'NOT_FOUND')
    const max = { ...s, gold: 1e9, habitats: s.habitats.map(h => ({ ...h, level: 5 })) }
    err(run(max, { type: 'startUpgrade', building: { type: 'habitat', id: 'h1' } }, 0), 'MAX_LEVEL')
    err(run({ ...s, gold: 10 }, { type: 'startUpgrade', building: { type: 'habitat', id: 'h1' } }, 0), 'INSUFFICIENT_GOLD')
    const busy = { ...s, gold: 25_000, constructions: [0, 1].map(i => ({ kind: 'build' as const, building: { type: 'farm' as const, index: i }, readyAtMs: 9 })) }
    err(run(busy, { type: 'startUpgrade', building: { type: 'habitat', id: 'h1' } }, 0), 'BUILDERS_BUSY')
  })
  it('a clock behind readyAtMs is NOT_READY and finishing is idempotent by index', () => {
    const a = ok(run({ ...s, gold: 25_000 }, { type: 'startUpgrade', building: { type: 'habitat', id: 'h1' } }, 50_000))
    err(run(a, { type: 'finishConstruction', index: 0 }, 10_000), 'NOT_READY')
    const b = ok(run(a, { type: 'finishConstruction', index: 0 }, 65_000))
    err(run(b, { type: 'finishConstruction', index: 0 }, 65_000), 'NOT_FOUND')
  })
  it('finishing a build only removes the construction', () => {
    const a = ok(run({ ...s, level: 5 }, { type: 'placeBuilding', building: { kind: 'habitat', element: 'terra' }, placement: P(6, 7) }, 0))
    const b = ok(run(a, { type: 'finishConstruction', index: 0 }, 15_000))
    expect([b.constructions, b.habitats.length, b.habitats[2]!.level]).toEqual([[], 3, 1])
  })
  it('validates the new actions', () => {
    expect(isValidAction({ type: 'startUpgrade', building: { type: 'hatchery' } })).toBe(true)
    expect(isValidAction({ type: 'startUpgrade', building: { type: 'hoard' } })).toBe(false)
    expect(isValidAction({ type: 'finishConstruction', index: 0 })).toBe(true)
    expect(isValidAction({ type: 'finishConstruction', index: -1 })).toBe(false)
  })
  it('farm, nest and hatchery levels change yields, breed time and slots', () => {
    const t = { ...s, level: 30, gold: 200_000, tutorial: { breedDone: true, hatchDone: true, buildsStarted: 2 } }
    const f = ok(run(ok(run(t, { type: 'startUpgrade', building: { type: 'farm', index: 0 } }, 0)), { type: 'finishConstruction', index: 0 }, 900_000))
    const planted = ok(run({ ...f, farms: f.farms.map((p, i) => i === 0 ? { ...p, crop: 'warlordPepper' as const, readyAtMs: 0 } : p) }, { type: 'harvest', plot: 0 }, 900_000))
    expect(planted.food - f.food).toBe(39_000)
    const n = ok(run(ok(run(t, { type: 'startUpgrade', building: { type: 'nest', index: 0 } }, 0)), { type: 'finishConstruction', index: 0 }, 7_200_000))
    const parents = n.dragons.map(d => ({ ...d, level: 4 }))
    const bred = ok(run({ ...n, dragons: parents }, { type: 'startBreed', parentA: 'd1', parentB: 'd2' }, 7_200_000))
    const child = getSpecies(FIXTURE_CATALOG, bred.nests[0]!.egg!.speciesId)
    expect(bred.nests[0]!.egg!.readyAtMs - 7_200_000).toBe(nestBreedMs(breedTimerMs(child.rarity, child.elements, FLASH_14), 2))
    const h = ok(run(ok(run(t, { type: 'startUpgrade', building: { type: 'hatchery' } }, 0)), { type: 'finishConstruction', index: 0 }, 7_200_000))
    expect(hatcherySlots(h.hatcheryLevel)).toBe(4)
  })
})

describe('upgrading buildings keep working (spec 6)', () => {
  const up = (b: object): PlayerState => ({ ...s, constructions: [{ kind: 'upgrade', building: b, readyAtMs: 999_999 } as never] })
  const unfinished = (b: object): PlayerState => ({ ...s, constructions: [{ kind: 'build', building: b, readyAtMs: 999_999 } as never] })

  it('a habitat under upgrade takes a moved and a hatched dragon', () => {
    const base = { ...s, dragons: [...s.dragons, { id: 'd9', speciesId: 'flame', level: 1, feeds: 0, habitatId: null }] }
    const upgrading = { ...base, constructions: up({ type: 'habitat', id: 'h1' }).constructions }
    expect(ok(run(upgrading, { type: 'moveDragon', dragonId: 'd9', habitatId: 'h1' }, 0)).dragons.find(d => d.id === 'd9')!.habitatId).toBe('h1')
    const hatching = { ...upgrading, hatchery: [{ speciesId: 'flame', readyAtMs: 0 }] }
    const hatched = ok(run(hatching, { type: 'hatch', slot: 0 }, 0))
    expect(hatched.dragons.find(d => d.id === `d${hatching.nextId}`)!.habitatId).toBe('h1')
  })

  it('a farm plot under upgrade can be planted, an unfinished one cannot', () => {
    expect(ok(run(up({ type: 'farm', index: 0 }), { type: 'plant', plot: 0, crop: 'dragonBush' }, 0)).farms[0]!.crop).toBe('dragonBush')
    err(run(unfinished({ type: 'farm', index: 0 }), { type: 'plant', plot: 0, crop: 'dragonBush' }, 0), 'UNDER_CONSTRUCTION')
  })

  it('an unfinished habitat still refuses dragons', () => {
    const st = { ...unfinished({ type: 'habitat', id: 'h1' }), dragons: [...s.dragons, { id: 'd9', speciesId: 'flame', level: 1, feeds: 0, habitatId: null }] }
    err(run(st, { type: 'moveDragon', dragonId: 'd9', habitatId: 'h1' }, 0), 'UNDER_CONSTRUCTION')
  })
})
