import { newPlayer, type PlayerState } from '@wyrmhaven/game-core'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { ApiProvider } from '../src/api/ApiProvider'
import { ToastProvider } from '../src/ui/Toast'
import { ApiError, type Api } from '../src/api/client'
import { sessionStore } from '../src/api/session'
import { useAction } from '../src/state/actions'
import { ME_KEY } from '../src/state/me'

function setup(actionImpl: Api['action']) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const me = { playerId: 'p1', address: '0xabc' as const, state: newPlayer(0), balanceWei: 0n, earningUnlocked: false, banned: false }
  qc.setQueryData(ME_KEY, me)
  sessionStore.set({ token: 't', playerId: 'p1', address: '0xabc' })
  const api = { action: actionImpl } as unknown as Api
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}><ApiProvider api={api}><ToastProvider>{children}</ToastProvider></ApiProvider></QueryClientProvider>
  )
  return { qc, wrapper, state: () => (qc.getQueryData(ME_KEY) as { state: PlayerState }).state }
}

describe('useAction', () => {
  it('sends a fresh uuid key and applies the returned state', async () => {
    const impl = vi.fn(async (_a, _k) => ({ state: { ...newPlayer(0), gold: 1020 }, effects: [] }))
    const { wrapper, state } = setup(impl as Api['action'])
    const { result } = renderHook(() => useAction(), { wrapper })
    await act(async () => { await result.current.run({ type: 'collectGold', habitatId: 'h1' }) })
    const key = impl.mock.calls[0]![1] as string
    expect(key).toMatch(/^[0-9a-f-]{36}$/)
    expect(state().gold).toBe(1020)
    await act(async () => { await result.current.run({ type: 'collectGold', habitatId: 'h1' }) })
    expect(impl.mock.calls[1]![1]).not.toBe(key)
  })

  it('keeps the last good state and exposes the code on a 422', async () => {
    const impl = vi.fn(async () => { throw new ApiError(422, 'PLOT_BUSY') })
    const { wrapper, state } = setup(impl as unknown as Api['action'])
    const { result } = renderHook(() => useAction(), { wrapper })
    await act(async () => { await result.current.run({ type: 'plant', plot: 0, crop: 'dragonBush' }).catch(() => {}) })
    expect(state().gold).toBe(1000)
    await waitFor(() => expect(result.current.error?.code).toBe('PLOT_BUSY'))
  })

  it('retries a network failure once with the same key, never a 4xx', async () => {
    let calls = 0
    const impl = vi.fn(async (_a, _k) => {
      calls++
      if (calls === 1) throw new TypeError('fetch failed')
      return { state: newPlayer(0), effects: [] }
    })
    const { wrapper } = setup(impl as Api['action'])
    const { result } = renderHook(() => useAction(), { wrapper })
    await act(async () => { await result.current.run({ type: 'harvest', plot: 0 }) })
    expect(impl).toHaveBeenCalledTimes(2)
    expect(impl.mock.calls[0]![1]).toBe(impl.mock.calls[1]![1])

    const bad = vi.fn(async () => { throw new ApiError(402, 'INSUFFICIENT_TOKENS') })
    const s2 = setup(bad as unknown as Api['action'])
    const h2 = renderHook(() => useAction(), { wrapper: s2.wrapper })
    await act(async () => { await h2.result.current.run({ type: 'harvest', plot: 0 }).catch(() => {}) })
    expect(bad).toHaveBeenCalledTimes(1)
  })

  it('clears the session on a 401 and refuses overlapping runs', async () => {
    let resolve!: (v: unknown) => void
    const impl = vi.fn(() => new Promise(r => { resolve = r }))
    const { wrapper } = setup(impl as unknown as Api['action'])
    const { result } = renderHook(() => useAction(), { wrapper })
    let first!: Promise<unknown>
    act(() => { first = result.current.run({ type: 'harvest', plot: 0 }) })
    await waitFor(() => expect(result.current.pending).toBe(true))
    await expect(result.current.run({ type: 'harvest', plot: 0 })).resolves.toBeNull() // overlapping run is refused
    await act(async () => { resolve({ state: newPlayer(0), effects: [] }); await first })

    const unauth = vi.fn(async () => { throw new ApiError(401, 'UNAUTHORIZED') })
    const s2 = setup(unauth as unknown as Api['action'])
    const h2 = renderHook(() => useAction(), { wrapper: s2.wrapper })
    await act(async () => { await h2.result.current.run({ type: 'harvest', plot: 0 }).catch(() => {}) })
    expect(sessionStore.get()).toBeNull()
  })
})
