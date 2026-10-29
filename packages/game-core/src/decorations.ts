import type { DecorationId } from './state'

/** Spec section 7. Only the Dawnspire items are island-restricted. */
export const DECORATIONS: Record<DecorationId, { size: 1 | 2 | 3; cost: number; minLevel: number; island?: 'dawnspire' }> = {
  stonePath: { size: 1, cost: 10, minLevel: 1 },
  picketFence: { size: 1, cost: 25, minLevel: 1 },
  flowerPatch: { size: 1, cost: 50, minLevel: 1 },
  emberLantern: { size: 1, cost: 150, minLevel: 2 },
  driftwoodBench: { size: 2, cost: 400, minLevel: 4 },
  hayCart: { size: 2, cost: 1_000, minLevel: 6 },
  shellFountain: { size: 2, cost: 3_000, minLevel: 9 },
  crystalCluster: { size: 2, cost: 8_000, minLevel: 13 },
  eggTotem: { size: 2, cost: 20_000, minLevel: 18 },
  moonwell: { size: 3, cost: 50_000, minLevel: 24 },
  boneArch: { size: 3, cost: 150_000, minLevel: 32 },
  skyShrine: { size: 3, cost: 400_000, minLevel: 40 },
  dawnObelisk: { size: 2, cost: 100_000, minLevel: 45, island: 'dawnspire' },
  starPool: { size: 3, cost: 300_000, minLevel: 45, island: 'dawnspire' },
  dragonColossus: { size: 3, cost: 1_000_000, minLevel: 45, island: 'dawnspire' },
}

export const DECORATION_REFUND_PCT = 25

export function decorationRefund(kind: DecorationId): number {
  return Math.floor(DECORATIONS[kind].cost * DECORATION_REFUND_PCT / 100)
}
