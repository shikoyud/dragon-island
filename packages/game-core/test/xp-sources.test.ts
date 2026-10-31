import { describe, expect, it } from 'vitest'
import { applyAction } from '../src/actions/apply'
import type { Action } from '../src/actions/types'
import { BUILD_XP_GOLD_PER_XP, BUILD_XP_MIN } from '../src/data/xp'
import { LAUNCH_CATALOG } from '../src/data/launch-catalog'
import { FLASH_14 } from '../src/data/presets'
import { buildXp, xpToNext } from '../src/progression'
import { createRng } from '../src/rng'
import { newPlayer, type PlayerState } from '../src/state'
import { ok } from './helpers'

const base = newPlayer(0)
const run = (st: PlayerState, a: Action, t = 0) => applyAction(st, a, t, createRng(1), LAUNCH_CATALOG, FLASH_14, 1)
const P = (col: number, row: number) => ({ island: 'home' as const, col, row, facing: 0 as const })
// Reads an award straight off `xp` when no level is gained.
const gained = (before: PlayerState, after: PlayerState) => after.xp - before.xp

describe('buildXp (Q2 a)', () => {
  it('is Gold / 20 with a floor of 5, capped at the XP to leave the level', () => {
    expect([BUILD_XP_GOLD_PER_XP, BUILD_XP_MIN]).toEqual([20, 5])
    expect(buildXp(10, { ...base, level: 1 })).toBe(5)
    expect(buildXp(5_000, { ...base, level: 3 })).toBe(250)
    expect(buildXp(250_000, { ...base, level: 18 })).toBe(xpToNext(18))
    expect(buildXp(250_000, { ...base, level: 18 })).toBe(9_088)
  })
})

describe('first-time hatch (R30)', () => {
  const hatchRare = (discovered: string[]) =>
    ok(run({ ...base, level: 50, discovered, hatchery: [{ speciesId: 'terra-flame', readyAtMs: 0 }] }, { type: 'hatch', slot: 0 }))
  it('doubles the XP when the species is new to the Book', () => {
    expect(hatchRare(['terra', 'flame']).xp).toBe(1_920)
  })
  it('a hatchling that has no room (it waits with no habitat) still pays the double', () => {
    const noRoom = ok(run({ ...base, level: 50, habitats: [], discovered: ['terra', 'flame'], hatchery: [{ speciesId: 'terra-flame', readyAtMs: 0 }] }, { type: 'hatch', slot: 0 }))
    expect(noRoom.dragons.at(-1)!.habitatId).toBeNull()
    expect(noRoom.xp).toBe(1_920)
  })
  it('pays the plain XP for a second one', () => {
    expect(hatchRare(['terra', 'flame', 'terra-flame']).xp).toBe(960)
  })
  it('pays the plain XP for a Common already discovered', () => {
    const r = ok(run({ ...base, level: 50, hatchery: [{ speciesId: 'terra', readyAtMs: 0 }] }, { type: 'hatch', slot: 0 }))
    expect(r.xp).toBe(120)
  })
  it('buying a Basic awards no XP', () => {
    const sea = { id: 'h3', element: 'sea' as const, level: 1, lastCollectedMs: 0, placement: P(9, 0) }
    const st: PlayerState = { ...base, level: 3, gold: 5_000, habitats: [...base.habitats, sea] }
    const a = ok(run(st, { type: 'buyBasic', element: 'sea' }))
    expect(a.xp).toBe(0)
    expect(a.discovered).toContain('sea')
  })
})

describe('build XP is paid when the Gold is spent (R31)', () => {
  it('a Sea habitat (5,000 Gold) at PL 3 awards 250, not 3,000', () => {
    const st: PlayerState = { ...base, level: 3, gold: 5_000 }
    expect(gained(st, ok(run(st, { type: 'placeBuilding', building: { kind: 'habitat', element: 'sea' }, placement: P(7, 7) })))).toBe(250)
  })
  it('a War habitat (250,000 Gold) at PL 18 is capped at xpToNext(18) and levels up once', () => {
    const st: PlayerState = { ...base, level: 18, gold: 250_000 }
    const a = ok(applyAction(st, { type: 'placeBuilding', building: { kind: 'habitat', element: 'war' }, placement: P(7, 7) }, 0, createRng(1), LAUNCH_CATALOG, FLASH_14, 3))
    expect(a).toMatchObject({ level: 19, xp: 0 })
  })
  it('Farm 2 (3,000 Gold) awards 150', () => {
    const st: PlayerState = { ...base, level: 3, gold: 3_000 }
    expect(gained(st, ok(run(st, { type: 'placeBuilding', building: { kind: 'farm' }, placement: P(7, 7) })))).toBe(150)
  })
  it('an expansion for 1,000 Gold awards 50', () => {
    const st: PlayerState = { ...base, level: 2, gold: 1_000 }
    expect(gained(st, ok(run(st, { type: 'expandIsland' })))).toBe(50)
  })
  it('an island unlock pays build XP', () => {
    const st: PlayerState = { ...base, level: 12, gold: 40_000 }
    expect(gained(st, ok(run(st, { type: 'unlockIsland' })))).toBe(2_000)
  })
  it('an upgrade pays build XP on the Gold paid', () => {
    const st: PlayerState = { ...base, level: 10, gold: 1_000_000 }
    const a = ok(run(st, { type: 'startUpgrade', building: { type: 'habitat', id: 'h1' } }))
    expect(st.gold - a.gold).toBeGreaterThan(0)
    expect(gained(st, a)).toBe(buildXp(st.gold - a.gold, st))
  })
  it('a decoration awards 0', () => {
    const st: PlayerState = { ...base, level: 50, gold: 1_000_000 }
    const a = ok(run(st, { type: 'placeBuilding', building: { kind: 'decoration', decoration: 'stonePath' }, placement: P(7, 7) }))
    expect(a.gold).toBeLessThan(st.gold)
    expect(a.xp).toBe(0)
  })
  it('premium items (farmL5, goldenAerie) award 0', () => {
    const farm = ok(run({ ...base, level: 50, farms: [{ ...base.farms[0]!, level: 4 }] }, { type: 'buy', item: { kind: 'farmL5', index: 0 } }))
    expect(farm.xp).toBe(0)
    const aerie = ok(run({ ...base, level: 50 }, { type: 'buy', item: { kind: 'goldenAerie', placement: P(7, 7) } }))
    expect(aerie.xp).toBe(0)
  })
  it('no Gold spent pays no build XP: buildXp(0) is 0, not the paid-build minimum', () => {
    expect(buildXp(0, { ...base, level: 1 })).toBe(0)
    expect(buildXp(1, { ...base, level: 1 })).toBe(BUILD_XP_MIN)
  })
  it('a refused build changes nothing: no Gold, no XP', () => {
    const st: PlayerState = { ...base, level: 3, gold: 4_999, xp: 40 }
    const r = run(st, { type: 'placeBuilding', building: { kind: 'habitat', element: 'sea' }, placement: P(7, 7) })
    expect(r).toEqual({ ok: false, error: 'INSUFFICIENT_GOLD' })
  })
  it('collecting Gold awards 0', () => {
    expect(ok(run(base, { type: 'collectGold', habitatId: 'h1' }, 600_000)).xp).toBe(0)
  })
})
