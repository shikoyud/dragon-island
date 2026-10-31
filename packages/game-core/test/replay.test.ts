import { expect, it } from 'vitest'
import { applyAction, createRng, newPlayer, type Action, type Effect, type PlayerState } from '../src/index'
import { FIXTURE_CATALOG } from './fixtures'
import { FREE, FREE_2 } from './helpers/land'

const OBSTACLE_ID = 'o-bush'
const script: [Action, number][] = [
  [{ type: 'collectGold', habitatId: 'h1' }, 60_000],
  [{ type: 'plant', plot: 0, crop: 'dragonBush' }, 60_000],
  [{ type: 'harvest', plot: 0 }, 120_000],
  ...Array.from({ length: 12 }, (): [Action, number] => [{ type: 'feed', dragonId: 'd1' }, 120_000]),
  ...Array.from({ length: 12 }, (): [Action, number] => [{ type: 'feed', dragonId: 'd2' }, 120_000]),
  [{ type: 'startBreed', parentA: 'd1', parentB: 'd2' }, 120_000],
  [{ type: 'collectEgg', breeder: 0 }, 135_000],
  [{ type: 'hatch', slot: 0 }, 150_000],
  [{ type: 'placeBuilding', building: { kind: 'decoration', decoration: 'stonePath' }, placement: FREE }, 160_000],
  [{ type: 'moveBuilding', target: { type: 'decoration', id: 'c4' }, placement: FREE_2 }, 160_000],
  [{ type: 'startUpgrade', building: { type: 'habitat', id: 'h1' } }, 160_000],
  [{ type: 'buy', item: { kind: 'skip', target: 'construction', index: 0 } }, 170_000],
  [{ type: 'startUpgrade', building: { type: 'farm', index: 0 } }, 180_000],
  [{ type: 'finishConstruction', index: 0 }, 99_999_999],
  [{ type: 'buyPlot', island: 'home', plot: 4 }, 100_000_000],
  [{ type: 'buyBridge', island: 'isle2' }, 100_000_000],
  [{ type: 'clearObstacle', obstacleId: OBSTACLE_ID }, 100_000_000],
  [{ type: 'finishConstruction', index: 0 }, 200_000_000],
]

function replay(): { state: PlayerState; effects: Effect[] } {
  const rng = createRng(123)
  const start = newPlayer(0)
  let state: PlayerState = { ...start, food: 200, level: 12, gold: 300_000, islands: { ...start.islands, obstacles: [{ id: OBSTACLE_ID, kind: 'bush', island: 'home', col: 8, row: 20 }] } }
  const effects: Effect[] = []
  for (const [action, t] of script) {
    const r = applyAction(state, action, t, rng, FIXTURE_CATALOG)
    if (!r.ok) throw new Error(`${action.type} failed: ${r.error}`)
    state = r.state
    effects.push(...r.effects)
  }
  return { state, effects }
}

it('replays to an identical state', () => {
  const a = replay(), b = replay()
  expect(a).toEqual(b)
  expect(a.state.dragons).toHaveLength(3)
  // Pins the RNG order: breeding draws one rng.int(total), after the earlier actions' draws.
  expect(a.state.dragons[2]!.speciesId).toBe('terra')
  expect(a.state.dragons.slice(0, 2).map(d => d.level)).toEqual([4, 4])
})

it('the building scenario changes the island and is deterministic', () => {
  const { state } = replay()
  expect(state.islands.plots.home).toEqual([5, 6, 9, 10, 4])
  expect(state.islands.unlocked).toEqual(['home', 'isle2'])
  expect(state.islands.obstacles.some(o => o.id === OBSTACLE_ID)).toBe(false)
  expect(state.constructions).toEqual([])
})
