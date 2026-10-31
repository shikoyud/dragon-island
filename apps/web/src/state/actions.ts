import type { ActionResponse, ClientAction } from '@wyrmhaven/shared'
import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useRef, useState } from 'react'
import { useApi } from '../api/ApiProvider'
import { ApiError } from '../api/client'
import { sessionStore } from '../api/session'
import { useToasts } from '../ui/Toast'
import type { Me } from '../api/client'
import { dropMessages } from './drops'
import { applyStateFromResponse, ME_KEY } from './me'

export interface ActionHook {
  /** Resolves to the response, or `null` after a failure that was already shown as a toast. Never rejects. */
  run(action: ClientAction): Promise<ActionResponse | null>
  pending: boolean
  error: ApiError | null
  clearError(): void
}

/**
 * The one way the client changes game state. One action in flight at a time (the server locks the
 * row anyway); a fresh idempotency key per run, reused only when the network failed before a reply.
 * A successful reply replaces the cached state; a failure leaves it untouched, exposes the code and
 * toasts the mapped message, so panels can `void run(...)` safely.
 */
export function useAction(): ActionHook {
  const api = useApi()
  const qc = useQueryClient()
  const toasts = useToasts()
  const inFlight = useRef(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<ApiError | null>(null)

  const run = useCallback(async (action: ClientAction): Promise<ActionResponse | null> => {
    if (inFlight.current) return null
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
      const before = qc.getQueryData<Me>(ME_KEY)?.state
      await applyStateFromResponse(qc, res.state)
      // A completed clear can drop Gold, Food or a speed-up token (R54/R55): said once, here, whichever way it finished.
      if (before) for (const text of dropMessages(before, res.state)) toasts.info(text)
      // Token charges change balanceWei, which only /me carries.
      if (res.effects.some(ef => ef.type === 'charge')) void qc.invalidateQueries({ queryKey: ME_KEY })
      return res
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.status === 401) sessionStore.clear()
        setError(e)
      }
      toasts.error(e)
      return null
    } finally {
      inFlight.current = false
      setPending(false)
    }
  }, [api, qc, toasts])

  return { run, pending, error, clearError: () => setError(null) }
}
