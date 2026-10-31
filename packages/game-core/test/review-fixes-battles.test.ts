import { describe, expect, it } from 'vitest'
import { applyAction } from '../src/actions/apply'
import type { Action } from '../src/actions/types'
import type { PlayerMove } from '../src/battle/machine'
import type { BattleDragonSpec } from '../src/battle/stats'
import type { OpponentSnapshot } from '../src/matchmaking'
import { createRng } from '../src/rng'
import { newPlayer, type Dragon, type PlayerState } from '../src/state'
import { FIXTURE_CATALOG } from './fixtures'
import { err, ok } from './helpers'

const run = (st: PlayerState, a: Action, t = 0) => applyAction(st, a, t, createRng(1), FIXTURE_CATALOG)
const raw = (st: PlayerState, a: unknown, t = 0) => run(st, a as Action, t)
const three = (id: string, level: number): BattleDragonSpec[] => [{ speciesId: id, level }, { speciesId: id, level }, { speciesId: id, level }]
const TEAM: [string, string, string] = ['d1', 'd2', 'd3']
const SWEEP: PlayerMove[] = [{ kind: 'attack', move: 1 }, { kind: 'attack', move: 1 }, { kind: 'attack', move: 1 }]
const dragons = (level: number): Dragon[] => TEAM.map(id => ({ id, speciesId: 'flame', level, feeds: 0, habitatId: 'h1' }))
const human: OpponentSnapshot = { playerId: 'p2', trophies: 500, level: 8, team: three('flame', 12) }
const bot: OpponentSnapshot = { ...human, playerId: null, team: three('nature', 1) }
const s8: PlayerState = { ...newPlayer(0), level: 8, trophies: 500, dragons: dragons(10), defenceTeam: TEAM }
const pvp = (opponent: OpponentSnapshot, moves = SWEEP): Action => ({ type: 'pvpBattle', team: TEAM, opponent, moves })

describe('a short or illegal move list is a forfeit, not a free cancel', () => {
  it('pvp: counts the attempt, costs trophies and credits the defender', () => {
    const r = run(s8, pvp(human, SWEEP))          // flame L10 cannot sweep flame L12 in three hits
    expect(r.ok && r.effects).toEqual([{ type: 'defenceResult', playerId: 'p2', trophyDelta: 5 }])
    const a = ok(r)
    expect([a.trophies, a.pvp.count, a.gold, a.xp]).toEqual([485, 1, 1000, 0])
    expect(r.ok && r.battle).toBeUndefined()
    const illegal = ok(run(s8, pvp(bot, [{ kind: 'attack', move: 1 }, { kind: 'attack', move: 3 }])))
    expect([illegal.trophies, illegal.pvp.count]).toEqual([485, 1])
  })

  it('pve replay: counts the attempt; a first-clear forfeit changes nothing', () => {
    const cleared = { ...s8, dragons: dragons(1), pve: { cleared: 1, replays: { day: 0, count: 0 } } }
    const r = ok(run(cleared, { type: 'pveBattle', stage: 1, team: TEAM, moves: SWEEP }))
    expect([r.pve.replays.count, r.gold, r.pve.cleared]).toEqual([1, 1000, 1])
    const first = ok(run({ ...cleared, pve: { cleared: 0, replays: { day: 0, count: 0 } } }, { type: 'pveBattle', stage: 1, team: TEAM, moves: SWEEP }))
    expect(first).toEqual({ ...cleared, pve: { cleared: 0, replays: { day: 0, count: 0 } } })
  })
})

describe('attacking requires a saved defence team', () => {
  it('rejects NO_DEFENCE_TEAM before anything else about the battle', () => {
    err(run({ ...s8, defenceTeam: null }, pvp(bot)), 'NO_DEFENCE_TEAM')
    expect(ok(run({ ...s8, dragons: dragons(20) }, pvp(bot))).trophies).toBe(530)
  })
})

describe('opponent snapshots are checked before the battle runs', () => {
  it('rejects unknown species and out-of-range levels without throwing', () => {
    err(run(s8, pvp({ ...bot, team: three('nope', 1) })), 'NOT_FOUND')
    err(raw(s8, pvp({ ...bot, team: three('nature', 0) })), 'INVALID_ACTION')
    err(raw(s8, pvp({ ...bot, team: three('nature', 41) })), 'INVALID_ACTION')
    err(raw(s8, pvp({ ...bot, team: three('nature', 1e308) })), 'INVALID_ACTION')
  })

  it('caps the move list at 45 entries', () => {
    err(raw(s8, pvp(bot, Array(46).fill({ kind: 'attack', move: 0 }))), 'INVALID_ACTION')
    expect(run(s8, pvp(bot, Array(45).fill({ kind: 'attack', move: 0 }))).ok).toBe(true)
  })
})
