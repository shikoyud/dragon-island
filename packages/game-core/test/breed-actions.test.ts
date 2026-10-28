import { describe, expect, it } from 'vitest'
import { applyAction } from '../src/actions/apply'
import type { Action } from '../src/actions/types'
import { getSpecies } from '../src/catalog'
import { RARITY } from '../src/rarity'
import { createRng } from '../src/rng'
import { newPlayer, type Dragon, type Egg, type PlayerState } from '../src/state'
import { FIXTURE_CATALOG } from './fixtures'
import { err, ok } from './helpers'

const s = newPlayer(0)
const s4: PlayerState = { ...s, dragons: s.dragons.map(d => ({ ...d, level: 4 })) }
const run = (st: PlayerState, a: Action, t: number, seed = 1) => applyAction(st, a, t, createRng(seed), FIXTURE_CATALOG)
const breed: Action = { type: 'startBreed', parentA: 'd1', parentB: 'd2' }
const rarityOf = (id: string) => getSpecies(FIXTURE_CATALOG, id).rarity
const egg = (speciesId: string, readyAtMs: number): Egg => ({ speciesId, readyAtMs })

describe('startBreed', () => {
  it('validates parents', () => {
    err(run(s4, { type: 'startBreed', parentA: 'd1', parentB: 'd1' }, 0), 'INVALID_PARENTS')
    err(run(s4, { type: 'startBreed', parentA: 'd1', parentB: 'dX' }, 0), 'INVALID_PARENTS')
    err(run(s, breed, 0), 'LEVEL_TOO_LOW')
  })

  it('lays a tutorial egg in 15 s and awards xp', () => {
    const a = ok(run(s4, breed, 0))
    const e = a.nests[0]!
    expect(e.readyAtMs).toBe(15_000)
    expect(a.tutorial.breedDone).toBe(true)
    expect(a.xp).toBe(RARITY[rarityOf(e.speciesId)].xp)
    err(run(a, breed, 0), 'NO_FREE_NEST')
  })

  it('uses the rarity breed time after the tutorial', () => {
    const a = ok(run({ ...s4, tutorial: { breedDone: true, hatchDone: false } }, breed, 1_000))
    const e = a.nests[0]!
    expect(e.readyAtMs).toBe(1_000 + RARITY[rarityOf(e.speciesId)].breedMs)
  })

  it('uses the lowest free nest', () => {
    const a = ok(run({ ...s4, nests: [egg('fire', 5), null, null] }, breed, 0))
    expect(a.nests[0]).toEqual(egg('fire', 5))
    expect(a.nests[1]).not.toBeNull()
    expect(a.nests[2]).toBeNull()
  })

  it('consumes an odds boost only on success', () => {
    expect(ok(run({ ...s4, oddsBoosts: 1 }, breed, 0)).oddsBoosts).toBe(0)
    const failed = run({ ...s, oddsBoosts: 1 }, breed, 0)
    err(failed, 'LEVEL_TOO_LOW')
  })

  it('applies and resets pity', () => {
    const a = ok(run({ ...s4, pity: { 'fire+water': 10 } }, breed, 0))
    expect(rarityOf(a.nests[0]!.speciesId)).not.toBe('common')
    expect(a.pity['fire+water']).toBe(0)
    for (let seed = 1; seed <= 20; seed++) {
      const b = ok(run(s4, breed, 0, seed))
      expect(b.pity['fire+water']).toBe(rarityOf(b.nests[0]!.speciesId) === 'common' ? 1 : 0)
    }
  })
})

describe('collectEgg', () => {
  const laid = ok(run(s4, breed, 0))

  it('moves a ready egg to the hatchery with the tutorial hatch time', () => {
    err(run(laid, { type: 'collectEgg', nest: 0 }, 14_999), 'NOT_READY')
    const a = ok(run(laid, { type: 'collectEgg', nest: 0 }, 15_000))
    expect(a.nests[0]).toBeNull()
    expect(a.hatchery).toEqual([egg(laid.nests[0]!.speciesId, 30_000)])
    expect(a.tutorial.hatchDone).toBe(true)
    err(run(a, { type: 'collectEgg', nest: 0 }, 15_000), 'NEST_EMPTY')
    err(run(a, { type: 'collectEgg', nest: 4 }, 15_000), 'NOT_FOUND')
  })

  it('uses the rarity hatch time after the tutorial', () => {
    const st = { ...s, nests: [egg('fw-rare', 0)], tutorial: { breedDone: true, hatchDone: true } }
    expect(ok(run(st, { type: 'collectEgg', nest: 0 }, 100)).hatchery[0]!.readyAtMs).toBe(100 + RARITY.rare.hatchMs)
  })

  it('refuses when eggs plus waiting dragons fill the hatchery', () => {
    const waiting: Dragon = { id: 'd9', speciesId: 'fw-common', level: 1, habitatId: null }
    const st = { ...laid, hatchery: [egg('fire', 0), egg('water', 0)], dragons: [...laid.dragons, waiting] }
    err(run(st, { type: 'collectEgg', nest: 0 }, 15_000), 'HATCHERY_FULL')
    expect(st.nests[0]).toEqual(laid.nests[0])
  })
})

describe('hatch', () => {
  const ready = { ...s, hatchery: [egg('fw-common', 30_000)] }

  it('creates a dragon in the first matching habitat', () => {
    const a = ok(run(ready, { type: 'hatch', slot: 0 }, 30_000))
    expect(a.dragons[2]).toEqual({ id: 'd3', speciesId: 'fw-common', level: 1, habitatId: 'h1' })
    expect(a.hatchery).toEqual([])
    expect(a.nextId).toBe(4)
    expect(a.xp).toBe(RARITY.common.xp)
  })

  it('waits in the hatchery when every matching habitat is full', () => {
    const extra = ['d5', 'd6', 'd7', 'd8'].map((id, i): Dragon =>
      ({ id, speciesId: i < 2 ? 'fire' : 'water', level: 1, habitatId: i < 2 ? 'h1' : 'h2' }))
    const full = { ...ready, dragons: [...ready.dragons, ...extra] }
    const a = ok(run(full, { type: 'hatch', slot: 0 }, 30_000))
    expect(a.dragons.find(d => d.id === 'd3')!.habitatId).toBeNull()
  })

  it('rejects bad or unready slots', () => {
    err(run(ready, { type: 'hatch', slot: 5 }, 30_000), 'NOT_FOUND')
    err(run(ready, { type: 'hatch', slot: 0 }, 29_999), 'NOT_READY')
  })
})

it('never mutates the input state', () => {
  expect(s).toEqual(newPlayer(0))
})
