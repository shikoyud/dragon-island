import { describe, expect, it } from 'vitest'
import { applyAction } from '../src/actions/apply'
import type { Action } from '../src/actions/types'
import { activeLegendaries, breedingPool } from '../src/breeding'
import { breederBreedMs, hatcherySlots, upgradeInfo } from '../src/buildings'
import { getSpecies } from '../src/catalog'
import { BREEDER_FOOTPRINT, BREEDER_LEVELS, HATCHERY_FIFTH_SLOT, HATCHERY_LEVELS } from '../src/data/breeding-buildings'
import { LAUNCH_CATALOG } from '../src/data/launch-catalog'
import { FLASH_14, FLASH_28 } from '../src/data/presets'
import { isValidAction } from '../src/index'
import { occupants, overlaps, placementError } from '../src/island'
import { placementRuleError } from '../src/placement-rules'
import { createRng, type Rng } from '../src/rng'
import { newPlayer, type Breeder, type Dragon, type PlayerState } from '../src/state'
import { priceMicroUsd, type StoreItem } from '../src/store'
import { err, ok } from './helpers'
import { FREE, freeCell, withAllLand } from './helpers/land'

const P = (col: number, row: number) => ({ island: 'home' as const, col, row, facing: 0 as const })
const base = newPlayer(0)
const parents = (a: string, b: string, level = 2): PlayerState => ({
  ...base, firstHybridDone: true, level,
  dragons: [{ ...base.dragons[0]!, speciesId: a, level: 4 }, { ...base.dragons[1]!, speciesId: b, level: 4 }],
})
const run = (s: PlayerState, a: Action, t = 0, rng: Rng = createRng(1)) => applyAction(s, a, t, rng, LAUNCH_CATALOG)
const breed: Action = { type: 'startBreed', parentA: 'd1', parentB: 'd2' }
const buy = (item: StoreItem): Action => ({ type: 'buy', item })
const mountain = (over: Partial<Breeder> = {}): Breeder => ({ ...base.breeders[0]!, ...over })
const grove = (over: Partial<Breeder> = {}): Breeder => ({ kind: 'grove', egg: null, level: 1, placement: FREE, ...over })
const finished = { speciesId: 'flame', readyAtMs: 0, hatchMs: 777, xpFree: false }
const counting = () => {
  const c = { calls: 0, rng: { next: () => { c.calls++; return 0 }, int: () => { c.calls++; return 0 } } as Rng }
  return c
}

describe('§5.4 tables', () => {
  it('Hatchery levels, with R16 timers', () => {
    expect(HATCHERY_LEVELS).toEqual([
      { slots: 1, gold: null, usdMicro: null, classicMs: 0 },
      { slots: 2, gold: 2_000, usdMicro: null, classicMs: 3_600_000 },
      { slots: 3, gold: 250_000, usdMicro: null, classicMs: 14_400_000 },
      { slots: 4, gold: 2_000_000, usdMicro: null, classicMs: 43_200_000 },
    ])
  })

  it('the fifth Hatchery slot is a purchase, not a level (Q5 a)', () => {
    expect(HATCHERY_FIFTH_SLOT).toEqual({ usdMicro: 3_000_000 })
  })

  it('Mountain levels', () => {
    expect(BREEDER_LEVELS.mountain).toEqual([
      { reductionPct: 0, gold: null, usdMicro: null, classicMs: 0 },
      { reductionPct: 10, gold: 150_000, usdMicro: null, classicMs: 3_600_000 },
      { reductionPct: 20, gold: 1_500_000, usdMicro: null, classicMs: 14_400_000 },
    ])
  })

  it('Grove levels: L1 is the 4 h build, L3 is an instant store item', () => {
    expect(BREEDER_LEVELS.grove).toEqual([
      { reductionPct: 0, gold: 400_000, usdMicro: null, classicMs: 14_400_000 },
      { reductionPct: 10, gold: 1_500_000, usdMicro: null, classicMs: 3_600_000 },
      { reductionPct: 20, gold: null, usdMicro: 3_500_000, classicMs: 0 },
    ])
  })

  it('both breeding buildings stand on 5x5 tiles (§5.4)', () => {
    expect(BREEDER_FOOTPRINT).toBe(5)
  })

  it('hatcherySlots adds the fifth slot on top of any level', () => {
    expect(hatcherySlots(1, false)).toBe(1)
    expect(hatcherySlots(4, false)).toBe(4)
    expect(hatcherySlots(1, true)).toBe(2)
    expect(hatcherySlots(4, true)).toBe(5)
  })

  it('breederBreedMs floors the reduced time', () => {
    expect(breederBreedMs(2_400_000, { kind: 'mountain', level: 1 })).toBe(2_400_000)
    expect(breederBreedMs(2_400_000, { kind: 'mountain', level: 2 })).toBe(2_160_000)
    expect(breederBreedMs(2_400_000, { kind: 'mountain', level: 3 })).toBe(1_920_000)
    expect(breederBreedMs(2_400_000, { kind: 'grove', level: 1 })).toBe(2_400_000)
    expect(breederBreedMs(2_400_000, { kind: 'grove', level: 3 })).toBe(1_920_000)
    expect(breederBreedMs(1_001, { kind: 'grove', level: 2 })).toBe(900)
  })
})

