import { describe, expect, it } from 'vitest'
import {
  activeLegendaries, breedingOdds, breedingPool, breedValidity, rollOffspring, type BreedContext,
} from '../src/breeding'
import { makeCatalog, type Species } from '../src/catalog'
import { BREED_WEIGHT } from '../src/data/breeding'
import { LAUNCH_CATALOG as C } from '../src/data/launch-catalog'
import { FLASH_14, FLASH_28 } from '../src/data/presets'
import { createRng } from '../src/rng'

const sp = (id: string) => {
  const s = C.species.get(id)
  if (!s) throw new Error(`no species ${id}`)
  return s
}
const none: BreedContext = { activeLegendaries: [] }
const only = (...ids: string[]): BreedContext => ({ activeLegendaries: ids })

/** Weight of each species in the pool, by id. */
const weights = (a: string, b: string, ctx: BreedContext = none, c = C) =>
  Object.fromEntries(breedingPool(sp2(c, a), sp2(c, b), ctx, c).map(e => [e.species.id, e.weight]))
const sp2 = (c: typeof C, id: string) => c.species.get(id)!
const total = (w: Record<string, number>) => Object.values(w).reduce((n, x) => n + x, 0)

describe('BREED_WEIGHT (§3.2)', () => {
  it('is 1000 / 500 / 200 / 60 / 40', () => {
    expect(BREED_WEIGHT).toEqual({ common: 1000, uncommon: 500, rare: 200, epic: 60, legendary: 40 })
  })
})

describe('breedingOdds (§3.2, §3.4)', () => {
  it('Terra x Nature: both Basics, both neutral hybrids; hybrid total 33.3 %', () => {
    const w = weights('terra', 'nature')
    expect(w).toEqual({ terra: 1000, nature: 1000, 'terra-nature': 500, 'nature-terra': 500 })
    const odds = breedingOdds(sp('terra'), sp('nature'), none, C)
    expect(odds['terra']).toBeCloseTo(1000 / 3000, 9)
    expect(odds['terra-nature']).toBeCloseTo(500 / 3000, 9)
    expect(odds['terra-nature']! + odds['nature-terra']!).toBeCloseTo(1 / 3, 9)
  })

  it('Terra x Flame: hybrid total 400/2400 = 16.7 %', () => {
    const w = weights('terra', 'flame')
    expect(total(w)).toBe(2400)
    const odds = breedingOdds(sp('terra'), sp('flame'), none, C)
    expect(odds['terra-flame']! + odds['flame-terra']!).toBeCloseTo(400 / 2400, 9)
  })

  it('Terra x Terra is always Terra', () => {
    expect(breedingOdds(sp('terra'), sp('terra'), none, C)).toEqual({ terra: 1 })
  })

  it('Flame-Terra x Ice-Sea (§3.3): 1580 total, no Basics', () => {
    const w = weights('flame-terra', 'ice-sea')
    expect(total(w)).toBe(1580)
    expect(w).toMatchObject({
      'ice-sea': 500, 'ice-terra': 500, 'flame-terra': 200, 'flame-sea': 200,
      'flame-ice': 60, 'ice-flame': 60, 'flame-ice-sea': 60,
    })
    expect(Object.keys(w).some(id => ['flame', 'ice', 'terra', 'sea'].includes(id))).toBe(false)
    const odds = breedingOdds(sp('flame-terra'), sp('ice-sea'), none, C)
    expect(odds['flame-ice']! + odds['ice-flame']!).toBeCloseTo(0.076, 3)
  })

  it('Flame x Ice-Sea: 2880 total with both Basics at 1000 and flame-ice at 60', () => {
    const w = weights('flame', 'ice-sea')
    expect(total(w)).toBe(2880)
    expect(w['flame']).toBe(1000)
    expect(w['ice']).toBe(1000)
    expect(w['flame-ice']).toBe(60)
  })

  it('floor guard: a pool with no Common or Uncommon gains each parent primary Basic', () => {
    expect(weights('flame-sea', 'flame-sea')).toEqual({ flame: 1000, 'flame-sea': 200 })
    const w = weights('flame-ice', 'ice-flame')
    expect(w).toMatchObject({ flame: 1000, ice: 1000, 'flame-ice': 60, 'ice-flame': 60 })
    expect(total(w)).toBe(2120)
    expect(breedingOdds(sp('flame-sea'), sp('flame-sea'), none, C)['flame']).toBeCloseTo(1000 / 1200, 9)
  })

  it('an Uncommon clones without a floor: Terra-Sea x Terra-Sea', () => {
    expect(breedingOdds(sp('terra-sea'), sp('terra-sea'), none, C)).toEqual({ 'terra-sea': 1 })
  })
})

