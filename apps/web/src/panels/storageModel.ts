import {
  getSpecies, LAUNCH_CATALOG, type Catalog, type Footprint, type MovableRef, type PlayerState, type Rarity, type SpeedUpToken,
} from '@wyrmhaven/game-core'
import type { ClientAction } from '@wyrmhaven/shared'
import { footprintOfMovable } from '../game/buildingInfo'
import { breederName } from '../hud/hudModel'
import { decorationName } from './infoModel'

export type StorageFilter = 'dragons' | 'eggs' | 'buildings' | 'items'

/** Use: put a building back with the Move placement (rule 5), run an action (an egg back to the Hatchery), or find a dragon a home. */
export type StorageUse =
  | { kind: 'place'; target: MovableRef; size: Footprint }
  | { kind: 'run'; action: ClientAction }
  | { kind: 'home'; dragonId: string }

export interface StorageItem {
  key: string
  kind: 'egg' | 'dragon' | 'building' | 'token'
  name: string
  filter: StorageFilter
  rarity?: Rarity
  speciesId?: string
  /** A dragon's level, for its look. */
  level?: number
  /** How many (speed-up tokens). */
  count?: number
  target?: MovableRef
  use?: StorageUse
  sell?: ClientAction
}

const cap = (w: string): string => w.charAt(0).toUpperCase() + w.slice(1)

/**
 * Everything in Storage (shiko, 2026-11-01): dragons, eggs, buildings, then speed-up tokens (ruling S6: listed with
 * their count, used from a timer's Speed Up). An egg is named only "Egg" until it hatches (R20).
 */
export function storageItems(s: PlayerState, catalog: Catalog = LAUNCH_CATALOG): StorageItem[] {
  const out: StorageItem[] = []
  for (const d of s.dragons) {
    if (!d.stored) continue
    const sp = getSpecies(catalog, d.speciesId)
    out.push({ key: `dragon:${d.id}`, kind: 'dragon', name: sp.name, filter: 'dragons', rarity: sp.rarity, speciesId: sp.id, level: d.level, use: { kind: 'home', dragonId: d.id }, sell: { type: 'sellDragon', dragonId: d.id } })
  }
  ;(s.storedEggs ?? []).forEach((e, index) => {
    out.push({ key: `egg:${index}`, kind: 'egg', name: 'Egg', filter: 'eggs', speciesId: e.speciesId, use: { kind: 'run', action: { type: 'takeEgg', index } } })
  })
  const building = (ref: MovableRef, name: string, sell?: ClientAction) =>
    out.push({ key: `${ref.type}:${'id' in ref ? ref.id : 'index' in ref ? ref.index : ''}`, kind: 'building', name, filter: 'buildings', target: ref, use: { kind: 'place', target: ref, size: footprintOfMovable(s, ref) }, ...(sell ? { sell } : {}) })
  for (const h of s.habitats) if (h.stored) building({ type: 'habitat', id: h.id }, h.element === 'aerie' ? 'Golden Aerie' : `${cap(h.element)} Habitat`)
  s.farms.forEach((f, index) => { if (f.stored) building({ type: 'farm', index }, 'Farm') })
  s.breeders.forEach((b, index) => { if (b.stored) building({ type: 'breeder', index }, breederName(b.kind)) })
  if (s.roostStored && s.roostPlacement) building({ type: 'roost' }, 'Dragon Roost')
  for (const d of s.decorations) if (d.stored) building({ type: 'decoration', id: d.id }, decorationName(d.kind), { type: 'removeDecoration', id: d.id })
  for (const token of Object.keys(s.speedUps) as SpeedUpToken[]) {
    const n = s.speedUps[token]
    if (n > 0) out.push({ key: `token:${token}`, kind: 'token', name: `${token} token`, filter: 'items', count: n })
  }
  return out
}
