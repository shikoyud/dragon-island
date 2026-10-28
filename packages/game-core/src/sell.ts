import type { PlayerState } from './state'
import { utcDay } from './time'

export { utcDay }

/** 10,000 eligible gold = $0.05 = 50,000 micro-USD. */
export const MICRO_USD_PER_GOLD = 5

/** Index = Hoard level − 1 (spec §14). */
export const HOARD: readonly { costMicroUsd: number; limitMicroUsd: number }[] = [
  { costMicroUsd: 2_000_000, limitMicroUsd: 1_000_000 },
  { costMicroUsd: 4_000_000, limitMicroUsd: 2_000_000 },
  { costMicroUsd: 8_000_000, limitMicroUsd: 4_000_000 },
  { costMicroUsd: 15_000_000, limitMicroUsd: 7_000_000 },
  { costMicroUsd: 25_000_000, limitMicroUsd: 12_000_000 },
  { costMicroUsd: 40_000_000, limitMicroUsd: 20_000_000 },
  { costMicroUsd: 60_000_000, limitMicroUsd: 30_000_000 },
]

export const HOARD_MIN_PLAYER_LEVEL = 5

/** Integer-only: compares withdrawn vs multiples of deposited instead of dividing. */
export function dailySellLimitMicroUsd(hoardLevel: number, ledger: PlayerState['ledger']): number {
  if (hoardLevel === 0) return 0
  const { depositedMicroUsd: dep, withdrawnMicroUsd: w, soldMicroUsd: sold } = ledger
  const repayment = Math.min(Math.floor(dep / 3), Math.max(0, dep - sold))
  const base = Math.max(HOARD[hoardLevel - 1]!.limitMicroUsd, repayment)
  if (w > 3 * dep) return 0
  if (w > 2 * dep) return Math.floor(base / 5)
  if (w > dep) return Math.floor(base / 2)
  return base
}

export function remainingSellMicroUsd(s: PlayerState, nowMs: number): number {
  const soldToday = s.sell.day === utcDay(nowMs) ? s.sell.soldTodayMicroUsd : 0
  return Math.max(0, dailySellLimitMicroUsd(s.hoardLevel, s.ledger) - soldToday)
}
