import { describe, expect, it } from 'vitest'
import { runDefender } from '../src/battle/ai'
import { combatStats, type BattleDragonSpec } from '../src/battle/stats'
import { battleOutcome, initBattle, legalMoves, step, type BattleState, type PlayerMove, type Side } from '../src/battle/machine'
import { simulateBattle } from '../src/battle/sim'
import { TURN_LIMIT } from '../src/data/battle'
import { createRng } from '../src/rng'
import { FIXTURE_CATALOG as C } from './fixtures'

const spec = (speciesId: string, level: number, hp?: number): BattleDragonSpec => hp === undefined ? { speciesId, level } : { speciesId, level, hp }
const three = (id: string, level: number) => [spec(id, level), spec(id, level), spec(id, level)]
const STRIKE: PlayerMove = { kind: 'attack', move: 0 }
const T1: PlayerMove = { kind: 'attack', move: 1 }
const T2: PlayerMove = { kind: 'attack', move: 2 }
const T3: PlayerMove = { kind: 'attack', move: 3 }
const rng = () => createRng(5)
const go = (b: BattleState, side: Side, m: PlayerMove, seed = 5): BattleState => {
  const next = step(b, side, m, createRng(seed))
  if (!next) throw new Error(`illegal ${JSON.stringify(m)}`)
  return next
}
const sideAt = (b: BattleState, side: Side, patch: Partial<BattleState['sides'][Side]>): BattleState =>
  ({ ...b, sides: { ...b.sides, [side]: { ...b.sides[side], ...patch } } })

describe('initBattle', () => {
  it('starts both first dragons active, attacker to act, nothing logged', () => {
    const b = initBattle(three('flame', 5), three('nature', 7), C)
    expect([b.sides.attacker.active, b.sides.defender.active, b.turn, b.toAct, b.awaiting, b.winner]).toEqual([0, 0, 0, 'attacker', 'action', null])
    expect(b.log).toEqual([])
    expect(b.sides.defender.team[0]!.moves).toHaveLength(4)
    expect(b.sides.defender.team[0]!.t3Cooling).toBe(false)
  })

  it('takes start HP, caps it at max, and full HP when absent', () => {
    const max = combatStats(spec('flame', 5), C).hp
    const b = initBattle([spec('flame', 5, 100), spec('flame', 5, max + 999), spec('flame', 5)], three('nature', 1), C)
    expect(b.sides.attacker.team.map(f => f.hp)).toEqual([100, max, max])
  })

  it('refuses a team that enters with a fallen dragon: a programming error', () => {
    expect(() => initBattle([spec('flame', 5, 0), spec('flame', 5), spec('flame', 5)], three('nature', 1), C)).toThrow()
    expect(() => initBattle(three('flame', 5), [spec('nature', 1), spec('nature', 1, -1), spec('nature', 1)], C)).toThrow()
  })
})

