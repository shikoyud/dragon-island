// GDD §3.6 (speed-ups), ruling R8. Skip price = $0.10 × H^0.68, H = remaining hours.
// The concave curve makes longer timers cheaper per hour. This is the one float in currency code (R8):
// the exponent has no integer form, so the result is rounded once to whole micro-USD.

export const SKIP_BASE_MICRO_USD = 100_000
export const SKIP_EXPONENT = 0.68
const HOUR_MS = 3_600_000

/** Micro-USD to skip `remainingMs` of any timer: 0 when nothing remains, otherwise at least 1. */
export function skipPriceMicroUsd(remainingMs: number): number {
  if (remainingMs <= 0) return 0
  return Math.max(1, Math.round(SKIP_BASE_MICRO_USD * (remainingMs / HOUR_MS) ** SKIP_EXPONENT))
}
