import { describe, expect, it } from 'vitest'
import { applyAction } from '../src/actions/apply'
import type { Action } from '../src/actions/types'
import { createRng } from '../src/rng'
import { MS_PER_DAY } from '../src/time'
import { newPlayer, type Dragon, type PlayerState } from '../src/state'
import { FIXTURE_CATALOG } from './fixtures'
import { err, ok } from './helpers'

const s = newPlayer(0)
const run = (st: PlayerState, a: Action, t = 0) => applyAction(st, a, t, createRng(1), FIXTURE_CATALOG)
// Untyped JSON from a client: anything may arrive.
const raw = (st: PlayerState, a: unknown, t = 0) => run(st, a as Action, t)
const fire = (id: string, habitatId: string | null = 'h1', level = 1): Dragon => ({ id, speciesId: 'fire', level, habitatId })

describe('malformed actions are rejected, never applied', () => {
  const rich: PlayerState = { ...s, earningUnlocked: true, hoardLevel: 1 }

  it('rejects unknown crops and action types', () => {
    err(raw(s, { type: 'plant', plot: 0, crop: 'constructor' }), 'INVALID_ACTION')
    err(raw(s, { type: 'plant', plot: 0, crop: 'gold' }), 'INVALID_ACTION')
    err(raw(s, { type: 'nope' }), 'INVALID_ACTION')
    err(raw(s, null), 'INVALID_ACTION')
  })

  it('rejects non-integer indexes', () => {
    const laid = { ...s, nests: [{ speciesId: 'fire', readyAtMs: 0 }], hatchery: [{ speciesId: 'fire', readyAtMs: 0 }] }
    err(raw(laid, { type: 'collectEgg', nest: '0' }), 'INVALID_ACTION')
    err(raw(laid, { type: 'hatch', slot: '0' }), 'INVALID_ACTION')
    err(raw(laid, { type: 'hatch', slot: 0.5 }), 'INVALID_ACTION')
    err(raw(s, { type: 'plant', plot: -1, crop: 'sprout' }), 'INVALID_ACTION')
    err(raw(s, { type: 'harvest', plot: Number.NaN }), 'INVALID_ACTION')
  })

  it('rejects bad store items, elements and ids', () => {
    err(raw(s, { type: 'buy', item: { kind: 'x' } }), 'INVALID_ACTION')
    err(raw(s, { type: 'buy', item: { kind: 'skip', target: 'bank', index: 0 } }), 'INVALID_ACTION')
    err(raw(s, { type: 'buy', item: { kind: 'levelUp', dragonId: 7 } }), 'INVALID_ACTION')
    err(raw({ ...s, level: 5 }, { type: 'buildHabitat', element: 'plasma' }), 'INVALID_ACTION')
    err(raw(s, { type: 'feed', dragonId: 1 }), 'INVALID_ACTION')
    err(raw(rich, { type: 'sellGold', gold: '100' }), 'INVALID_ACTION')
  })

  it('still reports player mistakes with their own codes', () => {
    err(run(rich, { type: 'sellGold', gold: 0 }), 'INVALID_AMOUNT')
    err(run(s, { type: 'plant', plot: 7, crop: 'sprout' }), 'NOT_FOUND')
  })
})

describe('sell counter is monotonic across a clock regression', () => {
  const t1 = 2 * MS_PER_DAY + 1000
  const base: PlayerState = { ...newPlayer(t1), earningUnlocked: true, hoardLevel: 1, gold: 600_000, eligibleGold: 600_000 }

  it('does not reset when the clock steps back across midnight', () => {
    const a = ok(run(base, { type: 'sellGold', gold: 200_000 }, t1))
    expect(a.sell).toEqual({ day: 2, soldTodayMicroUsd: 1_000_000 })
    err(run(a, { type: 'sellGold', gold: 1 }, t1 - 5000), 'SELL_LIMIT_REACHED')
    err(run(a, { type: 'sellGold', gold: 1 }, t1 + 10), 'SELL_LIMIT_REACHED')
    const b = ok(run(a, { type: 'sellGold', gold: 1 }, t1 + MS_PER_DAY))
    expect(b.sell.day).toBe(3)
  })
})

describe('habitats collect before anything changes their income', () => {
  const tenMin = 10 * 60_000

  it('upgrade does not retroactively raise the cap', () => {
    const idle = { ...s, gold: 10_000, dragons: [fire('d1', 'h1', 10), s.dragons[1]!] }
    const now = 1000 * 60_000
    const up = ok(run(idle, { type: 'upgradeHabitat', habitatId: 'h1' }, now))
    expect(up.eligibleGold).toBe(500)
    expect(ok(run(up, { type: 'collectGold', habitatId: 'h1' }, now)).eligibleGold).toBe(500)
  })

  it('selling a resident keeps the gold it already earned', () => {
    const two = { ...s, dragons: [...s.dragons, fire('d9')] }
    const sold = ok(run(two, { type: 'sellDragon', dragonId: 'd9' }, tenMin))
    expect(sold.eligibleGold).toBe(40)
    expect(sold.habitats[0]!.lastCollectedMs).toBe(tenMin)
  })

  it('feeding does not re-rate accrued gold', () => {
    const fed = ok(run({ ...s, food: 1000 }, { type: 'feed', dragonId: 'd1' }, tenMin))
    expect(fed.eligibleGold).toBe(20)
    expect(ok(run(fed, { type: 'collectGold', habitatId: 'h1' }, tenMin)).eligibleGold).toBe(20)
  })

  it('store level-up does not re-rate accrued gold', () => {
    const up = ok(run(s, { type: 'buy', item: { kind: 'levelUp', dragonId: 'd1' } }, tenMin))
    expect(up.eligibleGold).toBe(20)
    expect(up.habitats[0]!.lastCollectedMs).toBe(tenMin)
  })

  it('hatching into a habitat collects it first', () => {
    const ready = { ...s, hatchery: [{ speciesId: 'fire', readyAtMs: 0 }] }
    const hatched = ok(run(ready, { type: 'hatch', slot: 0 }, tenMin))
    expect(hatched.eligibleGold).toBe(20)
    expect(hatched.habitats[0]!.lastCollectedMs).toBe(tenMin)
  })
})
