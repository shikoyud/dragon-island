import { describe, expect, it } from 'vitest'
import { combatStats, movesFor, type BattleDragonSpec } from '../src/battle/stats'
import {
  aiMove, isLegalMove, MAX_ROUNDS, simulateBattle, turnOrder, type BattleOutcome, type Combatant, type PlayerMove,
} from '../src/battle/sim'
import { getSpecies } from '../src/catalog'
import { createRng, type Rng } from '../src/rng'
import { FIXTURE_CATALOG as C } from './fixtures'

const spec = (speciesId: string, level: number): BattleDragonSpec => ({ speciesId, level })
const three = (id: string, level: number) => [spec(id, level), spec(id, level), spec(id, level)]
const SWEEP: PlayerMove[] = [{ move: 0, target: 0 }, { move: 0, target: 1 }, { move: 0, target: 2 }]
const AI = true // attacker also AI-driven
const fighter = (id: string, level: number, hp?: number): Combatant => {
  const stats = combatStats(spec(id, level), C)
  const species = getSpecies(C, id)
  return { spec: spec(id, level), species, stats, hp: hp ?? stats.hp, moves: movesFor(species) }
}
const win = (o: BattleOutcome) => { if (!o.ok) throw new Error(o.error); return o }

describe('turnOrder', () => {
  it('sorts living combatants by speed, attacker first on ties', () => {
    const order = turnOrder([fighter('fire', 10), fighter('water', 5)], [fighter('ice', 10), fighter('nature', 1)])
    expect(order).toEqual([
      { side: 'attacker', slot: 0 }, { side: 'defender', slot: 0 }, { side: 'attacker', slot: 1 }, { side: 'defender', slot: 1 },
    ])
    expect(turnOrder([fighter('fire', 10, 0)], [fighter('ice', 1)])).toEqual([{ side: 'defender', slot: 0 }])
  })
})

describe('aiMove', () => {
  const actor = fighter('fn-rare', 5)

  it('picks the strongest multiplier, then the lowest HP, then the lowest slot', () => {
    expect(aiMove(actor, [fighter('water', 1), fighter('nature', 1), fighter('nature', 1, 1)])).toEqual({ move: 0, target: 2 })
    expect(aiMove(actor, [fighter('water', 1), fighter('water', 1), fighter('water', 1)])).toEqual({ move: 1, target: 0 })
    expect(aiMove(actor, [fighter('water', 1, 0), fighter('water', 1), fighter('water', 1)])).toEqual({ move: 1, target: 1 })
  })
})

describe('isLegalMove', () => {
  const actor = fighter('fw-rare', 1)
  const targets = [fighter('fire', 1, 0), fighter('fire', 1), fighter('fire', 1)]

  it('rejects KO’d targets, bad slots and bad move indexes', () => {
    expect(isLegalMove(actor, targets, { move: 0, target: 0 })).toBe(false)
    expect(isLegalMove(actor, targets, { move: 0, target: 3 })).toBe(false)
    expect(isLegalMove(actor, targets, { move: 2, target: 1 })).toBe(false)
    expect(isLegalMove(actor, targets, { move: 1.5, target: 1 })).toBe(false)
    expect(isLegalMove(actor, targets, { move: 1, target: 1 })).toBe(true)
  })
})

describe('simulateBattle', () => {
  it('lets a strong attacker sweep in one round', () => {
    const o = win(simulateBattle(three('fire', 20), three('nature', 1), SWEEP, createRng(1), C))
    expect(o.winner).toBe('attacker')
    expect(o.rounds).toBe(1)
    const atk = o.log.filter(e => e.side === 'attacker')
    expect(atk).toHaveLength(3)
    for (const e of atk) {
      expect(e.multiplier).toBe(2)
      expect(e.damage).toBeGreaterThanOrEqual(126)
      expect(e.damage).toBeLessThanOrEqual(154)
      expect(e.ko).toBe(true)
    }
    expect(o.log.filter(e => e.side === 'defender')).toHaveLength(0)
    expect(o.defender).toEqual([0, 0, 0])
  })

  it('rejects missing and illegal moves with the index', () => {
    expect(simulateBattle(three('fire', 20), three('nature', 1), [{ move: 0, target: 0 }], createRng(1), C))
      .toEqual({ ok: false, error: 'MISSING_MOVES', at: 1 })
    const twice = [{ move: 0, target: 0 }, { move: 0, target: 0 }, { move: 0, target: 1 }]
    expect(simulateBattle(three('fire', 20), three('nature', 1), twice, createRng(1), C))
      .toEqual({ ok: false, error: 'ILLEGAL_MOVE', at: 1 })
  })

  it('lets the defender win and zeroes the losing side', () => {
    const o = win(simulateBattle(three('fire', 1), three('fw-legend', 30), [], createRng(1), C, AI))
    expect(o.winner).toBe('defender')
    expect(o.rounds).toBeLessThan(MAX_ROUNDS)
    expect(o.attacker).toEqual([0, 0, 0])
  })

  it('breaks mirror ties in favour of the attacker', () => {
    const o = win(simulateBattle(three('fire', 1), three('fire', 1), [], createRng(1), C, AI))
    expect(o.winner).toBe('attacker')
    expect(o.defender).toEqual([0, 0, 0])
  })

  it('hands the defender the win at the round cap', () => {
    const o = win(simulateBattle(three('fire', 1), three('wall', 30), [], createRng(1), C, AI))
    expect(o.winner).toBe('defender')
    expect(o.rounds).toBeLessThanOrEqual(MAX_ROUNDS)
  })

  it('is deterministic per seed', () => {
    const run = (seed: number) => simulateBattle(three('fw-rare', 12), three('fn-rare', 12), [], createRng(seed), C, AI)
    expect(run(9)).toEqual(run(9))
    const a = win(run(9)), b = win(run(10))
    expect(a.log.map(e => e.damage)).not.toEqual(b.log.map(e => e.damage))
  })

  it('never exceeds the round cap and the AI never makes an illegal move', () => {
    const pool = [...C.species.values()].filter(s => !s.recipeOnly).map(s => s.id)
    const randomTeam = (rng: Rng) => Array.from({ length: 3 }, () => spec(pool[rng.int(pool.length)]!, 1 + rng.int(30)))
    for (let seed = 1; seed <= 200; seed++) {
      const rng = createRng(seed)
      const attackers = randomTeam(rng), defenders = randomTeam(rng)
      const o = win(simulateBattle(attackers, defenders, [], rng, C, AI))
      expect(o.rounds).toBeLessThanOrEqual(MAX_ROUNDS)
      if (o.rounds === MAX_ROUNDS && o.attacker.some(h => h > 0)) expect(o.winner).toBe('defender')
      // replay the log against our own HP bookkeeping
      const hp = { attacker: attackers.map(d => combatStats(d, C).hp), defender: defenders.map(d => combatStats(d, C).hp) }
      for (const e of o.log) {
        const victim = e.side === 'attacker' ? 'defender' : 'attacker'
        const actorSpecies = getSpecies(C, (e.side === 'attacker' ? attackers : defenders)[e.slot]!.speciesId)
        expect(hp[e.side][e.slot]).toBeGreaterThan(0)
        expect(hp[victim][e.target]).toBeGreaterThan(0)
        expect(e.move).toBeLessThan(movesFor(actorSpecies).length)
        hp[victim][e.target] = Math.max(0, hp[victim][e.target]! - e.damage)
        expect(e.ko).toBe(hp[victim][e.target] === 0)
      }
      expect(hp.attacker).toEqual(o.attacker)
      expect(hp.defender).toEqual(o.defender)
    }
  })
})
