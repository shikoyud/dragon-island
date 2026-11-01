import { describe, expect, it } from 'vitest'
import { aiChoice, runDefender } from '../src/battle/ai'
import { baseDamage } from '../src/battle/damage'
import { AI_EXPECTED_VARIANCE, AI_SWAP_BELOW_MULT, AI_SWAP_TARGET_MULT, VARIANCE_MAX, VARIANCE_MIN } from '../src/data/battle'
import { initBattle, legalMoves, step, type BattleState, type Side } from '../src/battle/machine'
import type { BattleDragonSpec } from '../src/battle/stats'
import { makeCatalog } from '../src/catalog'
import { createRng, type Rng } from '../src/rng'
import { FIXTURE_CATALOG as C } from './fixtures'

const spec = (speciesId: string, level: number): BattleDragonSpec => ({ speciesId, level })
const three = (id: string, level: number) => [spec(id, level), spec(id, level), spec(id, level)]
const toAct = (b: BattleState, side: Side): BattleState => ({ ...b, toAct: side })

function counting(inner: Rng): Rng & { calls: number[] } {
  const calls: number[] = []
  return { calls, next: () => inner.next(), int: (n: number) => { calls.push(n); return inner.int(n) } }
}
/** Returns the given int() values in order and fails on any other draw: proves exactly which draws happen. */
function scripted(...values: number[]): Rng {
  const q = [...values]
  return {
    next: () => { throw new Error('next() is not part of the draw order') },
    int: () => { if (q.length === 0) throw new Error('an unexpected draw'); return q.shift()! },
  }
}
const koActive = (b: BattleState, side: Side): BattleState => ({
  ...b, toAct: side, awaiting: 'replace',
  sides: { ...b.sides, [side]: { ...b.sides[side], team: b.sides[side].team.map((f, i) => (i === b.sides[side].active ? { ...f, hp: 0 } : f)) } },
})
const tally = (b: BattleState, side: Side, seed: number, trials: number) => {
  const rng = createRng(seed)
  const seen = new Map<string, number>()
  for (let i = 0; i < trials; i++) {
    const k = JSON.stringify(aiChoice(b, side, rng))
    seen.set(k, (seen.get(k) ?? 0) + 1)
  }
  return seen
}
const attack = (move: number) => JSON.stringify({ kind: 'attack', move })

describe('aiChoice: never 0x when another move exists (§6.4)', () => {
  it('Terra against Terra at Lv 20 only ever plays Physical, over both branches', () => {
    const b = initBattle(three('terra', 20), three('terra', 20), C)
    expect([...tally(b, 'attacker', 1, 2000).keys()]).toEqual([attack(0)])
  })

  it('a hybrid with one immune element skips only the immune moves', () => {
    // fn-rare: T1 flame, T2 nature, T3 flame. Against Flame, T1 and T3 are 0x and T2 nature is 0.5x.
    const b = initBattle(three('fn-rare', 20), three('flame', 1), C)
    expect([...tally(b, 'attacker', 2, 2000).keys()].sort()).toEqual([attack(0), attack(2)].sort())
  })

  it('takes the first legal move when every legal move is immune (a guard: Physical prevents it)', () => {
    const b = initBattle(three('terra', 20), [spec('terra', 20), spec('terra', 20), spec('terra', 20)], C)
    const noPhysical: BattleState = {
      ...b,
      sides: { ...b.sides, attacker: { ...b.sides.attacker, team: b.sides.attacker.team.map(f => ({ ...f, moves: f.moves.map(m => (m.tier === 'physical' ? { ...m, element: 'terra' as const } : m)) })) } },
    }
    expect(aiChoice(noPhysical, 'attacker', scripted(0))).toEqual({ kind: 'attack', move: 0 })
    expect(aiChoice(noPhysical, 'attacker', scripted(99))).toEqual({ kind: 'attack', move: 0 })
  })
})

