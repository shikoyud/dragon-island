import { describe, expect, it } from 'vitest'
import { runDefender } from '../src/battle/ai'
import { battleOutcome, initBattle, legalMoves, step, type BattleEvent, type BattleOutcome, type PlayerMove } from '../src/battle/machine'
import { battlePreview } from '../src/battle/preview'
import { simulateBattle } from '../src/battle/sim'
import { combatStats, type BattleDragonSpec } from '../src/battle/stats'
import { TURN_LIMIT } from '../src/data/battle'
import { createRng, type Rng } from '../src/rng'
import { FIXTURE_CATALOG as C } from './fixtures'

const spec = (speciesId: string, level: number): BattleDragonSpec => ({ speciesId, level })
const three = (id: string, level: number) => [spec(id, level), spec(id, level), spec(id, level)]
const T1: PlayerMove = { kind: 'attack', move: 1 }
const SWEEP: PlayerMove[] = [T1, T1, T1]
const win = (o: BattleOutcome) => { if (!o.ok) throw new Error(`${o.error} at ${o.at}`); return o }

describe('simulateBattle', () => {
  it('lets a strong attacker sweep: three actions, the defender acting between them', () => {
    const o = win(simulateBattle(three('flame', 20), three('nature', 1), SWEEP, createRng(1), C))
    expect(o.winner).toBe('attacker')
    expect(o.defender).toEqual([0, 0, 0])
    expect(o.attackerKos).toBe(0)
    expect(o.turns).toBe(5) // A, D, A, D, A
    expect(o.log.filter(e => e.kind === 'replace').map(e => e.side)).toEqual(['defender', 'defender'])
    const hits = o.log.filter((e): e is Extract<BattleEvent, { kind: 'attack' }> => e.kind === 'attack' && e.side === 'attacker')
    expect(hits).toHaveLength(3)
    expect(hits.every(e => e.ko && e.multiplier === 2)).toBe(true)
  })

  it('a short list is MISSING_MOVES at its length', () => {
    expect(simulateBattle(three('flame', 20), three('nature', 1), [T1], createRng(1), C)).toEqual({ ok: false, error: 'MISSING_MOVES', at: 1 })
    expect(simulateBattle(three('flame', 20), three('nature', 1), [], createRng(1), C)).toEqual({ ok: false, error: 'MISSING_MOVES', at: 0 })
  })

  it('an illegal move is ILLEGAL_MOVE with its index', () => {
    expect(simulateBattle(three('flame', 1), three('nature', 1), [{ kind: 'attack', move: 0 }, { kind: 'attack', move: 2 }], createRng(1), C))
      .toEqual({ ok: false, error: 'ILLEGAL_MOVE', at: 1 })
    expect(simulateBattle(three('flame', 20), three('nature', 1), [{ kind: 'replace', to: 1 }], createRng(1), C))
      .toEqual({ ok: false, error: 'ILLEGAL_MOVE', at: 0 })
  })

  it('trailing moves after the end are ignored, even illegal ones', () => {
    const base = simulateBattle(three('flame', 20), three('nature', 1), SWEEP, createRng(1), C)
    expect(simulateBattle(three('flame', 20), three('nature', 1), [...SWEEP, { kind: 'replace', to: 9 }, T1], createRng(1), C)).toEqual(base)
  })

  it('is deterministic per seed, and the seed matters', () => {
    const run = (seed: number) => win(simulateBattle(three('flame', 20), three('nature', 1), SWEEP, createRng(seed), C))
    expect(run(9)).toEqual(run(9))
    const damages = (o: BattleOutcome) => (o.ok ? o.log.map(e => (e.kind === 'attack' ? e.damage : 0)) : [])
    expect(damages(run(9))).not.toEqual(damages(run(10)))
  })

  it('starts from the given HP', () => {
    const atk: BattleDragonSpec[] = [{ speciesId: 'flame', level: 20, hp: 3000 }, spec('flame', 20), spec('flame', 20)]
    const o = win(simulateBattle(atk, three('nature', 1), SWEEP, createRng(1), C))
    expect(o.attacker[0]).toBeLessThanOrEqual(3000)
    expect(o.attacker[0]).toBeGreaterThan(0)
    expect(o.attacker[1]).toBe(combatStats(spec('flame', 20), C).hp)
  })
})

