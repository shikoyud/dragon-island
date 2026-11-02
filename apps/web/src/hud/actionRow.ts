import {
  clearCost, constructionFor, getSpecies, LAUNCH_CATALOG, residents, storedGold, upgradeInfo,
  type BuildingRef, type Catalog, type Footprint, type MovableRef, type PlayerState, type Preset,
} from '@wyrmhaven/game-core'
import type { ClientAction } from '@wyrmhaven/shared'
import { footprintOfMovable } from '../game/buildingInfo'
import type { Target } from '../game/bridge'
import { timerLabel } from '../game/islandModel'
import { formatGold } from '../ui/Money'
import { OBSTACLE_NAMES } from '../ui/obstacleNames'
import type { DialogKey } from './Hud'
import { breederName } from './hudModel'

/** The icon on a round action button; `dragon` is a resident's portrait. */
export type RowIcon = 'dragon' | 'getEgg' | 'collect' | 'upgrade' | 'info' | 'move' | 'hatch' | 'growFood' | 'speedUp' | 'breed' | 'clear'

/** What a button does: send an action, open a dialog, or start moving the selected thing. */
export type RowIntent =
  | { kind: 'run'; action: ClientAction }
  | { kind: 'open'; dialog: DialogKey }
  | { kind: 'move'; target: MovableRef; size: Footprint }

export interface RowButton {
  icon: RowIcon
  /** The button's accessible name and caption. */
  label: string
  intent: RowIntent
  /** Small text over the button: a timer, an amount, a price. */
  above?: string
  badge?: 'new'
  /** Why it can't be used yet, shown with a lock badge (a level gate). */
  locked?: string
  /** Why it does nothing now (nothing to collect). */
  disabled?: string
  /** A resident's portrait instead of an icon. */
  portrait?: { speciesId: string; level: number }
}

/** The row for the selected thing: its name over the last button, then the buttons left to right. */
export interface ActionRow { name: string; buttons: RowButton[] }

const open = (dialog: DialogKey): RowIntent => ({ kind: 'open', dialog })
const info = (target: Target): RowIntent => open({ kind: 'target', target })
const cap = (w: string): string => w.charAt(0).toUpperCase() + w.slice(1)

/** Upgrade, Info and Move: the tail every building's row ends with. Upgrade opens Info (ruling A2) and is left out at the top level. */
function tail(s: PlayerState, ref: BuildingRef & MovableRef, target: Target, nowMs: number, preset: Preset): RowButton[] {
  const out: RowButton[] = []
  const step = upgradeInfo(s, ref, preset)
  const running = constructionFor(s, ref)
  if (step) {
    out.push({
      icon: 'upgrade', label: 'Upgrade', intent: info(target),
      ...(running ? { above: timerLabel(running.readyAtMs, nowMs) } : {}),
      ...(s.level < step.minLevel ? { locked: `Level ${step.minLevel}` } : {}),
    })
  }
  out.push({ icon: 'info', label: 'Info', intent: info(target) })
  out.push({ icon: 'move', label: 'Move', intent: { kind: 'move', target: ref, size: footprintOfMovable(s, ref) } })
  return out
}

/**
 * The round action buttons for a selected thing (design, Phase 4 table), or null when a tap on it should not select: a plot
 * for sale (it opens Expand), the Map, empty land, something that has gone. Pure: the clock is `nowMs`, so a timer running
 * out changes the row on the next render with no new tap.
 */
