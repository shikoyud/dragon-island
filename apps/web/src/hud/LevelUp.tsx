import { useEffect, useRef, useState } from 'react'
import { levelUnlockLines } from './hudModel'

/** Where this device remembers the last level it showed a player (a per-viewer convenience, so it may be missing). */
export const levelShownKey = (playerId: string): string => `dragon-island:levelShown:${playerId}`

function readShown(playerId: string | undefined): number | null {
  if (!playerId) return null
  try {
    const raw = localStorage.getItem(levelShownKey(playerId))
    const n = raw === null ? NaN : Number(raw)
    return Number.isInteger(n) && n > 0 ? n : null
  } catch { return null }
}

function writeShown(playerId: string | undefined, level: number): void {
  if (!playerId) return
  try { localStorage.setItem(levelShownKey(playerId), String(level)) } catch { /* private window, blocked storage */ }
}

/**
 * Watches the player's level and reports a rise as a pending level-up (R38: it pays nothing, it only reports).
 * On the first level seen for a player, this device's stored "last level shown" decides: below the current level, the
 * screen lists everything since (a returning player on a new day, whose /me is already settled); nothing stored (a new
 * device) or a stored level at or above (a state reset) is a baseline with no screen. Closing the screen stores the level,
 * so a reload does not show it again. A fall shows nothing and becomes the new baseline. While `hold` is set (placement,
 * a battle) the rise waits, and several rises merge into one screen.
 */
export function useLevelUp(level: number | undefined, hold: boolean, playerId?: string): { from: number; to: number; dismiss: () => void } | null {
  const seen = useRef<{ player: string | undefined; level: number } | null>(null)
  const [pending, setPending] = useState<{ from: number; to: number } | null>(null)
  useEffect(() => {
    if (level === undefined) { seen.current = null; setPending(null); return }
    const prev = seen.current
    seen.current = { player: playerId, level }
    if (prev === null || prev.player !== playerId) {
      const stored = readShown(playerId)
      if (stored !== null && stored < level) setPending({ from: stored, to: level })
      else { setPending(null); writeShown(playerId, level) }
      return
    }
    if (level === prev.level) return
    if (level > prev.level) setPending(p => ({ from: p ? p.from : prev.level, to: level }))
    else { setPending(null); writeShown(playerId, level) }
  }, [level, playerId])
  const dismiss = () => { if (pending) writeShown(playerId, pending.to); setPending(null) }
  return pending && !hold ? { ...pending, dismiss } : null
}

/** The level-up screen: the new level (or `from → to` for a jump) and what opened. Sits above any open panel. */
export function LevelUp({ from, to, onClose, onShown }: { from: number; to: number; onClose: () => void; onShown?: () => void }) {
  const lines = levelUnlockLines(from, to)
  const shown = useRef(onShown)
  shown.current = onShown
  useEffect(() => { shown.current?.() }, [])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  const title = to - from > 1 ? `Level ${from} → ${to}` : `Level ${to}`
  return (
    <div className="hud-dialog-layer hud-levelup">
      <div className="hud-scrim" data-testid="levelup-scrim" onClick={onClose} />
      <div className="hud-dialog" role="dialog" aria-modal="true" aria-label="Level up">
        <section className="panel hud-levelup__card" style={{ border: '2px solid var(--border)', background: 'var(--bg-panel)', padding: 16, textAlign: 'center' }}>
          <small>Level up!</small>
          <h2 style={{ margin: '4px 0 12px' }}>{title}</h2>
          {lines.length > 0
            ? <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 12px', display: 'grid', gap: 4 }}>{lines.map(l => <li key={l}>{l}</li>)}</ul>
            : <p style={{ margin: '0 0 12px' }}>No new unlocks</p>}
          <button type="button" className="btn btn--primary" onClick={onClose} autoFocus>Continue</button>
        </section>
      </div>
    </div>
  )
}
