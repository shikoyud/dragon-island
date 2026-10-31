import { describe, expect, it } from 'vitest'
import { applyAction } from '../src/actions/apply'
import type { Action } from '../src/actions/types'
import { SPEED_UP_TOKEN_MS, type SpeedUpToken } from '../src/data/speedups'
import { createRng } from '../src/rng'
import { newPlayer, type PlayerState } from '../src/state'
import { isValidAction } from '../src/index'
import type { SkipTarget } from '../src/store'
import { FIXTURE_CATALOG } from './fixtures'
import { err, ok } from './helpers'

const run = (st: PlayerState, a: Action, t = 0, seed = 1) => applyAction(st, a, t, createRng(seed), FIXTURE_CATALOG)
const base = newPlayer(0)
const H = 3_600_000
const use = (token: SpeedUpToken, target: SkipTarget, index = 0): Action => ({ type: 'useSpeedUp', token, target, index })
const tokens = { '15m': 2, '1h': 2, '3h': 2 }
const withEgg = (readyAtMs: number): PlayerState => ({
  ...base, speedUps: tokens,
  breeders: [{ ...base.breeders[0]!, egg: { speciesId: 'flame', readyAtMs, hatchMs: 7, xpFree: false } }],
})

describe('useSpeedUp (R55, M4 Q2 a)', () => {
  it('holds the real-hour durations', () => {
    expect(SPEED_UP_TOKEN_MS).toEqual({ '15m': 900_000, '1h': 3_600_000, '3h': 10_800_000 })
  })
  it('a 1h token on a 3 h breed leaves 2 h, spends one token, charges nothing, leaves hatchMs', () => {
    const r = run(withEgg(3 * H), use('1h', 'breeder'))
    const s = ok(r)
    expect(s.breeders[0]!.egg).toEqual({ speciesId: 'flame', readyAtMs: 2 * H, hatchMs: 7, xpFree: false })
    expect(s.speedUps).toEqual({ '15m': 2, '1h': 1, '3h': 2 })
    expect(r.ok && r.effects).toEqual([])
  })
  it('takes the token off the ready time, not off nowMs', () => {
    expect(ok(run(withEgg(5 * H), use('3h', 'breeder'), H)).breeders[0]!.egg!.readyAtMs).toBe(2 * H)
  })
  it('a 3h token on a 40-minute clear floors at nowMs; the clear finishes once by finishConstruction', () => {
    const rich: PlayerState = { ...base, gold: 1_000_000_000, level: 30, speedUps: tokens }
    const o = base.islands.obstacles.find(x => x.kind === 'tree')!
    const started = ok(run(rich, { type: 'clearObstacle', obstacleId: o.id }, 0))
    const forty: PlayerState = { ...started, constructions: started.constructions.map(c => ({ ...c, readyAtMs: 2_400_000 })) }
    const s = ok(run(forty, use('3h', 'construction'), 1_000))
    expect(s.constructions.length).toBe(1)
    expect(s.constructions[0]!.readyAtMs).toBe(1_000)
    expect(s.speedUps['3h']).toBe(1)
    expect(s.islands.obstacles.some(x => x.id === o.id)).toBe(true) // nothing completed yet
    const done = ok(run(s, { type: 'finishConstruction', index: 0 }, 1_000))
    expect(done.islands.obstacles.some(x => x.id === o.id)).toBe(false)
    expect(done.constructions).toEqual([])
    err(run(done, { type: 'finishConstruction', index: 0 }, 1_000), 'NOT_FOUND')
  })
  it('works on hatchery, farm and construction timers', () => {
    const st: PlayerState = {
      ...base, speedUps: tokens,
      hatchery: [{ speciesId: 'flame', readyAtMs: 2 * H }],
      farms: [{ ...base.farms[0]!, crop: 'dragonBush' as const, readyAtMs: 2 * H }],
      constructions: [{ kind: 'upgrade', building: { type: 'habitat', id: 'h1' }, readyAtMs: 2 * H }],
    }
    expect(ok(run(st, use('1h', 'hatchery'))).hatchery[0]!.readyAtMs).toBe(H)
    expect(ok(run(st, use('1h', 'farm'))).farms[0]!.readyAtMs).toBe(H)
    const c = ok(run(st, use('1h', 'construction')))
    expect([c.constructions[0]!.readyAtMs, c.habitats[0]!.level]).toEqual([H, base.habitats[0]!.level])
  })
  it('NOTHING_TO_SKIP when the slot is idle or already ready; the token is kept', () => {
    const idle: PlayerState = { ...base, speedUps: tokens }
    err(run(idle, use('1h', 'breeder')), 'NOTHING_TO_SKIP')
    err(run(withEgg(H), use('1h', 'breeder'), H), 'NOTHING_TO_SKIP')
    err(run({ ...idle, farms: [{ ...base.farms[0]!, crop: null }] }, use('1h', 'farm')), 'NOTHING_TO_SKIP')
  })
  it('NO_TOKEN with none of that kind', () => {
    err(run({ ...withEgg(3 * H), speedUps: { '15m': 0, '1h': 0, '3h': 0 } }, use('1h', 'breeder')), 'NO_TOKEN')
    err(run({ ...withEgg(3 * H), speedUps: { '15m': 0, '1h': 0, '3h': 5 } }, use('1h', 'breeder')), 'NO_TOKEN')
  })
  it('NOT_FOUND for a bad index', () => {
    err(run(withEgg(3 * H), use('1h', 'breeder', 9)), 'NOT_FOUND')
    err(run(withEgg(3 * H), use('1h', 'construction', 0)), 'NOT_FOUND')
  })
  it('rejects malformed actions', () => {
    for (const a of [
      { type: 'useSpeedUp', token: '2h', target: 'breeder', index: 0 },
      { type: 'useSpeedUp', token: 'constructor', target: 'breeder', index: 0 },
      { type: 'useSpeedUp', token: '1h', target: 'bank', index: 0 },
      { type: 'useSpeedUp', token: '1h', target: 'breeder', index: -1 },
      { type: 'useSpeedUp', token: '1h', target: 'breeder', index: 0.5 },
    ]) expect(isValidAction(a)).toBe(false)
    expect(isValidAction(use('15m', 'farm'))).toBe(true)
  })
})
