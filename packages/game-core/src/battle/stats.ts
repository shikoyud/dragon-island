import { getSpecies, type Catalog, type Species } from '../catalog'
import { elementMultiplier, type Element } from '../elements'
import { RARITY } from '../rarity'
import type { Rng } from '../rng'

export interface BattleDragonSpec { speciesId: string; level: number }
export interface CombatStats { hp: number; atk: number; spd: number }
export interface BattleMove { name: string; element: Element | 'neutral'; powerPct: number }

export const ELEMENT_MOVE_POWER_PCT = 100
export const STRIKE: BattleMove = { name: 'Strike', element: 'neutral', powerPct: 80 }

/** Spec §10: HP = floor((100 + 20L) × mult), ATK = floor((10 + 3L) × mult), SPD = baseSpeed + L. */
export function combatStats(spec: BattleDragonSpec, c: Catalog): CombatStats {
  const sp = getSpecies(c, spec.speciesId)
  const pct = RARITY[sp.rarity].statPct
  return {
    hp: Math.floor((100 + 20 * spec.level) * pct / 100),
    atk: Math.floor((10 + 3 * spec.level) * pct / 100),
    spd: sp.baseSpeed + spec.level,
  }
}

/** One move per element; pure dragons also get neutral Strike. */
export function movesFor(sp: Species): BattleMove[] {
  const moves: BattleMove[] = sp.elements.map(e => ({ name: e, element: e, powerPct: ELEMENT_MOVE_POWER_PCT }))
  if (sp.elements.length === 1) moves.push(STRIKE)
  return moves
}

/** One rng.next() per call: roll uniform in [0.9, 1.1]. */
export function damage(atk: number, move: BattleMove, defender: Species, rng: Rng): { amount: number; multiplier: 2 | 1 | 0.5 } {
  const multiplier = elementMultiplier(move.element, defender.elements[0]!)
  const roll = 0.9 + 0.2 * rng.next()
  return { amount: Math.max(1, Math.floor(atk * move.powerPct * multiplier * roll / 100)), multiplier }
}
