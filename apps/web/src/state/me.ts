import { DEFAULT_PRESET, PRESETS, type PlayerState, type Preset } from '@wyrmhaven/game-core'
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
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

/** The soft-economy preset the server runs (`/me.game.preset`); Flash-14 until /me has loaded. */
export function presetOf(me: Pick<Me, 'game'> | undefined): Preset {
  return PRESETS[me?.game?.preset ?? DEFAULT_PRESET.id]
}

/** Task B9 replaces this pass-through with the proper preset hook. */
export function usePreset(): Preset {
  return presetOf(useMe().data)
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
