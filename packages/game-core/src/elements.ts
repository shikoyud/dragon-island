import { ELEMENTS, ELEMENT_TIER, OPPOSITE_PAIRS, STRONG_AGAINST, type Element, type ElementTier } from './data/elements'

export * from './data/elements'

/** A move's element: one of the ten, or Physical, which is always 1x (§2.1). */
export type MoveElement = Element | 'physical'
export type Mult = 0 | 0.5 | 1 | 2

/**
 * §2.1 rules, in order: Physical is 1x, an element is 0x to itself, then strong beats resisted,
 * which is what makes Dark and Light 2x against each other.
 */
export function elementMultiplier(move: MoveElement, defenderPrimary: Element): Mult {
  if (move === 'physical') return 1
  if (move === defenderPrimary) return 0
  if (STRONG_AGAINST[move].includes(defenderPrimary)) return 2
  if (STRONG_AGAINST[defenderPrimary].includes(move)) return 0.5
  return 1
}

/** §2.2: rows attack, columns defend. */
export const DAMAGE_MATRIX: Record<Element, Record<Element, Mult>> = Object.fromEntries(
  ELEMENTS.map(atk => [atk, Object.fromEntries(ELEMENTS.map(def => [def, elementMultiplier(atk, def)]))]),
) as Record<Element, Record<Element, Mult>>

export function isOpposite(a: Element, b: Element): boolean {
  return OPPOSITE_PAIRS.some(([x, y]) => (x === a && y === b) || (x === b && y === a))
}

/** The tier that sets a breed timer: C over B over A (§3.5). */
export function highestTier(elements: readonly Element[]): ElementTier {
  const tiers = elements.map(e => ELEMENT_TIER[e])
  return tiers.includes('C') ? 'C' : tiers.includes('B') ? 'B' : 'A'
}
