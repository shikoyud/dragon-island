import { describe, expect, it } from 'vitest'
import { applyAction } from '../src/actions/apply'
import type { Action } from '../src/actions/types'
import { islandSize, placementError } from '../src/island'
import { createRng } from '../src/rng'
import { newPlayer, type Dragon, type IslandId, type PlayerState } from '../src/state'
import { FIXTURE_CATALOG } from './fixtures'
import { err, ok } from './helpers'

const s = newPlayer(0)
const rng = createRng(1)
const run = (st: PlayerState, a: Action, t: number) => applyAction(st, a, t, rng, FIXTURE_CATALOG)
const withDragon = (st: PlayerState, d: Dragon): PlayerState => ({ ...st, dragons: [...st.dragons, d] })

describe('island unlock actions', () => {
  it('expands the home island in order with gates, costs and strip obstacles', () => {
    err(run(s, { type: 'expandIsland' }, 0), 'LEVEL_TOO_LOW')
    err(run({ ...s, level: 2, gold: 999 }, { type: 'expandIsland' }, 0), 'INSUFFICIENT_GOLD')
    const a = ok(run({ ...s, level: 2 }, { type: 'expandIsland' }, 0))
    expect([a.gold, a.islands.homeStep, islandSize(a, 'home')]).toEqual([0, 1, { w: 14, h: 12 }])
    expect(a.islands.obstacles.map(o => o.id)).toEqual(['home-s1-bush', 'home-s1-rock'])
    err(run({ ...a, level: 50, gold: 10_000_000, islands: { ...a.islands, homeStep: 12 } }, { type: 'expandIsland' }, 0), 'MAX_EXPANSION')
  })
  it('unlocks islands in order; Dawnspire needs a legendary', () => {
    err(run({ ...s, level: 11, gold: 40_000 }, { type: 'unlockIsland' }, 0), 'LEVEL_TOO_LOW')
    const a = ok(run({ ...s, level: 12, gold: 40_000 }, { type: 'unlockIsland' }, 0))
    expect([a.gold, a.islands.unlocked, a.islands.obstacles.length]).toEqual([0, ['home', 'isle2'], 30])
    expect(placementError(a, { island: 'isle2', col: a.islands.obstacles[0]!.col, row: a.islands.obstacles[0]!.row, facing: 0 }, 1)).toBe('OVERLAP')
    const five = { ...s, level: 45, gold: 3_000_000, islands: { homeStep: 0, unlocked: ['home', 'isle2', 'isle3', 'isle4', 'isle5'] as IslandId[], obstacles: [] } }
    err(run(five, { type: 'unlockIsland' }, 0), 'NO_LEGENDARY')
    const withLegend = withDragon(five, { id: 'd9', speciesId: 'wall', level: 1, feeds: 0, habitatId: null })
    const b = ok(run(withLegend, { type: 'unlockIsland' }, 0))
    expect(b.islands.unlocked.at(-1)).toBe('dawnspire')
    err(run(b, { type: 'unlockIsland' }, 0), 'MAX_ISLAND')
  })
  it('clears an obstacle for gold on a timer and pays XP and food on finish', () => {
    const a = ok(run({ ...s, level: 2, tutorial: { ...s.tutorial, buildsStarted: 2 } }, { type: 'expandIsland' }, 0))
    err(run({ ...a, gold: 99 }, { type: 'clearObstacle', obstacleId: 'home-s1-bush' }, 0), 'INSUFFICIENT_GOLD')
    err(run({ ...a, gold: 100 }, { type: 'clearObstacle', obstacleId: 'nope' }, 0), 'NOT_FOUND')
    const b = ok(run({ ...a, gold: 100 }, { type: 'clearObstacle', obstacleId: 'home-s1-bush' }, 0))
    expect([b.gold, b.constructions[0]]).toEqual([0, { kind: 'clear', obstacleId: 'home-s1-bush', readyAtMs: 60_000 }])
    err(run(b, { type: 'clearObstacle', obstacleId: 'home-s1-bush' }, 0), 'UNDER_CONSTRUCTION')
    const c = ok(run(b, { type: 'finishConstruction', index: 0 }, 60_000))
    expect([c.islands.obstacles.map(o => o.id), c.xp, c.food - b.food]).toEqual([['home-s1-rock'], 20, 10])
  })
  it('validates action shapes', () => {
    err(run(s, { type: 'clearObstacle', obstacleId: '' }, 0), 'INVALID_ACTION')
  })
})
