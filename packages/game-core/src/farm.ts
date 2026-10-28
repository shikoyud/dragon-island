import type { CropId } from './state'

export const CROPS: Record<CropId, { growMs: number; cost: number; food: number }> = {
  sprout: { growMs: 60_000, cost: 20, food: 10 },
  bushel: { growMs: 1_800_000, cost: 200, food: 150 },
  harvest: { growMs: 14_400_000, cost: 1_000, food: 900 },
  bounty: { growMs: 43_200_000, cost: 2_500, food: 3_000 },
}

export const MAX_PLOTS = 6

/** Cost of the next plot when the player owns `currentPlots` (starts at 2). */
export function plotCost(currentPlots: number): number {
  return 500 * 2 ** (currentPlots - 2)
}
