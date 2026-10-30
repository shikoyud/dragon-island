import { describe, expect, it } from 'vitest'
import { applyAction } from '../src/actions/apply'
import type { Action } from '../src/actions/types'
import { getSpecies } from '../src/catalog'
import { breedTimerMs } from '../src/data/breeding-timers'
import { breedingPool, activeLegendaries } from '../src/breeding'
import { LAUNCH_CATALOG } from '../src/data/launch-catalog'
import { FLASH_14 } from '../src/data/presets'
import { HATCH_XP, START_BREED_XP } from '../src/data/xp'
import { createRng } from '../src/rng'
import { newPlayer, type Breeder, type BreederEgg, type Dragon, type Egg, type PlayerState } from '../src/state'
import { err, ok } from './helpers'

const s = newPlayer(0)
const s4: PlayerState = { ...s, level: 2, dragons: s.dragons.map(d => ({ ...d, level: 4 })) }
const withParents = (a: string, b: string): PlayerState =>
  ({ ...s4, dragons: [{ ...s4.dragons[0]!, speciesId: a }, { ...s4.dragons[1]!, speciesId: b }] })
const run = (st: PlayerState, a: Action, t: number, seed = 1) => applyAction(st, a, t, createRng(seed), LAUNCH_CATALOG)
const breed: Action = { type: 'startBreed', parentA: 'd1', parentB: 'd2' }
const egg = (speciesId: string, readyAtMs: number): Egg => ({ speciesId, readyAtMs })
const inBreeder = (speciesId: string, readyAtMs: number, hatchMs = 1): BreederEgg => ({ speciesId, readyAtMs, hatchMs })
const breeder = (e: BreederEgg | null = null): Breeder => ({ kind: 'mountain', egg: e, level: 1, placement: { island: 'home', col: 0, row: 0, facing: 0 } })

