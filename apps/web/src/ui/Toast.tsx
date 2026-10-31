import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import { ApiError } from '../api/client'
import { messageFor } from '../api/errors'

interface Toast { id: number; kind: 'error' | 'info'; text: string }

interface ToastApi {
  error(e: unknown): void
  info(text: string): void
}

const ToastContext = createContext<ToastApi | null>(null)

/** One toast per message; API errors are mapped through `messageFor`. */
export function ToastProvider({ children, ttlMs = 5000 }: { children: ReactNode; ttlMs?: number }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const next = useRef(1)
  const push = useCallback((kind: Toast['kind'], text: string) => {
    const id = next.current++
    setToasts(t => (t.some(x => x.text === text) ? t : [...t, { id, kind, text }]))
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), ttlMs)
  }, [ttlMs])
  const api = useMemo<ToastApi>(() => ({
    error: e => push('error', e instanceof ApiError ? messageFor(e.code) : e instanceof Error ? e.message : String(e)),
    info: text => push('info', text),
  }), [push])
  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toasts" aria-live="polite" style={{ position: 'fixed', bottom: 96, left: 12, right: 12, display: 'grid', gap: 6, pointerEvents: 'none' }}>
        {toasts.map(t => (
          <div key={t.id} role={t.kind === 'error' ? 'alert' : 'status'} className={`toast toast--${t.kind}`}
            style={{ background: t.kind === 'error' ? 'var(--danger)' : 'var(--bg-panel-2)', color: 'var(--text)', padding: '8px 12px', border: '2px solid var(--border)', maxWidth: 480, justifySelf: 'center' }}>
            {t.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToasts(): ToastApi {
  const t = useContext(ToastContext)
  if (!t) throw new Error('useToasts outside <ToastProvider>')
  return t
}