// Review Focus 1: same seed and moves, same battle, whichever way it's driven.
describe('client and server agree across 300 seeds with a random legal player', () => {
  const pool = [...C.species.values()].map(s => s.id)
  const team = (r: Rng) => Array.from({ length: 3 }, () => spec(pool[r.int(pool.length)]!, 1 + r.int(40)))

  function checkLog(o: Extract<BattleOutcome, { ok: true }>, attackers: BattleDragonSpec[], defenders: BattleDragonSpec[]) {
    const hp = { attacker: attackers.map(d => combatStats(d, C).hp), defender: defenders.map(d => combatStats(d, C).hp) }
    const active = { attacker: 0, defender: 0 }
    for (const e of o.log) {
      if (e.kind !== 'attack') {
        expect(e.from).toBe(active[e.side])
        expect(hp[e.side][e.to]).toBeGreaterThan(0)
        active[e.side] = e.to
        continue
      }
      const foe = e.side === 'attacker' ? 'defender' : 'attacker'
      expect(e.slot).toBe(active[e.side])
      expect(e.target).toBe(active[foe])
      expect(hp[e.side][e.slot]).toBeGreaterThan(0)
      expect(hp[foe][e.target]).toBeGreaterThan(0)
      if (e.multiplier === 0) expect([e.damage, e.immune]).toEqual([0, true])
      else expect(e.damage).toBeGreaterThanOrEqual(1)
      hp[foe][e.target] = Math.max(0, hp[foe][e.target]! - e.damage)
      expect(e.ko).toBe(hp[foe][e.target] === 0)
    }
    expect(hp.attacker).toEqual(o.attacker)
    expect(hp.defender).toEqual(o.defender)
  }

  it('live step play, simulateBattle and step-by-step battlePreview give deep-equal outcomes and logs', () => {
    const seen = { swap: 0, replace: 0, immune: 0, ko: 0, limit: 0, attacker: 0, defender: 0 }
    for (let seed = 1; seed <= 300; seed++) {
      const choices = createRng(seed + 10_000)
      const attackers = team(choices), defenders = team(choices)
      // The player's picks come from their own stream, as a person's would: only the battle draws from the seed.
      const live = createRng(seed)
      let b = runDefender(initBattle(attackers, defenders, C), live)
      const moves: PlayerMove[] = []
      while (b.winner === null) {
        const legal = legalMoves(b, 'attacker')
        const m = legal[choices.int(legal.length)]!
        moves.push(m)
        const next = step(b, 'attacker', m, live)
        expect(next).not.toBeNull()
        b = runDefender(next!, live)
      }
      const played = battleOutcome(b)
      const sim = simulateBattle(attackers, defenders, moves, createRng(seed), C)
      expect(sim).toEqual(played)
      for (let i = 0; i < moves.length; i++) {
        const p = battlePreview(attackers, defenders, moves.slice(0, i), createRng(seed), C)
        expect(p.done).toBeNull()
        expect(p.state.toAct).toBe('attacker')
        expect(played.ok && played.log.slice(0, p.state.log.length)).toEqual(p.state.log)
      }
      const final = battlePreview(attackers, defenders, moves, createRng(seed), C)
      expect(final.done).toEqual(played)
      expect(final.state).toEqual(b)

      const o = win(sim)
      expect(o.turns).toBeLessThanOrEqual(TURN_LIMIT)
      expect(moves.length).toBeLessThanOrEqual(45)
      seen[o.winner]++
      if (o.turns === TURN_LIMIT) seen.limit++
      expect(o.attackerKos).toBe(o.attacker.filter(h => h === 0).length)
      for (const e of o.log) {
        if (e.kind === 'attack') {
          if (e.immune) seen.immune++
          if (e.ko) seen.ko++
        } else seen[e.kind]++
      }
      checkLog(o, attackers, defenders)
    }
    // The run must have exercised what it claims to protect.
    for (const [k, v] of Object.entries(seen)) expect(v, k).toBeGreaterThan(0)
  })
})