describe('newPlayer', () => {
  it('starts with one Mountain L1 at (8, 12) and no fifth slot (R1, R50)', () => {
    expect(base.breeders).toEqual([{ kind: 'mountain', egg: null, level: 1, placement: P(8, 12) }])
    expect(base.hatcheryFifthSlot).toBe(false)
    expect(base).not.toHaveProperty('nests')
  })

  it('its placements are legal and do not overlap', () => {
    const occ = occupants(base, 'home')
    expect(occ.find(o => o.ref.type === 'breeder')).toMatchObject({ col: 8, row: 12, size: 5 })
    for (const o of occ) expect(placementError(base, { ...P(o.col, o.row) }, o.size, o.ref)).toBeNull()
    for (const [i, a] of occ.entries()) for (const b of occ.slice(i + 1)) expect(overlaps(a, b)).toBe(false)
  })
})

describe('startBreed on breeders', () => {
  it('needs PL 2 with two Lv 4 dragons (§5.4)', () => {
    err(run(parents('terra', 'flame', 1), breed), 'LEVEL_TOO_LOW')
    expect(ok(run(parents('terra', 'flame', 2), breed)).breeders[0]!.egg).not.toBeNull()
  })

  it('checks parents, their level, PL, opposites, then a free breeder', () => {
    const c = counting()
    const low: PlayerState = { ...parents('flame', 'ice', 1), breeders: [mountain({ egg: finished })] }
    expect(applyAction({ ...low, dragons: [] }, breed, 0, c.rng, LAUNCH_CATALOG)).toEqual({ ok: false, error: 'INVALID_PARENTS' })
    expect(applyAction(low, breed, 0, c.rng, LAUNCH_CATALOG)).toEqual({ ok: false, error: 'LEVEL_TOO_LOW' })
    expect(applyAction({ ...low, level: 2 }, breed, 0, c.rng, LAUNCH_CATALOG)).toEqual({ ok: false, error: 'OPPOSITE_BASICS' })
    const pair = { ...parents('terra', 'flame'), breeders: [mountain({ egg: finished })] }
    expect(applyAction(pair, breed, 0, c.rng, LAUNCH_CATALOG)).toEqual({ ok: false, error: 'NO_FREE_BREEDER' })
    expect(c.calls).toBe(0)
  })

  it('reductions shorten breeding, never hatching (§5.4)', () => {
    // A forced Terra-Flame (Rare, Tier A) under Flash-14, in a Mountain L3.
    const tf = (id: 'terra' | 'flame') => getSpecies(LAUNCH_CATALOG, id)
    const pool = breedingPool(tf('terra'), tf('flame'), { activeLegendaries: activeLegendaries(1, FLASH_14), firstHybridPending: false }, LAUNCH_CATALOG)
    let roll = 0
    for (const e of pool) { if (e.species.id === 'terra-flame') break; roll += e.weight }
    const st = { ...parents('terra', 'flame'), breeders: [mountain({ level: 3 })] }
    const laid = ok(applyAction(st, breed, 5_000, { next: () => 0, int: () => roll }, LAUNCH_CATALOG, FLASH_14, 1))
    expect(laid.breeders[0]!.egg).toEqual({ speciesId: 'terra-flame', readyAtMs: 5_000 + 1_920_000, hatchMs: 2_400_000, xpFree: false })
    const at = 5_000 + 1_920_000
    const moved = ok(applyAction(laid, { type: 'collectEgg', breeder: 0 }, at, createRng(1), LAUNCH_CATALOG, FLASH_14, 1))
    expect(moved.hatchery).toEqual([{ speciesId: 'terra-flame', readyAtMs: at + 2_400_000, xpFree: false }])
    expect(moved.breeders[0]!.egg).toBeNull()
  })

  describe('Review Focus 3: an unfinished Grove takes no egg', () => {
    const busy = mountain({ egg: { speciesId: 'flame', readyAtMs: 99_999, hatchMs: 1, xpFree: false } })
    const building: PlayerState = {
      ...parents('terra', 'flame', 12), gold: 777, breeders: [busy, grove()],
      constructions: [{ kind: 'build', building: { type: 'breeder', index: 1 }, readyAtMs: 1_000 }],
    }

    it('fails NO_FREE_BREEDER with no Gold or RNG used', () => {
      const c = counting()
      expect(applyAction(building, breed, 0, c.rng, LAUNCH_CATALOG)).toEqual({ ok: false, error: 'NO_FREE_BREEDER' })
      expect(c.calls).toBe(0)
      expect(building.gold).toBe(777)
    })

    it('a finished Grove takes the egg, the busy Mountain is untouched', () => {
      const done = ok(run(building, { type: 'finishConstruction', index: 0 }, 1_000))
      const laid = ok(run(done, breed, 1_000))
      expect(laid.breeders[0]).toEqual(busy)
      expect(laid.breeders[1]!.egg).not.toBeNull()
      expect(laid.gold).toBe(777)
    })

    it('a breeder under upgrade keeps working', () => {
      const up: PlayerState = { ...parents('terra', 'flame'), constructions: [{ kind: 'upgrade', building: { type: 'breeder', index: 0 }, readyAtMs: 9 }] }
      expect(ok(run(up, breed)).breeders[0]!.egg).not.toBeNull()
    })
  })
})

