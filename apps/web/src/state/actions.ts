import type { ActionResponse, ClientAction } from '@wyrmhaven/shared'
import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useRef, useState } from 'react'
import { useApi } from '../api/ApiProvider'
import { ApiError } from '../api/client'
import { sessionStore } from '../api/session'
import { applyStateFromResponse } from './me'

export interface ActionHook {
  run(action: ClientAction): Promise<ActionResponse>
  pending: boolean
  error: ApiError | null
  lastSp: { awarded: number; today: number } | null
  clearError(): void
}

/**
 * The one way the client changes game state. One action in flight at a time (the server locks the
 * row anyway); a fresh idempotency key per run, reused only when the network failed before a reply.
 * A successful reply replaces the cached state; a 4xx leaves it untouched and exposes the code.
 */
export function useAction(): ActionHook {
  const api = useApi()
  const qc = useQueryClient()
  const inFlight = useRef(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<ApiError | null>(null)
  const [lastSp, setLastSp] = useState<{ awarded: number; today: number } | null>(null)

  const run = useCallback(async (action: ClientAction): Promise<ActionResponse> => {
    if (inFlight.current) throw new Error('An action is already in progress')
    inFlight.current = true
    setPending(true)
    setError(null)
    const key = crypto.randomUUID()
    try {
      let res: ActionResponse
      try {
        res = await api.action(action, key)
      } catch (e) {
        if (e instanceof ApiError) throw e
        // Network failure before any reply: the server may or may not have seen the key; retry once with it.
        res = await api.action(action, key)
      }
      applyStateFromResponse(qc, res.state)
      if (res.sp && res.sp.awarded > 0) setLastSp(res.sp)
      return res
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.status === 401) sessionStore.clear()
        setError(e)
      }
      throw e
    } finally {
      inFlight.current = false
      setPending(false)
    }
  }, [api, qc])

  return { run, pending, error, lastSp, clearError: () => setError(null) }
}
