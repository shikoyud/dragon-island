import { useSyncExternalStore } from 'react'

export interface Session { token: string; playerId: string; address: `0x${string}` }

const KEY = 'dris.session'
const listeners = new Set<() => void>()
let cached: Session | null | undefined

function read(): Session | null {
  if (cached !== undefined) return cached
  try {
    const raw = localStorage.getItem(KEY)
    cached = raw ? (JSON.parse(raw) as Session) : null
  } catch {
    cached = null
  }
  return cached
}

function notify() {
  for (const l of listeners) l()
}

/** The signed-in session, persisted per browser so a reload keeps the player signed in. */
export const sessionStore = {
  get: read,
  set(session: Session) {
    cached = session
    try { localStorage.setItem(KEY, JSON.stringify(session)) } catch { /* private mode */ }
    notify()
  },
  clear() {
    cached = null
    try { localStorage.removeItem(KEY) } catch { /* ignore */ }
    notify()
  },
  subscribe(l: () => void) {
    listeners.add(l)
    return () => { listeners.delete(l) }
  },
}

export function useSession(): Session | null {
  return useSyncExternalStore(sessionStore.subscribe, sessionStore.get, sessionStore.get)
}
