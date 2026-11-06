import {
  BREEDER_LEVELS, buildXp, cropFood, dragonRateX20, getSpecies, LAUNCH_CATALOG, storedGold, type Catalog, DECORATIONS, decorationRefund, habitatCap, habitatCapacity, hatcherySlots, levelCap, residents,
  upgradeInfo, type BuildingRef, type Element, type MovableRef, type PlayerState, type Preset,
} from '@wyrmhaven/game-core'
import type { ClientAction } from '@wyrmhaven/shared'
import { breederName } from '../hud/hudModel'
import { formatGold, formatPerMinuteX20 } from '../ui/Money'

/** One labelled value in the Info dialog's table; `elements` draws ribbons instead of text. */
export interface InfoRow { label: string; value: string; elements?: readonly Element[] }

/** What the Info dialog shows for a building (design, Phase 5: habitat-info). */
export interface BuildingInfo {
  name: string
  /** Shown after the name on the plank: "level N", "Tier N"; empty for decorations. */
  level: string
  rows: InfoRow[]
  description: string
  /** Store: the action, or why it can't be stored now; absent where Storage does not apply (the Hatchery). */
  store?: { action: ClientAction; blocked?: string }
  /** Sell, only where a sell action exists (ruling S7): decorations. */
  sell?: { label: string; action: ClientAction }
}

const cap = (w: string): string => w.charAt(0).toUpperCase() + w.slice(1)
export const decorationName = (kind: string): string => cap(kind.replace(/([A-Z])/g, ' $1').toLowerCase())

/** Our own short descriptions: never copied from another game. */
const ABOUT = {
  habitat: 'A home for dragons of its element. They earn gold here while you are away; collect it before it fills up.',
  aerie: 'A golden roost where a dragon of any element can live and earn.',
  farm: 'Grows food for your dragons. Higher levels harvest more food from every crop.',
  breeder: 'Two dragons meet here and leave an egg. Higher levels shorten the wait.',
  hatchery: 'Eggs rest in the nest until they hatch. More levels, more nest slots.',
  roost: 'Where dragons train past their limits. Each tier raises the highest level a dragon can reach.',
  decoration: 'Makes the island yours. It earns nothing, but it looks good.',
} as const

const storeOf = (target: MovableRef, blocked?: string): BuildingInfo['store'] =>
  ({ action: { type: 'putInStorage', target: target as Exclude<MovableRef, { type: 'hatchery' }> }, ...(blocked ? { blocked } : {}) })

/** The Info dialog's contents for a building, or null when it is gone. */
export function infoOf(s: PlayerState, ref: MovableRef, preset: Preset, nowMs = 0, catalog: Catalog = LAUNCH_CATALOG): BuildingInfo | null {
  switch (ref.type) {
    case 'habitat': {
      const h = s.habitats.find(x => x.id === ref.id)
      if (!h) return null
      const dragons = residents(s, h.id)
      const live = dragons.length
      const max = habitatCap(h.element, h.level, preset)
      const gold = storedGold(h, dragons, catalog, nowMs, preset)
      const perMinuteX20 = dragons.reduce((n, d) => n + dragonRateX20(getSpecies(catalog, d.speciesId), d.level, h, preset), 0)
      return {
        name: h.element === 'aerie' ? 'Golden Aerie' : `${cap(h.element)} Habitat`,
        level: `level ${h.level}`,
        rows: [
          { label: 'Max. Dragons', value: `${habitatCapacity(h.level)}x` },
          h.element === 'aerie' ? { label: 'Elements', value: 'Any' } : { label: 'Elements', value: cap(h.element), elements: [h.element] },
          { label: 'Max. Gold', value: formatGold(max) },
          { label: 'Gold now', value: `${formatGold(gold)} / ${formatGold(max)}${gold > 0 && gold >= max ? ' · FULL' : ''}` },
          { label: 'Income', value: `${formatPerMinuteX20(perMinuteX20)} gold/min` },
        ],
        description: h.element === 'aerie' ? ABOUT.aerie : ABOUT.habitat,
        store: storeOf(ref, live > 0 ? 'Move its dragons out first' : undefined),
      }
    }
    case 'farm': {
      const f = s.farms[ref.index]
      if (!f) return null
      return {
        name: 'Farm', level: `level ${f.level}`,
        rows: [
          { label: 'Food per Dragon Bush', value: formatGold(cropFood('dragonBush', f.level, preset)) },
          { label: 'Growing', value: f.crop ? cap(f.crop.replace(/([A-Z])/g, ' $1').toLowerCase()) : 'Nothing' },
        ],
        description: ABOUT.farm, store: storeOf(ref),
      }
    }
    case 'breeder': {
      const b = s.breeders[ref.index]
      if (!b) return null
      return {
        name: breederName(b.kind), level: `level ${b.level}`,
        rows: [
          { label: 'Breeding time', value: BREEDER_LEVELS[b.kind][b.level - 1]!.reductionPct === 0 ? 'Normal' : `-${BREEDER_LEVELS[b.kind][b.level - 1]!.reductionPct}%` },
          { label: 'Egg', value: b.egg ? 'Waiting' : 'None' },
        ],
        description: ABOUT.breeder, store: storeOf(ref, b.egg ? 'Collect its egg first' : undefined),
      }
    }
    case 'hatchery':
      return {
        name: 'Hatchery', level: `level ${s.hatcheryLevel}`,
        rows: [{ label: 'Nest slots', value: `${hatcherySlots(s.hatcheryLevel, s.hatcheryFifthSlot)}` }, { label: 'Eggs', value: `${s.hatchery.length}` }],
        description: ABOUT.hatchery,
      }
    case 'roost':
      if (!s.roostPlacement) return null
      return {
        name: 'Dragon Roost', level: s.roostTier === 0 ? 'unfinished' : `Tier ${s.roostTier}`,
        rows: [{ label: 'Dragon level cap', value: s.roostTier === 0 ? `Not finished · cap ${levelCap(0)}` : `Tier ${s.roostTier} · cap ${levelCap(s.roostTier)}` }],
        description: ABOUT.roost, store: storeOf(ref),
      }
    case 'decoration': {
      const d = s.decorations.find(x => x.id === ref.id)
      if (!d) return null
      const refund = formatGold(decorationRefund(d.kind))
      return {
        name: decorationName(d.kind), level: '',
        rows: [{ label: 'Size', value: `${DECORATIONS[d.kind].size}×${DECORATIONS[d.kind].size}` }, { label: 'Sells for', value: `${refund} gold` }],
        description: ABOUT.decoration, store: storeOf(ref),
        sell: { label: `Remove · +${refund} gold`, action: { type: 'removeDecoration', id: d.id } },
      }
    }
  }
}

