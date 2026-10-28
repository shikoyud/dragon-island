import { timerLabel } from '../game/islandModel'

/** "ready" / "14s" / "2m" / "4h" for a deadline relative to `nowMs`. */
export function Timer({ readyAtMs, nowMs }: { readyAtMs: number; nowMs: number }) {
  const label = timerLabel(readyAtMs, nowMs)
  return <span className={`timer ${label === 'ready' ? 'timer--ready' : ''}`}>{label}</span>
}

export const isReady = (readyAtMs: number, nowMs: number): boolean => nowMs >= readyAtMs
