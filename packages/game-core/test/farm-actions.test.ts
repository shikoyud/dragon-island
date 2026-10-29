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
  it('grows a crop into food', () => {
    const a = ok(run(s, { type: 'plant', plot: 0, crop: 'sprout' }, 0))
    expect(a.gold).toBe(980)
    expect(a.farms[0]).toEqual({ ...s.farms[0], crop: 'sprout', readyAtMs: 60_000 })
    err(run(a, { type: 'plant', plot: 0, crop: 'sprout' }, 0), 'PLOT_BUSY')
    err(run(a, { type: 'harvest', plot: 0 }, 59_999), 'NOT_READY')
    const b = ok(run(a, { type: 'harvest', plot: 0 }, 60_000))
    expect(b.food).toBe(110)
    expect(b.farms[0]).toEqual({ ...s.farms[0], crop: null, readyAtMs: 0 })
  })

  it('rejects bad plots and short gold', () => {
    err(run(s, { type: 'harvest', plot: 0 }, 0), 'PLOT_EMPTY')
    err(run(s, { type: 'plant', plot: 0, crop: 'bounty' }, 0), 'INSUFFICIENT_GOLD')
    err(run(s, { type: 'plant', plot: 7, crop: 'sprout' }, 0), 'NOT_FOUND')
    err(run(s, { type: 'harvest', plot: 7 }, 0), 'NOT_FOUND')
  })
})

it('never mutates the input state', () => {
  expect(s).toEqual(newPlayer(0))
})
