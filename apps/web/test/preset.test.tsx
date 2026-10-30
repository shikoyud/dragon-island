import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook } from '@testing-library/react'
import { DEFAULT_PRESET, newPlayer, PRESETS } from '@wyrmhaven/game-core'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { ApiProvider } from '../src/api/ApiProvider'
import type { Api } from '../src/api/client'
import { ME_KEY } from '../src/state/me'
import { presetOf, usePreset } from '../src/state/preset'

const withMe = (game: unknown) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  qc.setQueryData(ME_KEY, { playerId: 'p1', address: '0xabc', state: newPlayer(0), balanceWei: 0n, earningUnlocked: false, banned: false, game })
  return ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}><ApiProvider api={{} as Api}>{children}</ApiProvider></QueryClientProvider>
}

describe('usePreset', () => {
  it('is PRESETS[me.game.preset], and Flash-14 until /me has loaded', () => {
    expect(presetOf(undefined)).toBe(DEFAULT_PRESET)
    expect(renderHook(() => usePreset(), { wrapper: withMe(undefined) }).result.current).toBe(DEFAULT_PRESET)
    expect(renderHook(() => usePreset(), { wrapper: withMe({ preset: 'flash28' }) }).result.current).toBe(PRESETS.flash28)
  })
})
