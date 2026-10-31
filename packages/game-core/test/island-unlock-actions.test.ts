import { describe, expect, it } from 'vitest'
import { applyAction } from '../src/actions/apply'
import type { Action } from '../src/actions/types'
import { createRng } from '../src/rng'
import { newPlayer, type Obstacle, type PlayerState } from '../src/state'
import { FIXTURE_CATALOG } from './fixtures'
import { err, ok } from './helpers'

const rng = createRng(1)
const run = (st: PlayerState, a: Action, t: number) => applyAction(st, a, t, rng, FIXTURE_CATALOG)
const bush: Obstacle = { id: 'o-bush', kind: 'bush', island: 'home', col: 20, row: 12 }
const rock: Obstacle = { id: 'o-rock', kind: 'rock', island: 'home', col: 22, row: 12 }
const base = newPlayer(0)
const s: PlayerState = { ...base, level: 2, islands: { ...base.islands, obstacles: [bush, rock] } }

describe('clearing obstacles', () => {
  it('clears an obstacle for gold on a timer and pays XP and food on finish', () => {
    err(run({ ...s, gold: 99 }, { type: 'clearObstacle', obstacleId: 'o-bush' }, 0), 'INSUFFICIENT_GOLD')
    err(run({ ...s, gold: 100 }, { type: 'clearObstacle', obstacleId: 'nope' }, 0), 'NOT_FOUND')
    const b = ok(run({ ...s, gold: 100 }, { type: 'clearObstacle', obstacleId: 'o-bush' }, 0))
    expect([b.gold, b.constructions[0]]).toEqual([0, { kind: 'clear', obstacleId: 'o-bush', readyAtMs: 60_000 }])
    err(run(b, { type: 'clearObstacle', obstacleId: 'o-bush' }, 0), 'UNDER_CONSTRUCTION')
    const c = ok(run(b, { type: 'finishConstruction', index: 0 }, 60_000))
    expect([c.islands.obstacles.map(o => o.id), c.xp, c.food - b.food]).toEqual([['o-rock'], 65, 10])
    expect(c.level).toBe(3) // 20 classic x 12 = 240 XP from PL 2: 175 to PL 3, 65 over
  })
  it('validates action shapes', () => {
    err(run(s, { type: 'clearObstacle', obstacleId: '' }, 0), 'INVALID_ACTION')
  })
})
