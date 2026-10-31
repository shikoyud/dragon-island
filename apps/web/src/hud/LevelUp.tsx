import { useEffect, useRef, useState } from 'react'
import { levelUnlockLines } from './hudModel'

/**
 * Watches the player's level and reports a rise as a pending level-up (R38: it pays nothing, it only reports).
 * The first level seen is the baseline, so loading the game or switching accounts shows nothing; a fall (a state
 * reset) shows nothing either and becomes the new baseline. While `hold` is set (placement, a battle) the rise waits,
 * and several rises merge into one screen.
 */
export function useLevelUp(level: number | undefined, hold: boolean): { from: number; to: number; dismiss: () => void } | null {
  const seen = useRef<number | null>(null)
  const [pending, setPending] = useState<{ from: number; to: number } | null>(null)
  useEffect(() => {
    if (level === undefined) { seen.current = null; setPending(null); return }
    const prev = seen.current
    seen.current = level
    if (prev === null || level === prev) return
    if (level > prev) setPending(p => ({ from: p ? p.from : prev, to: level }))
    else setPending(null)
  }, [level])
  return pending && !hold ? { ...pending, dismiss: () => setPending(null) } : null
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
