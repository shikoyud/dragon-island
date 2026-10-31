import { describe, expect, it } from 'vitest'
import { legalMoves, type PlayerMove } from '../src/battle/machine'
import { battlePreview, battleSeed32 } from '../src/battle/preview'
import { simulateBattle } from '../src/battle/sim'
import type { BattleDragonSpec } from '../src/battle/stats'
import { createRng } from '../src/rng'
import { FIXTURE_CATALOG as C } from './fixtures'

const spec = (speciesId: string, level: number): BattleDragonSpec => ({ speciesId, level })
const three = (id: string, level: number) => [spec(id, level), spec(id, level), spec(id, level)]
const T1: PlayerMove = { kind: 'attack', move: 1 }
const SWEEP: PlayerMove[] = [T1, T1, T1]

describe('battlePreview', () => {
  it('stops at the first attacker action without a move', () => {
    const p = battlePreview(three('flame', 20), three('nature', 1), [], createRng(1), C)
    expect(p.done).toBeNull()
    expect([p.state.toAct, p.state.awaiting, p.state.turn, p.state.log.length]).toEqual(['attacker', 'action', 0, 0])
  })

  it('has already played the defender before it stops', () => {
    const p = battlePreview(three('flame', 20), three('nature', 1), [T1], createRng(1), C)
    expect(p.done).toBeNull()
    expect(p.state.toAct).toBe('attacker')
    expect(p.state.log.map(e => e.kind)).toEqual(['attack', 'replace', 'attack'])
    expect(p.state.turn).toBe(2)
  })

  it('reports the full outcome when every move is supplied, equal to simulateBattle', () => {
    const p = battlePreview(three('flame', 20), three('nature', 1), SWEEP, createRng(1), C)
    expect(p.done).toEqual(simulateBattle(three('flame', 20), three('nature', 1), SWEEP, createRng(1), C))
    expect(p.state.sides.defender.team.map(f => f.hp)).toEqual([0, 0, 0])
    expect(legalMoves(p.state, 'attacker')).toEqual([])
  })

  it('reports an illegal move with its index, keeping the state before it', () => {
    const p = battlePreview(three('flame', 1), three('nature', 1), [{ kind: 'attack', move: 0 }, { kind: 'attack', move: 3 }], createRng(1), C)
    expect(p.done).toEqual({ ok: false, error: 'ILLEGAL_MOVE', at: 1 })
    expect(p.state.turn).toBe(2)
  })

  it('ignores trailing moves', () => {
    const p = battlePreview(three('flame', 20), three('nature', 1), [...SWEEP, T1], createRng(1), C)
    expect(p.done).toEqual(simulateBattle(three('flame', 20), three('nature', 1), SWEEP, createRng(1), C))
  })
})

describe('battleSeed32', () => {
  it('takes the first 4 bytes as a uint32', () => {
    expect(battleSeed32(`0x${'ab'.repeat(32)}`)).toBe(0xabababab)
    expect(battleSeed32('ffffffff00')).toBe(0xffffffff)
  })
})
