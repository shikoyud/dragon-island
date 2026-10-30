import { describe, expect, it } from 'vitest'
import { applyAction } from '../src/actions/apply'
import type { Action } from '../src/actions/types'
import { createRng } from '../src/rng'
import { newPlayer, type Dragon, type PlayerState } from '../src/state'
import { FIXTURE_CATALOG } from './fixtures'
import { err, ok } from './helpers'

const s = newPlayer(0)
const run = (st: PlayerState, a: Action, t = 0) => applyAction(st, a, t, createRng(1), FIXTURE_CATALOG)
// Untyped JSON from a client: anything may arrive.
const raw = (st: PlayerState, a: unknown, t = 0) => run(st, a as Action, t)
const flame = (id: string, habitatId: string | null = 'h1', level = 1): Dragon => ({ id, speciesId: 'flame', level, feeds: 0, habitatId })

describe('malformed actions are rejected, never applied', () => {
  it('rejects unknown crops and action types', () => {
    err(raw(s, { type: 'plant', plot: 0, crop: 'constructor' }), 'INVALID_ACTION')
    err(raw(s, { type: 'plant', plot: 0, crop: 'gold' }), 'INVALID_ACTION')
    err(raw(s, { type: 'nope' }), 'INVALID_ACTION')
    err(raw(s, null), 'INVALID_ACTION')
  })

  it('rejects non-integer indexes', () => {
    const laid = { ...s, nests: [{ ...s.nests[0]!, egg: { speciesId: 'flame', readyAtMs: 0 } }], hatchery: [{ speciesId: 'flame', readyAtMs: 0 }] }
    err(raw(laid, { type: 'collectEgg', nest: '0' }), 'INVALID_ACTION')
    err(raw(laid, { type: 'hatch', slot: '0' }), 'INVALID_ACTION')
    err(raw(laid, { type: 'hatch', slot: 0.5 }), 'INVALID_ACTION')
    err(raw(s, { type: 'plant', plot: -1, crop: 'sprout' }), 'INVALID_ACTION')
    err(raw(s, { type: 'harvest', plot: Number.NaN }), 'INVALID_ACTION')
  })

  it('rejects bad store items, elements and ids', () => {
    err(raw(s, { type: 'buy', item: { kind: 'x' } }), 'INVALID_ACTION')
    err(raw(s, { type: 'buy', item: { kind: 'skip', target: 'bank', index: 0 } }), 'INVALID_ACTION')
    err(raw({ ...s, level: 5 }, { type: 'placeBuilding', building: { kind: 'habitat', element: 'plasma' }, placement: { island: 'home', col: 6, row: 7, facing: 0 } }), 'INVALID_ACTION')
    err(raw(s, { type: 'feed', dragonId: 1 }), 'INVALID_ACTION')
  })

  it('still reports player mistakes with their own codes', () => {
    err(run(s, { type: 'plant', plot: 7, crop: 'sprout' }), 'NOT_FOUND')
  })
})

describe('habitats collect before anything changes their income', () => {
  const tenMin = 10 * 60_000

  it('finishing an upgrade collects at the old rate first', () => {
    const idle = { ...s, gold: 10_000, dragons: [flame('d1', 'h1', 10), s.dragons[1]!] }
    const now = 1000 * 60_000
    const started = ok(run(idle, { type: 'startUpgrade', building: { type: 'habitat', id: 'h1' } }, 0))
    const up = ok(run(started, { type: 'finishConstruction', index: 0 }, now))
    expect(up.gold).toBe(9_500)
    expect(ok(run(up, { type: 'collectGold', habitatId: 'h1' }, now)).gold).toBe(9_500)
  })

  it('selling a resident keeps the gold it already earned', () => {
    const two = { ...s, dragons: [...s.dragons, flame('d9')] }
    const sold = ok(run(two, { type: 'sellDragon', dragonId: 'd9' }, tenMin))
    expect(sold.gold).toBe(1_140)
    expect(sold.habitats[0]!.lastCollectedMs).toBe(tenMin)
  })

  it('feeding does not re-rate accrued gold', () => {
    const fed = ok(run({ ...s, food: 1000 }, { type: 'feed', dragonId: 'd1' }, tenMin))
    expect(fed.gold).toBe(1_020)
    expect(ok(run(fed, { type: 'collectGold', habitatId: 'h1' }, tenMin)).gold).toBe(1_020)
  })

  it('hatching into a habitat collects it first', () => {
    const ready = { ...s, hatchery: [{ speciesId: 'flame', readyAtMs: 0 }] }
    const hatched = ok(run(ready, { type: 'hatch', slot: 0 }, tenMin))
    expect(hatched.gold).toBe(1_020)
    expect(hatched.habitats[0]!.lastCollectedMs).toBe(tenMin)
  })
})
