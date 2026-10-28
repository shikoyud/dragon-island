'use client'

import { useCallback, useEffect, useState } from 'react'
import type { EntrantState } from '../../server/entrants'

export type EntrantResult = {
  state: EntrantState | null | 'loading'
  /** The last refresh failed for a reason other than 401; `state` is the previous value. */
  failed: boolean
  refresh(): Promise<void>
}

/**
 * The signed-in entrant from `GET /api/me`. Only a 401 means signed out (null); any other failure
 * keeps the previous state and sets `failed`, so a blip never bounces the user back to Connect X.
 */
export function useEntrant(): EntrantResult {
  const [state, setState] = useState<EntrantState | null | 'loading'>('loading')
  const [failed, setFailed] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/me', { credentials: 'same-origin', cache: 'no-store' })
      if (res.status === 401) setState(null)
      else if (res.ok) setState((await res.json()) as EntrantState)
      else throw new Error(`GET /api/me: ${res.status}`)
      setFailed(false)
    } catch {
      setFailed(true)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { state, failed, refresh }
}
