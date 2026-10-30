import { describe, expect, it } from 'vitest'
import { applyAction } from '../src/actions/apply'
import type { Action } from '../src/actions/types'
import { createRng } from '../src/rng'
import { newPlayer, type PlayerState } from '../src/state'
import { priceMicroUsd, type StoreItem } from '../src/store'
import { FIXTURE_CATALOG } from './fixtures'
import { err, ok } from './helpers'
import { isValidAction } from '../src/index'

const run = (st: PlayerState, a: Action, t = 0) => applyAction(st, a, t, createRng(1), FIXTURE_CATALOG)
const buy = (item: StoreItem): Action => ({ type: 'buy', item })
const p0 = newPlayer(0)
const s = p0
const P = (col: number, row: number) => ({ island: 'home' as const, col, row, facing: 0 as const })

describe('buy', () => {
  it('sells food packs', () => {
    const r = run(p0, buy({ kind: 'foodPack' }))
    expect(r.ok && r.effects).toEqual([{ type: 'charge', microUsd: 500_000 }])
    expect(ok(r).food).toBe(1_100)
  })

  it('skips timers', () => {
    const st = { ...p0, nests: [{ ...p0.nests[0]!, egg: { speciesId: 'fire', readyAtMs: 1_800_001 } }] }
    const r = run(st, buy({ kind: 'skip', target: 'nest', index: 0 }))
    expect(r.ok && r.effects).toEqual([{ type: 'charge', microUsd: 200_000 }])
    expect(ok(r).nests[0]!.egg!.readyAtMs).toBe(0)
    err(run(st, buy({ kind: 'skip', target: 'nest', index: 0 }), 1_800_001), 'NOTHING_TO_SKIP')
    err(run(st, buy({ kind: 'skip', target: 'nest', index: 3 })), 'NOT_FOUND')
  })

  it('skips hatchery and farm timers', () => {
    const st = { ...p0, hatchery: [{ speciesId: 'fire', readyAtMs: 90_000 }], farms: [{ ...p0.farms[0]!, crop: 'sprout' as const, readyAtMs: 60_000 }, p0.farms[1]!] }
    expect(ok(run(st, buy({ kind: 'skip', target: 'hatchery', index: 0 }), 10)).hatchery[0]!.readyAtMs).toBe(10)
    expect(ok(run(st, buy({ kind: 'skip', target: 'farm', index: 0 }), 10)).farms[0]).toEqual({ ...p0.farms[0], crop: 'sprout', readyAtMs: 10 })
    err(run(st, buy({ kind: 'skip', target: 'farm', index: 1 })), 'NOTHING_TO_SKIP')
    err(run(st, buy({ kind: 'skip', target: 'hatchery', index: 1 })), 'NOT_FOUND')
  })

  it('rejects removed actions and store items', () => {
    err(run(p0, { type: 'sellGold', gold: 1 } as never), 'INVALID_ACTION')
    const removed = [
      { kind: 'oddsBoost' }, { kind: 'levelUp', dragonId: 'd1' }, { kind: 'nest', placement: P(6, 8) }, { kind: 'hoard' },
    ]
    for (const item of removed) err(run(p0, buy(item as never)), 'INVALID_ACTION')
  })
})

describe('placed store items and construction skips', () => {
  it('prices and applies a construction skip, which finishes the build', () => {
    const a = ok(run({ ...s, gold: 2_000, tutorial: { ...s.tutorial, buildsStarted: 2 } }, { type: 'startUpgrade', building: { type: 'habitat', id: 'h1' } }, 0))
    expect(priceMicroUsd({ kind: 'skip', target: 'construction', index: 0 }, a, 0)).toBe(100_000)
    expect(priceMicroUsd({ kind: 'skip', target: 'construction', index: 0 }, a, 600_000)).toBeNull()
    const r = run(a, { type: 'buy', item: { kind: 'skip', target: 'construction', index: 0 } }, 1_000)
    expect(r.ok && r.effects).toEqual([{ type: 'charge', microUsd: 100_000 }])
    expect([ok(r).habitats[0]!.level, ok(r).constructions]).toEqual([2, []])
  })
  it('a construction skip with a bad index is NOT_FOUND and charges nothing', () => {
    const a = ok(run({ ...s, gold: 2_000, tutorial: { ...s.tutorial, buildsStarted: 2 } }, { type: 'startUpgrade', building: { type: 'habitat', id: 'h1' } }, 0))
    for (const index of [1, 99]) err(run(a, { type: 'buy', item: { kind: 'skip', target: 'construction', index } }, 0), 'NOT_FOUND')
    for (const index of [-1, 0.5]) err(run(a, { type: 'buy', item: { kind: 'skip', target: 'construction', index } }, 0), 'INVALID_ACTION')
    err(run(s, { type: 'buy', item: { kind: 'skip', target: 'construction', index: 0 } }, 0), 'NOT_FOUND')
  })
  it('a construction skip on a ready construction is NOTHING_TO_SKIP', () => {
    const a = ok(run({ ...s, gold: 2_000, tutorial: { ...s.tutorial, buildsStarted: 2 } }, { type: 'startUpgrade', building: { type: 'habitat', id: 'h1' } }, 0))
    const readyAt = a.constructions[0]!.readyAtMs
    err(run(a, { type: 'buy', item: { kind: 'skip', target: 'construction', index: 0 } }, readyAt), 'NOTHING_TO_SKIP')
    err(run(a, { type: 'buy', item: { kind: 'skip', target: 'construction', index: 0 } }, readyAt + 1), 'NOTHING_TO_SKIP')
  })
  it('a construction skip frees a builder', () => {
    const t = { ...s, gold: 50_000, level: 10, tutorial: { ...s.tutorial, buildsStarted: 2 } }
    const two = ok(run(ok(run(t, { type: 'startUpgrade', building: { type: 'habitat', id: 'h1' } }, 0)), { type: 'startUpgrade', building: { type: 'habitat', id: 'h2' } }, 0))
    err(run(two, { type: 'startUpgrade', building: { type: 'farm', index: 0 } }, 0), 'BUILDERS_BUSY')
    const freed = ok(run(two, { type: 'buy', item: { kind: 'skip', target: 'construction', index: 0 } }, 0))
    expect(ok(run(freed, { type: 'startUpgrade', building: { type: 'farm', index: 0 } }, 0)).constructions).toHaveLength(2)
  })
})

it('never mutates inputs', () => {
  expect(p0).toEqual(newPlayer(0))
})