describe('startBreed', () => {
  it('validates parents', () => {
    err(run(s4, { type: 'startBreed', parentA: 'd1', parentB: 'd1' }, 0), 'INVALID_PARENTS')
    err(run(s4, { type: 'startBreed', parentA: 'd1', parentB: 'dX' }, 0), 'INVALID_PARENTS')
    err(run(s, breed, 0), 'LEVEL_TOO_LOW')
  })

  it('takes the real breed timer on the very first breed (no tutorial timer) and awards xp', () => {
    const a = ok(run(s4, breed, 1_000))
    const e = a.breeders[0]!.egg!
    const child = getSpecies(LAUNCH_CATALOG, e.speciesId)
    expect(e.readyAtMs).not.toBe(1_000 + 15_000)
    expect(e.readyAtMs).toBe(1_000 + breedTimerMs(child.rarity, child.elements, FLASH_14))
    expect(a.xp).toBe(START_BREED_XP)
    err(run(a, breed, 0), 'NO_FREE_BREEDER')
  })

  it('uses the lowest free breeder', () => {
    const a = ok(run({ ...s4, breeders: [breeder(inBreeder('flame', 5)), breeder(), breeder()] }, breed, 0))
    expect(a.breeders[0]!.egg).toEqual(inBreeder('flame', 5))
    expect(a.breeders[1]!.egg).not.toBeNull()
    expect(a.breeders[2]!.egg).toBeNull()
  })

  it('refuses two opposite Basics in either order, before the free-breeder check and without using the RNG', () => {
    let calls = 0
    const counting = { next: () => { calls++; return 0 }, int: () => { calls++; return 0 } }
    for (const [x, y] of [['flame', 'ice'], ['ice', 'flame']] as const) {
      const st = withParents(x, y)
      const r = applyAction(st, breed, 0, counting, LAUNCH_CATALOG)
      expect(r).toEqual({ ok: false, error: 'OPPOSITE_BASICS' })
      const busy = { ...st, breeders: [breeder(inBreeder('flame', 5))] }
      expect(applyAction(busy, breed, 0, counting, LAUNCH_CATALOG)).toEqual({ ok: false, error: 'OPPOSITE_BASICS' })
    }
    expect(calls).toBe(0)
  })

  it('checks the level before the opposite rule, and the free breeder last without using the RNG', () => {
    let calls = 0
    const counting = { next: () => { calls++; return 0 }, int: () => { calls++; return 0 } }
    const low = { ...withParents('flame', 'ice'), dragons: withParents('flame', 'ice').dragons.map(d => ({ ...d, level: 1 })) }
    expect(applyAction(low, breed, 0, counting, LAUNCH_CATALOG)).toEqual({ ok: false, error: 'LEVEL_TOO_LOW' })
    const busy = { ...s4, breeders: [breeder(inBreeder('flame', 5))] }
    expect(applyAction(busy, breed, 0, counting, LAUNCH_CATALOG)).toEqual({ ok: false, error: 'NO_FREE_BREEDER' })
    expect(calls).toBe(0)
  })

  it('a hybrid carrying opposite elements breeds normally', () => {
    const st = withParents('flame-ice', 'ice-flame')
    expect(ok(run(st, breed, 0)).breeders[0]!.egg).not.toBeNull()
  })

  it('has no pity state and draws exactly one rng.int per breed', () => {
    let ints = 0, nexts = 0
    const base = createRng(1)
    const counting = { next: () => { nexts++; return base.next() }, int: (n: number) => { ints++; return base.int(n) } }
    const r = ok(applyAction(s4, breed, 0, counting, LAUNCH_CATALOG))
    expect(r).not.toHaveProperty('pity')
    expect(s).not.toHaveProperty('pity')
    expect([ints, nexts]).toEqual([1, 0])
  })

  describe('Legendary events', () => {
    const tf = withParents('terra', 'flame')
    /** An rng whose single int() lands on `target` in the pool of Terra x Flame on `day`. */
    const forcing = (day: number, speciesId: string) => {
      const pool = breedingPool(
        getSpecies(LAUNCH_CATALOG, 'terra'), getSpecies(LAUNCH_CATALOG, 'flame'),
        { activeLegendaries: activeLegendaries(day, FLASH_14) }, LAUNCH_CATALOG)
      let acc = 0
      for (const e of pool) { if (e.species.id === speciesId) return { next: () => 0, int: () => acc }; acc += e.weight }
      return { next: () => 0, int: () => 0 }
    }

    it('can give Magma Sovereign on day 4 and never on day 5, under Flash-14', () => {
      const on = applyAction(tf, breed, 0, forcing(4, 'magma-sovereign'), LAUNCH_CATALOG, FLASH_14, 4)
      const egg4 = ok(on).breeders[0]!.egg!
      expect(egg4.speciesId).toBe('magma-sovereign')
      // Timer comes from the offspring.
      const child = getSpecies(LAUNCH_CATALOG, 'magma-sovereign')
      expect(egg4.readyAtMs).toBe(breedTimerMs(child.rarity, child.elements, FLASH_14))
      // Day 5: the same roll (1200, Magma's slot on day 4) lands on the next species of the day-5 pool, which is Terra.
      const off = ok(applyAction(tf, breed, 0, forcing(4, 'magma-sovereign'), LAUNCH_CATALOG, FLASH_14, 5))
      expect(off.breeders[0]!.egg!.speciesId).toBe('terra')
    })

    it('an egg bred on the last event day still hatches after the event ends (day 6)', () => {
      const laid = ok(applyAction(tf, breed, 0, forcing(4, 'magma-sovereign'), LAUNCH_CATALOG, FLASH_14, 4))
      const readyAt = laid.breeders[0]!.egg!.readyAtMs
      const day6 = 5 * 86_400_000 + 1
      const collected = ok(applyAction(laid, { type: 'collectEgg', breeder: 0 }, Math.max(readyAt, day6), createRng(1), LAUNCH_CATALOG, FLASH_14, 6))
      const hatchAt = collected.hatchery[0]!.readyAtMs
      const hatched = ok(applyAction(collected, { type: 'hatch', slot: 0 }, hatchAt, createRng(1), LAUNCH_CATALOG, FLASH_14, 6))
      expect(hatched.dragons.some(d => d.speciesId === 'magma-sovereign')).toBe(true)
    })

    it('defaults to day 1, which is inside the Magma window', () => {
      const r = ok(applyAction(tf, breed, 0, forcing(1, 'magma-sovereign'), LAUNCH_CATALOG))
      expect(r.breeders[0]!.egg!.speciesId).toBe('magma-sovereign')
    })
  })
})