export function actionRow(s: PlayerState, target: Target, nowMs: number, preset: Preset, catalog: Catalog = LAUNCH_CATALOG): ActionRow | null {
  switch (target.kind) {
    case 'dragon': {
      const d = s.dragons.find(x => x.id === target.id)
      return d?.habitatId ? actionRow(s, { kind: 'habitat', id: d.habitatId }, nowMs, preset, catalog) : null
    }
    case 'habitat': {
      const h = s.habitats.find(x => x.id === target.id)
      if (!h) return null
      const live = residents(s, h.id)
      const gold = storedGold(h, live, catalog, nowMs, preset)
      const portraits = live.map((d): RowButton => ({
        icon: 'dragon', label: getSpecies(catalog, d.speciesId).name, portrait: { speciesId: d.speciesId, level: d.level },
        intent: info({ kind: 'dragon', id: d.id }),
      }))
      return {
        name: h.element === 'aerie' ? 'Golden Aerie' : `${cap(h.element)} Habitat`,
        buttons: [
          ...portraits,
          { icon: 'getEgg', label: 'Get Egg', intent: open({ kind: 'panel', id: 'shop', tab: 'build' }) },
          { icon: 'collect', label: 'Collect', intent: { kind: 'run', action: { type: 'collectGold', habitatId: h.id } }, ...(gold > 0 ? { above: formatGold(gold) } : { disabled: 'Nothing to collect yet' }) },
          ...tail(s, { type: 'habitat', id: h.id }, { kind: 'habitat', id: h.id }, nowMs, preset),
        ],
      }
    }
    case 'hatchery':
    case 'hatcheryBuilding': {
      const building: Target = { kind: 'hatcheryBuilding' }
      const ready = s.hatchery.findIndex(e => e.readyAtMs <= nowMs)
      const first: RowButton = s.hatchery.length === 0
        ? { icon: 'getEgg', label: 'Get Egg', intent: open({ kind: 'panel', id: 'shop', tab: 'build' }) }
        : ready >= 0
          ? { icon: 'hatch', label: 'Hatch', intent: { kind: 'run', action: { type: 'hatch', slot: ready } } }
          : { icon: 'hatch', label: 'Hatch', badge: 'new', above: timerLabel(Math.min(...s.hatchery.map(e => e.readyAtMs)), nowMs), intent: info(building) }
      return { name: 'Hatchery', buttons: [first, ...tail(s, { type: 'hatchery' }, building, nowMs, preset)] }
    }
    case 'farm': {
      const f = s.farms[target.plot]
      if (!f) return null
      const first: RowButton = f.crop === null
        ? { icon: 'growFood', label: 'Grow Food', intent: info(target) }
        : f.readyAtMs <= nowMs
          ? { icon: 'collect', label: 'Collect', intent: { kind: 'run', action: { type: 'harvest', plot: target.plot } } }
          : { icon: 'speedUp', label: 'Speed Up', above: timerLabel(f.readyAtMs, nowMs), intent: info(target) }
      return { name: 'Farm', buttons: [first, ...tail(s, { type: 'farm', index: target.plot }, target, nowMs, preset)] }
    }
    case 'breeder': {
      const b = s.breeders[target.index]
      if (!b) return null
      const breed: RowButton = b.egg === null
        ? { icon: 'breed', label: 'Breed', intent: open({ kind: 'panel', id: 'breed' }) }
        : b.egg.readyAtMs <= nowMs
          ? { icon: 'breed', label: 'Collect Egg', intent: { kind: 'run', action: { type: 'collectEgg', breeder: target.index } } }
          : { icon: 'breed', label: 'Breed', above: timerLabel(b.egg.readyAtMs, nowMs), intent: open({ kind: 'panel', id: 'breed' }) }
      return { name: breederName(b.kind), buttons: [breed, ...tail(s, { type: 'breeder', index: target.index }, target, nowMs, preset)] }
    }
    case 'obstacle': {
      const o = s.islands.obstacles.find(x => x.id === target.id)
      if (!o) return null
      const clearing = s.constructions.find(c => c.kind === 'clear' && c.obstacleId === o.id)
      const button: RowButton = clearing
        ? { icon: 'speedUp', label: 'Speed Up', above: timerLabel(clearing.readyAtMs, nowMs), intent: info(target) }
        : { icon: 'clear', label: 'Clear', above: `${formatGold(clearCost(o))} gold`, intent: { kind: 'run', action: { type: 'clearObstacle', obstacleId: o.id } } }
      return { name: OBSTACLE_NAMES[o.kind], buttons: [button] }
    }
    case 'roost':
      return s.roostPlacement ? { name: 'Roost', buttons: tail(s, { type: 'roost' }, target, nowMs, preset) } : null
    case 'decoration': {
      const d = s.decorations.find(x => x.id === target.id)
      if (!d) return null
      const ref: MovableRef = { type: 'decoration', id: d.id }
      return {
        name: 'Decoration',
        buttons: [{ icon: 'info', label: 'Info', intent: info(target) }, { icon: 'move', label: 'Move', intent: { kind: 'move', target: ref, size: footprintOfMovable(s, ref) } }],
      }
    }
    default:
      return null
  }
}
