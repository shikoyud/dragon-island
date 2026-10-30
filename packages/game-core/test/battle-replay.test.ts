import { expect, it } from 'vitest'
import { applyAction, createRng, newPlayer, type Action, type ActionResult, type Effect, type PlayerState } from '../src/index'
import { FIXTURE_CATALOG } from './fixtures'

const TEAM: [string, string, string] = ['d1', 'd2', 'd3']
// fw-legend L30: move 0 (flame) one-shots nature L1; move 1 (sea) one-shots the flame-primary stage-1 team.
const flame = [{ move: 0, target: 0 }, { move: 0, target: 1 }, { move: 0, target: 2 }]
const sea = [{ move: 1, target: 0 }, { move: 1, target: 1 }, { move: 1, target: 2 }]
const human = { playerId: 'p2', trophies: 20, level: 8, team: [1, 2, 3].map(() => ({ speciesId: 'nature', level: 1 })) }
const script: Action[] = [
  { type: 'pvpBattle', team: TEAM, opponent: human, moves: flame },
  { type: 'pveBattle', stage: 1, team: TEAM, moves: sea },
  { type: 'pveBattle', stage: 1, team: TEAM, moves: sea },
]

function replay(): { state: PlayerState; effects: Effect[]; battles: unknown[] } {
  const rng = createRng(77)
  let state: PlayerState = { ...newPlayer(0), level: 8, defenceTeam: TEAM, dragons: TEAM.map(id => ({ id, speciesId: 'fw-legend', level: 30, feeds: 0, habitatId: 'h1' })) }
  const effects: Effect[] = [], battles: unknown[] = []
  for (const action of script) {
    const r: ActionResult = applyAction(state, action, 1_000, rng, FIXTURE_CATALOG)
    if (!r.ok) throw new Error(`${action.type} failed: ${r.error}`)
    state = r.state
    effects.push(...r.effects)
    battles.push(r.battle)
  }
  return { state, effects, battles }
}

it('replays battles to an identical state', () => {
  const a = replay(), b = replay()
  expect(a).toEqual(b)
  expect(a.state.trophies).toBe(30)
  expect(a.state.pve).toEqual({ cleared: 1, replays: { day: 0, count: 1 } })
  expect(a.effects).toEqual([{ type: 'defenceResult', playerId: 'p2', trophyDelta: -10 }])
})
