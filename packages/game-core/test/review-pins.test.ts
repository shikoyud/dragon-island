import { describe, expect, it } from 'vitest'
import { applyAction } from '../src/actions/apply'
import type { Action, ActionResult } from '../src/actions/types'
import { FLASH_14, FLASH_28, type Preset } from '../src/data/presets'
import { MAX_DRAGON_LEVEL, ROOST_LEVEL_CAPS } from '../src/dragon'
import { createRng } from '../src/rng'
import { newPlayer, type PlayerState } from '../src/state'
import { FIXTURE_CATALOG as C } from './fixtures'
import { err, ok } from './helpers'

import { FREE } from './helpers/land'

/** Plant, harvest, startBreed, placeBuilding and startUpgrade from the same state, one snapshot per step. */
function playScript(preset: Preset): PlayerState[] {
  const rng = createRng(7)
  const script: [Action, number][] = [
    [{ type: 'plant', plot: 0, crop: 'dragonBush' }, 0],
    [{ type: 'harvest', plot: 0 }, 60_000],
    [{ type: 'startBreed', parentA: 'd1', parentB: 'd2' }, 60_000],
    [{ type: 'placeBuilding', building: { kind: 'farm' }, placement: FREE }, 60_000],
    [{ type: 'startUpgrade', building: { type: 'habitat', id: 'h1' } }, 60_000],
  ]
  let s: PlayerState = { ...newPlayer(0), gold: 10_000_000, level: 20, dragons: newPlayer(0).dragons.map(d => ({ ...d, level: 4 })) }
  return script.map(([a, t]) => {
    const r: ActionResult = applyAction(s, a, t, rng, C, preset)
    s = ok(r)
    return s
  })
}

/** The same shape with every number blanked: strings, keys, arrays and nulls stay. */
const shape = (v: unknown): unknown =>
  typeof v === 'number' ? 0
    : Array.isArray(v) ? v.map(shape)
      : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, shape(x)]))
        : v

describe('Flash-28 at action level (Review Focus 4)', () => {
  const f14 = playScript(FLASH_14)
  const f28 = playScript(FLASH_28)
  const [plant14, harvest14, breed14, place14, upgrade14] = f14 as [PlayerState, PlayerState, PlayerState, PlayerState, PlayerState]
  const [plant28, harvest28, breed28, place28, upgrade28] = f28 as [PlayerState, PlayerState, PlayerState, PlayerState, PlayerState]

  it('runs the same script under both presets and only the numbers differ', () => {
    expect(f28.map(shape)).toEqual(f14.map(shape))
  })

  it('takes the numbers from the preset at every step', () => {
    expect([plant14.farms[0]!.readyAtMs, plant28.farms[0]!.readyAtMs]).toEqual([15_000, 20_000])
    // Dragon Bush: 5 Food x cropYieldMult (12, 8), on top of the 50 the player starts with.
    expect([harvest14.food, harvest28.food]).toEqual([110, 90])
    expect(breed14.breeders[0]!.egg!.readyAtMs).not.toBe(breed28.breeders[0]!.egg!.readyAtMs)
    expect(breed28.breeders[0]!.egg!.readyAtMs - 60_000).toBeGreaterThan(breed14.breeders[0]!.egg!.readyAtMs - 60_000)
    expect(place28.constructions[0]!.readyAtMs - 60_000).toBeGreaterThan(place14.constructions[0]!.readyAtMs - 60_000)
    expect(upgrade28.constructions[1]!.readyAtMs - 60_000).toBeGreaterThan(upgrade14.constructions[1]!.readyAtMs - 60_000)
  })
})

describe('exact Food and the level cap (Review Focus 2)', () => {
  const rng = createRng(1)
  const feed: Action = { type: 'feed', dragonId: 'd1' }
  const withD1 = (level: number, feeds: number, extra: Partial<PlayerState> = {}): PlayerState => {
    const s = newPlayer(0)
    return { ...s, ...extra, dragons: s.dragons.map(d => (d.id === 'd1' ? { ...d, level, feeds } : d)) }
  }

  it('a dragon at the cap with no Food reports LEVEL_CAP, not INSUFFICIENT_FOOD', () => {
    err(applyAction(withD1(7, 0, { food: 0 }), feed, 0, rng, C), 'LEVEL_CAP')
  })

  it('a Lv 39 dragon on its fourth feed at tier 5 reaches 40, then LEVEL_CAP', () => {
    const a = ok(applyAction(withD1(39, 3, { food: 1e12, roostTier: 5 }), feed, 0, rng, C))
    expect(a.dragons.find(d => d.id === 'd1')).toMatchObject({ level: 40, feeds: 0 })
    err(applyAction(a, feed, 0, rng, C), 'LEVEL_CAP')
  })

  it('the top Roost tier allows the maximum dragon level', () => {
    expect(ROOST_LEVEL_CAPS.at(-1)).toBe(MAX_DRAGON_LEVEL)
  })
})
