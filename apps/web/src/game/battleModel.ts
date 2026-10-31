import { stageOf, TURN_LIMIT, type BattleEvent, type BattleState, type Element, type Side } from '@wyrmhaven/game-core'

/** The next event after your action shows this long after the last one (§6.1 alternates; R80). None with reduced motion. */
export const PLAYBACK_STEP_MS = 600

/** The events `next` adds to `prev`, in order. A shorter log (nothing the machine produces) has nothing to play. */
export function playbackQueue(prev: readonly BattleEvent[], next: readonly BattleEvent[]): BattleEvent[] {
  return next.slice(prev.length)
}

/** What the screen shows once `shown` log events have played: the truth is the log, and an event not yet played changes nothing. */
export interface BattleView {
  hp: Record<Side, number[]>
  active: Record<Side, number>
  /** Turns used so far (R63). */
  turn: number
  last: BattleEvent | null
}

export function battleView(state: BattleState, shown: number): BattleView {
  const entry = (side: Side) => state.sides[side].team.map(f => Math.min(f.spec.hp ?? f.stats.hp, f.stats.hp))
  const view: BattleView = { hp: { attacker: entry('attacker'), defender: entry('defender') }, active: { attacker: 0, defender: 0 }, turn: 0, last: null }
  for (const e of state.log.slice(0, Math.max(0, shown))) {
    view.last = e
    view.turn = e.turn
    if (e.kind === 'attack') {
      const foe = e.side === 'attacker' ? view.hp.defender : view.hp.attacker
      foe[e.target] = Math.max(0, foe[e.target]! - e.damage)
    } else {
      view.active[e.side] = e.to
    }
  }
  return view
}

/** The turn being played, so a battle that ends on Turn 8 has met an 8-turn goal; when `over`, the turns it took. */
export function turnLabel(turnsUsed: number, over: boolean): string {
  return `Turn ${over ? turnsUsed : Math.min(turnsUsed + 1, TURN_LIMIT)} / ${TURN_LIMIT}`
}

/**
 * Whether a side's sprite flips so the dragons face each other: yours to the right, the enemy to the left. Juvenile and adult
 * sheets face left and hatchling sheets right (read from all 222 dragon sheets in art v1).
 */
export function dragonFlip(side: Side, level: number): boolean {
  const facesRight = stageOf(level) === 'baby'
  return side === 'attacker' ? !facesRight : facesRight
}

const TINT_SUPER = 0xffa030
const TINT_WEAK = 0x7f9cff

export interface HitFx {
  /** A damage number, or `IMMUNE` with no number at all (§6.2). */
  text: string
  /** The target's tint for this hit; null at 1x and on an immune hit. */
  tint: number | null
  /** The floating text's colour. */
  colour: string
  label: '2x' | '0.5x' | null
  crit: boolean
  ko: boolean
}

export function hitFx(e: Extract<BattleEvent, { kind: 'attack' }>): HitFx {
  if (e.immune) return { text: 'IMMUNE', tint: null, colour: '#c9d1e8', label: null, crit: false, ko: false }
  const up = e.multiplier === 2
  const down = e.multiplier === 0.5
  return {
    text: `-${e.damage}`,
    tint: up ? TINT_SUPER : down ? TINT_WEAK : null,
    colour: up ? '#ffc060' : down ? '#a9bcff' : '#ffffff',
    label: up ? '2x' : down ? '0.5x' : null,
    crit: e.crit,
    ko: e.ko,
  }
}

/** One line for each event: the same facts as the scene's effects, for screen readers and reduced motion. */
export function battleLine(state: BattleState, e: BattleEvent): string {
  const who = (side: Side, slot: number) => `${side === 'defender' ? 'Enemy ' : ''}${state.sides[side].team[slot]!.species.name}`
  if (e.kind !== 'attack') return `${who(e.side, e.to)} ${e.kind === 'swap' ? 'swaps in' : 'enters'}`
  const name = state.sides[e.side].team[e.slot]!.moves[e.move]!.name
  const head = `${who(e.side, e.slot)}: ${name}`
  if (e.immune) return `${head}, IMMUNE`
  const parts = [`${head}, ${e.damage} damage`]
  if (e.multiplier !== 1) parts.push(`${e.multiplier}x`)
  if (e.crit) parts.push('critical')
  const foe: Side = e.side === 'attacker' ? 'defender' : 'attacker'
  return `${parts.join(', ')}${e.ko ? `. ${who(foe, e.target)} is out` : ''}`
}

export type PipState = 'alive' | 'hurt' | 'ko'

export const pipState = (hp: number, max: number): PipState => (hp <= 0 ? 'ko' : hp < max ? 'hurt' : 'alive')

export interface BackdropFill { sky: number; ground: number; platform: number; rim: number }

/** `battle.backdrop.<element>` has no art yet: a fill by chapter element. Dark enough for white text on it. */
const BACKDROPS: Record<Element, BackdropFill> = {
  terra: { sky: 0x3a2c22, ground: 0x4f3a28, platform: 0x7a5a3c, rim: 0x2a1e14 },
  flame: { sky: 0x3d1a14, ground: 0x55241a, platform: 0x8a3f26, rim: 0x2a100a },
  sea: { sky: 0x14304a, ground: 0x1a4464, platform: 0x2f6f94, rim: 0x0c2032 },
  nature: { sky: 0x1b3a22, ground: 0x265030, platform: 0x3f7f4a, rim: 0x102414 },
  electric: { sky: 0x3a3414, ground: 0x4e461a, platform: 0x8a7c2c, rim: 0x26220a },
  ice: { sky: 0x233f50, ground: 0x2f566c, platform: 0x6a9db4, rim: 0x162a36 },
  metal: { sky: 0x2a3036, ground: 0x3a4249, platform: 0x68727c, rim: 0x1a1e22 },
  dark: { sky: 0x1e1833, ground: 0x2b2247, platform: 0x4d3f7a, rim: 0x120e20 },
  light: { sky: 0x48442a, ground: 0x5e5936, platform: 0x9c9560, rim: 0x2e2b18 },
  war: { sky: 0x3a1218, ground: 0x501a22, platform: 0x842c3a, rim: 0x260a0e },
}
const ARENA: BackdropFill = { sky: 0x1b2140, ground: 0x232b52, platform: 0x3b4680, rim: 0x0f1324 }

/** A Trial's fill by its chapter's element; null is the Arena. */
export const backdropFill = (element: Element | null): BackdropFill => (element ? BACKDROPS[element] : ARENA)
