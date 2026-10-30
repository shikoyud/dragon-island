import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { parseSiweMessage } from 'viem/siwe'
import { describe, expect, it, vi } from 'vitest'
import { ApiProvider } from '../src/api/ApiProvider'
import { createApi } from '../src/api/client'
import { sessionStore } from '../src/api/session'
import { SignIn } from '../src/wallet/SignIn'
import { WalletProvider, type WalletAdapter } from '../src/wallet/WalletProvider'

const ADDRESS = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8' as const

function fakeApi(verifyStatus = 200) {
  const calls: { url: string; body?: unknown }[] = []
  const impl = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = String(input)
    const body = init.body ? JSON.parse(String(init.body)) : undefined
    calls.push({ url, body })
    if (url.endsWith('/auth/nonce')) return Response.json({ nonce: 'n0nce12345678' })
    if (url.endsWith('/auth/verify')) {
      return verifyStatus === 200
        ? Response.json({ token: 'tok', playerId: 'p1', address: ADDRESS })
        : Response.json({ error: 'UNAUTHORIZED' }, { status: 401 })
    }
    if (url.endsWith('/me')) return Response.json({ playerId: 'p1', address: ADDRESS, state: {}, balanceWei: '0', earningUnlocked: false, banned: false })
    return Response.json({ error: 'NOT_FOUND' }, { status: 404 })
  }) as typeof fetch
  return { api: createApi({ baseUrl: '/api', getToken: () => sessionStore.get()?.token ?? null, onUnauthorized: () => sessionStore.clear(), fetchImpl: impl }), calls }
}

function wallet(overrides: Partial<WalletAdapter> = {}): WalletAdapter {
  return {
    address: ADDRESS, chainId: 46630, isConnected: true,
    connect: vi.fn(async () => {}),
    switchChain: vi.fn(async () => {}),
    signMessage: vi.fn(async (_m: string) => '0xsig' as `0x${string}`),
    ...overrides,
  }
}

function renderSignIn(api: ReturnType<typeof createApi>, w: WalletAdapter) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <ApiProvider api={api}>
        <WalletProvider adapter={w}>
          <SignIn />
        </WalletProvider>
      </ApiProvider>
    </QueryClientProvider>,
  )
}

describe('<SignIn>', () => {
  it('signs a SIWE message for chain 46630 and stores the session', async () => {
    const { api, calls } = fakeApi()
    const w = wallet()
    renderSignIn(api, w)
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))
    await waitFor(() => expect(sessionStore.get()?.token).toBe('tok'))
    const signed = (w.signMessage as ReturnType<typeof vi.fn>).mock.calls[0]![0] as string
    const parsed = parseSiweMessage(signed)
    expect(parsed.chainId).toBe(46630)
    expect(parsed.nonce).toBe('n0nce12345678')
    expect(parsed.address).toBe(ADDRESS)
    expect(calls.find(c => c.url.endsWith('/auth/verify'))!.body).toEqual({ message: signed, signature: '0xsig' })
    expect(screen.getByText(/0x7099…79C8/)).toBeInTheDocument()
  })

  it('shows a rejected signature', async () => {
    const { api } = fakeApi()
    renderSignIn(api, wallet({ signMessage: vi.fn(async () => { throw new Error('User rejected') }) }))
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))
    expect(await screen.findByText(/signature rejected/i)).toBeInTheDocument()
    expect(sessionStore.get()).toBeNull()
  })

  it('asks to switch network on the wrong chain and to connect when disconnected', async () => {
    const { api } = fakeApi()
    const w = wallet({ chainId: 1 })
    const { unmount } = renderSignIn(api, w)
    await userEvent.click(screen.getByRole('button', { name: /switch to robinhood chain testnet/i }))
    expect(w.switchChain).toHaveBeenCalledWith(46630)
    unmount()
    const w2 = wallet({ isConnected: false, address: null })
    renderSignIn(api, w2)
    await userEvent.click(screen.getByRole('button', { name: /connect wallet/i }))
    expect(w2.connect).toHaveBeenCalled()
  })

  it('surfaces a failed verification', async () => {
    const { api } = fakeApi(401)
    renderSignIn(api, wallet())
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))
    expect(await screen.findByText(/sign-in failed/i)).toBeInTheDocument()
  })
})
