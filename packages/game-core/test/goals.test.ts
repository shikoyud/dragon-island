import { describe, expect, it } from 'vitest'
import { applyAction } from '../src/actions/apply'
import type { Action } from '../src/actions/types'
import { isValidAction } from '../src/actions/validate'
import { LAUNCH_CATALOG } from '../src/data/launch-catalog'
import { GOALS } from '../src/data/goals'
import { FLASH_14 } from '../src/data/presets'
import { currentGoal, goalProgress } from '../src/goals'
import { createRng } from '../src/rng'
import { newPlayer, type PlayerState } from '../src/state'
import { err, ok } from './helpers'

const base = newPlayer(0)
const run = (st: PlayerState, a: Action, t = 0) => applyAction(st, a, t, createRng(1), LAUNCH_CATALOG, FLASH_14, 1)
const prog = (st: PlayerState) => goalProgress(st, currentGoal(st)!, LAUNCH_CATALOG)
const stats = (o: Partial<PlayerState['goalStats']>): PlayerState['goalStats'] => ({ ...base.goalStats, ...o })
const MIN = 60_000

// The literal R36 rows.
const ROWS: [string, number, number][] = [
  ['Collect Gold from a habitat', 25, 200],
  ['Plant and harvest a Dragon Bush', 25, 100],
  ['Feed a dragon', 25, 100],
  ['Raise two dragons to level 4', 50, 500],
  ['Breed your first hybrid', 75, 500],
  ['Hatch an egg', 75, 1_000],
  ['Build a Sea or Nature habitat', 100, 2_000],
  ['Buy a Sea or Nature Basic', 100, 2_000],
  ['Build a second farm', 100, 2_000],
  ['Upgrade the Hatchery', 100, 2_000],
  ['Build the Dragon Roost', 200, 5_000],
  ['Raise a dragon to level 10', 200, 10_000],
  ['Find 10 species in the Dragon Book', 300, 20_000],
  ['Upgrade the Roost to Tier 2', 500, 40_000],
]

// A state that satisfies each row (and no other progress).
const hab = (element: 'sea' | 'nature') => ({ id: 'hx', element, level: 1, lastCollectedMs: 0, placement: { island: 'home' as const, col: 9, row: 0, facing: 0 as const } })
const dragon = (id: string, speciesId: string, level: number) => ({ id, speciesId, level, feeds: 0, habitatId: null })
const SATISFY: ((s: PlayerState) => PlayerState)[] = [
  s => ({ ...s, goalStats: stats({ collects: 1 }) }),
  s => ({ ...s, goalStats: stats({ harvests: 1 }) }),
  s => ({ ...s, goalStats: stats({ feeds: 1 }) }),
  s => ({ ...s, dragons: s.dragons.map(d => ({ ...d, level: 4 })) }),
  s => ({ ...s, firstHybridDone: true }),
  s => ({ ...s, goalStats: stats({ hatches: 1 }) }),
  s => ({ ...s, habitats: [...s.habitats, hab('nature')] }),
  s => ({ ...s, dragons: [...s.dragons, dragon('dx', 'sea', 1)] }),
  s => ({ ...s, farms: [...s.farms, { ...s.farms[0]!, placement: { island: 'home', col: 11, row: 0, facing: 0 } }] }),
  s => ({ ...s, hatcheryLevel: 2 }),
  s => ({ ...s, roostTier: 1 }),
  s => ({ ...s, dragons: [...s.dragons, dragon('dx', 'terra', 10)] }),
  s => ({ ...s, discovered: Array.from({ length: 10 }, (_, i) => `sp${i}`) }),
  s => ({ ...s, roostTier: 2 }),
]

describe('the 14 Goals (R36)', () => {
  it('are the literal rows', () => {
    expect(GOALS.map(g => [g.text, g.xp, g.gold])).toEqual(ROWS)
  })

  it('a new player starts at Goal 1 with zero counters', () => {
    expect(base.goalIndex).toBe(0)
    expect(base.goalStats).toEqual({ collects: 0, harvests: 0, feeds: 0, breeds: 0, hatches: 0 })
    expect(base).not.toHaveProperty('tutorial')
    expect(currentGoal(base)).toBe(GOALS[0])
  })

  it.each(GOALS.map((g, i) => [i + 1, g, i] as const))('Goal %i: a satisfying state is done, the fresh state is not', (_n, g, i) => {
    const s = { ...base, goalIndex: i }
    expect(goalProgress(s, g, LAUNCH_CATALOG).have).toBeLessThan(goalProgress(s, g, LAUNCH_CATALOG).need)
    const done = SATISFY[i]!(s)
    const p = goalProgress(done, g, LAUNCH_CATALOG)
    expect(p.have).toBeGreaterThanOrEqual(p.need)
    expect(ok(run(done, { type: 'claimGoal' })).goalIndex).toBe(i + 1)
  })

  it('an unfinished Sea or Nature habitat does not count for Goal 7', () => {
    const s = SATISFY[6]!({ ...base, goalIndex: 6, constructions: [{ kind: 'build', building: { type: 'habitat', id: 'hx' }, readyAtMs: 1 }] })
    expect(prog(s).have).toBe(0)
  })
})

