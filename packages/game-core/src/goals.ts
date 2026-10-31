import { getSpecies, type Catalog } from './catalog'
import { isUnfinished } from './construction'
import { GOALS, type GoalRow } from './data/goals'
import type { PlayerState } from './state'

/** The Goal waiting to be claimed, or null after the last one (§1.4). */
export function currentGoal(s: PlayerState): GoalRow | null {
  return GOALS[s.goalIndex] ?? null
}

const flag = (b: boolean): { have: number; need: number } => ({ have: b ? 1 : 0, need: 1 })

/** Progress toward a Goal, read from state and counters only; `have` never exceeds `need` (R37). */
export function goalProgress(s: PlayerState, g: GoalRow, c: Catalog): { have: number; need: number } {
  const d = g.done
  switch (d.kind) {
    case 'stat': return { have: Math.min(s.goalStats[d.stat], d.need), need: d.need }
    case 'dragonLevel': return { have: Math.min(s.dragons.filter(x => x.level >= d.need).length, d.count), need: d.count }
    case 'discovered': return { have: Math.min(s.discovered.length, d.need), need: d.need }
    case 'habitatsOf': return flag(s.habitats.some(h => (d.elements as readonly string[]).includes(h.element) && !isUnfinished(s, { type: 'habitat', id: h.id })))
    case 'dragonOf': return flag(s.dragons.some(x => {
      const e = getSpecies(c, x.speciesId).elements
      return e.length === 1 && d.elements.includes(e[0]!)
    }))
    case 'firstHybrid': return flag(s.firstHybridDone)
    case 'farms': return { have: Math.min(s.farms.filter((_, i) => !isUnfinished(s, { type: 'farm', index: i })).length, d.need), need: d.need }
    case 'hatchery': return { have: Math.min(s.hatcheryLevel, d.need), need: d.need }
    case 'roost': return { have: Math.min(s.roostTier, d.need), need: d.need }
    case 'level': return { have: Math.min(s.level, d.need), need: d.need }
  }
}