/** One Benefits line of the Upgrade dialog: the value now and the green increase (design, Phase 5: habitat-upgrade). */
export interface Benefit { label: string; now: string; plus: string }

/** What the next level adds, or [] at the top; the Roost has its own tier dialog. */
export function upgradeBenefits(s: PlayerState, ref: BuildingRef, preset: Preset): Benefit[] {
  switch (ref.type) {
    case 'habitat': {
      const h = s.habitats.find(x => x.id === ref.id)
      if (!h || h.element === 'aerie' || !upgradeInfo(s, ref, preset)) return []
      const goldNow = habitatCap(h.element, h.level, preset), goldNext = habitatCap(h.element, h.level + 1, preset)
      return [
        { label: 'Max. Dragons', now: `${habitatCapacity(h.level)}`, plus: `+${habitatCapacity(h.level + 1) - habitatCapacity(h.level)}` },
        { label: 'Max. Gold', now: formatGold(goldNow), plus: `+${formatGold(goldNext - goldNow)}` },
      ]
    }
    case 'farm': {
      const f = s.farms[ref.index]
      if (!f || !upgradeInfo(s, ref, preset)) return []
      const now = cropFood('dragonBush', f.level, preset), next = cropFood('dragonBush', f.level + 1, preset)
      return [{ label: 'Food per Dragon Bush', now: formatGold(now), plus: `+${formatGold(next - now)}` }]
    }
    case 'breeder': {
      const b = s.breeders[ref.index]
      const next = b && BREEDER_LEVELS[b.kind][b.level]
      if (!b || !next || !upgradeInfo(s, ref, preset)) return []
      const now = BREEDER_LEVELS[b.kind][b.level - 1]!.reductionPct
      return [{ label: 'Breeding time', now: now === 0 ? '0%' : `-${now}%`, plus: `-${next.reductionPct - now}%` }]
    }
    case 'hatchery': {
      if (!upgradeInfo(s, ref, preset)) return []
      const now = hatcherySlots(s.hatcheryLevel, s.hatcheryFifthSlot), next = hatcherySlots(s.hatcheryLevel + 1, s.hatcheryFifthSlot)
      return [{ label: 'Nest slots', now: `${now}`, plus: `+${next - now}` }]
    }
    case 'roost': return []
  }
}

/** The XP the next upgrade pays when it starts (build XP on the gold spent), or 0 at the top. */
export function upgradeXp(s: PlayerState, ref: BuildingRef, preset: Preset): number {
  const step = upgradeInfo(s, ref, preset)
  return step ? buildXp(step.cost, s) * preset.xpMult : 0
}
