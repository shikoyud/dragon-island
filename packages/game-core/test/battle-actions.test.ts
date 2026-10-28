import { describe, expect, it } from 'vitest'
import { applyAction } from '../src/actions/apply'
import type { Action } from '../src/actions/types'
import type { BattleDragonSpec } from '../src/battle/stats'
import type { PlayerMove } from '../src/battle/sim'
import type { OpponentSnapshot } from '../src/matchmaking'
import { createRng } from '../src/rng'
import { newPlayer, type Dragon, type PlayerState } from '../src/state'
import { dayCounterAt, MS_PER_DAY } from '../src/time'
import { FIXTURE_CATALOG } from './fixtures'
import { err, ok } from './helpers'

const run = (st: PlayerState, a: Action, t = 0) => applyAction(st, a, t, createRng(1), FIXTURE_CATALOG)
const raw = (st: PlayerState, a: unknown, t = 0) => run(st, a as Action, t)
const three = (id: string, level: number): BattleDragonSpec[] => [{ speciesId: id, level }, { speciesId: id, level }, { speciesId: id, level }]
const AI: PlayerMove[] = [{ move: 0, target: 0 }, { move: 0, target: 1 }, { move: 0, target: 2 }]
const TEAM: [string, string, string] = ['d1', 'd2', 'd3']
const bot: OpponentSnapshot = { playerId: null, trophies: 0, level: 8, team: three('nature', 1) }
const human: OpponentSnapshot = { ...bot, playerId: 'p2' }
const fireTeam = (level: number, speciesId = 'fire'): Dragon[] => TEAM.map(id => ({ id, speciesId, level, habitatId: 'h1' }))
const s0 = newPlayer(0)
const s8: PlayerState = { ...s0, level: 8, dragons: fireTeam(20) }
const weak: PlayerState = { ...s8, dragons: fireTeam(1) }
// Stage 1 is fire-primary (160 hp) and stage 2 is ice (180 hp): water L30 and fire L30 one-shot them respectively.
const sWater: PlayerState = { ...s8, dragons: fireTeam(30, 'water') }
const pvp = (opponent: OpponentSnapshot, moves = AI, team = TEAM): Action => ({ type: 'pvpBattle', team, opponent, moves })
const pve = (stage: number, moves = AI, team = TEAM): Action => ({ type: 'pveBattle', stage, team, moves })
const MANY: PlayerMove[] = Array(300).fill({ move: 0, target: 0 })

describe('dayCounterAt', () => {
  it('resets only when the day moves forward', () => {
    expect(dayCounterAt({ day: 2, count: 5 }, 1 * MS_PER_DAY)).toEqual({ day: 2, count: 5 })
    expect(dayCounterAt({ day: 2, count: 5 }, 2 * MS_PER_DAY + 10)).toEqual({ day: 2, count: 5 })
    expect(dayCounterAt({ day: 2, count: 5 }, 3 * MS_PER_DAY)).toEqual({ day: 3, count: 0 })
  })
})

describe('setDefenceTeam', () => {
  it('stores three distinct owned dragons', () => {
    expect(ok(run(s8, { type: 'setDefenceTeam', dragonIds: TEAM })).defenceTeam).toEqual(TEAM)
    err(run(s8, { type: 'setDefenceTeam', dragonIds: ['d1', 'd1', 'd2'] }), 'INVALID_TEAM')
    err(run(s8, { type: 'setDefenceTeam', dragonIds: ['d1', 'd2', 'dX'] }), 'INVALID_TEAM')
  })

  it('is cleared when a member is sold', () => {
    const saved = ok(run(s8, { type: 'setDefenceTeam', dragonIds: TEAM }))
    expect(ok(run(saved, { type: 'sellDragon', dragonId: 'd3' })).defenceTeam).toBeNull()
    expect(ok(run({ ...saved, dragons: [...saved.dragons, { id: 'd4', speciesId: 'fire', level: 1, habitatId: null }] },
      { type: 'sellDragon', dragonId: 'd4' })).defenceTeam).toEqual(TEAM)
  })
})

