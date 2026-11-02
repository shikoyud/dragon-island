import { goalProgress, GOALS, LAUNCH_CATALOG, type Catalog, type GoalRow, type PlayerState, type Preset } from '@wyrmhaven/game-core'
import type { DialogKey } from '../hud/Hud'
import type { IconName } from '../hud/Icon'

export interface GoalRoute { label: string; to: DialogKey }

const habitatRoute = (s: PlayerState): GoalRoute | null => {
  const h = s.habitats.find(x => !x.stored && s.dragons.some(d => d.habitatId === x.id))
  return h ? { label: 'Habitat', to: { kind: 'info', target: { type: 'habitat', id: h.id } } } : null
}
const dragonRoute = (s: PlayerState): GoalRoute | null => {
  const d = s.dragons.find(x => !x.stored && x.habitatId !== null)
  return d ? { label: 'Dragon', to: { kind: 'target', target: { kind: 'dragon', id: d.id } } } : null
}

/** A one-tap route from a Goal to where it is done, when there is an obvious place. */
export function goalRoute(g: GoalRow, s: PlayerState): GoalRoute | null {
  switch (g.done.kind) {
    case 'stat':
      if (g.done.stat === 'harvests') return { label: 'Farm', to: { kind: 'target', target: { kind: 'farm', plot: 0 } } }
      if (g.done.stat === 'hatches') return { label: 'Hatchery', to: { kind: 'target', target: { kind: 'hatcheryBuilding' } } }
      if (g.done.stat === 'collects') return habitatRoute(s)
      if (g.done.stat === 'feeds') return dragonRoute(s)
      return null
    case 'dragonLevel': return dragonRoute(s)
    case 'hatchery': return { label: 'Hatchery', to: { kind: 'target', target: { kind: 'hatcheryBuilding' } } }
    case 'firstHybrid': return { label: 'Breeding', to: { kind: 'panel', id: 'breed' } }
    case 'discovered': return { label: 'Dragon Book', to: { kind: 'panel', id: 'book' } }
    case 'roost':
      // The Roost if it stands (to upgrade it), else the Shop's Build tab where it is bought.
      return s.roostPlacement ? { label: 'Roost', to: { kind: 'upgrade', target: { type: 'roost' } } } : { label: 'Shop', to: { kind: 'panel', id: 'shop', tab: 'build' } }
    case 'habitatsOf': return { label: 'Shop', to: { kind: 'panel', id: 'shop', category: 'habitats' } }
    case 'dragonOf': return { label: 'Shop', to: { kind: 'panel', id: 'shop', category: 'dragons' } }
    case 'farms': return { label: 'Shop', to: { kind: 'panel', id: 'shop', category: 'farms' } }
    default: return null
  }
}

/** Our own one-line hints under each Goal's title. */
function hintOf(g: GoalRow): string {
  const d = g.done
  switch (d.kind) {
    case 'stat':
      return { collects: 'Tap a habitat to collect the gold its dragons earn.', harvests: 'Plant a crop at the Farm and come back when it is ripe.',
        feeds: 'Food makes dragons grow.', breeds: 'Two dragons at the Breeding Mountain leave an egg.', hatches: 'Eggs hatch in the Hatchery.' }[d.stat]
    case 'dragonLevel': return 'Dragons earn more gold as they grow.'
    case 'firstHybrid': return 'Pair two different elements at the Breeding Mountain.'
    case 'discovered': return 'Every new species joins the Dragon Book.'
    case 'habitatsOf': return 'New elements need a home of their own.'
    case 'dragonOf': return 'Basic dragons are sold in the Shop.'
    case 'farms': return 'More farms, more food.'
    case 'hatchery': return 'More nest slots for your eggs.'
    case 'roost': return 'The Roost lets dragons train past their limits.'
    case 'level': return 'Goals, building and breeding all give XP.'
  }
}

function iconOf(g: GoalRow): IconName {
  const d = g.done
  switch (d.kind) {
    case 'stat': return ({ collects: 'collect', harvests: 'growFood', feeds: 'food', breeds: 'breed', hatches: 'hatch' } as const)[d.stat]
    case 'dragonLevel': return 'xp'
    case 'firstHybrid': return 'breed'
    case 'discovered': return 'book'
    case 'habitatsOf': return 'build'
    case 'dragonOf': return 'dragons'
    case 'farms': return 'growFood'
    case 'hatchery': return 'hatch'
    case 'roost': return 'upgrade'
    case 'level': return 'xp'
  }
}

/** One row of the Goals dialog (design, Phase 5: task). Goals come one at a time (§1.4): Claim or Go only on the current one. */
export interface GoalView {
  id: string
  index: number
  title: string
  hint: string
  icon: IconName
  /** After the preset multiplier. */
  xp: number
  gold: number
  have: number
  need: number
  state: 'done' | 'claim' | 'go' | 'later'
  route: GoalRoute | null
}

export function goalRows(s: PlayerState, preset: Preset, catalog: Catalog = LAUNCH_CATALOG): GoalView[] {
  return GOALS.map((g, index) => {
    const current = index === s.goalIndex
    const p = current ? goalProgress(s, g, catalog) : { have: index < s.goalIndex ? 1 : 0, need: 1 }
    const state = index < s.goalIndex ? 'done' : !current ? 'later' : p.have >= p.need ? 'claim' : 'go'
    return { id: g.id, index, title: g.text, hint: hintOf(g), icon: iconOf(g), xp: g.xp * preset.xpMult, gold: g.gold, have: p.have, need: p.need, state, route: goalRoute(g, s) }
  })
}

/** Recommended: the current Goal and the two after it. */
export const recommendedRows = (rows: readonly GoalView[]): GoalView[] => {
  const i = rows.findIndex(r => r.state === 'claim' || r.state === 'go')
  return i < 0 ? [] : rows.slice(i, i + 3)
}
