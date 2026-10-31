import {
  battleSeed32, createRng, newPlayer, simulateBattle, type BattleDragonSpec, type OpponentSnapshot, type PlayerMove, type PlayerState,
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
const T1: PlayerMove = { kind: 'attack', move: 1 }

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

// Flame is 2x against nature, so a flame L20 team one-shots the nature L1 bots with T1.
const dragons = (speciesId: string, level: number) => TEAM.map(id => ({ id, speciesId, level, feeds: 0, habitatId: 'h1' }))
const s8: PlayerState = { ...newPlayer(0), level: 8, dragons: dragons('flame', 20), defenceTeam: TEAM }

describe('useBattle', () => {
  it('previews with the offer seed, offers only legal moves, and submits exactly the chosen list', async () => {
    const { wrapper, action } = harness(s8)
    const { result } = renderHook(() => useBattle(), { wrapper })
    act(() => result.current.startPvp(offer, TEAM))
    expect(result.current.preview?.state.toAct).toBe('attacker')
    expect(result.current.legal).toEqual([
      { kind: 'attack', move: 0 }, { kind: 'attack', move: 1 }, { kind: 'attack', move: 2 }, { kind: 'attack', move: 3 },
      { kind: 'swap', to: 1 }, { kind: 'swap', to: 2 },
    ])
    act(() => result.current.choose(T1))
    act(() => result.current.choose(T1))
    act(() => result.current.choose(T1))
    const done = result.current.preview!.done!
    expect(done.ok && done.winner).toBe('attacker')
    expect(result.current.legal).toEqual([])
    const local = simulateBattle(three('flame', 20), bot.team, [T1, T1, T1], createRng(battleSeed32(SEED_HEX)), result.current.catalog)
    expect(done).toEqual(local)
    await act(async () => { await result.current.submit() })
    expect(action).toHaveBeenCalledWith({ type: 'pvpBattle', offerId: 'offer-1', team: TEAM, moves: [T1, T1, T1] }, expect.any(String))
  })

  it('undoes the last move and labels PvE previews approximate', () => {
    const { wrapper } = harness(s8)
    const { result } = renderHook(() => useBattle(), { wrapper })
    act(() => result.current.startPve(1, TEAM))
    expect(result.current.exactPreview).toBe(false)
    act(() => result.current.choose(T1))
    expect(result.current.moves).toHaveLength(1)
    act(() => result.current.undo())
    expect(result.current.moves).toHaveLength(0)
  })
})

const host = (state: PlayerState, opp: Offer = offer) => {
  const { wrapper } = harness(state)
  const Host = () => {
    const b = useBattle()
    if (!b.preview) { b.startPvp(opp, TEAM); return null }
    return <BattlePanel battle={b} />
  }
  render(<Host />, { wrapper })
}
const moveGroup = () => within(screen.getByRole('group', { name: /^move$/i }))

describe('BattlePanel', () => {
  it('shows the four moves and the swaps, and has no target to pick', async () => {
    host(s8)
    expect(moveGroup().getAllByRole('button').map(b => b.textContent)).toEqual(['Strike', 'Cinder Spit', 'Blaze Lash', 'Inferno Crown'])
    expect(within(screen.getByRole('group', { name: /^swap$/i })).getAllByRole('button')).toHaveLength(2)
    expect(screen.queryByRole('group', { name: /target/i })).toBeNull()
  })

  it('every battle button asks for a 44 px tap target', () => {
    host(s8)
    for (const group of [/^move$/i, /^swap$/i]) {
      for (const b of within(screen.getByRole('group', { name: group })).getAllByRole('button')) expect(b).toHaveStyle({ minHeight: '44px' })
    }
  })

  it('disables a level-locked move', () => {
    host({ ...s8, dragons: dragons('flame', 9) })
    expect(moveGroup().getByRole('button', { name: 'Strike' })).toBeEnabled()
    expect(moveGroup().getByRole('button', { name: 'Cinder Spit' })).toBeEnabled()
    expect(moveGroup().getByRole('button', { name: 'Blaze Lash' })).toBeDisabled()
    expect(moveGroup().getByRole('button', { name: 'Inferno Crown' })).toBeDisabled()
  })

  it('a Tier 3 used is disabled on the next action', async () => {
    host(s8, { ...offer, opponent: { ...bot, team: three('terra', 1) } })
    await userEvent.click(moveGroup().getByRole('button', { name: 'Inferno Crown' }))
    expect(moveGroup().getByRole('button', { name: 'Inferno Crown' })).toBeDisabled()
  })

  it('a swap changes the active dragon and uses the turn', async () => {
    host(s8, { ...offer, opponent: { ...bot, team: three('sea', 1) } })
    await userEvent.click(within(screen.getByRole('group', { name: /^swap$/i })).getAllByRole('button')[0]!)
    expect(screen.getByText(/turn 2 of 30/i)).toBeInTheDocument()
  })

  it('asks for a replacement after a KO, and nothing else until then', async () => {
    // Flame L1 falls to the first hit from Sea L40, on the defender's reply.
    host({ ...s8, dragons: dragons('flame', 1) }, { ...offer, opponent: { ...bot, team: three('sea', 40) } })
    await userEvent.click(moveGroup().getByRole('button', { name: 'Strike' }))
    const group = within(screen.getByRole('group', { name: /^replacement$/i }))
    expect(screen.queryByRole('group', { name: /^move$/i })).toBeNull()
    expect(group.getAllByRole('button')).toHaveLength(2)
    expect(group.getAllByRole('button')[0]).toHaveStyle({ minHeight: '44px' })
    await userEvent.click(group.getAllByRole('button')[1]!)
    expect(screen.getByRole('group', { name: /^move$/i })).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: /^replacement$/i })).toBeNull()
  })

  it('enables Submit only when the preview is complete, and Undo steps back', async () => {
    host(s8)
    expect(screen.getByRole('button', { name: /submit/i })).toBeDisabled()
    await userEvent.click(moveGroup().getByRole('button', { name: 'Cinder Spit' }))
    await userEvent.click(moveGroup().getByRole('button', { name: 'Cinder Spit' }))
    await userEvent.click(moveGroup().getByRole('button', { name: 'Cinder Spit' }))
    expect(screen.getByRole('button', { name: /submit/i })).toBeEnabled()
    expect(screen.getByText(/you win/i)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /undo/i }))
    expect(screen.queryByText(/you win/i)).toBeNull()
    expect(screen.getByRole('button', { name: /submit/i })).toBeDisabled()
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
