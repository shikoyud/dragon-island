// GDD §1.4, §4.3, §5.7. R36: the 14 Goals are ours, XP in §4.3's 25-500 range (classic, before the preset's xpMult).
import type { Element } from '../elements'
import type { GoalStats } from '../state'

export type GoalCheck =
  | { kind: 'stat'; stat: keyof GoalStats; need: number }
  /** `count` dragons at level `need` or more. */
  | { kind: 'dragonLevel'; need: number; count: number }
  /** Species in the Dragon Book. */
  | { kind: 'discovered'; need: number }
  /** A finished habitat of any listed element. */
  | { kind: 'habitatsOf'; elements: readonly Element[] }
  /** An owned Basic of any listed element. */
  | { kind: 'dragonOf'; elements: readonly Element[] }
  /** The scripted first hybrid has been bred (§3.5). */
  | { kind: 'firstHybrid' }
  /** Finished farm plots. */
  | { kind: 'farms'; need: number }
  | { kind: 'hatchery'; need: number }
  | { kind: 'roost'; need: number }
  | { kind: 'level'; need: number }

export interface GoalRow { id: string; text: string; xp: number; gold: number; done: GoalCheck }

const row = (n: number, text: string, xp: number, gold: number, done: GoalCheck): GoalRow => ({ id: `goal${n}`, text, xp, gold, done })

export const GOALS: readonly GoalRow[] = [
  row(1, 'Collect Gold from a habitat', 25, 200, { kind: 'stat', stat: 'collects', need: 1 }),
  row(2, 'Plant and harvest a Dragon Bush', 25, 100, { kind: 'stat', stat: 'harvests', need: 1 }),
  row(3, 'Feed a dragon', 25, 100, { kind: 'stat', stat: 'feeds', need: 1 }),
  row(4, 'Raise two dragons to level 4', 50, 500, { kind: 'dragonLevel', need: 4, count: 2 }),
  row(5, 'Breed your first hybrid', 75, 500, { kind: 'firstHybrid' }),
  row(6, 'Hatch an egg', 75, 1_000, { kind: 'stat', stat: 'hatches', need: 1 }),
  row(7, 'Build a Sea or Nature habitat', 100, 2_000, { kind: 'habitatsOf', elements: ['sea', 'nature'] }),
  row(8, 'Buy a Sea or Nature Basic', 100, 2_000, { kind: 'dragonOf', elements: ['sea', 'nature'] }),
  row(9, 'Build a second farm', 100, 2_000, { kind: 'farms', need: 2 }),
  row(10, 'Upgrade the Hatchery', 100, 2_000, { kind: 'hatchery', need: 2 }),
  row(11, 'Build the Dragon Roost', 200, 5_000, { kind: 'roost', need: 1 }),
  row(12, 'Raise a dragon to level 10', 200, 10_000, { kind: 'dragonLevel', need: 10, count: 1 }),
  row(13, 'Find 10 species in the Dragon Book', 300, 20_000, { kind: 'discovered', need: 10 }),
  row(14, 'Upgrade the Roost to Tier 2', 500, 40_000, { kind: 'roost', need: 2 }),
]
