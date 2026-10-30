import { describe, expect, it } from 'vitest'
import { battlePreview } from '../src/battle/preview'
import { aiMove, isLegalMove, simulateBattle, type PlayerMove } from '../src/battle/sim'
import type { BattleDragonSpec } from '../src/battle/stats'
import { createRng } from '../src/rng'
import { FIXTURE_CATALOG as C } from './fixtures'

const spec = (speciesId: string, level: number): BattleDragonSpec => ({ speciesId, level })
const three = (id: string, level: number) => [spec(id, level), spec(id, level), spec(id, level)]
const SWEEP: PlayerMove[] = [{ move: 0, target: 0 }, { move: 0, target: 1 }, { move: 0, target: 2 }]

describe('battlePreview', () => {
  it('stops at the first attacker action without a move', () => {
    const p = battlePreview(three('flame', 20), three('nature', 1), [], createRng(1), C)
    expect(p.done).toBeNull()
    expect(p.next).toEqual({ side: 'attacker', slot: 0 })
    expect(p.round).toBe(1)
    expect(p.log.filter(e => e.side === 'attacker')).toHaveLength(0)
    expect(p.attacker.every(c => c.hp === c.stats.hp)).toBe(true) // no SPD until M5: attackers act in slot order
  })

  it('reports the full outcome when every move is supplied', () => {
    const p = battlePreview(three('flame', 20), three('nature', 1), SWEEP, createRng(1), C)
    expect(p.done).toEqual(simulateBattle(three('flame', 20), three('nature', 1), SWEEP, createRng(1), C))
    expect(p.next).toBeNull()
    expect(p.defender.map(c => c.hp)).toEqual([0, 0, 0])
  })

  it('reports an illegal move instead of guessing', () => {
    const p = battlePreview(three('flame', 20), three('nature', 1), [{ move: 0, target: 0 }, { move: 0, target: 0 }], createRng(1), C)
    expect(p.done).toEqual({ ok: false, error: 'ILLEGAL_MOVE', at: 1 })
  })

  it('is a prefix of the full simulation for any legal prefix of moves', () => {
    const pool = [...C.species.values()].filter(s => s.rarity !== 'legendary').map(s => s.id)
    for (let seed = 1; seed <= 150; seed++) {
      const rng = createRng(seed)
      const team = () => Array.from({ length: 3 }, () => spec(pool[rng.int(pool.length)]!, 1 + rng.int(30)))
      const attackers = team(), defenders = team()
      // Build a full legal move list with the AI, one preview step at a time.
      const moves: PlayerMove[] = []
      for (let guard = 0; guard < 200; guard++) {
        const p = battlePreview(attackers, defenders, moves, createRng(seed), C)
        if (p.done) break
        const actor = p.attacker[p.next!.slot]!
        const m = aiMove(actor, p.defender)
        expect(isLegalMove(actor, p.defender, m)).toBe(true)
        moves.push(m)
      }
      const full = simulateBattle(attackers, defenders, moves, createRng(seed), C)
      expect(full.ok).toBe(true)
      if (!full.ok) continue
      const cut = Math.floor(moves.length / 2)
      const partial = battlePreview(attackers, defenders, moves.slice(0, cut), createRng(seed), C)
      expect(full.log.slice(0, partial.log.length)).toEqual(partial.log)
      const complete = battlePreview(attackers, defenders, moves, createRng(seed), C)
      expect(complete.done).toEqual(full)
    }
  })
})
