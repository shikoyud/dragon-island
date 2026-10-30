import { describe, expect, it } from 'vitest'
import { applyAction } from '../src/actions/apply'
import type { Action } from '../src/actions/types'
import { getSpecies } from '../src/catalog'
import { basicPriceGold } from '../src/data/breeding'
import { breedTimerMs } from '../src/data/breeding-timers'
import { breedingPool, activeLegendaries } from '../src/breeding'
import { LAUNCH_CATALOG } from '../src/data/launch-catalog'
import { FLASH_14, FLASH_28 } from '../src/data/presets'
import { HATCH_XP, START_BREED_XP } from '../src/data/xp'
import { createRng } from '../src/rng'
import { newPlayer, type Breeder, type BreederEgg, type Dragon, type Egg, type PlayerState } from '../src/state'
import { err, ok } from './helpers'

const s = newPlayer(0)
const s4: PlayerState = { ...s, firstHybridDone: true, level: 2, dragons: s.dragons.map(d => ({ ...d, level: 4 })) }
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
    expect(a.xp).toBe(START_BREED_XP * 12) // 60, PL 2 needs 200
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

  describe('the scripted first hybrid (§3.5, R25)', () => {
    const pending: PlayerState = { ...s4, firstHybridDone: false }
    const tf = (st: PlayerState) => ({ ...st, dragons: [{ ...st.dragons[0]!, speciesId: 'terra' }, { ...st.dragons[1]!, speciesId: 'flame' }] })
    const at = (target: number) => ({ next: () => 0, int: (n: number) => (target < 0 ? n - 1 : target) })

    it('rolls terra-flame or flame-terra, 60 s, under both presets and any Mountain level, and marks it done', () => {
      for (const preset of [FLASH_14, FLASH_28]) for (const level of [1, 2, 3]) for (const pick of [0, 1]) {
        const st = { ...tf(pending), breeders: [{ ...breeder(), level }] }
        const r = ok(applyAction(st, breed, 5_000, { next: () => 0, int: (n: number) => (pick ? n - 1 : 0) }, LAUNCH_CATALOG, preset, 1))
        const e = r.breeders[0]!.egg!
        expect(['terra-flame', 'flame-terra']).toContain(e.speciesId)
        expect(e.readyAtMs).toBe(5_000 + 60_000)
        expect(e.hatchMs).toBe(60_000)
        expect(r.firstHybridDone).toBe(true)
      }
    })

    it('a scripted egg hatches 60 s after collectEgg', () => {
      const bred = ok(run(tf(pending), breed, 0))
      const collectedAt = 100_000
      const collected = ok(run(bred, { type: 'collectEgg', breeder: 0 }, collectedAt))
      expect(collected.hatchery[0]!.readyAtMs).toBe(collectedAt + 60_000)
      err(run(collected, { type: 'hatch', slot: 0 }, collectedAt + 59_999), 'NOT_READY')
      ok(run(collected, { type: 'hatch', slot: 0 }, collectedAt + 60_000))
    })

    it('is 50/50 between the two hybrids', () => {
      const a = ok(applyAction(tf(pending), breed, 0, at(0), LAUNCH_CATALOG, FLASH_14, 1)).breeders[0]!.egg!.speciesId
      const b = ok(applyAction(tf(pending), breed, 0, at(-1), LAUNCH_CATALOG, FLASH_14, 1)).breeders[0]!.egg!.speciesId
      expect(new Set([a, b])).toEqual(new Set(['terra-flame', 'flame-terra']))
    })

    it('the next breed uses normal odds and timers', () => {
      const first = ok(run(tf(pending), breed, 0))
      const again = { ...first, breeders: [breeder()] }
      const r = ok(applyAction(again, breed, 0, at(0), LAUNCH_CATALOG, FLASH_14, 1))
      const e = r.breeders[0]!.egg!
      const child = getSpecies(LAUNCH_CATALOG, e.speciesId)
      expect(e.speciesId).toBe('flame') // lowest id in the full pool, weight 1000 first
      expect(e.hatchMs).toBe(breedTimerMs(child.rarity, child.elements, FLASH_14))
      expect(e.hatchMs).not.toBe(60_000)
    })

    it('Terra x Terra while pending gives terra and leaves the script pending', () => {
      const st = { ...pending, dragons: pending.dragons.map(d => ({ ...d, speciesId: 'terra' })) }
      const r = ok(run(st, breed, 0))
      expect(r.breeders[0]!.egg!.speciesId).toBe('terra')
      expect(r.firstHybridDone).toBe(false)
    })

    it('with Magma Sovereign featured the scripted roll cannot be it', () => {
      for (let i = 0; i < 40; i++) {
        const r = ok(applyAction(tf(pending), breed, 0, createRng(i), LAUNCH_CATALOG, FLASH_14, 1))
        expect(r.breeders[0]!.egg!.speciesId).not.toBe('magma-sovereign')
      }
      const top = ok(applyAction(tf(pending), breed, 0, at(10_000), LAUNCH_CATALOG, FLASH_14, 1))
      expect(top.breeders[0]!.egg!.speciesId).not.toBe('magma-sovereign')
    })
  })
})

