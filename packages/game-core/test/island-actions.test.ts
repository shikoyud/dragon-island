import { describe, expect, it } from 'vitest'
import { applyAction } from '../src/actions/apply'
import type { Action } from '../src/actions/types'
import { createRng } from '../src/rng'
import { newPlayer, type Dragon, type PlayerState } from '../src/state'
import { FIXTURE_CATALOG } from './fixtures'
import { err, ok } from './helpers'

const s = newPlayer(0)
const rng = createRng(1)
const run = (st: PlayerState, a: Action, t: number) => applyAction(st, a, t, rng, FIXTURE_CATALOG)
const withDragon = (st: PlayerState, d: Dragon): PlayerState => ({ ...st, dragons: [...st.dragons, d] })
const d9: Dragon = { id: 'd9', speciesId: 'fw-common', level: 1, habitatId: null }
const setD1 = (patch: Partial<Dragon>, extra: Partial<PlayerState> = {}): PlayerState =>
  ({ ...s, ...extra, dragons: s.dragons.map(d => d.id === 'd1' ? { ...d, ...patch } : d) })

describe('collectGold', () => {
  it('collects eligible gold and stamps the time', () => {
    const r = run(s, { type: 'collectGold', habitatId: 'h1' }, 600_000)
    expect(r.ok && r.effects).toEqual([])
    const a = ok(r)
    expect([a.gold, a.eligibleGold, a.habitats[0]!.lastCollectedMs]).toEqual([1020, 20, 600_000])
    const b = ok(run(a, { type: 'collectGold', habitatId: 'h1' }, 300_000))
    expect([b.gold, b.habitats[0]!.lastCollectedMs]).toEqual([1020, 600_000])
  })

  it('rejects unknown habitats', () => {
    err(run(s, { type: 'collectGold', habitatId: 'h9' }, 0), 'NOT_FOUND')
  })
})

describe('moveDragon', () => {
  it('requires a matching element', () => {
    err(run(s, { type: 'moveDragon', dragonId: 'd1', habitatId: 'h2' }, 0), 'ELEMENT_MISMATCH')
  })

  it('moves a waiting dragon into a habitat', () => {
    const a = ok(run(withDragon(s, d9), { type: 'moveDragon', dragonId: 'd9', habitatId: 'h2' }, 0))
    expect(a.dragons.find(d => d.id === 'd9')!.habitatId).toBe('h2')
  })

  it('collects both habitats first', () => {
    const st = withDragon(s, { ...d9, habitatId: 'h1' })
    const a = ok(run(st, { type: 'moveDragon', dragonId: 'd9', habitatId: 'h2' }, 600_000))
    expect(a.gold).toBe(1000 + 40 + 20)
    expect(a.eligibleGold).toBe(60)
    expect(a.habitats.map(h => h.lastCollectedMs)).toEqual([600_000, 600_000])
  })

  it('treats a same-habitat move as a no-op', () => {
    const r = run(s, { type: 'moveDragon', dragonId: 'd1', habitatId: 'h1' }, 0)
    expect(r).toEqual({ ok: true, state: s, effects: [] })
  })

  it('refuses a full habitat', () => {
    let st = s
    for (const id of ['d7', 'd8']) st = withDragon(st, { id, speciesId: 'water', level: 1, habitatId: 'h2' })
    err(run(withDragon(st, d9), { type: 'moveDragon', dragonId: 'd9', habitatId: 'h2' }, 0), 'NO_HABITAT_SLOT')
  })

  it('rejects unknown ids', () => {
    err(run(s, { type: 'moveDragon', dragonId: 'd9', habitatId: 'h1' }, 0), 'NOT_FOUND')
    err(run(s, { type: 'moveDragon', dragonId: 'd1', habitatId: 'h9' }, 0), 'NOT_FOUND')
  })
})

describe('feed', () => {
  it('raises one level for food and awards xp', () => {
    const a = ok(run(s, { type: 'feed', dragonId: 'd1' }, 0))
    expect([a.dragons[0]!.level, a.food]).toEqual([2, 96])
    const b = ok(run(setD1({ level: 9 }, { food: 400 }), { type: 'feed', dragonId: 'd1' }, 0))
    expect([b.dragons[0]!.level, b.food, b.xp]).toEqual([10, 76, 32])
  })

  it('refuses without food or at max level', () => {
    err(run({ ...s, food: 3 }, { type: 'feed', dragonId: 'd1' }, 0), 'INSUFFICIENT_FOOD')
    err(run(setD1({ level: 30 }, { food: 1e9 }), { type: 'feed', dragonId: 'd1' }, 0), 'MAX_LEVEL')
    err(run(s, { type: 'feed', dragonId: 'd9' }, 0), 'NOT_FOUND')
  })
})

describe('sellDragon', () => {
  it('keeps at least two dragons', () => {
    err(run(s, { type: 'sellDragon', dragonId: 'd1' }, 0), 'LAST_DRAGONS')
  })

  it('credits ineligible gold', () => {
    const a = ok(run(withDragon(s, d9), { type: 'sellDragon', dragonId: 'd9' }, 0))
    expect([a.gold, a.eligibleGold, a.dragons.length]).toEqual([1100, 0, 2])
  })

  it('rejects unknown dragons', () => {
    err(run(withDragon(s, d9), { type: 'sellDragon', dragonId: 'd5' }, 0), 'NOT_FOUND')
  })
})

it('never mutates the input state', () => {
  expect(s).toEqual(newPlayer(0))
})