describe('turns (§6.1, R63)', () => {
  const start = () => initBattle(three('flame', 5), three('sea', 5), C)

  it('the attacker moves first and only the side to act may move', () => {
    expect(step(start(), 'defender', STRIKE, rng())).toBeNull()
    expect(legalMoves(start(), 'defender')).toEqual([])
    expect(legalMoves(start(), 'attacker').length).toBeGreaterThan(0)
  })

  it('an attack is one turn and hands over; a swap is one turn and hands over', () => {
    const a = go(start(), 'attacker', STRIKE)
    expect([a.turn, a.toAct, a.awaiting]).toEqual([1, 'defender', 'action'])
    expect(a.log).toHaveLength(1)
    expect(a.log[0]).toMatchObject({ kind: 'attack', turn: 1, side: 'attacker', slot: 0, move: 0, target: 0, multiplier: 1, immune: false, ko: false })
    const s = go(a, 'defender', { kind: 'swap', to: 2 })
    expect([s.turn, s.toAct, s.sides.defender.active]).toEqual([2, 'attacker', 2])
    expect(s.log[1]).toEqual({ kind: 'swap', turn: 2, side: 'defender', from: 0, to: 2 })
  })

  it('step is pure: the old state is untouched', () => {
    const b = start()
    const snapshot = structuredClone(b)
    go(b, 'attacker', STRIKE)
    go(b, 'attacker', { kind: 'swap', to: 1 })
    expect(b).toEqual(snapshot)
  })

  it('a KO makes its owner replace first, free, then that owner has the turn', () => {
    const b = initBattle(three('flame', 20), [spec('nature', 1, 1), spec('nature', 1), spec('sea', 1)], C)
    const ko = go(b, 'attacker', T1)
    expect([ko.turn, ko.toAct, ko.awaiting, ko.winner]).toEqual([1, 'defender', 'replace', null])
    expect(ko.log[0]).toMatchObject({ kind: 'attack', ko: true, multiplier: 2 })
    expect(legalMoves(ko, 'defender')).toEqual([{ kind: 'replace', to: 1 }, { kind: 'replace', to: 2 }])
    expect(step(ko, 'defender', STRIKE, rng())).toBeNull()
    expect(step(ko, 'defender', { kind: 'swap', to: 1 }, rng())).toBeNull()
    const r = go(ko, 'defender', { kind: 'replace', to: 2 })
    expect([r.turn, r.toAct, r.awaiting, r.sides.defender.active]).toEqual([1, 'defender', 'action', 2])
    expect(r.log[1]).toEqual({ kind: 'replace', turn: 1, side: 'defender', from: 0, to: 2 })
  })

  it("the attacker's own replacement arrives as { kind: 'replace' } before its next action", () => {
    const b = initBattle([spec('flame', 1, 1), spec('flame', 1), spec('flame', 1)], three('sea', 20), C)
    const a = go(b, 'attacker', STRIKE)
    const ko = go(a, 'defender', T1)
    expect([ko.toAct, ko.awaiting]).toEqual(['attacker', 'replace'])
    expect(step(ko, 'attacker', STRIKE, rng())).toBeNull()
    const r = go(ko, 'attacker', { kind: 'replace', to: 1 })
    expect([r.turn, r.toAct, r.awaiting]).toEqual([2, 'attacker', 'action'])
  })

  it('replace to a fallen or the active slot is illegal, and replace outside a KO is too', () => {
    const b = initBattle(three('flame', 20), [spec('nature', 1, 1), spec('nature', 1, 1), spec('nature', 1)], C)
    expect(step(b, 'attacker', { kind: 'replace', to: 1 }, rng())).toBeNull()
    const first = go(go(b, 'attacker', T1), 'defender', { kind: 'replace', to: 1 })
    const second = go(go(first, 'defender', STRIKE), 'attacker', T1)
    expect(second.awaiting).toBe('replace')
    expect(step(second, 'defender', { kind: 'replace', to: 0 }, rng())).toBeNull() // fallen
    expect(step(second, 'defender', { kind: 'replace', to: 1 }, rng())).toBeNull() // active and fallen
    expect(step(second, 'defender', { kind: 'replace', to: 2 }, rng())).not.toBeNull()
  })

  it('swap to the active, a fallen or a missing slot is illegal; with no bench alive there is no swap', () => {
    const b = initBattle(three('flame', 20), [spec('nature', 1), spec('nature', 1), spec('nature', 1)], C)
    expect(step(b, 'attacker', { kind: 'swap', to: 0 }, rng())).toBeNull()
    expect(step(b, 'attacker', { kind: 'swap', to: 3 }, rng())).toBeNull()
    const benchDown = { ...sideAt(b, 'defender', { team: b.sides.defender.team.map((f, i) => (i === 0 ? f : { ...f, hp: 0 })) }), toAct: 'defender' as Side }
    expect(step(benchDown, 'defender', { kind: 'swap', to: 1 }, rng())).toBeNull()
    expect(legalMoves(benchDown, 'defender').every(m => m.kind === 'attack')).toBe(true)
  })

  it('the battle ends when a side has none alive, with no replacement and no moves after', () => {
    let s = initBattle(three('flame', 20), [spec('nature', 1, 1), spec('nature', 1, 1), spec('nature', 1, 1)], C)
    for (const to of [1, 2]) s = go(go(go(s, 'attacker', T1), 'defender', { kind: 'replace', to }), 'defender', STRIKE)
    const end = go(s, 'attacker', T1)
    expect([end.winner, end.awaiting, end.turn]).toEqual(['attacker', 'action', 5])
    expect(legalMoves(end, 'attacker')).toEqual([])
    expect(legalMoves(end, 'defender')).toEqual([])
    expect(step(end, 'attacker', STRIKE, rng())).toBeNull()
  })

  it('garbage moves are illegal and draw nothing', () => {
    let draws = 0
    const counted = { next: () => { draws++; return 0 }, int: () => { draws++; return 0 } }
    for (const m of [{ kind: 'attack', move: 4 }, { kind: 'attack', move: -1 }, { kind: 'attack', move: 0.5 }, { kind: 'swap', to: 1.5 }, { kind: 'nope' }] as unknown as PlayerMove[]) {
      expect(step(start(), 'attacker', m, counted)).toBeNull()
    }
    expect(draws).toBe(0)
  })
})