describe('aiChoice: highest expected damage 80 % (§6.4)', () => {
  const b = initBattle(three('flame', 20), three('nature', 1), C) // T3 2x is the best of Physical, T1, T2, T3

  it('the best branch is taken 80 % ± 2 of 10,000 trials, and always plays the best move', () => {
    const rng = counting(createRng(11))
    let best = 0
    for (let i = 0; i < 10_000; i++) {
      const before = rng.calls.length
      const m = aiChoice(b, 'attacker', rng)
      if (rng.calls.length - before === 1) {
        best++
        expect(m).toEqual({ kind: 'attack', move: 3 })
      }
    }
    expect(best).toBeGreaterThanOrEqual(7800)
    expect(best).toBeLessThanOrEqual(8200)
  })

  it('the random branch covers all legal non-immune moves, so the best move lands 85 % overall with 4 of them', () => {
    const seen = tally(b, 'attacker', 12, 10_000)
    expect(seen.size).toBe(4)
    const share = seen.get(attack(3))! / 10_000
    expect(share).toBeGreaterThan(0.83)
    expect(share).toBeLessThan(0.87)
    for (const move of [0, 1, 2]) {
      const other = seen.get(attack(move))! / 10_000
      expect(other).toBeGreaterThan(0.04)
      expect(other).toBeLessThan(0.06)
    }
  })

  it('"highest expected" is baseDamage with no crit and variance 1000, and 79 is the last best roll', () => {
    const f = b.sides.attacker.team[0]!
    const dmg = f.moves.map(m => baseDamage(f.stats.atk, m, 'nature', false, 1000))
    expect(Math.max(...dmg)).toBe(dmg[3])
    expect(aiChoice(b, 'attacker', scripted(0))).toEqual({ kind: 'attack', move: 3 })
    expect(aiChoice(b, 'attacker', scripted(79))).toEqual({ kind: 'attack', move: 3 })
    expect(aiChoice(b, 'attacker', scripted(80, 0))).toEqual({ kind: 'attack', move: 0 })
  })

  it('ties take the lowest move slot', () => {
    const same: BattleState = {
      ...b,
      sides: { ...b.sides, attacker: { ...b.sides.attacker, team: b.sides.attacker.team.map(f => ({ ...f, moves: f.moves.map(m => ({ ...m, element: 'flame' as const, multPct: 100 })) })) } },
    }
    expect(aiChoice(same, 'attacker', scripted(0))).toEqual({ kind: 'attack', move: 0 })
  })

  it('respects the T3 cooldown in both branches', () => {
    const cooling = toAct(step(b, 'attacker', { kind: 'attack', move: 3 }, createRng(1))!, 'attacker')
    // The hit KO'd nature L1, which doesn't matter here: the attacker's own kit is what's under test.
    const back: BattleState = { ...cooling, awaiting: 'action' }
    expect(tally(back, 'attacker', 13, 5000).has(attack(3))).toBe(false)
    expect(aiChoice(back, 'attacker', scripted(0))).toEqual({ kind: 'attack', move: 2 })
  })

  it('never picks a level-locked move', () => {
    const low = initBattle(three('flame', 9), three('nature', 1), C)
    expect([...tally(low, 'attacker', 14, 3000).keys()].sort()).toEqual([attack(0), attack(1)].sort())
  })
})

describe('AI constants live in data/battle', () => {
  it('names the 0.5x line, the 2x bench test and the expected-damage variance', () => {
    expect([AI_SWAP_BELOW_MULT, AI_SWAP_TARGET_MULT, AI_EXPECTED_VARIANCE]).toEqual([0.5, 2, 1000])
    expect(AI_EXPECTED_VARIANCE).toBe(Math.round((VARIANCE_MIN + VARIANCE_MAX) / 2))
  })
})