describe('Review Focus 1: a full Hatchery leaves the egg in its building', () => {
  const egg = { speciesId: 'terra-flame', readyAtMs: 100, hatchMs: 2_400_000, xpFree: false }
  const waiting: Dragon = { id: 'd9', speciesId: 'flame', level: 1, feeds: 0, habitatId: null }
  const full: PlayerState = {
    ...parents('terra', 'flame'), breeders: [mountain({ egg })], hatchery: [{ speciesId: 'flame', readyAtMs: 50 }],
  }
  const heldByDragon: PlayerState = { ...full, hatchery: [], dragons: [...full.dragons, waiting] }

  for (const [name, s, free] of [
    ['an egg', full, { type: 'hatch', slot: 0 }],
    ['a dragon with no habitat', heldByDragon, { type: 'moveDragon', dragonId: 'd9', habitatId: 'h2' }],
  ] as [string, PlayerState, Action][]) {
    it(`with the slot held by ${name}: blocked, then the hatch timer starts when it moves`, () => {
      err(run(s, { type: 'collectEgg', breeder: 0 }, 200), 'HATCHERY_FULL')
      expect(s.breeders[0]!.egg).toEqual(egg)
      err(run(s, breed, 200), 'NO_FREE_BREEDER')
      const freed = ok(run(s, free, 300))
      expect(freed.breeders[0]!.egg).toEqual(egg)
      const moved = ok(run(freed, { type: 'collectEgg', breeder: 0 }, 400))
      expect(moved.breeders[0]!.egg).toBeNull()
      expect(moved.hatchery.at(-1)).toEqual({ speciesId: 'terra-flame', readyAtMs: 400 + 2_400_000, xpFree: false })
      expect(ok(run(moved, breed, 400)).breeders[0]!.egg).not.toBeNull()
    })
  }

  it('the bought fifth slot makes room at any level', () => {
    const roomier = ok(run({ ...full, hatcheryFifthSlot: true }, { type: 'collectEgg', breeder: 0 }, 200))
    expect(roomier.hatchery).toHaveLength(2)
  })

  it('collectEgg reports a bad index and an empty breeder', () => {
    err(run(full, { type: 'collectEgg', breeder: 4 }, 200), 'NOT_FOUND')
    err(run(base, { type: 'collectEgg', breeder: 0 }, 200), 'BREEDER_EMPTY')
    err(run(full, { type: 'collectEgg', breeder: 0 }, 99), 'NOT_READY')
    expect(isValidAction({ type: 'collectEgg', breeder: 0 })).toBe(true)
    expect(isValidAction({ type: 'collectEgg', nest: 0 })).toBe(false)
  })
})

