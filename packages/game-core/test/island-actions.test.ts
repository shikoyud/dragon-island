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
const d9: Dragon = { id: 'd9', speciesId: 'fw-common', level: 1, feeds: 0, habitatId: null }
const setD1 = (patch: Partial<Dragon>, extra: Partial<PlayerState> = {}): PlayerState =>
  ({ ...s, ...extra, dragons: s.dragons.map(d => d.id === 'd1' ? { ...d, ...patch } : d) })

describe('collectGold', () => {
  it('collects gold and stamps the time', () => {
    const r = run(s, { type: 'collectGold', habitatId: 'h1' }, 600_000)
    expect(r.ok && r.effects).toEqual([])
    const before = s
    const a = ok(r)
    const after = a
    // Flame Common Lv 1 in Flash-14 earns 70 gold/min: 10 minutes is 700.
    expect([a.gold, a.habitats[0]!.lastCollectedMs]).toEqual([1700, 600_000])
    expect(after.xp).toBe(before.xp)
    const b = ok(run(a, { type: 'collectGold', habitatId: 'h1' }, 300_000))
    expect([b.gold, b.habitats[0]!.lastCollectedMs]).toEqual([1700, 600_000])
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
    const st = withDragon(s, { ...d9, feeds: 0, habitatId: 'h1' })
    const a = ok(run(st, { type: 'moveDragon', dragonId: 'd9', habitatId: 'h2' }, 600_000))
    // h1 now holds two Flame Commons (2 x 70 x 10 min); h2's Sea Common earns 100/min.
    expect(a.gold).toBe(1000 + 1400 + 1000)
    expect(a.habitats.map(h => h.lastCollectedMs)).toEqual([600_000, 600_000])
  })

  it('treats a same-habitat move as a no-op', () => {
    const r = run(s, { type: 'moveDragon', dragonId: 'd1', habitatId: 'h1' }, 0)
    expect(r).toEqual({ ok: true, state: s, effects: [] })
  })

  it('refuses a full habitat', () => {
    let st = s
    for (const id of ['d7']) st = withDragon(st, { id, speciesId: 'sea', level: 1, feeds: 0, habitatId: 'h2' })
    err(run(withDragon(st, d9), { type: 'moveDragon', dragonId: 'd9', habitatId: 'h2' }, 0), 'NO_HABITAT_SLOT')
  })

  it('rejects unknown ids', () => {
    err(run(s, { type: 'moveDragon', dragonId: 'd9', habitatId: 'h1' }, 0), 'NOT_FOUND')
    err(run(s, { type: 'moveDragon', dragonId: 'd1', habitatId: 'h9' }, 0), 'NOT_FOUND')
  })
})

describe('feed', () => {
  const feed1 = (st: PlayerState) => ok(run(st, { type: 'feed', dragonId: 'd1' }, 0))

  it('takes four feeds per level, one feed per call', () => {
    const one = feed1(s)
    expect([one.dragons[0]!.level, one.dragons[0]!.feeds, one.food, one.xp]).toEqual([1, 1, 95, 1])
    const three = feed1(feed1(one))
    expect([three.dragons[0]!.level, three.dragons[0]!.feeds]).toEqual([1, 3])
    const four = feed1(three)
    expect([four.dragons[0]!.level, four.dragons[0]!.feeds, 100 - four.food]).toEqual([2, 0, 20])
  })

  it('spends exactly foodPerFeed and can empty the larder', () => {
    expect(feed1(setD1({}, { food: 5 })).food).toBe(0)
    const lv9 = feed1(setD1({ level: 9 }, { food: 100, roostTier: 2 }))
    expect([lv9.food, lv9.dragons[0]!.feeds]).toEqual([78, 1])
  })

  it('refuses without food, at the Roost level cap, or for unknown dragons', () => {
    err(run({ ...s, food: 4 }, { type: 'feed', dragonId: 'd1' }, 0), 'INSUFFICIENT_FOOD')
    err(run(setD1({ level: 7 }, { food: 1e9 }), { type: 'feed', dragonId: 'd1' }, 0), 'LEVEL_CAP')
    expect(feed1(setD1({ level: 7 }, { food: 1e9, roostTier: 1 })).food).toBeLessThan(1e9)
    err(run(s, { type: 'feed', dragonId: 'd9' }, 0), 'NOT_FOUND')
  })
})

describe('sellDragon', () => {
  it('keeps at least two dragons', () => {
    err(run(s, { type: 'sellDragon', dragonId: 'd1' }, 0), 'LAST_DRAGONS')
  })

  it('credits sale gold', () => {
    const a = ok(run(withDragon(s, d9), { type: 'sellDragon', dragonId: 'd9' }, 0))
    expect([a.gold, a.dragons.length]).toEqual([1100, 2])
  })

  it('pays the A9 value for the species rarity and refuses legendaries', () => {
    const rare = ok(run(withDragon(s, { ...d9, speciesId: 'fw-rare' }), { type: 'sellDragon', dragonId: 'd9' }, 0))
    expect(rare.gold).toBe(1000 + 2500)
    const epic = ok(run(withDragon(s, { ...d9, speciesId: 'fw-epic' }), { type: 'sellDragon', dragonId: 'd9' }, 0))
    expect(epic.gold).toBe(1000 + 10000)
    err(run(withDragon(s, { ...d9, speciesId: 'fw-legend' }), { type: 'sellDragon', dragonId: 'd9' }, 0), 'NOT_SELLABLE')
  })

  it('rejects unknown dragons', () => {
    err(run(withDragon(s, d9), { type: 'sellDragon', dragonId: 'd5' }, 0), 'NOT_FOUND')
  })
})

it('never mutates the input state', () => {
  expect(s).toEqual(newPlayer(0))
})