describe('breedValidity (§3.2 rule 1)', () => {
  it('refuses two opposite Basics in both orders', () => {
    for (const [x, y] of [['flame', 'ice'], ['ice', 'flame'], ['nature', 'electric'], ['terra', 'dark'], ['sea', 'war']] as const) {
      expect(breedValidity(sp(x), sp(y))).toBe('OPPOSITE_BASICS')
    }
  })
  it('allows a hybrid that carries the same elements and counter pairs', () => {
    expect(breedValidity(sp('flame'), sp('ice-sea'))).toBeNull()
    expect(breedValidity(sp('terra'), sp('flame'))).toBeNull()
    expect(breedValidity(sp('flame-ice'), sp('ice-flame'))).toBeNull()
  })
})

describe('Legendary events (§3.2, §8.4)', () => {
  it('Flash-14 windows', () => {
    expect(activeLegendaries(4, FLASH_14)).toContain('magma-sovereign')
    expect(activeLegendaries(5, FLASH_14)).not.toContain('magma-sovereign')
    expect(activeLegendaries(5, FLASH_14)).toContain('glacier-warlord')
    expect(activeLegendaries(9, FLASH_14)).toContain('radiant-aegis')
    expect(activeLegendaries(13, FLASH_14)).toEqual([])
    expect(activeLegendaries(0, FLASH_14)).toEqual([])
  })
  it('Flash-28 windows', () => {
    expect(activeLegendaries(7, FLASH_28)).toContain('magma-sovereign')
    expect(activeLegendaries(8, FLASH_28)).not.toContain('magma-sovereign')
    expect(activeLegendaries(8, FLASH_28)).toContain('glacier-warlord')
    expect(activeLegendaries(24, FLASH_28)).toContain('radiant-aegis')
    expect(activeLegendaries(25, FLASH_28)).toEqual([])
  })

  it('adds a 40 weight Legendary only while active and only when its elements fit', () => {
    const w = weights('terra', 'flame', only('magma-sovereign'))
    expect(w['magma-sovereign']).toBe(40)
    expect(total(w)).toBe(2440)
    expect(breedingOdds(sp('terra'), sp('flame'), only('magma-sovereign'), C)['magma-sovereign']).toBeCloseTo(40 / 2440, 9)
    expect(weights('terra', 'flame')['magma-sovereign']).toBeUndefined()

    const g = weights('ice', 'war', only('glacier-warlord'))
    expect(g['glacier-warlord']).toBe(40)
    expect(total(g)).toBe(2440)

    const r = weights('light', 'metal', only('radiant-aegis'))
    expect(r['radiant-aegis']).toBe(40)
    expect(total(r)).toBe(3040)
    expect(r['radiant-aegis']! / 3040).toBeCloseTo(0.013, 3)

    expect(weights('terra', 'nature', only('magma-sovereign'))).not.toHaveProperty('magma-sovereign')
  })

  it('a fixture Legendary [flame, ice] on the §3.3 pool: 40/1620 = 2.5 %', () => {
    const legend: Species = { id: 'fx-legend', name: 'fx', elements: ['flame', 'ice'], rarity: 'legendary' }
    const cat = makeCatalog([...C.species.values(), legend])
    const w = weights('flame-terra', 'ice-sea', only('fx-legend'), cat)
    expect(w['fx-legend']).toBe(40)
    expect(total(w)).toBe(1620)
    expect(40 / 1620).toBeCloseTo(0.025, 3)
    expect(weights('flame-terra', 'ice-sea', none, cat)).not.toHaveProperty('fx-legend')
  })
})

describe('rollOffspring', () => {
  it('takes the species at the cumulative position of one rng.int(total)', () => {
    const a = sp('terra'), b = sp('nature')
    const pool = breedingPool(a, b, none, C)
    const sum = pool.reduce((n, e) => n + e.weight, 0)
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      let calls = 0
      const probe = createRng(seed)
      const counted = { next: () => { calls++; return probe.next() }, int: (n: number) => { calls++; return probe.int(n) } }
      const got = rollOffspring(a, b, none, C, counted)
      expect(calls).toBe(1)
      const r = createRng(seed).int(sum)
      let acc = 0, want = pool[pool.length - 1]!.species
      for (const e of pool) { acc += e.weight; if (r < acc) { want = e.species; break } }
      expect(got.id).toBe(want.id)
    }
  })

  it('lists the pool in stable id order', () => {
    const ids = breedingPool(sp('terra'), sp('nature'), none, C).map(e => e.species.id)
    expect(ids).toEqual([...ids].sort())
  })

  it('matches the odds over many rolls', () => {
    const rng = createRng(7)
    let hybrids = 0
    for (let i = 0; i < 20_000; i++) if (rollOffspring(sp('terra'), sp('nature'), none, C, rng).elements.length === 2) hybrids++
    expect(hybrids / 20_000).toBeGreaterThan(0.31)
    expect(hybrids / 20_000).toBeLessThan(0.36)
  })
})
