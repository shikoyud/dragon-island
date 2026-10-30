import { finalsLockAtMs, gameDay, phaseOf, PRESETS, shutdownAtMs } from '@wyrmhaven/game-core'
import type { GameInfo } from '@wyrmhaven/shared'

const pad = (n: number): string => n.toString().padStart(2, '0')

/** "3d 04:12:55": whole days, then hours, minutes and seconds; rounds up so the last second shows 00:00:01. */
function span(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const d = Math.floor(total / 86_400)
  const h = Math.floor((total % 86_400) / 3_600)
  const m = Math.floor((total % 3_600) / 60)
  return `${d}d ${pad(h)}:${pad(m)}:${pad(total % 60)}`
}

/**
 * The Terminal countdown text for a moment (§1.5): to launch before it, to the Finals lock during the rush and
 * endgame, to the end of the finals during them, to the end of the redemption window in settlement; null once closed.
 * The phase comes from the clock, not from `game.phase`, which is only as fresh as the last /me.
 */
export function terminalLabel(game: Pick<GameInfo, 'launchAtMs' | 'preset'>, nowMs: number): string | null {
  const preset = PRESETS[game.preset]
  const phase = phaseOf(gameDay(game.launchAtMs, nowMs), preset)
  switch (phase) {
    case 'prelaunch': return `Launch in ${span(game.launchAtMs - nowMs)}`
    case 'rush':
    case 'endgame': return `Finals lock in ${span(finalsLockAtMs(game.launchAtMs, preset) - nowMs)}`
    case 'finals': return `Finals end in ${span(finalsLockAtMs(game.launchAtMs, preset) - nowMs)}`
    case 'settlement': return `Redemption ends in ${span(shutdownAtMs(game.launchAtMs, preset) - nowMs)}`
    case 'closed': return null
  }
}

/** The countdown under the pills. */
export function TerminalClock({ game, nowMs }: { game: Pick<GameInfo, 'launchAtMs' | 'preset'>; nowMs: number }) {
  const label = terminalLabel(game, nowMs)
  if (label === null) return null
  return <div className="hud-clock outlined" role="timer" aria-label="Terminal countdown">{label}</div>
}
