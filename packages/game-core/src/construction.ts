import type { BuildingRef, Construction, PlayerState } from './state'

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

/** Appends a construction that takes `timerMs`. `null` when both builders are busy. */
export function startConstruction(
  s: PlayerState, c: NewConstruction, timerMs: number, nowMs: number,
): PlayerState | null {
  if (s.constructions.length >= MAX_BUILDERS) return null
  return { ...s, constructions: [...s.constructions, { ...c, readyAtMs: nowMs + timerMs } as Construction] }
}

/** A new building still being built: it does nothing yet. A building under upgrade keeps working. */
export function isUnfinished(s: PlayerState, ref: BuildingRef): boolean {
  return s.constructions.some(c => c.kind === 'build' && sameBuilding(c.building, ref))
}
