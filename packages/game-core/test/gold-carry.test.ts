import { describe, expect, it } from 'vitest'
import { applyAction } from '../src/actions/apply'
import type { Action } from '../src/actions/types'
import { habitatCap } from '../src/data/habitats'
import { FLASH_14 } from '../src/data/presets'
import { residents, storedGold } from '../src/habitat'
import { createRng } from '../src/rng'
import { newPlayer, type PlayerState } from '../src/state'
import { FIXTURE_CATALOG } from './fixtures'
import { ok } from './helpers'

// The start state's Terra Basic in h1 earns 180 Gold/min under Flash-14; h2 holds a Flame Basic.
const PER_MIN = 180
const START_GOLD = newPlayer(0).gold
const rng = createRng(1)
const run = (s: PlayerState, a: Action, t: number) => ok(applyAction(s, a, t, rng, FIXTURE_CATALOG))
const collect: Action = { type: 'collectGold', habitatId: 'h1' }
const feed: Action = { type: 'feed', dragonId: 'd1' }
const h1 = (s: PlayerState) => s.habitats.find(h => h.id === 'h1')!
const waiting = (s: PlayerState, t: number) => storedGold(h1(s), residents(s, 'h1'), FIXTURE_CATALOG, t, FLASH_14)

describe('partial minutes of Gold carry over a collect', () => {
  it('a collect at 1:59 pays one minute and keeps the 59 s', () => {
    const a = run(newPlayer(0), collect, 119_000)
    expect(a.gold).toBe(START_GOLD + PER_MIN)
    expect(h1(a).lastCollectedMs).toBe(60_000)
    expect(waiting(a, 119_999)).toBe(0)
    expect(waiting(a, 120_000)).toBe(PER_MIN)
  })

  it('two feeds 50 s apart on a Terra L1 lose no accrual', () => {
    const a = run(newPlayer(0), feed, 50_000)
    expect(a.gold).toBe(START_GOLD)
    expect(h1(a).lastCollectedMs).toBe(0)
    const b = run(a, feed, 100_000)
    expect(b.gold).toBe(START_GOLD + PER_MIN) // the first minute was paid at 1:40
    expect(h1(b).lastCollectedMs).toBe(60_000)
    const c = run(b, collect, 120_000)
    expect(c.gold).toBe(START_GOLD + 2 * PER_MIN)
  })

  it('many short collects earn the same as one long one', () => {
    let s = newPlayer(0)
    for (let t = 7_000; t <= 600_000; t += 7_000) s = run(s, collect, t)
    s = run(s, collect, 600_000)
    expect(s.gold).toBe(run(newPlayer(0), collect, 600_000).gold)
  })

  it('a capped habitat stamps now: the cap stopped production, so nothing carries', () => {
    const cap = habitatCap('terra', 1, FLASH_14)
    const t = 100 * 3_600_000 + 30_000
    const a = run(newPlayer(0), collect, t)
    expect(a.gold).toBe(START_GOLD + cap)
    expect(h1(a).lastCollectedMs).toBe(t)
  })

  it('an empty habitat stamps now: it produced nothing, so a dragon moved in gets no head start', () => {
    const empty = { ...newPlayer(0), dragons: [] }
    expect(h1(run(empty, collect, 119_000)).lastCollectedMs).toBe(119_000)
  })

  it('does not move the stamp back when the clock is behind it', () => {
    const a = run(newPlayer(0), collect, 600_000)
    expect(h1(run(a, collect, 300_000)).lastCollectedMs).toBe(600_000)
  })
})
