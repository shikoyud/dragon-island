import { describe, expect, it } from 'vitest'
import { applyAction } from '../src/actions/apply'
import type { Action } from '../src/actions/types'
import { createRng } from '../src/rng'
import { newPlayer, type PlayerState } from '../src/state'
import { FIXTURE_CATALOG } from './fixtures'
import { err, ok } from './helpers'

const s = newPlayer(0)
const rng = createRng(1)
const run = (st: PlayerState, a: Action, t: number) => applyAction(st, a, t, rng, FIXTURE_CATALOG)

describe('plant and harvest', () => {
  it('grows a crop into food, ready after the Flash-14 timer', () => {
    const a = ok(run(s, { type: 'plant', plot: 0, crop: 'dragonBush' }, 1_000))
    expect(a.gold).toBe(950)
    expect(a.farms[0]).toEqual({ ...s.farms[0], crop: 'dragonBush', readyAtMs: 16_000 })
    err(run(a, { type: 'plant', plot: 0, crop: 'dragonBush' }, 1_000), 'PLOT_BUSY')
    err(run(a, { type: 'harvest', plot: 0 }, 15_999), 'NOT_READY')
    const b = ok(run(a, { type: 'harvest', plot: 0 }, 16_000))
    expect(b.food).toBe(s.food + 60)
    expect(b.farms[0]).toEqual({ ...s.farms[0], crop: null, readyAtMs: 0 })
  })

  it('a crop planted at t is NOT_READY at t + 14,999 and ready at t + 15,000', () => {
    const t = 5_000
    const a = ok(run(s, { type: 'plant', plot: 0, crop: 'dragonBush' }, t))
    err(run(a, { type: 'harvest', plot: 0 }, t + 14_999), 'NOT_READY')
    ok(run(a, { type: 'harvest', plot: 0 }, t + 15_000))
  })

  it('reads the farm level at harvest, not at planting', () => {
    const a = ok(run(s, { type: 'plant', plot: 0, crop: 'dragonBush' }, 0))
    const lvl3 = { ...a, farms: a.farms.map((f, i) => i === 0 ? { ...f, level: 3 } : f) }
    expect(ok(run(lvl3, { type: 'harvest', plot: 0 }, 15_000)).food).toBe(s.food + 90)
  })

  it('locks crops behind player level', () => {
    err(run({ ...s, level: 2, gold: 1e6 }, { type: 'plant', plot: 0, crop: 'emberWheat' }, 0), 'LEVEL_TOO_LOW')
    expect(ok(run({ ...s, level: 3, gold: 1e6 }, { type: 'plant', plot: 0, crop: 'emberWheat' }, 0)).gold).toBe(1e6 - 250)
  })

  it('rejects bad plots and short gold', () => {
    err(run(s, { type: 'harvest', plot: 0 }, 0), 'PLOT_EMPTY')
    err(run({ ...s, level: 15 }, { type: 'plant', plot: 0, crop: 'warlordPepper' }, 0), 'INSUFFICIENT_GOLD')
    err(run(s, { type: 'plant', plot: 7, crop: 'dragonBush' }, 0), 'NOT_FOUND')
    err(run(s, { type: 'harvest', plot: 7 }, 0), 'NOT_FOUND')
  })

  it('rejects the old crop ids', () => {
    err(run(s, { type: 'plant', plot: 0, crop: 'sprout' as never }, 0), 'INVALID_ACTION')
  })
})

it('never mutates the input state', () => {
  expect(s).toEqual(newPlayer(0))
})