describe('the 30-turn limit', () => {
  // Terra can't be hurt by Terra moves, so T1s pass the turns without damage.
  const stall = () => {
    let b = initBattle(three('terra', 5), three('terra', 5), C)
    while (b.turn < TURN_LIMIT - 1) b = go(b, b.toAct, T1)
    return b
  }

  it('after turn 30 with both sides alive, the defender wins with 30 turns', () => {
    const b = stall()
    expect([b.turn, b.winner, b.toAct]).toEqual([29, null, 'defender'])
    const end = go(b, 'defender', T1)
    expect([end.turn, end.winner]).toEqual([30, 'defender'])
    // Through the simulator: L1 can't KO L40 in 15 hits, and the attacker's T1s are immune.
    const o = simulateBattle(three('terra', 40), three('terra', 1), Array.from({ length: 15 }, () => T1), createRng(1), C)
    if (!o.ok) throw new Error(`${o.error} at ${o.at}`)
    expect([o.winner, o.turns, o.log.length, o.attackerKos]).toEqual(['defender', 30, 30, 0])
  })

  it('a KO on turn 30 with a bench alive asks for no replacement: the limit ends it, defender wins, real HP kept', () => {
    const b = stall()
    const low = sideAt(b, 'attacker', { team: b.sides.attacker.team.map((f, i) => (i === 0 ? { ...f, hp: 1 } : f)) })
    const end = go(low, 'defender', STRIKE)
    expect([end.turn, end.winner, end.awaiting]).toEqual([30, 'defender', 'action'])
    expect(legalMoves(end, 'attacker')).toEqual([])
    const o = battleOutcome(end)
    expect([o.winner, o.turns, o.attackerKos]).toEqual(['defender', 30, 1])
    expect(o.attacker.slice(1)).toEqual(b.sides.attacker.team.slice(1).map(f => f.hp))
  })

  it('a KO of the defender\'s dragon on turn 30 with its bench alive also ends it for the defender', () => {
    const b = { ...stall(), toAct: 'attacker' as Side }
    const low = sideAt(b, 'defender', { team: b.sides.defender.team.map((f, i) => (i === 0 ? { ...f, hp: 1 } : f)) })
    const end = go(low, 'attacker', STRIKE)
    expect([end.turn, end.winner]).toEqual([30, 'defender'])
  })

  it('a side falling on the last possible action still wins the battle for the side that hit', () => {
    const b = stall()
    // Only the last attacker dragon left, on turn 30: the side dealing the blow wins outright, no limit check needed.
    const last = sideAt(b, 'attacker', { team: b.sides.attacker.team.map((f, i) => ({ ...f, hp: i === 0 ? 1 : 0 })) })
    const end = go(last, 'defender', STRIKE)
    expect([end.turn, end.winner, end.awaiting]).toEqual([30, 'defender', 'action'])
    // And the attacker's last action, turn 29, finishing the last enemy is an attacker win.
    const lastEnemy = { ...sideAt(b, 'defender', { team: b.sides.defender.team.map((f, i) => ({ ...f, hp: i === 0 ? 1 : 0 })) }), toAct: 'attacker' as Side, turn: 28 }
    const won = go(lastEnemy, 'attacker', STRIKE)
    expect([won.turn, won.winner]).toEqual([29, 'attacker'])
  })

  it('a KO replacement never counts as a turn', () => {
    const b = initBattle(three('flame', 20), [spec('nature', 1, 1), spec('nature', 1), spec('nature', 1)], C)
    const o = go(go(b, 'attacker', T1), 'defender', { kind: 'replace', to: 1 })
    expect(o.turn).toBe(1)
  })
})

