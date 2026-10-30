import {
  battleSeed32, createRng, newPlayer, simulateBattle, type BattleDragonSpec, type OpponentSnapshot, type PlayerState,
} from '@wyrmhaven/game-core'
import type { Offer } from '@wyrmhaven/shared'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, renderHook, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { ApiProvider } from '../src/api/ApiProvider'
import { ToastProvider } from '../src/ui/Toast'
import type { Api } from '../src/api/client'
import { sessionStore } from '../src/api/session'
import { BattlePanel } from '../src/panels/BattlePanel'
import { PvePanel } from '../src/panels/PvePanel'
import { useBattle } from '../src/state/battle'
import { ME_KEY } from '../src/state/me'

const TEAM: [string, string, string] = ['d1', 'd2', 'd3']
const three = (id: string, level: number): BattleDragonSpec[] => [{ speciesId: id, level }, { speciesId: id, level }, { speciesId: id, level }]
const SEED_HEX = `0x${'ab'.repeat(32)}` as const
const bot: OpponentSnapshot = { playerId: null, trophies: 0, level: 8, team: three('nature', 1) }
const offer: Offer = { offerId: 'offer-1', opponent: bot, seedHex: SEED_HEX }

function harness(state: PlayerState) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  qc.setQueryData(ME_KEY, { playerId: 'p1', address: '0xabc', state, balanceWei: 0n, earningUnlocked: false, banned: false })
  sessionStore.set({ token: 't', playerId: 'p1', address: '0xabc' })
  const action = vi.fn(async () => ({ state, effects: [], battle: undefined }))
  const api = { action, offers: vi.fn(async () => ({ offers: [offer] })) } as unknown as Api
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}><ApiProvider api={api}><ToastProvider>{children}</ToastProvider></ApiProvider></QueryClientProvider>
  )
  return { wrapper, action, qc }
}

// Flame is ×2 against nature, so a flame L20 team one-shots the nature L1 bots (sea would be ×0.5).
const flameTeam = (level: number) => TEAM.map(id => ({ id, speciesId: 'flame', level, feeds: 0, habitatId: 'h1' }))
const s8: PlayerState = { ...newPlayer(0), level: 8, dragons: flameTeam(20), defenceTeam: TEAM }

describe('useBattle', () => {
  it('previews with the offer seed, offers only legal moves, and submits exactly the chosen list', async () => {
    const { wrapper, action } = harness(s8)
    const { result } = renderHook(() => useBattle(), { wrapper })
    act(() => result.current.startPvp(offer, TEAM))
    expect(result.current.preview?.next).toEqual({ side: 'attacker', slot: 0 })
    expect(result.current.legalMoves()).toHaveLength(6) // 2 moves (flame, Strike) × 3 living targets
    act(() => result.current.choose(0, 0))
    act(() => result.current.choose(0, 1))
    expect(result.current.legalMoves().every(m => m.target === 2)).toBe(true)
    act(() => result.current.choose(0, 2))
    const done = result.current.preview!.done!
    expect(done.ok && done.winner).toBe('attacker')
    const local = simulateBattle(three('flame', 20), bot.team, [{ move: 0, target: 0 }, { move: 0, target: 1 }, { move: 0, target: 2 }], createRng(battleSeed32(SEED_HEX)), result.current.catalog)
    expect(done).toEqual(local)
    await act(async () => { await result.current.submit() })
    expect(action).toHaveBeenCalledWith({ type: 'pvpBattle', offerId: 'offer-1', team: TEAM, moves: [{ move: 0, target: 0 }, { move: 0, target: 1 }, { move: 0, target: 2 }] }, expect.any(String))
  })

  it('undoes the last move and labels PvE previews approximate', () => {
    const { wrapper } = harness(s8)
    const { result } = renderHook(() => useBattle(), { wrapper })
    act(() => result.current.startPve(1, TEAM))
    expect(result.current.exactPreview).toBe(false)
    act(() => result.current.choose(0, 0))
    expect(result.current.moves).toHaveLength(1)
    act(() => result.current.undo())
    expect(result.current.moves).toHaveLength(0)
  })
})

describe('BattlePanel', () => {
  it('disables KO’d targets and enables Submit only when the preview is complete', async () => {
    const { wrapper } = harness(s8)
    const Host = () => {
      const b = useBattle()
      if (!b.preview) { b.startPvp(offer, TEAM); return null }
      return <BattlePanel battle={b} />
    }
    render(<Host />, { wrapper })
    const submit = await screen.findByRole('button', { name: /submit/i })
    expect(submit).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: /^flame$/i }))
    await userEvent.click(screen.getByRole('button', { name: /target 1/i }))
    // slot 0 is now KO'd (flame L20 one-shots nature L1)
    expect(screen.getByRole('button', { name: /target 1/i })).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: /^flame$/i }))
    await userEvent.click(screen.getByRole('button', { name: /target 2/i }))
    await userEvent.click(screen.getByRole('button', { name: /^flame$/i }))
    await userEvent.click(screen.getByRole('button', { name: /target 3/i }))
    expect(screen.getByRole('button', { name: /submit/i })).toBeEnabled()
    expect(screen.getByText(/you win/i)).toBeInTheDocument()
  })
})

describe('PvePanel', () => {
  it('locks stages past the next one and shows replays left', () => {
    const { wrapper } = harness(s8)
    render(<PvePanel onFight={() => {}} />, { wrapper })
    const stages = screen.getByRole('list', { name: /stages/i })
    expect(within(stages).getByRole('button', { name: /^stage 1 ·/i })).toBeEnabled()
    expect(within(stages).getByRole('button', { name: /^stage 2 ·/i })).toBeDisabled()
    expect(screen.getByText(/replays left: 10/i)).toBeInTheDocument()
    expect(within(stages).getByRole('button', { name: /^stage 1 ·/i })).toHaveTextContent('100 gold')
  })
})
