import { getSpecies, type Catalog, type Species } from '../catalog'
import { elementMultiplier } from '../elements'
import type { Rng } from '../rng'
import { combatStats, damage, movesFor, type BattleDragonSpec, type BattleMove, type CombatStats } from './stats'

export const MAX_ROUNDS = 30
export const TEAM_SIZE = 3

/** `move` indexes the acting dragon's `movesFor` list; `target` is a defender slot 0–2. */
export interface PlayerMove { move: number; target: number }
export interface Combatant { spec: BattleDragonSpec; species: Species; stats: CombatStats; hp: number; moves: BattleMove[] }
export type Side = 'attacker' | 'defender'
export interface BattleEvent {
  round: number; side: Side; slot: number; move: number; target: number; damage: number; multiplier: number; ko: boolean
}
export type BattleOutcome =
  | { ok: true; winner: Side; rounds: number; log: BattleEvent[]; attacker: number[]; defender: number[] }
  | { ok: false; error: 'ILLEGAL_MOVE' | 'MISSING_MOVES'; at: number }

const other = (side: Side): Side => (side === 'attacker' ? 'defender' : 'attacker')

/** Living combatants by SPD descending; ties → attacker first, then slot order. */
export function turnOrder(attackers: readonly Combatant[], defenders: readonly Combatant[]): { side: Side; slot: number }[] {
  const all = [
    ...attackers.map((c, slot) => ({ side: 'attacker' as Side, slot, spd: c.stats.spd, hp: c.hp, rank: 0 })),
    ...defenders.map((c, slot) => ({ side: 'defender' as Side, slot, spd: c.stats.spd, hp: c.hp, rank: 1 })),
  ]
  return all
    .filter(x => x.hp > 0)
    .sort((a, b) => b.spd - a.spd || a.rank - b.rank || a.slot - b.slot)
    .map(({ side, slot }) => ({ side, slot }))
}

export function isLegalMove(actor: Combatant, targets: readonly Combatant[], m: PlayerMove): boolean {
  if (!Number.isInteger(m.move) || !Number.isInteger(m.target)) return false
  if (m.move < 0 || m.move >= actor.moves.length) return false
  const t = targets[m.target]
  return t !== undefined && t.hp > 0
}

/** Highest multiplier move; target = lowest current HP among those giving it; ties → lowest slot / move. */
export function aiMove(actor: Combatant, targets: readonly Combatant[]): PlayerMove {
  let best: { move: number; target: number; mult: number; hp: number } | null = null
  targets.forEach((t, target) => {
    if (t.hp <= 0) return
    const primary = t.species.elements[0]!
    actor.moves.forEach((mv, move) => {
      const mult = elementMultiplier(mv.element, primary)
      if (!best || mult > best.mult || (mult === best.mult && t.hp < best.hp)) best = { move, target, mult, hp: t.hp }
    })
  })
  if (!best) return { move: 0, target: 0 }
  const { move, target } = best
  return { move, target }
}

export interface SimOptions {
  /** Replace the attacker's move list with the AI entirely (for tests). */
  attackerAi?: boolean
  /** Missing or illegal attacker moves are filled in by the AI instead of failing (PvE: the seed is secret). */
  aiFallback?: boolean
}

/**
 * Deterministic 3v3. Attacker moves come from `moves` (one per attacker action);
 * the defender is AI. One `rng.next()` per hit, nothing else. Trailing unused
 * moves are ignored. A bare boolean sixth argument means `attackerAi`.
 */
export function simulateBattle(
  attacker: readonly BattleDragonSpec[], defender: readonly BattleDragonSpec[], moves: readonly PlayerMove[],
  rng: Rng, c: Catalog, options: boolean | SimOptions = false,
): BattleOutcome {
  const { attackerAi = false, aiFallback = false } = typeof options === 'boolean' ? { attackerAi: options } : options
  const build = (specs: readonly BattleDragonSpec[]): Combatant[] => specs.map(spec => {
    const species = getSpecies(c, spec.speciesId)
    const stats = combatStats(spec, c)
    return { spec, species, stats, hp: stats.hp, moves: movesFor(species) }
  })
  const sides: Record<Side, Combatant[]> = { attacker: build(attacker), defender: build(defender) }
  const alive = (side: Side) => sides[side].some(x => x.hp > 0)
  const log: BattleEvent[] = []
  let cursor = 0

  for (let round = 1; round <= MAX_ROUNDS; round++) {
    for (const { side, slot } of turnOrder(sides.attacker, sides.defender)) {
      const actor = sides[side][slot]!
      if (actor.hp <= 0) continue
      const targets = sides[other(side)]
      let pm: PlayerMove
      if (side === 'defender' || attackerAi) {
        pm = aiMove(actor, targets)
      } else {
        const next = moves[cursor]
        if (next === undefined) {
          if (!aiFallback) return { ok: false, error: 'MISSING_MOVES', at: cursor }
          pm = aiMove(actor, targets)
        } else if (!isLegalMove(actor, targets, next)) {
          if (!aiFallback) return { ok: false, error: 'ILLEGAL_MOVE', at: cursor }
          pm = aiMove(actor, targets)
        } else {
          pm = next
        }
        cursor++
      }
      const victim = targets[pm.target]!
      const hit = damage(actor.stats.atk, actor.moves[pm.move]!, victim.species, rng)
      victim.hp = Math.max(0, victim.hp - hit.amount)
      log.push({ round, side, slot, move: pm.move, target: pm.target, damage: hit.amount, multiplier: hit.multiplier, ko: victim.hp === 0 })
      if (!alive(other(side))) return finish(side, round)
    }
  }
  return finish('defender', MAX_ROUNDS)

  function finish(winner: Side, rounds: number): BattleOutcome {
    return { ok: true, winner, rounds, log, attacker: sides.attacker.map(x => x.hp), defender: sides.defender.map(x => x.hp) }
  }
}
