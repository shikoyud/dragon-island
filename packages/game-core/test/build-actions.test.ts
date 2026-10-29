import { describe, expect, it } from 'vitest'
import { applyAction } from '../src/actions/apply'
import type { Action } from '../src/actions/types'
import { isValidAction } from '../src/index'
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
    const a = ok(run({ ...s, level: 5, gold: 5_000 }, { type: 'placeBuilding', building: { kind: 'habitat', element: 'earth' }, placement: P(6, 7) }, 1_000))
    expect(a.habitats[2]).toEqual({ id: 'h3', element: 'earth', level: 1, lastCollectedMs: 1_000, placement: P(6, 7) })
    expect(a.gold).toBe(4_500)
    expect(a.constructions).toEqual([{ kind: 'build', building: { type: 'habitat', id: 'h3' }, readyAtMs: 16_000 }])
  })
  it('rejects overlap, bounds, limit and gold', () => {
    err(run({ ...s, level: 5 }, { type: 'placeBuilding', building: { kind: 'habitat', element: 'earth' }, placement: P(0, 0) }, 0), 'OVERLAP')
    err(run({ ...s, level: 5 }, { type: 'placeBuilding', building: { kind: 'habitat', element: 'earth' }, placement: P(8, 8) }, 0), 'OUT_OF_BOUNDS')
    err(run(s, { type: 'placeBuilding', building: { kind: 'habitat', element: 'earth' }, placement: P(6, 7) }, 0), 'HABITAT_LIMIT')
    err(run({ ...s, level: 5, gold: 10 }, { type: 'placeBuilding', building: { kind: 'habitat', element: 'earth' }, placement: P(6, 7) }, 0), 'INSUFFICIENT_GOLD')
  })
  it('a third plot costs 500 and takes 2 min after the tutorial builds', () => {
    const t = { ...s, tutorial: { ...s.tutorial, buildsStarted: 2 } }
    const a = ok(run(t, { type: 'placeBuilding', building: { kind: 'farm' }, placement: P(6, 7) }, 0))
    expect(a.farms[2]).toEqual({ crop: null, readyAtMs: 0, level: 1, placement: P(6, 7) })
    expect([a.gold, a.constructions[0]!.readyAtMs]).toEqual([500, 120_000])
  })
  it('unfinished habitats take no dragons', () => {
    const a = ok(run({ ...s, level: 5 }, { type: 'placeBuilding', building: { kind: 'habitat', element: 'fire' }, placement: P(6, 7) }, 0))
    err(run(a, { type: 'moveDragon', dragonId: 'd1', habitatId: 'h3' }, 0), 'UNDER_CONSTRUCTION')
    const full = { ...a, dragons: [...a.dragons, ...['d3', 'd4'].map(id => ({ id, speciesId: 'fire', level: 1, habitatId: 'h1' }))], hatchery: [{ speciesId: 'fire', readyAtMs: 0 }] }
    expect(ok(run(full, { type: 'hatch', slot: 0 }, 0)).dragons.at(-1)!.habitatId).toBeNull()
  })
  it('decorations are instant, level-gated, refundable at 25% ineligible', () => {
    err(run(s, { type: 'placeBuilding', building: { kind: 'decoration', decoration: 'hayCart' }, placement: P(6, 7) }, 0), 'LEVEL_TOO_LOW')
    err(run({ ...s, level: 45 }, { type: 'placeBuilding', building: { kind: 'decoration', decoration: 'starPool' }, placement: P(6, 7) }, 0), 'WRONG_ISLAND')
    const a = ok(run({ ...s, level: 6, gold: 1_000, eligibleGold: 1_000 }, { type: 'placeBuilding', building: { kind: 'decoration', decoration: 'hayCart' }, placement: P(6, 7) }, 0))
    expect([a.gold, a.constructions.length, a.decorations[0]!.id]).toEqual([0, 0, 'c3'])
    const b = ok(run(a, { type: 'removeDecoration', id: 'c3' }, 0))
    expect([b.gold, b.eligibleGold, b.decorations]).toEqual([250, 0, []])
    err(run(a, { type: 'removeDecoration', id: 'c9' }, 0), 'NOT_FOUND')
  })
  it('the Nexus only goes on the Dawnspire, once', () => {
    err(run({ ...s, level: 45, gold: 1e9 }, { type: 'placeBuilding', building: { kind: 'nexus' }, placement: P(6, 7) }, 0), 'WRONG_ISLAND')
    const d = { ...s, level: 45, gold: 1e9, islands: { ...s.islands, unlocked: ['home', 'dawnspire'] as PlayerState['islands']['unlocked'] } }
    const dp = { island: 'dawnspire' as const, col: 0, row: 0, facing: 0 as const }
    const a = ok(run(d, { type: 'placeBuilding', building: { kind: 'nexus' }, placement: dp }, 0))
    expect(a.habitats.at(-1)).toMatchObject({ element: 'any', level: 5 })
    expect(a.gold).toBe(1e9 - 250_000)
    err(run({ ...a, constructions: [] }, { type: 'placeBuilding', building: { kind: 'nexus' }, placement: { ...dp, col: 8 } }, 0), 'NEXUS_EXISTS')
  })
  it('builders can all be busy', () => {
    const busy = { ...s, level: 5, constructions: [0, 1].map(i => ({ kind: 'build' as const, building: { type: 'farm' as const, index: i }, readyAtMs: 9 })) }
    err(run(busy, { type: 'placeBuilding', building: { kind: 'habitat', element: 'earth' }, placement: P(6, 7) }, 0), 'BUILDERS_BUSY')
  })
})

describe('plant on unfinished plots', () => {
  it('rejects a plot under construction', () => {
    const t = { ...s, tutorial: { ...s.tutorial, buildsStarted: 2 } }
    const a = ok(run(t, { type: 'placeBuilding', building: { kind: 'farm' }, placement: P(6, 7) }, 0))
    err(run(a, { type: 'plant', plot: 2, crop: 'sprout' }, 0), 'UNDER_CONSTRUCTION')
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
  it('rejects moving the Nexus off Dawnspire', () => {
    const nexus = { id: 'h3', element: 'any' as const, level: 5, lastCollectedMs: 0, placement: dp }
    const st = { ...base, habitats: [...base.habitats, nexus] }
    err(run(st, { type: 'moveBuilding', target: { type: 'habitat', id: 'h3' }, placement: P(6, 7) }, 0), 'WRONG_ISLAND')
    expect(ok(run(st, { type: 'moveBuilding', target: { type: 'habitat', id: 'h3' }, placement: { ...dp, col: 8 } }, 0)).habitats[2]!.placement.col).toBe(8)
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
