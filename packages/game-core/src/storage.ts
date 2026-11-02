import type { Action, ActionError, MovableRef } from './actions/types'
import { sameBuilding } from './construction'
import type { BuildingRef, Construction, PlayerState } from './state'

/** What can go into Storage (shiko, 2026-11-01): every building but the Hatchery, a dragon, an egg in a Hatchery slot. */
export type StorageRef = Exclude<MovableRef, { type: 'hatchery' }> | { type: 'dragon'; id: string } | { type: 'egg'; slot: number }

/** When `ref` went into Storage, or null when it is on the island (or missing). */
export function storedAt(s: PlayerState, ref: MovableRef): number | null {
  switch (ref.type) {
    case 'habitat': return s.habitats.find(h => h.id === ref.id)?.stored?.atMs ?? null
    case 'farm': return s.farms[ref.index]?.stored?.atMs ?? null
    case 'breeder': return s.breeders[ref.index]?.stored?.atMs ?? null
    case 'roost': return s.roostStored?.atMs ?? null
    case 'decoration': return s.decorations.find(d => d.id === ref.id)?.stored?.atMs ?? null
    default: return null
  }
}

export const isStored = (s: PlayerState, ref: MovableRef): boolean => storedAt(s, ref) !== null

/** A construction whose building is in Storage: its timer is paused and it holds no builder (S2). */
export function isPaused(s: PlayerState, c: Construction): boolean {
  return c.kind !== 'clear' && c.building.type !== 'hatchery' && isStored(s, c.building)
}

const habitatStored = (s: PlayerState, id: string): boolean => isStored(s, { type: 'habitat', id })
const dragonStored = (s: PlayerState, id: string): boolean => s.dragons.some(d => d.id === id && d.stored)

/**
 * Why `a` touches something in Storage, or null. Every action on a stored building fails NOT_FOUND except the Move that
 * takes it out (S1); a stored dragon can only be moved into a habitat or sold (S4).
 */
export function storedTargetError(s: PlayerState, a: Action): ActionError | null {
  const building = (ref: BuildingRef): boolean => ref.type !== 'hatchery' && isStored(s, ref)
  const team = (ids: readonly string[]): ActionError | null => ids.some(id => dragonStored(s, id)) ? 'INVALID_TEAM' : null
  switch (a.type) {
    case 'collectGold': return habitatStored(s, a.habitatId) ? 'NOT_FOUND' : null
    case 'startUpgrade': return building(a.building) ? 'NOT_FOUND' : null
    case 'finishConstruction': {
      const c = s.constructions[a.index]
      return c && isPaused(s, c) ? 'NOT_FOUND' : null
    }
    case 'plant':
    case 'harvest': return isStored(s, { type: 'farm', index: a.plot }) ? 'NOT_FOUND' : null
    case 'collectEgg': return isStored(s, { type: 'breeder', index: a.breeder }) ? 'NOT_FOUND' : null
    case 'moveDragon': return habitatStored(s, a.habitatId) ? 'NOT_FOUND' : null
    case 'feed': return dragonStored(s, a.dragonId) ? 'NOT_FOUND' : null
    case 'startBreed': return dragonStored(s, a.parentA) || dragonStored(s, a.parentB) ? 'INVALID_PARENTS' : null
    case 'setDefenceTeam': return team(a.dragonIds)
    case 'pvpBattle':
    case 'startTrial': return team(a.team)
    case 'useSpeedUp': {
      if (a.target === 'farm') return isStored(s, { type: 'farm', index: a.index }) ? 'NOT_FOUND' : null
      if (a.target === 'breeder') return isStored(s, { type: 'breeder', index: a.index }) ? 'NOT_FOUND' : null
      const c = a.target === 'construction' ? s.constructions[a.index] : undefined
      return c && isPaused(s, c) ? 'NOT_FOUND' : null
    }
    case 'buy': {
      const item = a.item
      if (item.kind === 'habitatL5') return habitatStored(s, item.habitatId) ? 'NOT_FOUND' : null
      if (item.kind === 'farmL5') return isStored(s, { type: 'farm', index: item.index }) ? 'NOT_FOUND' : null
      if (item.kind === 'groveL3') return isStored(s, { type: 'breeder', index: item.index }) ? 'NOT_FOUND' : null
      if (item.kind === 'ascension') return s.roostStored ? 'NOT_FOUND' : null
      if (item.kind === 'skip' && item.target === 'farm') return isStored(s, { type: 'farm', index: item.index }) ? 'NOT_FOUND' : null
      if (item.kind === 'skip' && item.target === 'breeder') return isStored(s, { type: 'breeder', index: item.index }) ? 'NOT_FOUND' : null
      if (item.kind === 'skip' && item.target === 'construction') {
        const c = s.constructions[item.index]
        return c && isPaused(s, c) ? 'NOT_FOUND' : null
      }
      return null
    }
    default: return null
  }
}

/**
 * The state with `ref` taken out of Storage at `nowMs` (S2): its timers move on by the time it spent stored, a habitat
 * starts earning from now. The caller sets the new placement.
 */
export function takeOut(s: PlayerState, ref: MovableRef, nowMs: number): PlayerState {
  const at = storedAt(s, ref)
  if (at === null || ref.type === 'hatchery') return s
  const gap = Math.max(0, nowMs - at)
  const constructions = s.constructions.map(c => c.kind !== 'clear' && c.building.type !== 'hatchery' && sameBuilding(c.building, ref as BuildingRef) && ref.type !== 'decoration'
    ? { ...c, readyAtMs: c.readyAtMs + gap } : c)
  const next = { ...s, constructions }
  switch (ref.type) {
    case 'habitat': return { ...next, habitats: s.habitats.map(h => h.id === ref.id ? { ...unmark(h), lastCollectedMs: nowMs } : h) }
    case 'farm': return { ...next, farms: s.farms.map((f, i) => i === ref.index ? { ...unmark(f), readyAtMs: f.crop === null ? f.readyAtMs : f.readyAtMs + gap } : f) }
    case 'breeder': return { ...next, breeders: s.breeders.map((b, i) => i === ref.index ? { ...unmark(b), egg: b.egg && { ...b.egg, readyAtMs: b.egg.readyAtMs + gap } } : b) }
    case 'roost': {
      const { roostStored: _, ...rest } = next
      return rest
    }
    case 'decoration': return { ...next, decorations: s.decorations.map(d => d.id === ref.id ? unmark(d) : d) }
  }
}

function unmark<T extends { stored?: unknown }>(x: T): T {
  const { stored: _, ...rest } = x
  return rest as T
}
