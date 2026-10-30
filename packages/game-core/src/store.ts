import type { PlayerState } from './state'

export type StoreItem =
  | { kind: 'skip'; target: SkipTarget; index: number }
  | { kind: 'foodPack' }

export type SkipTarget = 'nest' | 'hatchery' | 'farm' | 'construction'

export const MAX_NESTS = 4
export const FOOD_PACK = 1_000
export const SKIP_STEP_MS = 1_800_000

/** Ready time of a skip target, or `null` if the slot holds nothing. */
export function skipTargetReadyAt(s: PlayerState, target: SkipTarget, index: number): number | null {
  if (target === 'construction') return s.constructions[index]?.readyAtMs ?? null
  if (target === 'nest') return s.nests[index]?.egg?.readyAtMs ?? null
  if (target === 'hatchery') return s.hatchery[index]?.readyAtMs ?? null
  const plot = s.farms[index]
  return plot && plot.crop !== null ? plot.readyAtMs : null
}

/** Price in micro-USD, or `null` when the item can't be bought now. */
export function priceMicroUsd(item: StoreItem, s: PlayerState, nowMs: number): number | null {
  switch (item.kind) {
    case 'skip': {
      const readyAt = skipTargetReadyAt(s, item.target, item.index)
      if (readyAt === null || readyAt <= nowMs) return null
      return 100_000 * Math.ceil((readyAt - nowMs) / SKIP_STEP_MS)
    }
    case 'foodPack':
      return 500_000
  }
}
