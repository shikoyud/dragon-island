import { expect, it } from 'vitest'
import { applyAction, createRng, newPlayer, type Action, type Effect, type PlayerState } from '../src/index'
import { FIXTURE_CATALOG } from './fixtures'

const OBSTACLE_ID = 'home-s1-bush'
const script: [Action, number][] = [
  [{ type: 'collectGold', habitatId: 'h1' }, 60_000],
  [{ type: 'plant', plot: 0, crop: 'dragonBush' }, 60_000],
  [{ type: 'harvest', plot: 0 }, 120_000],
  ...Array.from({ length: 12 }, (): [Action, number] => [{ type: 'feed', dragonId: 'd1' }, 120_000]),
  ...Array.from({ length: 12 }, (): [Action, number] => [{ type: 'feed', dragonId: 'd2' }, 120_000]),
  [{ type: 'startBreed', parentA: 'd1', parentB: 'd2' }, 120_000],
  [{ type: 'collectEgg', breeder: 0 }, 135_000],
  [{ type: 'hatch', slot: 0 }, 150_000],
  [{ type: 'placeBuilding', building: { kind: 'decoration', decoration: 'stonePath' }, placement: { island: 'home', col: 9, row: 8, facing: 0 } }, 160_000],
  [{ type: 'moveBuilding', target: { type: 'decoration', id: 'c4' }, placement: { island: 'home', col: 10, row: 8, facing: 0 } }, 160_000],
  [{ type: 'startUpgrade', building: { type: 'habitat', id: 'h1' } }, 160_000],
  [{ type: 'buy', item: { kind: 'skip', target: 'construction', index: 0 } }, 170_000],
  [{ type: 'startUpgrade', building: { type: 'farm', index: 0 } }, 180_000],
  [{ type: 'finishConstruction', index: 0 }, 99_999_999],
  [{ type: 'expandIsland' }, 100_000_000],
  [{ type: 'unlockIsland' }, 100_000_000],
  [{ type: 'clearObstacle', obstacleId: OBSTACLE_ID }, 100_000_000],
  [{ type: 'finishConstruction', index: 0 }, 200_000_000],
]

function replay(): { state: PlayerState; effects: Effect[] } {
  const rng = createRng(123)
  let state: PlayerState = { ...newPlayer(0), food: 200, level: 12, gold: 300_000 }
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
  expect(state.islands.homeStep).toBe(1)
  expect(state.islands.unlocked).toEqual(['home', 'isle2'])
  expect(state.islands.obstacles.some(o => o.id === 'home-s1-bush')).toBe(false)
  expect(state.constructions).toEqual([])
})
