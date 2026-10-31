import { getSpecies, type Catalog, type Species } from '../catalog'
import { TURN_LIMIT } from '../data/battle'
import type { Mult } from '../elements'
import type { Rng } from '../rng'
import { rollDamage } from './damage'
import { moveUnlocked, movesFor, type BattleMove } from './moves'
import { combatStats, type BattleDragonSpec, type CombatStats } from './stats'

export type Side = 'attacker' | 'defender'

/** `move` is a kit slot (0 Physical, 1 to 3 the tiers); `to` is a team slot. There is no target: a move hits the other side's active. */
export type PlayerMove = { kind: 'attack'; move: number } | { kind: 'swap'; to: number } | { kind: 'replace'; to: number }

export interface Fighter {
  spec: BattleDragonSpec
  species: Species
  stats: CombatStats
  hp: number
  moves: readonly BattleMove[]
  /** Used Tier 3 on this dragon's last action. */
  t3Cooling: boolean
}

export interface BattleState {
  sides: Record<Side, { team: Fighter[]; active: number }>
  /** Attacks and swaps so far, both sides (R63). */
  turn: number
  /** The side that must move next: while `awaiting` is 'replace', the side that has to replace. */
  toAct: Side
  awaiting: 'action' | 'replace'
  log: BattleEvent[]
  winner: Side | null
}

/**
 * `turn` is the turn the event belongs to: an attack or swap is the turn it used, a replacement is
 * the turn whose KO it answers. `target` is the slot on the other side.
 */
export type BattleEvent =
  | { kind: 'attack'; turn: number; side: Side; slot: number; move: number; target: number; damage: number; multiplier: Mult; crit: boolean; immune: boolean; ko: boolean }
  | { kind: 'swap' | 'replace'; turn: number; side: Side; from: number; to: number }

export type BattleOutcome =
  | { ok: true; winner: Side; turns: number; log: BattleEvent[]; attacker: number[]; defender: number[]; attackerKos: number }
  | { ok: false; error: 'ILLEGAL_MOVE' | 'MISSING_MOVES'; at: number }

export const otherSide = (side: Side): Side => (side === 'attacker' ? 'defender' : 'attacker')

/** Both first dragons active, the attacker to act (§6.1). Entering with a dragon at 0 HP or less is a programming error. */
export function initBattle(attacker: readonly BattleDragonSpec[], defender: readonly BattleDragonSpec[], c: Catalog): BattleState {
  const build = (specs: readonly BattleDragonSpec[]): { team: Fighter[]; active: number } => {
    if (specs.length === 0) throw new Error('initBattle: an empty team')
    return {
      active: 0,
      team: specs.map(spec => {
        if (spec.hp !== undefined && spec.hp <= 0) throw new Error(`initBattle: ${spec.speciesId} entered with hp ${spec.hp}`)
        const species = getSpecies(c, spec.speciesId)
        const stats = combatStats(spec, c)
        return { spec, species, stats, hp: Math.min(spec.hp ?? stats.hp, stats.hp), moves: movesFor(species), t3Cooling: false }
      }),
    }
  }
  return { sides: { attacker: build(attacker), defender: build(defender) }, turn: 0, toAct: 'attacker', awaiting: 'action', log: [], winner: null }
}

/** Every move `side` may make now, attacks by slot then swaps by slot; empty when it isn't that side's move. */
export function legalMoves(b: BattleState, side: Side): PlayerMove[] {
  if (b.winner !== null || side !== b.toAct) return []
  const { team, active } = b.sides[side]
  const bench = team.flatMap((f, i) => (f.hp > 0 && i !== active ? [i] : []))
  if (b.awaiting === 'replace') return bench.map(to => ({ kind: 'replace', to }))
  const actor = team[active]!
  const attacks = actor.moves.flatMap((m, move): PlayerMove[] =>
    moveUnlocked(m, actor.spec.level) && !(m.tier === 3 && actor.t3Cooling) ? [{ kind: 'attack', move }] : [])
  return [...attacks, ...bench.map((to): PlayerMove => ({ kind: 'swap', to }))]
}

const sameMove = (a: PlayerMove, b: PlayerMove): boolean =>
  a.kind === 'attack' ? b.kind === 'attack' && a.move === b.move : a.kind === b.kind && a.to === (b as { to: number }).to

/** The limit is checked only here, once any KO has been answered: both sides are alive at this point. */
const nextTurn = (b: BattleState, toAct: Side): BattleState =>
  (b.turn >= TURN_LIMIT ? { ...b, winner: 'defender' } : { ...b, toAct, awaiting: 'action' })

/** Applies one move; null if it's illegal, having drawn nothing. Pure: `b` is left as it was. */
export function step(b: BattleState, side: Side, m: PlayerMove, rng: Rng): BattleState | null {
  if (!legalMoves(b, side).some(x => sameMove(x, m))) return null
  const me = b.sides[side]
  const foeSide = otherSide(side)
  const withMe = (patch: Partial<BattleState['sides'][Side]>) => ({ ...b.sides, [side]: { ...me, ...patch } })

  if (m.kind === 'replace') {
    const log: BattleEvent[] = [...b.log, { kind: 'replace', turn: b.turn, side, from: me.active, to: m.to }]
    // The KO came on the other side's turn, so the side that replaced now has the turn too.
    return nextTurn({ ...b, sides: withMe({ active: m.to }), log }, side)
  }

  const turn = b.turn + 1
  if (m.kind === 'swap') {
    const team = me.team.map((f, i) => (i === me.active ? { ...f, t3Cooling: false } : f)) // R64
    const log: BattleEvent[] = [...b.log, { kind: 'swap', turn, side, from: me.active, to: m.to }]
    return nextTurn({ ...b, sides: withMe({ team, active: m.to }), turn, log }, foeSide)
  }

  const actor = me.team[me.active]!
  const move = actor.moves[m.move]!
  const foe = b.sides[foeSide]
  const target = foe.team[foe.active]!
  const hit = rollDamage(actor.stats.atk, move, target.species.elements[0]!, rng)
  const hp = Math.max(0, target.hp - hit.amount)
  const ko = hp === 0
  const foeTeam = foe.team.map((f, i) => (i === foe.active ? { ...f, hp } : f))
  const myTeam = me.team.map((f, i) => (i === me.active ? { ...f, t3Cooling: move.tier === 3 } : f))
  const log: BattleEvent[] = [...b.log, {
    kind: 'attack', turn, side, slot: me.active, move: m.move, target: foe.active,
    damage: hit.amount, multiplier: hit.multiplier, crit: hit.crit, immune: hit.immune, ko,
  }]
  const after: BattleState = { ...b, sides: { ...b.sides, [side]: { ...me, team: myTeam }, [foeSide]: { ...foe, team: foeTeam } }, turn, log }
  if (!ko) return nextTurn(after, foeSide)
  if (!foeTeam.some(f => f.hp > 0)) return { ...after, winner: side }
  return { ...after, toAct: foeSide, awaiting: 'replace' }
}

/** The result of a finished battle. */
export function battleOutcome(b: BattleState): Extract<BattleOutcome, { ok: true }> {
  if (b.winner === null) throw new Error('battleOutcome: the battle is not over')
  const hps = (side: Side) => b.sides[side].team.map(f => f.hp)
  const attacker = hps('attacker')
  return { ok: true, winner: b.winner, turns: b.turn, log: b.log, attacker, defender: hps('defender'), attackerKos: attacker.filter(h => h === 0).length }
}
