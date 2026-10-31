import { describe, expect, it } from 'vitest'
import { applyAction } from '../src/actions/apply'
import type { Action } from '../src/actions/types'
import { upgradeInfo } from '../src/buildings'
import { ROOST_FOOTPRINT, ROOST_TIERS } from '../src/data/roost'
import { FLASH_14 } from '../src/data/presets'
import { LAUNCH_CATALOG } from '../src/data/launch-catalog'
import { levelCap, ROOST_LEVEL_CAPS } from '../src/dragon'
import { isValidAction } from '../src/index'
import { occupants } from '../src/island'
import { placementRuleError } from '../src/placement-rules'
import { createRng } from '../src/rng'
import { newPlayer, type PlayerState } from '../src/state'
import { priceMicroUsd } from '../src/store'
import { unlockPl } from '../src/data/unlocks'
import { err, ok } from './helpers'

import { FREE, FREE_2 } from './helpers/land'
const P = (col: number, row: number) => ({ island: 'home' as const, col, row, facing: 0 as const })
const AT = FREE
const base = newPlayer(0)
const run = (s: PlayerState, a: Action, t = 0) => applyAction(s, a, t, createRng(1), LAUNCH_CATALOG)
const place: Action = { type: 'placeBuilding', building: { kind: 'roost' }, placement: AT }
const ascend: Action = { type: 'buy', item: { kind: 'ascension' } }
const H = 3_600_000
/** A built Roost at `tier`. */
const roosted = (tier: number, over: Partial<PlayerState> = {}): PlayerState => ({ ...base, roostPlacement: AT, roostTier: tier, level: 30, gold: 50_000_000, ...over })

describe('§4.2 tables', () => {
  it('every row, literally', () => {
    expect(ROOST_TIERS).toEqual([
      { tier: 1, levelCap: 10, gold: 5_000, usdMicro: null, classicMs: 30 * 60_000 },
      { tier: 2, levelCap: 15, gold: 75_000, usdMicro: null, classicMs: 4 * H },
      { tier: 3, levelCap: 20, gold: 400_000, usdMicro: null, classicMs: 12 * H },
      { tier: 4, levelCap: 30, gold: 2_500_000, usdMicro: null, classicMs: 24 * H },
      { tier: 5, levelCap: 40, gold: 10_000_000, usdMicro: 2_000_000, classicMs: 48 * H },
    ])
    expect(ROOST_FOOTPRINT).toBe(4)
  })

  it('levelCap at each tier is derived from the table', () => {
    expect([0, 1, 2, 3, 4, 5].map(levelCap)).toEqual([7, 10, 15, 20, 30, 40])
    expect(ROOST_LEVEL_CAPS).toEqual([7, ...ROOST_TIERS.map(t => t.levelCap)])
  })

  it('newPlayer has no Roost, and the Roost gates read the unlock table', () => {
    expect(base.roostPlacement).toBeNull()
    expect([1, 2, 3, 4, 5].map(t => unlockPl(`roost:${t}` as 'roost:1'))).toEqual([5, 10, 15, 22, 30])
  })
})