describe('Legendary events', () => {
  const tf = withParents('terra', 'flame')
  /** An rng whose single int() lands on `target` in the pool of Terra x Flame on `day`. */
  const forcing = (day: number, speciesId: string) => {
    const pool = breedingPool(
      getSpecies(LAUNCH_CATALOG, 'terra'), getSpecies(LAUNCH_CATALOG, 'flame'),
      { activeLegendaries: activeLegendaries(day, FLASH_14), firstHybridPending: false }, LAUNCH_CATALOG)
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

  it('discovers a new species once and dedupes a second hatch', () => {
    const st = { ...s, hatchery: [egg('terra-flame', 0), egg('terra-flame', 0)] }
    const a = ok(run(st, { type: 'hatch', slot: 0 }, 0))
    expect(a.discovered).toEqual(['terra', 'flame', 'terra-flame'])
    expect(ok(run(a, { type: 'hatch', slot: 0 }, 0)).discovered).toEqual(['terra', 'flame', 'terra-flame'])
    expect(ok(run(ready, { type: 'hatch', slot: 0 }, 30_000)).discovered).toEqual(['terra', 'flame'])
  })

  it('creates a dragon in the first matching habitat', () => {
    const a = ok(run(ready, { type: 'hatch', slot: 0 }, 30_000))
    expect(a.dragons[2]).toEqual({ id: 'd3', speciesId: 'flame', level: 1, feeds: 0, habitatId: 'h2' })
    expect(a.hatchery).toEqual([])
    expect(a.nextId).toBe(4)
    expect(a.level).toBe(2) // 10 classic x 12 = 120 XP from PL 1: 50 to PL 2, 70 over
    expect(a.xp).toBe(HATCH_XP.common * 12 - 50)
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

describe('buyBasic', () => {
  const seaHab = { id: 'h3', element: 'sea' as const, level: 1, lastCollectedMs: 0, placement: { island: 'home' as const, col: 9, row: 0, facing: 0 as const } }
  const rich: PlayerState = { ...s, level: 3, gold: 5_000, habitats: [...s.habitats, seaHab] }
  const buy: Action = { type: 'buyBasic', element: 'sea' }

  it('adds the species to the Dragon Book once', () => {
    const a = ok(run(rich, buy, 1_000))
    expect(a.discovered).toEqual(['terra', 'flame', 'sea'])
  })

  it('prices a Basic at its habitat build Gold', () => {
    expect(basicPriceGold('sea')).toBe(5_000)
    expect(basicPriceGold('terra')).toBe(500)
  })

  it('puts a Lv 1 Basic in a finished habitat of its element with room and takes the Gold', () => {
    const a = ok(run(rich, buy, 1_000))
    expect(a.gold).toBe(0)
    expect(a.dragons.at(-1)).toEqual({ id: 'd3', speciesId: 'sea', level: 1, feeds: 0, habitatId: 'h3' })
    expect(a.nextId).toBe(s.nextId + 1)
  })

  it('collects the habitat before the newcomer changes its income', () => {
    const a = ok(run(rich, buy, 60_000))
    expect(a.habitats.find(h => h.id === 'h3')!.lastCollectedMs).toBe(60_000)
  })

  it('is gated by Player Level, then Gold', () => {
    err(run({ ...rich, level: 2 }, buy, 0), 'LEVEL_TOO_LOW')
    err(run({ ...rich, gold: 4_999 }, buy, 0), 'INSUFFICIENT_GOLD')
  })

  it('needs a finished habitat of the element with a free slot (R26)', () => {
    err(run({ ...rich, habitats: s.habitats }, buy, 0), 'NO_HABITAT_SLOT')
    const fill = (id: string): Dragon => ({ id, speciesId: 'sea', level: 1, feeds: 0, habitatId: 'h3' })
    err(run({ ...rich, dragons: [...rich.dragons, fill('d8'), fill('d9')] }, buy, 0), 'NO_HABITAT_SLOT')
    const building = { ...rich, constructions: [{ kind: 'build' as const, building: { type: 'habitat' as const, id: 'h3' }, readyAtMs: 9_999 }] }
    err(run(building, buy, 0), 'NO_HABITAT_SLOT')
  })

  it('never mutates the input and never uses the hatchery', () => {
    const before = JSON.parse(JSON.stringify(rich))
    const a = ok(run(rich, buy, 0))
    expect(rich).toEqual(before)
    expect(a.hatchery).toEqual([])
  })
})

it('never mutates the input state', () => {
  expect(s).toEqual(newPlayer(0))
})

describe('buyBasic into a Golden Aerie (§5.2 accepts any element)', () => {
  const at = (col: number) => ({ island: 'home' as const, col, row: 0, facing: 0 as const })
  const aerie = { id: 'h4', element: 'aerie' as const, level: 5, lastCollectedMs: 0, placement: at(14) }
  const sea = { id: 'h3', element: 'sea' as const, level: 1, lastCollectedMs: 0, placement: at(9) }
  const base: PlayerState = { ...s, level: 3, gold: 5_000 }
  const buy: Action = { type: 'buyBasic', element: 'sea' }

  it('uses the Aerie when no Sea habitat exists', () => {
    const a = ok(run({ ...base, habitats: [...s.habitats, aerie] }, buy, 0))
    expect(a.dragons.at(-1)!.habitatId).toBe('h4')
  })

  it('prefers a Sea habitat listed before the Aerie', () => {
    const a = ok(run({ ...base, habitats: [...s.habitats, sea, aerie] }, buy, 0))
    expect(a.dragons.at(-1)!.habitatId).toBe('h3')
  })
})
