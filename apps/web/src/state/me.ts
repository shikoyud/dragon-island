import { gameDay, type PlayerState } from '@wyrmhaven/game-core'
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { useApi } from '../api/ApiProvider'
import type { Me } from '../api/client'
import { useSession } from '../api/session'

export const ME_KEY = ['me'] as const

/** The player's server state; the single source of truth for every panel and scene. */
export function useMe() {
  const api = useApi()
  const session = useSession()
  return useQuery({
    queryKey: ME_KEY,
    queryFn: () => api.me(),
    enabled: session !== null,
    staleTime: 10_000,
  })
}

/**
 * Replaces the cached state with the one an action response carried. An in-flight /me refetch started
 * before the action is cancelled first so its older snapshot cannot land on top of the newer state.
 */
export async function applyStateFromResponse(qc: QueryClient, state: PlayerState): Promise<void> {
  await qc.cancelQueries({ queryKey: ME_KEY })
  qc.setQueryData<Me>(ME_KEY, old => (old ? { ...old, state } : old))
}

export function useInvalidateMe() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: ME_KEY })
}

/**
 * An open tab turns with the game day: when the synced day changes, /me is refetched, so the server settles the XP banked
 * at the old limit and the bar, the unlock reasons and the level-up screen follow (the first reading is not a turn).
 */
export function useRefreshOnNewDay(game: { launchAtMs: number } | undefined, nowMs: number): void {
  const qc = useQueryClient()
  const day = game ? gameDay(game.launchAtMs, nowMs) : null
  const last = useRef<number | null>(null)
  useEffect(() => {
    if (day === null) { last.current = null; return }
    const prev = last.current
    last.current = day
    if (prev !== null && prev !== day) void qc.invalidateQueries({ queryKey: ME_KEY })
  }, [day, qc])
}