describe('placing the Roost', () => {
  it('PL 4 is too low', () => {
    err(run({ ...base, level: 4, gold: 5_000 }, place), 'LEVEL_TOO_LOW')
  })

  it('PL 5 with 5,000 Gold builds Tier 1 for 300,000 ms under Flash-14, and the tier waits for the build', () => {
    expect(FLASH_14.timerDiv).toBe(6)
    const s = ok(run({ ...base, level: 5, gold: 5_000 }, place))
    expect(s.gold).toBe(0)
    expect(s.roostPlacement).toEqual(AT)
    expect(s.roostTier).toBe(0)
    expect(s.constructions).toEqual([{ kind: 'build', building: { type: 'roost' }, readyAtMs: 300_000 }])
  })

  it('pays build XP on the 5,000 Gold (R31)', () => {
    expect(ok(run({ ...base, level: 5, gold: 5_000 }, place)).xp).toBe(250)
  })

  it('too little Gold, busy builders, a second Roost, and bad cells', () => {
    err(run({ ...base, level: 5, gold: 4_999 }, place), 'INSUFFICIENT_GOLD')
    const busy = { ...base, level: 5, gold: 9_999, constructions: [0, 1].map(i => ({ kind: 'build' as const, building: { type: 'farm' as const, index: i }, readyAtMs: 9 })) }
    err(run(busy, place), 'BUILDERS_BUSY')
    err(run(roosted(1), { ...place, placement: FREE_2 }), 'MAX_LEVEL')
    err(run({ ...base, level: 5, gold: 5_000 }, { ...place, placement: P(8, 8) }), 'OVERLAP')
  })

  it('is a 4x4 building in the occupants list and the placement rules', () => {
    expect(occupants(roosted(1), 'home').find(o => o.ref.type === 'roost')).toEqual({ ref: { type: 'roost' }, col: FREE.col, row: FREE.row, size: 4 })
    expect(placementRuleError(base, { kind: 'roost' }, AT)).toBeNull()
    expect(placementRuleError(base, { kind: 'roost' }, P(8, 8))).toBe('OVERLAP')
    expect(placementRuleError(base, { kind: 'move', target: { type: 'roost' } }, AT)).toBe('NOT_FOUND')
  })

  it('moves like other buildings', () => {
    const moved = ok(run(roosted(1), { type: 'moveBuilding', target: { type: 'roost' }, placement: FREE_2 }))
    expect(moved.roostPlacement).toEqual(FREE_2)
    err(run(roosted(1), { type: 'moveBuilding', target: { type: 'roost' }, placement: P(8, 8) }), 'OVERLAP')
    err(run(base, { type: 'moveBuilding', target: { type: 'roost' }, placement: AT }), 'NOT_FOUND')
  })

  it('Review Focus 1: a Lv 7 feed fails during the Tier 1 build and succeeds after it', () => {
    const feed: Action = { type: 'feed', dragonId: 'd1' }
    const dragons = [{ ...base.dragons[0]!, level: 7 }, base.dragons[1]!]
    const building = ok(run({ ...base, level: 5, gold: 5_000, food: 1e6, dragons }, place))
    err(run(building, feed, 100_000), 'LEVEL_CAP')
    const done = ok(run(building, { type: 'finishConstruction', index: 0 }, 300_000))
    expect(done.roostTier).toBe(1)
    expect(done.constructions).toEqual([])
    ok(run(done, feed, 300_000))
  })

  it('a Roost moved during its build keeps the new cell, and the finish gives Tier 1', () => {
    const building = ok(run({ ...base, level: 5, gold: 5_000 }, place))
    const moved = ok(run(building, { type: 'moveBuilding', target: { type: 'roost' }, placement: FREE_2 }, 100_000))
    expect(moved.roostTier).toBe(0)
    const done = ok(run(moved, { type: 'finishConstruction', index: 0 }, 300_000))
    expect([done.roostTier, done.roostPlacement]).toEqual([1, FREE_2])
  })

  it('a Roost build can be skipped like any construction', () => {
    const building = ok(run({ ...base, level: 5, gold: 5_000 }, place))
    const r = run(building, { type: 'buy', item: { kind: 'skip', target: 'construction', index: 0 } }, 0)
    expect(ok(r).roostTier).toBe(1)
    expect(r.ok && r.effects).toHaveLength(1)
  })
})

describe('Tiers 2 to 4 are Gold upgrades', () => {
  const up: Action = { type: 'startUpgrade', building: { type: 'roost' } }

  it('upgradeInfo reads the table and the unlock table', () => {
    expect(upgradeInfo(roosted(1), { type: 'roost' }, FLASH_14)).toEqual({ cost: 75_000, timerMs: 4 * H / 6, minLevel: 10 })
    expect(upgradeInfo(roosted(2), { type: 'roost' }, FLASH_14)).toEqual({ cost: 400_000, timerMs: 12 * H / 6, minLevel: 15 })
    expect(upgradeInfo(roosted(3), { type: 'roost' }, FLASH_14)).toEqual({ cost: 2_500_000, timerMs: 24 * H / 6, minLevel: 22 })
    expect(upgradeInfo(roosted(4), { type: 'roost' }, FLASH_14)).toBeNull()
    expect(upgradeInfo(roosted(5), { type: 'roost' }, FLASH_14)).toBeNull()
    expect(upgradeInfo(base, { type: 'roost' }, FLASH_14)).toBeNull()
  })

  it('upgrades Tier 1 to 2: spends Gold, pays build XP, raises the tier on completion', () => {
    const s = ok(run(roosted(1, { level: 10, gold: 75_000 }), up))
    expect(s.gold).toBe(0)
    expect(s.level).toBe(11) // build XP is capped at one level's worth (R31)
    expect(s.roostTier).toBe(1)
    expect(s.constructions).toEqual([{ kind: 'upgrade', building: { type: 'roost' }, readyAtMs: 4 * H / 6 }])
    expect(ok(run(s, { type: 'finishConstruction', index: 0 }, 4 * H / 6)).roostTier).toBe(2)
  })

  it('gates: PL, Gold, one at a time, no Roost, Tier 4 is the end of the Gold path', () => {
    err(run(roosted(1, { level: 9 }), up), 'LEVEL_TOO_LOW')
    err(run(roosted(1, { level: 10, gold: 74_999 }), up), 'INSUFFICIENT_GOLD')
    const going = ok(run(roosted(1, { level: 10 }), up))
    err(run(going, up), 'UNDER_CONSTRUCTION')
    err(run(base, up), 'NOT_FOUND')
    err(run(roosted(4), up), 'MAX_LEVEL')
    err(run(roosted(5), up), 'MAX_LEVEL')
  })

  it('an unfinished Tier 1 build cannot be upgraded', () => {
    const building = ok(run({ ...base, level: 10, gold: 1e7 }, place))
    err(run(building, { type: 'startUpgrade', building: { type: 'roost' } }), 'UNDER_CONSTRUCTION')
  })
})

