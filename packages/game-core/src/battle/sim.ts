import type { Catalog } from '../catalog'
import type { Rng } from '../rng'
import type { BattleOutcome, PlayerMove } from './machine'
import { battlePreview } from './preview'
import type { BattleDragonSpec } from './stats'

/**
 * Deterministic 3v3 (A8): the attacker's moves come from `moves`, one per action or replacement, the
 * defender is `aiChoice`. A list that runs out is MISSING_MOVES. Moves after the end are ignored.
 */
export function simulateBattle(
  attacker: readonly BattleDragonSpec[], defender: readonly BattleDragonSpec[], moves: readonly PlayerMove[], rng: Rng, c: Catalog,
): BattleOutcome {
  return battlePreview(attacker, defender, moves, rng, c).done ?? { ok: false, error: 'MISSING_MOVES', at: moves.length }
}
