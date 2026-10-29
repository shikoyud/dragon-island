import { TUTORIAL_TIMER_MS } from './time'
import type { BuildingRef, Construction, PlayerState } from './state'

type NewConstruction = Construction extends infer C ? (C extends unknown ? Omit<C, 'readyAtMs'> : never) : never

export const MAX_BUILDERS = 2
export const TUTORIAL_BUILDS = 2
export const NEXUS_COST = 250_000
export const NEXUS_BUILD_MS = 43_200_000
/** Build timers for farm plots 3..6. */
export const FARM_PLOT_BUILD_MS: readonly number[] = [120_000, 600_000, 1_800_000, 3_600_000]

const HABITAT_TIMER_BASE_MS = 600_000
const HABITAT_TIMER_MAX_MS = 28_800_000

/** `habitatsOwned` excludes the Nexus: 600_000 x 2^(owned-2), clamped to [10 min, 8 h]. */
export function newHabitatTimerMs(habitatsOwned: number): number {
  const exp = Math.min(Math.max(habitatsOwned - 2, 0), 10)
  return Math.min(HABITAT_TIMER_BASE_MS * 2 ** exp, HABITAT_TIMER_MAX_MS)
}

export function sameBuilding(a: BuildingRef, b: BuildingRef): boolean {
  if (a.type !== b.type) return false
  switch (a.type) {
    case 'habitat': return a.id === (b as typeof a).id
    case 'farm': return a.index === (b as typeof a).index
    case 'nest': return a.index === (b as typeof a).index
    default: return true
  }
}

export function constructionFor(s: PlayerState, ref: BuildingRef): Construction | undefined {
  return s.constructions.find(c => c.kind !== 'clear' && sameBuilding(c.building, ref))
}

export function isUnderConstruction(s: PlayerState, ref: BuildingRef): boolean {
  return constructionFor(s, ref) !== undefined
}

/** Appends a construction; the first TUTORIAL_BUILDS a player starts take TUTORIAL_TIMER_MS. `null` when both builders are busy. */
export function startConstruction(
  s: PlayerState, c: NewConstruction, timerMs: number, nowMs: number,
): PlayerState | null {
  if (s.constructions.length >= MAX_BUILDERS) return null
  const tutorial = s.tutorial.buildsStarted < TUTORIAL_BUILDS
  const readyAtMs = nowMs + (tutorial ? TUTORIAL_TIMER_MS : timerMs)
  return {
    ...s,
    constructions: [...s.constructions, { ...c, readyAtMs } as Construction],
    tutorial: { ...s.tutorial, buildsStarted: s.tutorial.buildsStarted + 1 },
  }
}

/** A new building still being built: it does nothing yet. A building under upgrade keeps working. */
export function isUnfinished(s: PlayerState, ref: BuildingRef): boolean {
  return s.constructions.some(c => c.kind === 'build' && sameBuilding(c.building, ref))
}
