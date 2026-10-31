import { AI_BEST_MOVE_PERCENT } from '../data/battle'
import { elementMultiplier, type Element, type Mult } from '../elements'
import type { Rng } from '../rng'
import { baseDamage } from './damage'
import { legalMoves, otherSide, step, type BattleState, type Fighter, type PlayerMove, type Side } from './machine'
import { moveUnlocked } from './moves'

/** The unlocked element moves' multipliers on `primary`: Physical doesn't count (R66), a resting Tier 3 still does. */
function elementMults(f: Fighter, primary: Element): Mult[] {
  return f.moves
    .filter(m => m.tier !== 'physical' && moveUnlocked(m, f.spec.level))
    .map(m => elementMultiplier(m.element, primary))
}
const bestMult = (f: Fighter, primary: Element): Mult => Math.max(...elementMults(f, primary)) as Mult

/**
 * §6.4's Defense AI, for either side. Legal moves only.
 *
 * Draw order is part of the contract, since the battle's stream is shared with damage rolls:
 * - A replacement (R65) draws nothing: the bench dragon with the best multiplier on the opponent's active, ties lowest slot.
 * - A swap draws nothing: when every element move is 0.5x or worse (R66) and a bench dragon has a 2x move, the lowest such slot.
 * - Otherwise an attack: one `rng.int(100)`. Under AI_BEST_MOVE_PERCENT it takes the highest `baseDamage` with no crit and
 *   variance 1000, ties lowest slot, and draws no more. Otherwise one `rng.int(n)` over the n legal non-immune moves.
 *   With none (a guard: Physical is never immune) it takes the first legal move, with no second draw.
 */
export function aiChoice(b: BattleState, side: Side, rng: Rng): PlayerMove {
  const legal = legalMoves(b, side)
  if (legal.length === 0) throw new Error(`aiChoice: ${side} has no move to make`)
  const me = b.sides[side]
  const foe = b.sides[otherSide(side)]
  const primary = foe.team[foe.active]!.species.elements[0]!

  if (b.awaiting === 'replace') {
    let pick = legal[0]!
    let best = -1
    for (const m of legal) {
      if (m.kind !== 'replace') continue
      const mult = bestMult(me.team[m.to]!, primary)
      if (mult > best) { best = mult; pick = m }
    }
    return pick
  }

  const actor = me.team[me.active]!
  if (elementMults(actor, primary).every(x => x <= 0.5)) {
    const swap = legal.find(m => m.kind === 'swap' && bestMult(me.team[m.to]!, primary) === 2)
    if (swap) return swap
  }

  const attacks = legal.flatMap(m => (m.kind === 'attack' ? [m] : []))
  if (rng.int(100) < AI_BEST_MOVE_PERCENT) {
    let pick = attacks[0]!
    let best = -1
    for (const m of attacks) {
      const expected = baseDamage(actor.stats.atk, actor.moves[m.move]!, primary, false, 1000)
      if (expected > best) { best = expected; pick = m }
    }
    return pick
  }
  const open = attacks.filter(m => elementMultiplier(actor.moves[m.move]!.element, primary) !== 0)
  return open.length === 0 ? attacks[0]! : open[rng.int(open.length)]!
}

/** Plays the defender's AI, turns and replacements, until the attacker must act or the battle ends. */
export function runDefender(b: BattleState, rng: Rng): BattleState {
  let state = b
  while (state.winner === null && state.toAct === 'defender') {
    const next = step(state, 'defender', aiChoice(state, 'defender', rng), rng)
    if (!next) throw new Error('runDefender: the AI chose an illegal move')
    state = next
  }
  return state
}
