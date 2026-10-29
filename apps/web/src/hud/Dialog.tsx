import { useEffect, type ReactNode } from 'react'

/**
 * Hosts one panel over the island: a centred modal on wide screens, a bottom sheet on narrow ones (CSS decides).
 * The scrim and Escape close it; the panel inside keeps its own close button. A non-modal dialog (the battle)
 * docks to the side or bottom without a scrim, so the canvas under it stays clickable.
 */
export function Dialog({ label, onClose, children, modal = true }: { label: string; onClose: () => void; children: ReactNode; modal?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className={`hud-dialog-layer${modal ? '' : ' hud-dialog-layer--dock'}`}>
      {modal && <div className="hud-scrim" data-testid="dialog-scrim" onClick={onClose} />}
      <div className="hud-dialog" role="dialog" aria-modal={modal} aria-label={label}>
        {children}
      </div>
    </div>
  )
}