describe('Ascension (Tier 5, R35)', () => {
  it('Review Focus 2: at PL 30, Tier 4, 10M Gold it charges 2,000,000 micro-USD, spends the Gold, starts the build', () => {
    const r = applyAction(roosted(4, { gold: 10_000_000 }), ascend, 0, createRng(1), LAUNCH_CATALOG, FLASH_14, 5) // after Rush: no day limit
    if (!r.ok) throw new Error(r.error)
    expect(r.effects).toEqual([{ type: 'charge', microUsd: 2_000_000 }])
    expect(r.state.gold).toBe(0)
    expect(r.state.level).toBe(31) // ditto
    expect(r.state.roostTier).toBe(4)
    expect(r.state.constructions).toEqual([{ kind: 'upgrade', building: { type: 'roost' }, readyAtMs: 28_800_000 }])
    expect(ok(run(r.state, { type: 'finishConstruction', index: 0 }, 28_800_000)).roostTier).toBe(5)
  })

  it('fails with no charge below Tier 4, below PL 30, or with too little Gold', () => {
    err(run(roosted(3), ascend), 'INVALID_ACTION')
    err(run(roosted(0, { roostPlacement: null }), ascend), 'NOT_FOUND')
    err(run(roosted(4, { level: 29 }), ascend), 'LEVEL_TOO_LOW')
    err(run(roosted(4, { gold: 9_999_999 }), ascend), 'INSUFFICIENT_GOLD')
    err(run(roosted(5), ascend), 'MAX_LEVEL')
    const full = roosted(4, { constructions: [0, 1].map(i => ({ kind: 'build' as const, building: { type: 'farm' as const, index: i }, readyAtMs: 9 })) })
    err(run(full, ascend), 'BUILDERS_BUSY')
  })

  it('a second Ascension while building fails', () => {
    const going = ok(run(roosted(4), ascend))
    err(run(going, ascend), 'UNDER_CONSTRUCTION')
  })

  it('can be skipped like any timer', () => {
    const going = ok(run(roosted(4), ascend))
    expect(ok(run(going, { type: 'buy', item: { kind: 'skip', target: 'construction', index: 0 } })).roostTier).toBe(5)
  })

  it('priceMicroUsd: $2.00 at Tier 4, none elsewhere', () => {
    expect(priceMicroUsd({ kind: 'ascension' }, roosted(4), 0)).toBe(2_000_000)
    expect(priceMicroUsd({ kind: 'ascension' }, roosted(3), 0)).toBeNull()
    expect(priceMicroUsd({ kind: 'ascension' }, roosted(5), 0)).toBeNull()
  })
})

describe('action shape check', () => {
  it('accepts the new Roost actions and refs', () => {
    expect(isValidAction(place)).toBe(true)
    expect(isValidAction(ascend)).toBe(true)
    expect(isValidAction({ type: 'startUpgrade', building: { type: 'roost' } })).toBe(true)
    expect(isValidAction({ type: 'moveBuilding', target: { type: 'roost' }, placement: AT })).toBe(true)
  })
})