describe('claimGoal', () => {
  it('fails GOAL_NOT_DONE on an unmet Goal', () => {
    err(run(base, { type: 'claimGoal' }), 'GOAL_NOT_DONE')
  })

  it('Goal 1 after a collect pays 25 x 12 XP and 200 Gold, and advances', () => {
    const collected = ok(run(base, { type: 'collectGold', habitatId: 'h1' }, 10 * MIN))
    expect(collected.goalStats.collects).toBe(1)
    const r = ok(run(collected, { type: 'claimGoal' }, 10 * MIN))
    expect(r.gold).toBe(collected.gold + 200)
    expect(r.goalIndex).toBe(1)
    // 300 XP crosses PL 2 (50) and PL 3 (175) and leaves 75 toward PL 4.
    expect([r.level, r.xp]).toEqual([3, 300 - 50 - 175])
  })

  it('a refused action does not count, and a collect that pays 0 does not count', () => {
    err(run(base, { type: 'collectGold', habitatId: 'nope' }), 'NOT_FOUND')
    expect(ok(run(base, { type: 'collectGold', habitatId: 'h1' }, 0)).goalStats.collects).toBe(0)
    err(run(base, { type: 'feed', dragonId: 'nope' }), 'NOT_FOUND')
    err(run({ ...base, food: 0 }, { type: 'feed', dragonId: 'd1' }), 'INSUFFICIENT_FOOD')
  })

  it('a Goal already met when the one before is claimed is claimable at once', () => {
    const s = { ...base, goalStats: stats({ collects: 1, harvests: 1 }) }
    const a = ok(run(s, { type: 'claimGoal' }))
    const b = ok(run(a, { type: 'claimGoal' }))
    expect(b.goalIndex).toBe(2)
    err(run(b, { type: 'claimGoal' }), 'GOAL_NOT_DONE')
  })

  it('pays once: replaying the same claim on the new state claims the next Goal only', () => {
    const s = { ...base, goalStats: stats({ collects: 1 }) }
    const a = ok(run(s, { type: 'claimGoal' }))
    err(run(a, { type: 'claimGoal' }), 'GOAL_NOT_DONE')
    expect(a.gold).toBe(s.gold + 200)
  })

  it('after Goal 14 there is NO_GOAL', () => {
    const s = { ...base, goalIndex: 14 }
    expect(currentGoal(s)).toBeNull()
    err(run(s, { type: 'claimGoal' }), 'NO_GOAL')
  })

  it('goalProgress reads 1 / 2 part way', () => {
    const s = { ...base, goalIndex: 3, dragons: [{ ...base.dragons[0]!, level: 4 }, base.dragons[1]!] }
    expect(prog(s)).toEqual({ have: 1, need: 2 })
  })

  it('goes through isValidAction', () => {
    expect(isValidAction({ type: 'claimGoal' })).toBe(true)
  })
})

describe('a fresh Flash-14 player can finish Goals 1-6 with real actions and no grants', () => {
  it('plays through', () => {
    let t = 0
    let s = newPlayer(0)
    const act = (a: Action) => { s = ok(run(s, a, t)) }
    const claim = (n: number) => {
      expect(s.goalIndex, `before claiming Goal ${n}`).toBe(n - 1)
      act({ type: 'claimGoal' })
    }
    t += 10 * MIN
    act({ type: 'collectGold', habitatId: 'h1' })
    expect(s.goalStats.collects).toBe(1)
    claim(1)
    act({ type: 'plant', plot: 0, crop: 'dragonBush' })
    t += 60 * MIN
    act({ type: 'harvest', plot: 0 })
    claim(2)
    act({ type: 'feed', dragonId: 'd1' })
    claim(3)
    // Goal 4: two dragons to Lv 4, farming for Food when it runs short.
    for (const id of ['d1', 'd2']) {
      while (s.dragons.find(d => d.id === id)!.level < 4) {
        if (run(s, { type: 'feed', dragonId: id }, t).ok === false) {
          act({ type: 'plant', plot: 0, crop: 'dragonBush' })
          t += 60 * MIN
          act({ type: 'harvest', plot: 0 })
          t += 10 * MIN
          act({ type: 'collectGold', habitatId: 'h1' })
          continue
        }
        act({ type: 'feed', dragonId: id })
      }
    }
    claim(4)
    // Goal 5: the scripted first hybrid; Goal 6: collect the egg and hatch it.
    act({ type: 'startBreed', parentA: 'd1', parentB: 'd2' })
    expect(s.firstHybridDone).toBe(true)
    claim(5)
    t += 2 * MIN
    act({ type: 'collectEgg', breeder: 0 })
    t += 24 * 3_600_000
    act({ type: 'hatch', slot: 0 })
    claim(6)
    expect(s.goalIndex).toBe(6)
  })
})
