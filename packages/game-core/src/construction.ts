import { MAX_CLEARS } from './data/obstacles'
import type { BuildingRef, Construction, PlayerState } from './state'
import { isPaused } from './storage'

type NewConstruction = Construction extends infer C ? (C extends unknown ? Omit<C, 'readyAtMs'> : never) : never

export const MAX_BUILDERS = 2

export function sameBuilding(a: BuildingRef, b: BuildingRef): boolean {
  if (a.type !== b.type) return false
  switch (a.type) {
    case 'habitat': return a.id === (b as typeof a).id
    case 'farm': return a.index === (b as typeof a).index
    case 'breeder': return a.index === (b as typeof a).index
    default: return true
  }
}

export function constructionFor(s: PlayerState, ref: BuildingRef): Construction | undefined {
  return s.constructions.find(c => c.kind !== 'clear' && sameBuilding(c.building, ref))
}

export function isUnderConstruction(s: PlayerState, ref: BuildingRef): boolean {
  return constructionFor(s, ref) !== undefined
}

/** Builds and upgrades running; clears have their own limit (M4 Q1 a). */
export function activeBuilds(s: PlayerState): number {
  return s.constructions.filter(c => c.kind !== 'clear' && !isPaused(s, c)).length
}

export function activeClears(s: PlayerState): number {
  return s.constructions.filter(c => c.kind === 'clear').length
}

/** Which limit stops a new construction of this kind: builds against MAX_BUILDERS, clears against MAX_CLEARS. */
export function busyError(s: PlayerState, kind: Construction['kind']): 'BUILDERS_BUSY' | 'CLEARS_BUSY' | null {
  if (kind === 'clear') return activeClears(s) >= MAX_CLEARS ? 'CLEARS_BUSY' : null
  return activeBuilds(s) >= MAX_BUILDERS ? 'BUILDERS_BUSY' : null
}

/** Appends a construction that takes `timerMs`. `null` when its limit is reached (busyError says which). */
export function startConstruction(
  s: PlayerState, c: NewConstruction, timerMs: number, nowMs: number,
): PlayerState | null {
  if (busyError(s, c.kind) !== null) return null
  return { ...s, constructions: [...s.constructions, { ...c, readyAtMs: nowMs + timerMs } as Construction] }
}

/** A new building still being built: it does nothing yet. A building under upgrade keeps working. */
export function isUnfinished(s: PlayerState, ref: BuildingRef): boolean {
  return s.constructions.some(c => c.kind === 'build' && sameBuilding(c.building, ref))
}
