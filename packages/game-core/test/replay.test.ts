import { expect, it } from 'vitest'
import { applyAction, createRng, newPlayer, type Action, type Effect, type PlayerState } from '../src/index'
import { FIXTURE_CATALOG } from './fixtures'

const script: [Action, number][] = [
  [{ type: 'collectGold', habitatId: 'h1' }, 60_000],
  [{ type: 'plant', plot: 0, crop: 'sprout' }, 60_000],
  [{ type: 'harvest', plot: 0 }, 120_000],
  ...Array.from({ length: 3 }, (): [Action, number] => [{ type: 'feed', dragonId: 'd1' }, 120_000]),
  ...Array.from({ length: 3 }, (): [Action, number] => [{ type: 'feed', dragonId: 'd2' }, 120_000]),
  [{ type: 'startBreed', parentA: 'd1', parentB: 'd2' }, 120_000],
  [{ type: 'collectEgg', nest: 0 }, 135_000],
  [{ type: 'hatch', slot: 0 }, 150_000],
]

function replay(): { state: PlayerState; effects: Effect[] } {
  const rng = createRng(123)
  let state: PlayerState = { ...newPlayer(0), food: 200 }
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
  expect(a.state.dragons.slice(0, 2).map(d => d.level)).toEqual([4, 4])
})
