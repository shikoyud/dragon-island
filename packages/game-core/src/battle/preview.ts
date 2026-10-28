import { getSpecies, type Catalog } from '../catalog'
import type { Rng } from '../rng'
import {
  aiMove, isLegalMove, MAX_ROUNDS, turnOrder, type BattleEvent, type BattleOutcome, type Combatant, type PlayerMove, type Side,
} from './sim'
import { combatStats, damage, movesFor, type BattleDragonSpec } from './stats'

export interface BattlePreview {
  log: BattleEvent[]
  attacker: Combatant[]
  defender: Combatant[]
  /** Round in progress when the preview stopped (or the final round). */
  round: number
  /** The attacker who needs a move next, or null when the battle is decided or a move was illegal. */
  next: { side: Side; slot: number } | null
  /** The full outcome once every needed move is present (or the error for a bad move). */
  done: BattleOutcome | null
}

/** First 4 bytes of a 0x-hex seed as the uint32 `createRng` takes (same rule as the server). */
export function battleSeed32(seedHex: string): number {
  return parseInt(seedHex.replace(/^0x/, '').slice(0, 8), 16) >>> 0
}

const other = (side: Side): Side => (side === 'attacker' ? 'defender' : 'attacker')

/**
 * Replays exactly like `simulateBattle` with the moves given so far and stops at the first attacker
 * action that has no move, exposing the live combatants so a client can pick the next move. With a
 * complete move list it returns the same outcome `simulateBattle` would.
 */
export function battlePreview(
  attacker: readonly BattleDragonSpec[], defender: readonly BattleDragonSpec[], moves: readonly PlayerMove[], rng: Rng, c: Catalog,
): BattlePreview {
  const build = (specs: readonly BattleDragonSpec[]): Combatant[] => specs.map(spec => {
    const species = getSpecies(c, spec.speciesId)
    const stats = combatStats(spec, c)
    return { spec, species, stats, hp: stats.hp, moves: movesFor(species) }
  })
  const sides: Record<Side, Combatant[]> = { attacker: build(attacker), defender: build(defender) }
  const alive = (side: Side) => sides[side].some(x => x.hp > 0)
  const log: BattleEvent[] = []
  let cursor = 0
  const snapshot = (round: number, next: BattlePreview['next'], done: BattleOutcome | null): BattlePreview =>
    ({ log, attacker: sides.attacker, defender: sides.defender, round, next, done })
  const finish = (winner: Side, rounds: number): BattleOutcome =>
    ({ ok: true, winner, rounds, log, attacker: sides.attacker.map(x => x.hp), defender: sides.defender.map(x => x.hp) })

  for (let round = 1; round <= MAX_ROUNDS; round++) {
    for (const { side, slot } of turnOrder(sides.attacker, sides.defender)) {
      const actor = sides[side][slot]!
      if (actor.hp <= 0) continue
      const targets = sides[other(side)]
      let pm: PlayerMove
      if (side === 'defender') {
        pm = aiMove(actor, targets)
      } else {
        const next = moves[cursor]
        if (next === undefined) return snapshot(round, { side, slot }, null)
        if (!isLegalMove(actor, targets, next)) return snapshot(round, null, { ok: false, error: 'ILLEGAL_MOVE', at: cursor })
        pm = next
        cursor++
      }
      const victim = targets[pm.target]!
      const hit = damage(actor.stats.atk, actor.moves[pm.move]!, victim.species, rng)
      victim.hp = Math.max(0, victim.hp - hit.amount)
      log.push({ round, side, slot, move: pm.move, target: pm.target, damage: hit.amount, multiplier: hit.multiplier, ko: victim.hp === 0 })
      if (!alive(other(side))) return snapshot(round, null, finish(side, round))
    }
  }
  return snapshot(MAX_ROUNDS, null, finish('defender', MAX_ROUNDS))
}
