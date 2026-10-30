import { describe, expect, it } from 'vitest'
import { simulateBattle, type PlayerMove } from '../src/battle/sim'
import type { BattleDragonSpec } from '../src/battle/stats'
import { createRng } from '../src/rng'
import { FIXTURE_CATALOG as C } from './fixtures'

const spec = (speciesId: string, level: number): BattleDragonSpec => ({ speciesId, level })
const three = (id: string, level: number) => [spec(id, level), spec(id, level), spec(id, level)]

describe('simulateBattle with aiFallback', () => {
  it('lets the AI finish a short move list instead of failing', () => {
    const short: PlayerMove[] = [{ move: 0, target: 0 }]
    expect(simulateBattle(three('flame', 20), three('nature', 1), short, createRng(1), C).ok).toBe(false)
    const o = simulateBattle(three('flame', 20), three('nature', 1), short, createRng(1), C, { aiFallback: true })
    expect(o.ok).toBe(true)
    expect(o.ok && o.winner).toBe('attacker')
    expect(o.ok && o.log[0]).toMatchObject({ side: 'attacker', slot: 0, move: 0, target: 0 }) // the given move was used first
  })

  it('replaces an illegal move with the AI choice', () => {
    const bad: PlayerMove[] = [{ move: 0, target: 0 }, { move: 0, target: 0 }] // target 0 is KO'd by then
    const o = simulateBattle(three('flame', 20), three('nature', 1), bad, createRng(1), C, { aiFallback: true })
    expect(o.ok).toBe(true)
    expect(o.ok && o.log[1]!.target).not.toBe(0)
  })

  it('is identical to the strict simulation when every move is legal', () => {
    const moves: PlayerMove[] = [{ move: 0, target: 0 }, { move: 0, target: 1 }, { move: 0, target: 2 }]
    expect(simulateBattle(three('flame', 20), three('nature', 1), moves, createRng(1), C, { aiFallback: true }))
      .toEqual(simulateBattle(three('flame', 20), three('nature', 1), moves, createRng(1), C))
  })
})
