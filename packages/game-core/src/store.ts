import { foodToNextLevel, MAX_DRAGON_LEVEL } from './dragon'
import { HOARD } from './sell'
import type { Placement, PlayerState } from './state'

export type StoreItem =
  | { kind: 'skip'; target: SkipTarget; index: number }
  | { kind: 'nest'; placement: Placement }
  | { kind: 'foodPack' }
  | { kind: 'levelUp'; dragonId: string }
  | { kind: 'oddsBoost' }
  | { kind: 'hoard'; placement?: Placement } // placement required (and validated) when hoardLevel === 0

export type SkipTarget = 'nest' | 'hatchery' | 'farm' | 'construction'

export const MAX_NESTS = 4
export const FOOD_PACK = 1_000
export const SKIP_STEP_MS = 1_800_000

const NEST_PRICES = [2_000_000, 4_000_000, 8_000_000] // 2nd, 3rd, 4th nest

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
    case 'nest':
      return NEST_PRICES[s.nests.length - 1] ?? null
    case 'foodPack':
      return 500_000
    case 'levelUp': {
      const d = s.dragons.find(x => x.id === item.dragonId)
      if (!d || d.level >= MAX_DRAGON_LEVEL) return null
      return Math.max(50_000, 500 * foodToNextLevel(d.level))
    }
    case 'oddsBoost':
      return 500_000
    case 'hoard':
      return HOARD[s.hoardLevel]?.costMicroUsd ?? null
  }
}
