import type { Species } from '../catalog'
import type { Element } from '../data/elements'
import { MOVE_MIN_LEVEL, MOVE_MULT_PCT, MOVE_NAMES, PHYSICAL_MOVE_NAME, type MoveTier } from '../data/moves'
import type { MoveElement } from '../elements'

export interface BattleMove { name: string; element: MoveElement; tier: MoveTier; multPct: number; minLevel: number }

/**
 * §6.1 / A17 fixed kit, always 4 entries in slot order Physical, T1, T2, T3.
 * One element: all three tiers in it. Two: primary, secondary, primary. Three: primary, secondary, third.
 */
export function movesFor(sp: Species): readonly BattleMove[] {
  const [e0, e1, e2] = sp.elements
  const tierEl: Record<1 | 2 | 3, Element> = { 1: e0!, 2: e1 ?? e0!, 3: e2 ?? e0! }
  const physical: BattleMove = {
    name: PHYSICAL_MOVE_NAME, element: 'physical', tier: 'physical',
    multPct: MOVE_MULT_PCT.physical, minLevel: MOVE_MIN_LEVEL.physical,
  }
  const tiers = ([1, 2, 3] as const).map((t): BattleMove => ({
    name: MOVE_NAMES[tierEl[t]][t], element: tierEl[t], tier: t,
    multPct: MOVE_MULT_PCT[t], minLevel: MOVE_MIN_LEVEL[t],
  }))
  return [physical, ...tiers]
}

export function moveUnlocked(m: BattleMove, level: number): boolean {
  return level >= m.minLevel
}
