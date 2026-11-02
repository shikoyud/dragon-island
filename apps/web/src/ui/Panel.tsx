import { PillButton } from './kit/buttons'
import type { ReactNode } from 'react'

/** 9-slice pixel frame when `ui.panel` art exists; a plain bordered box otherwise. */
export function Panel({ title, children, onClose, frameSrc }: { title: string; children: ReactNode; onClose?: () => void; frameSrc?: string }) {
  const style = frameSrc
    ? { borderImage: `url(${frameSrc}) 8 fill / 8px stretch`, borderWidth: 8, borderStyle: 'solid' as const }
    : { border: '2px solid var(--border)', background: 'var(--bg-panel)' }
  return (
    <section className="panel" aria-label={title} style={{ ...style, padding: 12, imageRendering: 'pixelated' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <h2 style={{ margin: 0, fontSize: 14 }}>{title}</h2>
        {onClose && <button type="button" className="btn btn--ghost" onClick={onClose} aria-label="Close">×</button>}
      </header>
      {children}
    </section>
  )
}

/** The old action button API, drawn as a kit pill: primary is yellow (go/place), danger red, the rest blue. */
export function ActionButton({
  id, children, onClick, disabled, reason, primary, danger,
}: { id: string; children: ReactNode; onClick?: () => void; disabled?: boolean; reason?: string; primary?: boolean; danger?: boolean }) {
  return (
    <span className="action-button">
      <PillButton id={id} color={danger ? 'red' : primary ? 'yellow' : 'blue'} disabled={disabled} reason={reason} onClick={onClick}>
        {children}
      </PillButton>
    </span>
  )
}