describe('placing the Grove', () => {
  const place: Action = { type: 'placeBuilding', building: { kind: 'grove' }, placement: FREE }
  const ready = (level: number, gold = 500_000) => ({ ...base, level, gold })

  it('needs PL 12', () => {
    err(run(ready(11), place), 'LEVEL_TOO_LOW')
  })

  it('charges 400,000 and builds for 2,400,000 ms under Flash-14', () => {
    const a = ok(applyAction(ready(12), place, 1_000, createRng(1), LAUNCH_CATALOG, FLASH_14))
    expect(a.gold).toBe(100_000)
    expect(a.breeders[1]).toEqual({ kind: 'grove', egg: null, level: 1, placement: FREE })
    expect(a.constructions).toEqual([{ kind: 'build', building: { type: 'breeder', index: 1 }, readyAtMs: 1_000 + 2_400_000 }])
  })

  it('divides the build by the preset', () => {
    const a = ok(applyAction(ready(12), place, 0, createRng(1), LAUNCH_CATALOG, FLASH_28))
    expect(a.constructions[0]!.readyAtMs).toBe(Math.floor(14_400_000 / FLASH_28.timerDiv))
  })

  it('a second Grove fails MAX_LEVEL', () => {
    const a = ok(run(ready(12, 2_000_000), place))
    const more = withAllLand(a) // the Start has no second free 5x5
    const second = freeCell(more, 5)
    expect(placementRuleError(more, { kind: 'grove' }, second)).toBeNull()
    err(run(more, { ...place, placement: second } as Action), 'MAX_LEVEL')
  })

  it('refuses short Gold and busy builders', () => {
    err(run(ready(12, 399_999), place), 'INSUFFICIENT_GOLD')
    const busy = { ...ready(12), constructions: [0, 1].map(i => ({ kind: 'build' as const, building: { type: 'farm' as const, index: i }, readyAtMs: 9 })) }
    err(run(busy, place), 'BUILDERS_BUSY')
  })

  it('takes a 5x5 footprint and is a valid action', () => {
    expect(placementRuleError(base, { kind: 'grove' }, P(28, 12))).toBe('OUT_OF_BOUNDS')
    expect(placementRuleError(base, { kind: 'grove' }, P(20, 12))).toBe('NOT_OWNED')
    expect(placementRuleError(base, { kind: 'grove' }, P(14, 12))).toBeNull()
    expect(placementRuleError(base, { kind: 'grove' }, P(9, 12))).toBe('OVERLAP')
    expect(isValidAction(place)).toBe(true)
  })
})