describe('aiChoice: swap (§6.4, R66)', () => {
  // Flame on Sea is 0.5x. Physical (1x) doesn't count, so the test fires as long as the bench has a 2x move.
  it('swaps when every element move is 0.5x or worse and a bench dragon has a 2x move, lowest such slot', () => {
    const b = initBattle(three('sea', 1), [spec('flame', 1), spec('terra', 1), spec('nature', 1)], C)
    expect(aiChoice(toAct(b, 'defender'), 'defender', scripted())).toEqual({ kind: 'swap', to: 2 })
    const two = initBattle(three('sea', 1), [spec('flame', 1), spec('nature', 1), spec('nature', 1)], C)
    expect(aiChoice(toAct(two, 'defender'), 'defender', scripted())).toEqual({ kind: 'swap', to: 1 })
  })

  it('0x counts as 0.5x or worse', () => {
    // Sea on Sea is 0x; Nature on the bench is 2x on Sea.
    const b = initBattle(three('sea', 1), [spec('sea', 1), spec('nature', 1), spec('terra', 1)], C)
    expect(aiChoice(toAct(b, 'defender'), 'defender', scripted())).toEqual({ kind: 'swap', to: 1 })
  })

  it('does not swap with a 1x element move, or with no 2x on the bench', () => {
    const one = initBattle(three('sea', 1), [spec('terra', 1), spec('nature', 1), spec('nature', 1)], C)
    expect(aiChoice(toAct(one, 'defender'), 'defender', scripted(0)).kind).toBe('attack')
    const none = initBattle(three('sea', 1), [spec('flame', 1), spec('terra', 1), spec('terra', 1)], C)
    expect(aiChoice(toAct(none, 'defender'), 'defender', scripted(0))).toEqual({ kind: 'attack', move: 0 }) // Strike (0.52) beats T1 at 0.5x (0.425)
  })

  it('a locked move does not count, on the active or on the bench', () => {
    // fn-rare: T1 flame (0.5x on Sea), T2 nature (2x on Sea, Lv 10).
    const activeLocked = initBattle(three('sea', 1), [spec('fn-rare', 1), spec('nature', 1), spec('terra', 1)], C)
    expect(aiChoice(toAct(activeLocked, 'defender'), 'defender', scripted())).toEqual({ kind: 'swap', to: 1 })
    const activeOpen = initBattle(three('sea', 1), [spec('fn-rare', 10), spec('nature', 1), spec('terra', 1)], C)
    expect(aiChoice(toAct(activeOpen, 'defender'), 'defender', scripted(0)).kind).toBe('attack')
    const benchLocked = initBattle(three('sea', 1), [spec('flame', 1), spec('fn-rare', 1), spec('terra', 1)], C)
    expect(aiChoice(toAct(benchLocked, 'defender'), 'defender', scripted(0)).kind).toBe('attack')
    const benchOpen = initBattle(three('sea', 1), [spec('flame', 1), spec('fn-rare', 10), spec('terra', 1)], C)
    expect(aiChoice(toAct(benchOpen, 'defender'), 'defender', scripted())).toEqual({ kind: 'swap', to: 1 })
  })

  it('a fallen bench dragon does not count', () => {
    const b = initBattle(three('sea', 1), [spec('flame', 1), spec('nature', 1), spec('terra', 1)], C)
    const dead = toAct({ ...b, sides: { ...b.sides, defender: { ...b.sides.defender, team: b.sides.defender.team.map((f, i) => (i === 1 ? { ...f, hp: 0 } : f)) } } }, 'defender')
    expect(aiChoice(dead, 'defender', scripted(0)).kind).toBe('attack')
  })
})

describe('aiChoice: swap with a three-element dragon (R66)', () => {
  // flame-war-nature: T1 flame, T2 war, T3 nature. Against a Sea primary that is 0.5x, 0.5x and 2x.
  const TRI = makeCatalog([...C.species.values(), { id: 'tri', name: 'tri', elements: ['flame', 'war', 'nature'], rarity: 'epic' }])
  const rest = (b: BattleState, cooling: boolean): BattleState => ({
    ...b, sides: { ...b.sides, defender: { ...b.sides.defender, team: b.sides.defender.team.map((f, i) => (i === 0 ? { ...f, t3Cooling: cooling } : f)) } },
  })

  it('a Tier 3 that is resting still counts: its 2x keeps the dragon in, so no swap', () => {
    const b = initBattle(three('sea', 20), [spec('tri', 20), spec('nature', 20), spec('terra', 20)], TRI)
    for (const cooling of [false, true]) {
      const pick = aiChoice(toAct(rest(b, cooling), 'defender'), 'defender', scripted(0))
      expect(pick.kind).toBe('attack')
    }
    // Resting, the T3 can't be picked: the best move left is one of the 0.5x ones, or Strike.
    const resting = aiChoice(toAct(rest(b, true), 'defender'), 'defender', scripted(0))
    expect(resting).not.toEqual({ kind: 'attack', move: 3 })
  })

  it('before the Tier 3 unlocks, the same dragon is all 0.5x and swaps to the 2x on its bench', () => {
    const b = initBattle(three('sea', 20), [spec('tri', 19), spec('nature', 20), spec('terra', 20)], TRI)
    expect(aiChoice(toAct(b, 'defender'), 'defender', scripted())).toEqual({ kind: 'swap', to: 1 })
  })
})

