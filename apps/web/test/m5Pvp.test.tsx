// Task 9 (review of Task 7): the Arena panel shows species names, not ids.
import { LAUNCH_CATALOG, newPlayer, type PlayerState } from '@wyrmhaven/game-core'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ApiProvider } from '../src/api/ApiProvider'
import type { Api } from '../src/api/client'
import { sessionStore } from '../src/api/session'
import { PvpPanel } from '../src/panels/PvpPanel'
import { ME_KEY } from '../src/state/me'
import { ToastProvider } from '../src/ui/Toast'

const name = (id: string): string => LAUNCH_CATALOG.species.get(id)!.name

describe('PvpPanel shows names, not ids', () => {
  it('lists your dragons and the opponents by species name', async () => {
    const state: PlayerState = {
      ...newPlayer(0), level: 8,
      dragons: [{ id: 'd-17f3', speciesId: 'flame', level: 20, feeds: 0, habitatId: 'h1' }, { id: 'd-9a2c', speciesId: 'sea', level: 12, feeds: 0, habitatId: 'h1' }],
    }
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    qc.setQueryData(ME_KEY, { playerId: 'p1', address: '0xabc', state, balanceWei: 0n, earningUnlocked: false, banned: false })
    sessionStore.set({ token: 't', playerId: 'p1', address: '0xabc' })
    const offers = { offers: [{ offerId: 'o1', seedHex: `0x${'ab'.repeat(32)}`, opponent: { playerId: null, trophies: 40, level: 6, team: [{ speciesId: 'nature', level: 3 }, { speciesId: 'terra', level: 2 }, { speciesId: 'ice', level: 4 }] } }] }
    const api = { offers: vi.fn(async () => offers), action: vi.fn() } as unknown as Api
    render(<QueryClientProvider client={qc}><ApiProvider api={api}><ToastProvider><PvpPanel onFight={vi.fn()} /></ToastProvider></ApiProvider></QueryClientProvider>)
    expect(screen.getByRole('button', { name: `${name('flame')} L20` })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: `${name('sea')} L12` })).toBeInTheDocument()
    expect(document.body).not.toHaveTextContent('d-17f3')
    await userEvent.click(screen.getByRole('button', { name: 'Find opponents' }))
    const list = await screen.findByRole('list', { name: 'Opponents' })
    expect(list).toHaveTextContent(`${name('nature')} L3, ${name('terra')} L2, ${name('ice')} L4`)
  })
})
