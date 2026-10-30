import { describe, expect, it } from 'vitest'
import { applyAction } from '../src/actions/apply'
import type { Action } from '../src/actions/types'
import { makeCatalog } from '../src/catalog'
import { habitatCap } from '../src/data/habitats'
import { FLASH_14 } from '../src/data/presets'
import { goldPerMinuteX20 } from '../src/dragon'
import { residents, storedGold } from '../src/habitat'
import { createRng } from '../src/rng'
import { newPlayer, type PlayerState } from '../src/state'
import { FIXTURE_CATALOG } from './fixtures'
import { ok } from './helpers'

// The start state's Terra Basic in h1 earns 180 Gold/min under Flash-14 (3 Gold/s); h2's Flame Basic earns 70.
const START_GOLD = newPlayer(0).gold
const rng = createRng(1)
const run = (s: PlayerState, a: Action, t: number) => ok(applyAction(s, a, t, rng, FIXTURE_CATALOG))
const collect: Action = { type: 'collectGold', habitatId: 'h1' }
const feed: Action = { type: 'feed', dragonId: 'd1' }
const h1 = (s: PlayerState) => s.habitats.find(h => h.id === 'h1')!
const waiting = (s: PlayerState, t: number) => storedGold(h1(s), residents(s, 'h1'), FIXTURE_CATALOG, t, FLASH_14)

describe('Gold accrues by the millisecond', () => {
  it('a collect at 1:59 pays 357 and stamps now', () => {
    const a = run(newPlayer(0), collect, 119_000)
    expect(a.gold).toBe(START_GOLD + 357)
    expect(h1(a).lastCollectedMs).toBe(119_000)
    expect(waiting(a, 119_000)).toBe(0)
    expect(waiting(a, 120_000)).toBe(3)
  })

  it('two feeds 50 s apart on a Terra L1 pay about 150 Gold each and lose under 1 Gold in total', () => {
    const a = run(newPlayer(0), feed, 50_000)
    expect(a.gold).toBe(START_GOLD + 150)
    expect(h1(a).lastCollectedMs).toBe(50_000)
    const b = run(a, feed, 100_000)
    expect(b.gold).toBe(START_GOLD + 300)
    expect(h1(b).lastCollectedMs).toBe(100_000)
    // A rate with a fraction per collect, 3 Gold/s over 50,001 ms: the floor costs under 1 Gold in total.
    const c = run(run(newPlayer(0), feed, 50_001), feed, 100_002)
    const whole = 100_002 * 180 / 60_000
    expect(c.gold - START_GOLD).toBeGreaterThan(whole - 1)
    expect(c.gold - START_GOLD).toBeLessThanOrEqual(whole)
  })

  it('short collects lose under 1 Gold each against one long collect, and never gain', () => {
    let s = newPlayer(0)
    let collects = 0
    for (let t = 7_001; t <= 600_000; t += 7_001) { s = run(s, collect, t); collects++ }
    s = run(s, collect, 600_000)
    collects++
    const long = run(newPlayer(0), collect, 600_000).gold
    expect(s.gold).toBeLessThanOrEqual(long)
    expect(long - s.gold).toBeLessThan(collects)
  })

  it('a capped habitat pays the cap and stamps now', () => {
    const t = 100 * 3_600_000 + 30_000
    const a = run(newPlayer(0), collect, t)
    expect(a.gold).toBe(START_GOLD + habitatCap('terra', 1, FLASH_14))
    expect(h1(a).lastCollectedMs).toBe(t)
  })

  it('an empty habitat stamps now like any other', () => {
    const empty = { ...newPlayer(0), dragons: [] }
    const a = run(empty, collect, 119_000)
    expect([a.gold, h1(a).lastCollectedMs]).toEqual([START_GOLD, 119_000])
  })

  it('does not move the stamp back when the clock is behind it', () => {
    const a = run(newPlayer(0), collect, 600_000)
    const b = run(a, collect, 300_000)
    expect([b.gold, h1(b).lastCollectedMs]).toEqual([a.gold, 600_000])
  })

  it('the product stays an exact integer: six Lv 40 Legendaries for a 21-day game', () => {
    const product = 6 * goldPerMinuteX20('terra', 'legendary', 40, FLASH_14) * 21 * 86_400_000
    expect(product).toBeLessThan(2e15)
    expect(Number.isSafeInteger(product)).toBe(true)
  })
})

describe('moving a dragon between occupied habitats (the carry-over exploit)', () => {
  // Terra-primary hybrid, 180 Gold/min wherever it lives.
  const CAT = makeCatalog([
    { id: 'terra', name: 'terra', elements: ['terra'], rarity: 'common' },
    { id: 'flame', name: 'flame', elements: ['flame'], rarity: 'common' },
    { id: 'tf', name: 'tf', elements: ['terra', 'flame'], rarity: 'common' },
  ])
  const base = newPlayer(0)
  // h2 was last collected 30 s after h1: out of phase, which is what whole-minute carry-over paid twice for.
  const start: PlayerState = {
    ...base,
    habitats: base.habitats.map(h => (h.id === 'h2' ? { ...h, lastCollectedMs: 30_000 } : h)),
    dragons: [
      { id: 'd1', speciesId: 'terra', level: 1, feeds: 0, habitatId: 'h1' },
      { id: 'd2', speciesId: 'flame', level: 1, feeds: 0, habitatId: 'h2' },
      { id: 'm', speciesId: 'tf', level: 1, feeds: 0, habitatId: 'h1' },
    ],
  }
  const act = (s: PlayerState, a: Action, t: number) => ok(applyAction(s, a, t, rng, CAT, FLASH_14))
  const settle = (s: PlayerState, t: number) =>
    act(act(s, { type: 'collectGold', habitatId: 'h1' }, t), { type: 'collectGold', habitatId: 'h2' }, t)
  const TEN_MIN = 600_000
  const real = 180 * 10 + 180 * 10 + 665 // d1 and the mover for ten minutes, d2 (70/min) for the 570 s since its stamp

  it('every 30 s it earns its real income and no more', () => {
    let s = start
    let touches = 0
    for (let t = 60_000; t < TEN_MIN; t += 30_000) { // always leaving the habitat whose minute has just rolled over
      const to = s.dragons.find(d => d.id === 'm')!.habitatId === 'h1' ? 'h2' : 'h1'
      s = act(s, { type: 'moveDragon', dragonId: 'm', habitatId: to }, t)
      touches += 2
    }
    s = settle(s, TEN_MIN)
    touches += 2
    const earned = s.gold - START_GOLD
    expect(earned).toBeLessThanOrEqual(real)
    expect(earned).toBeGreaterThan(real - touches)
  })

  it('timed to any phase, moves do not beat staying put', () => {
    const still = settle(start, TEN_MIN).gold - START_GOLD
    expect(still).toBe(real)
    for (const period of [7_000, 13_000, 29_000, 31_000, 59_000, 61_000]) {
      let s = start
      for (let t = 30_000 + period; t < TEN_MIN; t += period) {
        const to = s.dragons.find(d => d.id === 'm')!.habitatId === 'h1' ? 'h2' : 'h1'
        s = act(s, { type: 'moveDragon', dragonId: 'm', habitatId: to }, t)
      }
      expect(settle(s, TEN_MIN).gold - START_GOLD, `every ${period} ms`).toBeLessThanOrEqual(still)
    }
  })
})