describe('aiChoice: replacement (R65)', () => {
  it("sends the bench dragon with the best multiplier on the opponent's active", () => {
    const b = initBattle(three('sea', 1), [spec('terra', 1), spec('terra', 1), spec('nature', 1)], C)
    expect(aiChoice(koActive(b, 'defender'), 'defender', scripted())).toEqual({ kind: 'replace', to: 2 })
  })

  it('ties take the lowest slot', () => {
    const b = initBattle(three('sea', 1), [spec('terra', 1), spec('nature', 1), spec('nature', 1)], C)
    expect(aiChoice(koActive(b, 'defender'), 'defender', scripted())).toEqual({ kind: 'replace', to: 1 })
  })

  it('compares element moves, so 1x beats 0.5x', () => {
    const b = initBattle(three('sea', 1), [spec('terra', 1), spec('flame', 1), spec('terra', 1)], C)
    expect(aiChoice(koActive(b, 'defender'), 'defender', scripted())).toEqual({ kind: 'replace', to: 2 })
  })

  it('a locked move does not count', () => {
    const locked = initBattle(three('sea', 1), [spec('terra', 1), spec('fn-rare', 1), spec('terra', 1)], C)
    expect(aiChoice(koActive(locked, 'defender'), 'defender', scripted())).toEqual({ kind: 'replace', to: 2 })
    const open = initBattle(three('sea', 1), [spec('terra', 1), spec('fn-rare', 10), spec('terra', 1)], C)
    expect(aiChoice(koActive(open, 'defender'), 'defender', scripted())).toEqual({ kind: 'replace', to: 1 })
  })

  it('works for either side', () => {
    const b = initBattle([spec('terra', 1), spec('terra', 1), spec('nature', 1)], three('sea', 1), C)
    expect(aiChoice(koActive(b, 'attacker'), 'attacker', scripted())).toEqual({ kind: 'replace', to: 2 })
  })
})

describe('aiChoice draw order (part of the contract)', () => {
  const b = initBattle(three('flame', 20), three('nature', 1), C)

  it('an attack: one int(100); the best branch stops there', () => {
    const rng = counting({ next: () => 0, int: () => 0 })
    aiChoice(b, 'attacker', rng)
    expect(rng.calls).toEqual([100])
  })

  it('the random branch adds one int(n), n = legal non-immune moves', () => {
    const rng = counting({ next: () => 0, int: n => (n === 100 ? 80 : 0) })
    aiChoice(b, 'attacker', rng)
    expect(rng.calls).toEqual([100, 4])
    const twoMoves = initBattle(three('flame', 1), three('nature', 1), C)
    const r2 = counting({ next: () => 0, int: n => (n === 100 ? 99 : 1) })
    expect(aiChoice(twoMoves, 'attacker', r2)).toEqual({ kind: 'attack', move: 1 })
    expect(r2.calls).toEqual([100, 2])
  })

  it('a swap and a replacement draw nothing', () => {
    const sw = counting(createRng(1))
    expect(aiChoice(toAct(initBattle(three('sea', 1), [spec('flame', 1), spec('nature', 1), spec('terra', 1)], C), 'defender'), 'defender', sw).kind).toBe('swap')
    expect(sw.calls).toEqual([])
    const re = counting(createRng(1))
    expect(aiChoice(koActive(b, 'attacker'), 'attacker', re).kind).toBe('replace')
    expect(re.calls).toEqual([])
  })

  it('aiChoice leaves the state alone and throws when the side has nothing to do', () => {
    const snapshot = structuredClone(b)
    aiChoice(b, 'attacker', createRng(1))
    expect(b).toEqual(snapshot)
    expect(() => aiChoice(b, 'defender', createRng(1))).toThrow()
  })
})

describe('runDefender', () => {
  it('does nothing while the attacker must act', () => {
    const b = initBattle(three('flame', 5), three('sea', 5), C)
    expect(runDefender(b, createRng(1))).toBe(b)
  })

  it("plays the AI's turn and hands back to the attacker", () => {
    const b = step(initBattle(three('flame', 5), three('terra', 5), C), 'attacker', { kind: 'attack', move: 0 }, createRng(1))!
    const after = runDefender(b, createRng(2))
    expect([after.toAct, after.turn, after.log.length]).toEqual(['attacker', 2, 2])
  })

  it('replaces and then takes its turn, stopping when the attacker must replace', () => {
    const b = initBattle([{ speciesId: 'flame', level: 1, hp: 1 }, spec('flame', 1), spec('flame', 1)], [{ speciesId: 'nature', level: 1, hp: 1 }, spec('sea', 20), spec('sea', 20)], C)
    const ko = step(b, 'attacker', { kind: 'attack', move: 1 }, createRng(1))!
    expect(ko.awaiting).toBe('replace')
    const after = runDefender(ko, createRng(2))
    expect(after.log.map(e => e.kind)).toEqual(['attack', 'replace', 'attack'])
    expect([after.toAct, after.awaiting, after.turn]).toEqual(['attacker', 'replace', 2])
    expect(legalMoves(after, 'attacker').every(m => m.kind === 'replace')).toBe(true)
  })

  it('returns at once when the battle is over', () => {
    const b = initBattle(three('flame', 5), three('sea', 5), C)
    const over: BattleState = { ...b, winner: 'attacker', toAct: 'defender' }
    expect(runDefender(over, createRng(1))).toBe(over)
  })
})