describe('Tier 3 and locks (§6.1, R64)', () => {
  const start = () => initBattle(three('flame', 20), three('sea', 20), C)
  const has = (b: BattleState, side: Side, move: number) => legalMoves(b, side).some(m => m.kind === 'attack' && m.move === move)

  it("using T3 makes it illegal on that dragon's next action; another move clears it", () => {
    let b = go(start(), 'attacker', T3)
    expect(b.sides.attacker.team[0]!.t3Cooling).toBe(true)
    b = go(b, 'defender', STRIKE)
    expect(has(b, 'attacker', 3)).toBe(false)
    expect(step(b, 'attacker', T3, rng())).toBeNull()
    b = go(b, 'attacker', T2)
    expect(b.sides.attacker.team[0]!.t3Cooling).toBe(false)
    b = go(b, 'defender', STRIKE)
    expect(has(b, 'attacker', 3)).toBe(true)
  })

  it('swapping out clears it, and a fresh entrant may use T3', () => {
    let b = go(start(), 'attacker', T3)
    b = go(b, 'defender', STRIKE)
    b = go(b, 'attacker', { kind: 'swap', to: 1 })
    expect(b.sides.attacker.team[0]!.t3Cooling).toBe(false)
    b = go(b, 'defender', STRIKE)
    expect(has(b, 'attacker', 3)).toBe(true) // the entrant
    b = go(b, 'attacker', { kind: 'swap', to: 0 })
    b = go(b, 'defender', STRIKE)
    expect(has(b, 'attacker', 3)).toBe(true) // the one that rested by swapping
  })

  it("one dragon's rest does not touch the other side or its bench", () => {
    let b = go(start(), 'attacker', T3)
    expect(has(b, 'defender', 3)).toBe(true)
    b = go(b, 'defender', T3)
    expect(b.sides.defender.team[0]!.t3Cooling).toBe(true)
    expect(b.sides.attacker.team[1]!.t3Cooling).toBe(false)
  })

  it('level-locked moves are illegal: Lv 9 has Physical and T1, Lv 10 adds T2, Lv 20 T3', () => {
    const at = (level: number) => legalMoves(initBattle(three('flame', level), three('sea', 1), C), 'attacker')
      .flatMap(m => (m.kind === 'attack' ? [m.move] : []))
    expect(at(9)).toEqual([0, 1])
    expect(at(10)).toEqual([0, 1, 2])
    expect(at(19)).toEqual([0, 1, 2])
    expect(at(20)).toEqual([0, 1, 2, 3])
    expect(step(initBattle(three('flame', 9), three('sea', 1), C), 'attacker', T2, rng())).toBeNull()
  })
})

describe('immunity and stalemates (Review Focus 4)', () => {
  it('a Terra Basic against a Terra Basic can only hurt with Physical', () => {
    const b = initBattle(three('terra', 20), three('terra', 20), C)
    for (const m of [T1, T2, T3]) {
      expect(go(b, 'attacker', m).log[0]).toMatchObject({ kind: 'attack', damage: 0, multiplier: 0, immune: true, ko: false })
    }
    const strike = go(b, 'attacker', STRIKE).log[0]!
    expect(strike).toMatchObject({ multiplier: 1, immune: false })
    expect(strike.kind === 'attack' && strike.damage).toBeGreaterThan(0)
  })

  it('a battle of two mirror L1 teams still ends', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const r = createRng(seed)
      let b = initBattle(three('terra', 1), three('terra', 1), C)
      while (b.winner === null) {
        const m = b.awaiting === 'replace' ? legalMoves(b, 'attacker')[0]! : STRIKE
        b = runDefender(step(b, 'attacker', m, r)!, r)
      }
      expect(b.turn).toBeLessThanOrEqual(TURN_LIMIT)
    }
  })

  it('swap loops by both sides reach turn 30 and the defender wins, untouched', () => {
    // Flame is 0.5x on Sea with Nature 2x on the bench; Nature is 0.5x on Ice with Flame 2x on the bench.
    const attackers = [spec('ice', 1), spec('sea', 1), spec('terra', 1)]
    const defenders = [spec('flame', 1), spec('nature', 1), spec('terra', 1)]
    const moves: PlayerMove[] = Array.from({ length: 15 }, (_, i) => ({ kind: 'swap', to: i % 2 === 0 ? 1 : 0 }))
    const o = simulateBattle(attackers, defenders, moves, createRng(3), C)
    if (!o.ok) throw new Error(`${o.error} at ${o.at}`)
    expect([o.winner, o.turns, o.attackerKos]).toEqual(['defender', 30, 0])
    expect(o.log).toHaveLength(30)
    expect(o.log.every(e => e.kind === 'swap')).toBe(true)
    const hp = (specs: BattleDragonSpec[]) => specs.map(s => combatStats(s, C).hp)
    expect(o.attacker).toEqual(hp(attackers))
    expect(o.defender).toEqual(hp(defenders))
  })
})

describe('attackerKos', () => {
  it("counts the attacker's fallen", () => {
    const attackers = [spec('flame', 1, 1), spec('flame', 1, 1), spec('flame', 40)]
    const moves: PlayerMove[] = [STRIKE, { kind: 'replace', to: 1 }, STRIKE, { kind: 'replace', to: 2 }]
    const strikes = Array.from({ length: 13 }, () => STRIKE)
    const o = simulateBattle(attackers, three('terra', 40), [...moves, ...strikes], createRng(1), C)
    if (!o.ok) throw new Error(`${o.error} at ${o.at}`)
    expect(o.attacker.slice(0, 2)).toEqual([0, 0])
    expect(o.attackerKos).toBe(o.attacker.filter(h => h === 0).length)
    expect(o.attackerKos).toBeGreaterThanOrEqual(2)
  })
})
