import type { Catalog } from '../catalog'
import type { Rng } from '../rng'
import { runDefender } from './ai'
import { battleOutcome, initBattle, step, type BattleOutcome, type BattleState, type PlayerMove } from './machine'
import type { BattleDragonSpec } from './stats'

export interface BattlePreview {
  /** Where the battle stands after the moves given, the defender's reply included. */
  state: BattleState
  /** The outcome once the battle is decided, the error for an illegal move, null while the attacker still has to move. */
  done: BattleOutcome | null
}

/** First 4 bytes of a 0x-hex seed as the uint32 `createRng` takes (same rule as the server). */
export function battleSeed32(seedHex: string): number {
  return parseInt(seedHex.replace(/^0x/, '').slice(0, 8), 16) >>> 0
}

/**
 * Plays the moves given and stops where the attacker has to move next, so a client can pick from
 * `legalMoves(state, 'attacker')`. Moves after the battle's end are ignored. `simulateBattle` is this
 * with a list that has to be complete, so there is one replay of a move list and not two.
 */
export function battlePreview(
  attacker: readonly BattleDragonSpec[], defender: readonly BattleDragonSpec[], moves: readonly PlayerMove[], rng: Rng, c: Catalog,
): BattlePreview {
  let state = runDefender(initBattle(attacker, defender, c), rng)
  for (let at = 0; state.winner === null; at++) {
    const m = moves[at]
    if (m === undefined) return { state, done: null }
    const next = step(state, 'attacker', m, rng)
    if (!next) return { state, done: { ok: false, error: 'ILLEGAL_MOVE', at } }
    state = runDefender(next, rng)
  }
  return { state, done: battleOutcome(state) }
}
