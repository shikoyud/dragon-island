import { newPlayer } from '@wyrmhaven/game-core'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { ApiProvider } from '../src/api/ApiProvider'
import { ApiError, type Api } from '../src/api/client'
import { sessionStore } from '../src/api/session'
import { ME_KEY } from '../src/state/me'
import { useAction } from '../src/state/actions'
import { ErrorBoundary } from '../src/ui/ErrorBoundary'
import { Shell, useLayout } from '../src/Shell'
import { ToastProvider, useToasts } from '../src/ui/Toast'

function setWidth(px: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: px })
  window.dispatchEvent(new Event('resize'))
}

function Providers({ children, api }: { children: ReactNode; api?: Partial<Api> }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  qc.setQueryData(ME_KEY, { playerId: 'p1', address: '0xabc', state: newPlayer(0), balanceWei: 0n, earningUnlocked: false, banned: false, season: null })
  sessionStore.set({ token: 't', playerId: 'p1', address: '0xabc' })
  return <QueryClientProvider client={qc}><ApiProvider api={(api ?? {}) as Api}><ToastProvider>{children}</ToastProvider></ApiProvider></QueryClientProvider>
}

describe('layout', () => {
  it('uses a bottom sheet below 900px and a sidebar above', () => {
    setWidth(360)
    const Probe = () => <div data-testid="layout">{useLayout()}</div>
    render(<Probe />)
    expect(screen.getByTestId('layout')).toHaveTextContent('sheet')
    act(() => setWidth(1280))
    expect(screen.getByTestId('layout')).toHaveTextContent('sidebar')
  })

  it('renders the shell with the layout attribute', () => {
    setWidth(360)
    render(<Providers><Shell header={<span>hdr</span>} canvas={<div>canvas</div>} side={<div>side</div>} /></Providers>)
    expect(screen.getByTestId('shell')).toHaveAttribute('data-layout', 'sheet')
  })
})

describe('toasts and errors', () => {
  it('shows one toast with the mapped message when an action fails', async () => {
    const api = { action: vi.fn(async () => { throw new ApiError(422, 'PLOT_BUSY') }) }
    const Trigger = () => {
      const { run } = useAction()
      const toasts = useToasts()
      return <button type="button" onClick={() => run({ type: 'harvest', plot: 0 }).catch(e => toasts.error(e))}>go</button>
    }
    render(<Providers api={api}><Trigger /></Providers>)
    await userEvent.click(screen.getByRole('button', { name: 'go' }))
    const alerts = await screen.findAllByRole('alert')
    expect(alerts).toHaveLength(1)
    expect(alerts[0]).toHaveTextContent(/something is already growing/i)
  })

  it('catches render errors with a reload button', () => {
    const Boom = () => { throw new Error('kaboom') }
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<ErrorBoundary><Boom /></ErrorBoundary>)
    expect(screen.getByText(/something broke/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /reload/i })).toBeInTheDocument()
    spy.mockRestore()
  })
})
