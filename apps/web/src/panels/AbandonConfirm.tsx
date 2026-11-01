import { useEffect } from 'react'
import { createPortal } from 'react-dom'

/**
 * Every way out of a fight asks here, with what it costs. It portals to the game root because the Trials banner sits inside a
 * dialog of its own. Escape closes only this: it is caught before any other listener can read it as closing what's underneath.
 */
export function AbandonConfirm({ cost, pending, onConfirm, onCancel }: { cost: string; pending: boolean; onConfirm: () => void; onCancel: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopImmediatePropagation()
      onCancel()
    }
    window.addEventListener('keydown', onKey, { capture: true })
    return () => window.removeEventListener('keydown', onKey, { capture: true })
  }, [onCancel])
  return createPortal(
    <div className="hud-dialog-layer battle-confirm">
      <div className="hud-scrim" onClick={onCancel} />
      <div className="hud-dialog" role="alertdialog" aria-modal="true" aria-label="Abandon?">
        <section className="panel battle-confirm__card">
          <h2>Abandon?</h2>
          <p>{cost}</p>
          <div className="battle-confirm__row">
            <button type="button" className="btn" autoFocus onClick={onCancel}>Keep fighting</button>
            <button type="button" className="btn btn--danger" disabled={pending} onClick={onConfirm}>Abandon</button>
          </div>
        </section>
      </div>
    </div>,
    document.querySelector('.game-root') ?? document.body,
  )
}
