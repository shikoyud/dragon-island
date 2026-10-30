import type { Preset } from './data/presets'
import { MS_PER_DAY } from './time'

export type Phase = 'prelaunch' | 'rush' | 'endgame' | 'finals' | 'settlement' | 'closed'

/** Game day: 1 on launch day, 0 before launch. Days roll over at launch time + n days. */
export function gameDay(launchAtMs: number, nowMs: number): number {
  if (nowMs < launchAtMs) return 0
  return Math.floor((nowMs - launchAtMs) / MS_PER_DAY) + 1
}

const within = (day: number, [from, to]: [number, number]): boolean => day >= from && day <= to

export function phaseOf(day: number, preset: Preset): Phase {
  if (day < 1) return 'prelaunch'
  const p = preset.phases
  if (within(day, p.rush)) return 'rush'
  if (within(day, p.endgame)) return 'endgame'
  if (within(day, p.finals)) return 'finals'
  if (within(day, p.settlement)) return 'settlement'
  return 'closed'
}

/** End of the last finals day. */
export function finalsLockAtMs(launchAtMs: number, preset: Preset): number {
  return launchAtMs + preset.phases.finals[1] * MS_PER_DAY
}

/** End of settlement. */
export function shutdownAtMs(launchAtMs: number, preset: Preset): number {
  return launchAtMs + preset.phases.settlement[1] * MS_PER_DAY
}