describe('pvpBattle', () => {
  it('needs player level 8 and a valid team', () => {
    err(run({ ...s0, dragons: fireTeam(20) }, pvp(bot)), 'LEVEL_TOO_LOW')
    err(run(s8, pvp(bot, AI, ['d1', 'd2', 'dX'])), 'INVALID_TEAM')
    err(run(s8, pvp(bot, AI, ['d1', 'd1', 'd2'])), 'INVALID_TEAM')
  })

  it('awards trophies and xp on a win; Bronze pays no gold', () => {
    const r = run(s8, pvp(bot))
    expect(r.ok && r.effects).toEqual([])
    expect(r.ok && r.battle?.winner).toBe('attacker')
    const a = ok(r)
    expect([a.trophies, a.gold, a.eligibleGold, a.xp, a.pvp]).toEqual([30, 1000, 0, 20, { day: 0, count: 1 }])
  })

  it('reports a defence loss to a human opponent', () => {
    const r = run(s8, pvp(human))
    expect(r.ok && r.effects).toEqual([{ type: 'defenceResult', playerId: 'p2', trophyDelta: -10 }])
  })

  it('pays league gold from trophies before the battle', () => {
    const a = ok(run({ ...s8, trophies: 850 }, pvp(bot)))
    expect([a.gold, a.eligibleGold, a.trophies]).toEqual([1200, 200, 880])
    const b = ok(run({ ...s8, trophies: 790 }, pvp(bot)))
    expect([b.gold, b.trophies]).toEqual([1100, 820])
  })

  it('handles a loss: trophies floor at 0, defender gains', () => {
    const legend: OpponentSnapshot = { ...human, team: three('fw-legend', 30) }
    const r = run({ ...weak, trophies: 10 }, pvp(legend, MANY))
    expect(r.ok && r.battle?.winner).toBe('defender')
    expect(r.ok && r.effects).toEqual([{ type: 'defenceResult', playerId: 'p2', trophyDelta: 5 }])
    const a = ok(r)
    expect([a.trophies, a.xp, a.gold, a.pvp.count]).toEqual([0, 0, 1000, 1])
  })

  it('rejects bad move lists without counting the attempt', () => {
    const r = run(s8, pvp(bot, [{ move: 0, target: 0 }]))
    err(r, 'MISSING_MOVES')
    err(run(s8, pvp(bot, [{ move: 0, target: 0 }, { move: 0, target: 0 }, { move: 0, target: 1 }])), 'ILLEGAL_MOVE')
  })

  it('enforces the daily attack cap monotonically', () => {
    err(run({ ...s8, pvp: { day: 0, count: 20 } }, pvp(bot)), 'DAILY_CAP_REACHED')
    expect(ok(run({ ...s8, pvp: { day: 0, count: 20 } }, pvp(bot), MS_PER_DAY)).pvp).toEqual({ day: 1, count: 1 })
    err(run({ ...s8, pvp: { day: 5, count: 20 } }, pvp(bot), 4 * MS_PER_DAY), 'DAILY_CAP_REACHED')
  })
})

describe('pveBattle', () => {
  it('needs player level 5, a real stage, and the previous stage cleared', () => {
    err(run({ ...s0, dragons: fireTeam(20) }, pve(1)), 'LEVEL_TOO_LOW')
    err(run(sWater, pve(0)), 'NOT_FOUND')
    err(run(sWater, pve(31)), 'NOT_FOUND')
    err(run(sWater, pve(2)), 'STAGE_LOCKED')
    err(run(sWater, pve(1, AI, ['d1', 'd2', 'dX'])), 'INVALID_TEAM')
  })

  it('pays a first clear in full and unlocks the next stage', () => {
    const a = ok(run(sWater, pve(1)))
    expect([a.gold, a.eligibleGold, a.food, a.xp, a.pve]).toEqual([1100, 100, 120, 15, { cleared: 1, replays: { day: 0, count: 0 } }])
    expect(ok(run({ ...a, dragons: fireTeam(30) }, pve(2))).pve.cleared).toBe(2)
  })

  it('pays replays a quarter of the gold and counts them', () => {
    const cleared = ok(run(sWater, pve(1)))
    const r = ok(run(cleared, pve(1)))
    expect([r.gold, r.food, r.xp, r.pve.replays]).toEqual([1125, 120, 15, { day: 0, count: 1 }])
    err(run({ ...cleared, pve: { cleared: 1, replays: { day: 0, count: 10 } } }, pve(1)), 'DAILY_CAP_REACHED')
  })

  it('changes nothing on a lost first clear', () => {
    const r = run({ ...weak, pve: { cleared: 29, replays: { day: 0, count: 0 } } }, pve(30, MANY))
    expect(r.ok && r.battle?.winner).toBe('defender')
    const a = ok(r)
    expect([a.gold, a.food, a.xp, a.pve.cleared]).toEqual([1000, 100, 0, 29])
  })
})

describe('malformed battle payloads', () => {
  it('are rejected at the boundary', () => {
    err(raw(s8, { type: 'pvpBattle', team: TEAM, opponent: bot, moves: [{ move: '0', target: 0 }] }), 'INVALID_ACTION')
    err(raw(s8, { type: 'pvpBattle', team: ['d1', 'd2'], opponent: bot, moves: AI }), 'INVALID_ACTION')
    err(raw(s8, { type: 'pvpBattle', team: TEAM, opponent: { ...bot, team: bot.team.slice(0, 2) }, moves: AI }), 'INVALID_ACTION')
    err(raw(s8, { type: 'pvpBattle', team: TEAM, opponent: { ...bot, trophies: 'lots' }, moves: AI }), 'INVALID_ACTION')
    err(raw(s8, { type: 'pveBattle', stage: 1.5, team: TEAM, moves: AI }), 'INVALID_ACTION')
    err(raw(s8, { type: 'setDefenceTeam', dragonIds: ['d1', 'd2', 3] }), 'INVALID_ACTION')
  })
})

it('never mutates inputs', () => {
  expect(s0).toEqual(newPlayer(0))
})
