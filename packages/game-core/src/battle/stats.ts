import { getSpecies, type Catalog, type Species } from '../catalog'
import { elementMultiplier, type MoveElement, type Mult } from '../elements'
import { atkAt, hpAt } from '../rarity'
import type { Rng } from '../rng'

export interface BattleDragonSpec { speciesId: string; level: number }
export interface CombatStats { hp: number; atk: number }
export interface BattleMove { name: string; element: MoveElement; powerPct: number }

export const ELEMENT_MOVE_POWER_PCT = 100
export const STRIKE: BattleMove = { name: 'Strike', element: 'physical', powerPct: 80 }

/** GDD §2.4: HP and ATK come from the rarity curve (R6). There is no SPD until M5. */
export function combatStats(spec: BattleDragonSpec, c: Catalog): CombatStats {
  const sp = getSpecies(c, spec.speciesId)
  return { hp: hpAt(sp.rarity, spec.level), atk: atkAt(sp.rarity, spec.level) }
}

/** One move per element; pure dragons also get the Physical Strike. */
export function movesFor(sp: Species): BattleMove[] {
  const moves: BattleMove[] = sp.elements.map(e => ({ name: e, element: e, powerPct: ELEMENT_MOVE_POWER_PCT }))
  if (sp.elements.length === 1) moves.push(STRIKE)
  return moves
}

/** One rng.next() per call: roll uniform in [0.9, 1.1]. A 0x hit deals 0; any other hit deals at least 1. */
export function damage(atk: number, move: BattleMove, defender: Species, rng: Rng): { amount: number; multiplier: Mult } {
  const multiplier = elementMultiplier(move.element, defender.elements[0]!)
  const roll = 0.9 + 0.2 * rng.next()
  return { amount: multiplier === 0 ? 0 : Math.max(1, Math.floor(atk * move.powerPct * multiplier * roll / 100)), multiplier }
}
