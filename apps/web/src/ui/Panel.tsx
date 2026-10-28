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

/** A button that stays focusable when disabled and explains why via aria-describedby. */
export function ActionButton({
  id, children, onClick, disabled, reason, primary, danger,
}: { id: string; children: ReactNode; onClick?: () => void; disabled?: boolean; reason?: string; primary?: boolean; danger?: boolean }) {
  const descId = `${id}-why`
  return (
    <span className="action-button">
      <button
        type="button"
        id={id}
        className={`btn ${primary ? 'btn--primary' : ''} ${danger ? 'btn--danger' : ''}`}
        disabled={disabled}
        aria-describedby={disabled && reason ? descId : undefined}
        onClick={onClick}
      >
        {children}
      </button>
      {disabled && reason && <small id={descId} className="action-button__why" style={{ display: 'block', color: 'var(--text-muted)' }}>{reason}</small>}
    </span>
  )
}
