import { describe, expect, it } from 'vitest'
import { applyAction } from '../src/actions/apply'
import type { Action } from '../src/actions/types'
import { createRng } from '../src/rng'
import { newPlayer, type PlayerState } from '../src/state'
import type { StoreItem } from '../src/store'
import { FIXTURE_CATALOG } from './fixtures'
import { err, ok } from './helpers'

const run = (st: PlayerState, a: Action, t = 0) => applyAction(st, a, t, createRng(1), FIXTURE_CATALOG)
const sell = (gold: number): Action => ({ type: 'sellGold', gold })
const buy = (item: StoreItem): Action => ({ type: 'buy', item })
const base: PlayerState = { ...newPlayer(0), earningUnlocked: true, hoardLevel: 1, gold: 300_000, eligibleGold: 300_000 }
const p0 = newPlayer(0)

describe('sellGold', () => {
  it('checks gates in order', () => {
    err(run(p0, sell(1)), 'EARNING_LOCKED')
    err(run({ ...base, hoardLevel: 0 }, sell(1)), 'NO_HOARD')
    for (const g of [0, -1, 1.5, Number.NaN]) err(run(base, sell(g)), 'INVALID_AMOUNT')
    err(run({ ...base, eligibleGold: 10 }, sell(11)), 'INSUFFICIENT_GOLD')
  })

  it('pays out eligible gold and records the sale', () => {
    const r = run(base, sell(100_000))
    expect(r.ok && r.effects).toEqual([{ type: 'payout', microUsd: 500_000 }])
    const a = ok(r)
    expect([a.gold, a.eligibleGold]).toEqual([200_000, 200_000])
    expect(a.sell.soldTodayMicroUsd).toBe(500_000)
    expect(a.ledger.soldMicroUsd).toBe(500_000)
  })

  it('enforces the daily limit and resets at 00:00 UTC', () => {
    const a = ok(run(base, sell(100_000)))
    err(run(a, sell(100_001)), 'SELL_LIMIT_REACHED')
    const b = ok(run(a, sell(100_000)))
    expect(b.sell.soldTodayMicroUsd).toBe(1_000_000)
    err(run(b, sell(1)), 'SELL_LIMIT_REACHED')
    const c = ok(run({ ...b, gold: 100_000, eligibleGold: 100_000 }, sell(100_000), 86_400_000))
    expect(c.sell).toEqual({ day: 1, soldTodayMicroUsd: 500_000 })
    expect(c.ledger.soldMicroUsd).toBe(1_500_000)
  })
})

describe('buy', () => {
  it('sells food packs', () => {
    const r = run(p0, buy({ kind: 'foodPack' }))
    expect(r.ok && r.effects).toEqual([{ type: 'charge', microUsd: 500_000 }])
    expect(ok(r).food).toBe(1_100)
  })

  it('sells nests up to four', () => {
    const r = run(p0, buy({ kind: 'nest' }))
    expect(r.ok && r.effects).toEqual([{ type: 'charge', microUsd: 2_000_000 }])
    expect(ok(r).nests).toEqual([null, null])
    err(run({ ...p0, nests: [null, null, null, null] }, buy({ kind: 'nest' })), 'MAX_NESTS')
  })

  it('skips timers', () => {
    const st = { ...p0, nests: [{ speciesId: 'fire', readyAtMs: 1_800_001 }] }
    const r = run(st, buy({ kind: 'skip', target: 'nest', index: 0 }))
    expect(r.ok && r.effects).toEqual([{ type: 'charge', microUsd: 200_000 }])
    expect(ok(r).nests[0]!.readyAtMs).toBe(0)
    err(run(st, buy({ kind: 'skip', target: 'nest', index: 0 }), 1_800_001), 'NOTHING_TO_SKIP')
    err(run(st, buy({ kind: 'skip', target: 'nest', index: 3 })), 'NOT_FOUND')
  })

  it('skips hatchery and farm timers', () => {
    const st = { ...p0, hatchery: [{ speciesId: 'fire', readyAtMs: 90_000 }], farms: [{ crop: 'sprout' as const, readyAtMs: 60_000 }, { crop: null, readyAtMs: 0 }] }
    expect(ok(run(st, buy({ kind: 'skip', target: 'hatchery', index: 0 }), 10)).hatchery[0]!.readyAtMs).toBe(10)
    expect(ok(run(st, buy({ kind: 'skip', target: 'farm', index: 0 }), 10)).farms[0]).toEqual({ crop: 'sprout', readyAtMs: 10 })
    err(run(st, buy({ kind: 'skip', target: 'farm', index: 1 })), 'NOTHING_TO_SKIP')
    err(run(st, buy({ kind: 'skip', target: 'hatchery', index: 1 })), 'NOT_FOUND')
  })

  it('levels a dragon up without food or xp', () => {
    const r = run(p0, buy({ kind: 'levelUp', dragonId: 'd1' }))
    expect(r.ok && r.effects).toEqual([{ type: 'charge', microUsd: 50_000 }])
    const a = ok(r)
    expect([a.dragons[0]!.level, a.food, a.xp]).toEqual([2, 100, 0])
    const max = { ...p0, dragons: p0.dragons.map(d => ({ ...d, level: 30 })) }
    err(run(max, buy({ kind: 'levelUp', dragonId: 'd1' })), 'MAX_LEVEL')
    err(run(p0, buy({ kind: 'levelUp', dragonId: 'd9' })), 'NOT_FOUND')
  })

  it('sells odds boosts', () => {
    expect(ok(run(p0, buy({ kind: 'oddsBoost' }))).oddsBoosts).toBe(1)
  })

  it('builds and upgrades the Hoard', () => {
    err(run({ ...p0, level: 4 }, buy({ kind: 'hoard' })), 'LEVEL_TOO_LOW')
    const r = run({ ...p0, level: 5 }, buy({ kind: 'hoard' }))
    expect(r.ok && r.effects).toEqual([{ type: 'charge', microUsd: 2_000_000 }])
    expect(ok(r).hoardLevel).toBe(1)
    err(run({ ...p0, level: 5, hoardLevel: 7 }, buy({ kind: 'hoard' })), 'MAX_LEVEL')
  })
})

it('never mutates inputs', () => {
  expect(p0).toEqual(newPlayer(0))
})