describe('moving a breeder', () => {
  it('moves with a 5x5 footprint, ignoring itself', () => {
    const s = base
    const a = ok(run(s, { type: 'moveBuilding', target: { type: 'breeder', index: 0 }, placement: P(8, 13) }))
    expect(a.breeders[0]!.placement).toEqual(P(8, 13))
    err(run(s, { type: 'moveBuilding', target: { type: 'breeder', index: 0 }, placement: P(9, 8) }), 'OVERLAP')
    err(run(s, { type: 'moveBuilding', target: { type: 'breeder', index: 9 }, placement: P(8, 13) }), 'NOT_FOUND')
  })
})

describe('upgradeInfo from the tables', () => {
  const hatcheryAt = (hatcheryLevel: number) => ({ ...base, hatcheryLevel })
  const withBreeder = (b: Breeder) => ({ ...base, breeders: [b] })

  it('Hatchery: cost, minLevel and timers ÷ timerDiv; L4 is the top', () => {
    const info = (l: number) => upgradeInfo(hatcheryAt(l), { type: 'hatchery' }, FLASH_14)
    expect(info(1)).toEqual({ cost: 2_000, timerMs: 600_000, minLevel: 4 })
    expect(info(2)).toEqual({ cost: 250_000, timerMs: 2_400_000, minLevel: 13 })
    expect(info(3)).toEqual({ cost: 2_000_000, timerMs: 7_200_000, minLevel: 21 })
    expect(info(4)).toBeNull()
    expect(upgradeInfo(hatcheryAt(1), { type: 'hatchery' }, FLASH_28)!.timerMs).toBe(Math.floor(3_600_000 / FLASH_28.timerDiv))
  })

  it('Mountain goes to L3 for Gold', () => {
    const info = (level: number) => upgradeInfo(withBreeder(mountain({ level })), { type: 'breeder', index: 0 }, FLASH_14)
    expect(info(1)).toEqual({ cost: 150_000, timerMs: 600_000, minLevel: 10 })
    expect(info(2)).toEqual({ cost: 1_500_000, timerMs: 2_400_000, minLevel: 20 })
    expect(info(3)).toBeNull()
  })

  it('Grove goes to L2 for Gold; L3 is a store item', () => {
    const info = (level: number) => upgradeInfo(withBreeder(grove({ level })), { type: 'breeder', index: 0 }, FLASH_14)
    expect(info(1)).toEqual({ cost: 1_500_000, timerMs: 600_000, minLevel: 20 })
    expect(info(2)).toBeNull()
    expect(upgradeInfo(base, { type: 'breeder', index: 7 }, FLASH_14)).toBeNull()
  })

  it('startUpgrade applies the minLevel gate, then finishing raises the level', () => {
    const up = { type: 'startUpgrade', building: { type: 'breeder', index: 0 } } as const
    const t = { ...base, gold: 200_000 }
    err(run({ ...t, level: 9 }, up), 'LEVEL_TOO_LOW')
    const a = ok(applyAction({ ...t, level: 10 }, up, 0, createRng(1), LAUNCH_CATALOG, FLASH_14))
    expect([a.gold, a.constructions[0]!.readyAtMs]).toEqual([50_000, 600_000])
    expect(ok(run(a, { type: 'finishConstruction', index: 0 }, 600_000)).breeders[0]!.level).toBe(2)
    const h = { type: 'startUpgrade', building: { type: 'hatchery' } } as const
    err(run({ ...t, level: 3 }, h), 'LEVEL_TOO_LOW')
    expect(ok(run(ok(run({ ...t, level: 4 }, h)), { type: 'finishConstruction', index: 0 }, 600_000)).hatcheryLevel).toBe(2)
  })

  it('a breeder under construction cannot start an upgrade', () => {
    const st: PlayerState = { ...base, level: 30, gold: 1e9, breeders: [mountain(), grove()], constructions: [{ kind: 'build', building: { type: 'breeder', index: 1 }, readyAtMs: 9 }] }
    err(run(st, { type: 'startUpgrade', building: { type: 'breeder', index: 1 } }), 'UNDER_CONSTRUCTION')
  })
})

