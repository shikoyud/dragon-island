import { CRIT_PERCENT, VARIANCE_MAX, VARIANCE_MIN } from '../data/battle'
import type { Element } from '../data/elements'
import { elementMultiplier, type Mult } from '../elements'
import type { Rng } from '../rng'
import type { BattleMove } from './moves'

/**
 * §6.2 in integers (R62): floor(atk x multPct x em2 x critNum x var / (100 x 2 x 2 x 1000)),
 * em2 = ElementMult x 2 and critNum 3 (crit, 1.5x) or 2. A 0x hit deals 0; any other hit deals at least 1.
 */
export function baseDamage(atk: number, m: BattleMove, defPrimary: Element, crit: boolean, varianceThousandths: number): number {
  const em2 = elementMultiplier(m.element, defPrimary) * 2
  if (em2 === 0) return 0
  const n = atk * m.multPct * em2 * (crit ? 3 : 2) * varianceThousandths
  return Math.max(1, Math.floor(n / (100 * 2 * 2 * 1000)))
}

/** Exactly two draws, even when immune: rng.int(100) for crit, then rng.int(201) for variance. */
export function rollDamage(atk: number, m: BattleMove, defPrimary: Element, rng: Rng):
  { amount: number; multiplier: Mult; crit: boolean; immune: boolean } {
  const crit = rng.int(100) < CRIT_PERCENT
  const variance = VARIANCE_MIN + rng.int(VARIANCE_MAX - VARIANCE_MIN + 1)
  const multiplier = elementMultiplier(m.element, defPrimary)
  return { amount: baseDamage(atk, m, defPrimary, crit, variance), multiplier, crit, immune: multiplier === 0 }
}