describe('collectEgg', () => {
  const laid = ok(run(s4, breed, 0))

  it('moves a ready egg to the hatchery with the real hatch time on the first hatch', () => {
    const ready = laid.breeders[0]!.egg!.readyAtMs
    const sp = getSpecies(LAUNCH_CATALOG, laid.breeders[0]!.egg!.speciesId)
    err(run(laid, { type: 'collectEgg', breeder: 0 }, ready - 1), 'NOT_READY')
    const a = ok(run(laid, { type: 'collectEgg', breeder: 0 }, ready))
    expect(a.breeders[0]!.egg).toBeNull()
    expect(a.hatchery).toEqual([egg(sp.id, ready + breedTimerMs(sp.rarity, sp.elements, FLASH_14))])
    err(run(a, { type: 'collectEgg', breeder: 0 }, ready), 'BREEDER_EMPTY')
    err(run(a, { type: 'collectEgg', breeder: 4 }, ready), 'NOT_FOUND')
  })

  it('uses the hatch time the egg was laid with', () => {
    const st = { ...s, breeders: [breeder(inBreeder('terra-flame', 0, 12_345))] }
    expect(ok(run(st, { type: 'collectEgg', breeder: 0 }, 100)).hatchery[0]!.readyAtMs).toBe(100 + 12_345)
  })

  it('refuses when eggs plus waiting dragons fill the hatchery', () => {
    const waiting: Dragon = { id: 'd9', speciesId: 'flame', level: 1, feeds: 0, habitatId: null }
    const st = { ...laid, hatchery: [egg('flame', 0), egg('sea', 0)], dragons: [...laid.dragons, waiting] }
    err(run(st, { type: 'collectEgg', breeder: 0 }, laid.breeders[0]!.egg!.readyAtMs), 'HATCHERY_FULL')
    expect(st.breeders[0]).toEqual(laid.breeders[0])
  })
})

describe('hatch', () => {
  const ready = { ...s, hatchery: [egg('flame', 30_000)] }

  it('creates a dragon in the first matching habitat', () => {
    const a = ok(run(ready, { type: 'hatch', slot: 0 }, 30_000))
    expect(a.dragons[2]).toEqual({ id: 'd3', speciesId: 'flame', level: 1, feeds: 0, habitatId: 'h2' })
    expect(a.hatchery).toEqual([])
    expect(a.nextId).toBe(4)
    expect(a.xp).toBe(HATCH_XP.common)
  })

  it('waits in the hatchery when every matching habitat is full', () => {
    const extra = ['d5', 'd6', 'd7', 'd8'].map((id, i): Dragon =>
      ({ id, speciesId: i < 2 ? 'flame' : 'sea', level: 1, feeds: 0, habitatId: i < 2 ? 'h1' : 'h2' }))
    const full = { ...ready, dragons: [...ready.dragons, ...extra] }
    const a = ok(run(full, { type: 'hatch', slot: 0 }, 30_000))
    expect(a.dragons.find(d => d.id === 'd3')!.habitatId).toBeNull()
  })

  it('rejects bad or unready slots', () => {
    err(run(ready, { type: 'hatch', slot: 5 }, 30_000), 'NOT_FOUND')
    err(run(ready, { type: 'hatch', slot: 0 }, 29_999), 'NOT_READY')
  })
})

it('never mutates the input state', () => {
  expect(s).toEqual(newPlayer(0))
})