describe('store', () => {
  describe('hatcheryL5', () => {
    const item = { kind: 'hatcheryL5' } as const

    it('costs 3,000,000 from PL 15 at any Hatchery level, only once (Q5 a)', () => {
      expect(priceMicroUsd(item, { ...base, level: 14 }, 0)).toBeNull()
      expect(priceMicroUsd(item, { ...base, level: 15 }, 0)).toBe(3_000_000)
      expect(priceMicroUsd(item, { ...base, level: 15, hatcheryLevel: 4 }, 0)).toBe(3_000_000)
      expect(priceMicroUsd(item, { ...base, level: 30, hatcheryFifthSlot: true }, 0)).toBeNull()
    })

    it('buying sets the flag and charges; a second buy and a low level fail with no charge', () => {
      const r = run({ ...base, level: 15 }, buy(item))
      expect(r.ok && r.effects).toEqual([{ type: 'charge', microUsd: 3_000_000 }])
      const a = ok(r)
      expect([a.hatcheryFifthSlot, a.hatcheryLevel]).toEqual([true, 1])
      err(run(a, buy(item)), 'MAX_LEVEL')
      err(run({ ...base, level: 14 }, buy(item)), 'LEVEL_TOO_LOW')
    })
  })

  describe('groveL3', () => {
    const item = { kind: 'groveL3', index: 1 } as const
    const at = (level: number, pl = 25): PlayerState => ({ ...base, level: pl, breeders: [mountain(), grove({ level })] })

    it('costs 3,500,000 only at Grove L2 with PL 25', () => {
      expect(priceMicroUsd(item, at(2), 0)).toBe(3_500_000)
      expect(priceMicroUsd(item, at(2, 24), 0)).toBeNull()
      expect(priceMicroUsd(item, at(1), 0)).toBeNull()
      expect(priceMicroUsd(item, at(3), 0)).toBeNull()
      expect(priceMicroUsd({ kind: 'groveL3', index: 0 }, { ...at(2), breeders: [mountain({ level: 2 }), grove({ level: 2 })] }, 0)).toBeNull()
      expect(priceMicroUsd({ kind: 'groveL3', index: 9 }, at(2), 0)).toBeNull()
    })

    it('buying is instant; every refusal is typed', () => {
      const r = run(at(2), buy(item))
      expect(r.ok && r.effects).toEqual([{ type: 'charge', microUsd: 3_500_000 }])
      expect([ok(r).breeders[1]!.level, ok(r).constructions]).toEqual([3, []])
      err(run(at(3), buy(item)), 'MAX_LEVEL')
      err(run(at(1), buy(item)), 'INVALID_ACTION')
      err(run(at(2, 24), buy(item)), 'LEVEL_TOO_LOW')
      err(run(at(2), buy({ kind: 'groveL3', index: 0 })), 'NOT_FOUND')
      err(run(at(2), buy({ kind: 'groveL3', index: 9 })), 'NOT_FOUND')
    })

    it('validates the shapes', () => {
      expect(isValidAction(buy(item))).toBe(true)
      expect(isValidAction(buy({ kind: 'hatcheryL5' }))).toBe(true)
      expect(isValidAction(buy({ kind: 'groveL3' } as never))).toBe(false)
    })
  })

  it('skips an egg in a breeder, keeping its hatch time', () => {
    const st = { ...base, breeders: [mountain({ egg: { speciesId: 'flame', readyAtMs: 1_800_001, hatchMs: 42, xpFree: false } })] }
    const r = ok(run(st, buy({ kind: 'skip', target: 'breeder', index: 0 })))
    expect(r.breeders[0]!.egg).toEqual({ speciesId: 'flame', readyAtMs: 0, hatchMs: 42, xpFree: false })
  })
})
