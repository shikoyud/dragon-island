'use client'

import { useCallback, useEffect, useState } from 'react'
import type { EntrantState } from '../../server/entrants'

export type EntrantResult = { state: EntrantState | null | 'loading'; refresh(): Promise<void> }

/** The signed-in entrant from `GET /api/me`; null when signed out (401) or on error. */
export function useEntrant(): EntrantResult {
  const [state, setState] = useState<EntrantState | null | 'loading'>('loading')

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/me', { credentials: 'same-origin', cache: 'no-store' })
      setState(res.ok ? ((await res.json()) as EntrantState) : null)
    } catch {
      setState(null)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { state, refresh }
}
