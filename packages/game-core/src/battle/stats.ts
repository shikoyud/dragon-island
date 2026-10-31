import { getSpecies, type Catalog } from '../catalog'
import { atkAt, hpAt } from '../rarity'

export interface BattleDragonSpec {
  speciesId: string
  level: number
  /** Starting HP; full if absent. */
  hp?: number
}
export interface CombatStats { hp: number; atk: number }

/** GDD §2.4: HP and ATK come from the rarity curve (R6). */
export function combatStats(spec: BattleDragonSpec, c: Catalog): CombatStats {
  const sp = getSpecies(c, spec.speciesId)
  return { hp: hpAt(sp.rarity, spec.level), atk: atkAt(sp.rarity, spec.level) }
}
