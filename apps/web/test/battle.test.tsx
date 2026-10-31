// §6.1, §6.2, R80: the portrait battle screen's React side. The scene has battleScene.test.ts; real pixels have e2e/battle.spec.ts.
import {
  battleSeed32, createRng, LAUNCH_CATALOG, newPlayer, simulateBattle, type BattleDragonSpec, type BattleState, type OpponentSnapshot, type PlayerMove, type PlayerState,
  elementMultiplier, initBattle, step,
} from '@wyrmhaven/game-core'
import type { Offer } from '@wyrmhaven/shared'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState, type ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiProvider } from '../src/api/ApiProvider'
import { ToastProvider } from '../src/ui/Toast'
import { ApiError, type Api } from '../src/api/client'
import { sessionStore } from '../src/api/session'
import { messageFor } from '../src/api/errors'
import { createBridge } from '../src/game/bridge'
import { BattlePanel, SEND_PATIENCE_MS } from '../src/panels/BattlePanel'
import { INPUT_GUARD_MS } from '../src/game/battleModel'
import { moveCard, pvpForfeitCost, useBattle, type BattleHook } from '../src/state/battle'
import { ME_KEY } from '../src/state/me'

const TEAM: [string, string, string] = ['d1', 'd2', 'd3']
const three = (id: string, level: number): BattleDragonSpec[] => [{ speciesId: id, level }, { speciesId: id, level }, { speciesId: id, level }]
const SEED_HEX = `0x${'ab'.repeat(32)}` as const
const bot: OpponentSnapshot = { playerId: null, trophies: 0, level: 8, team: three('nature', 1) }
const offer: Offer = { offerId: 'offer-1', opponent: bot, seedHex: SEED_HEX }
const T1: PlayerMove = { kind: 'attack', move: 1 }

function harness(state: PlayerState, reply: Record<string, unknown> = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  qc.setQueryData(ME_KEY, { playerId: 'p1', address: '0xabc', state, balanceWei: 0n, earningUnlocked: false, banned: false })
  sessionStore.set({ token: 't', playerId: 'p1', address: '0xabc' })
  const action = vi.fn(async (_a: unknown, _k: string): Promise<unknown> => ({ state, effects: [], battle: { winner: 'attacker', turns: 3 }, ...reply }))
  const me = vi.fn(async () => qc.getQueryData(ME_KEY))
  const api = { action, me, offers: vi.fn(async () => ({ offers: [offer] })) } as unknown as Api
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}><ApiProvider api={api}><ToastProvider>{children}</ToastProvider></ApiProvider></QueryClientProvider>
  )
  return { wrapper, action, me, qc }
}

// Flame is 2x against nature, so a flame L20 team one-shots the nature L1 bots with T1.
const dragons = (speciesId: string, level: number) => TEAM.map(id => ({ id, speciesId, level, feeds: 0, habitatId: 'h1' }))
const s8: PlayerState = { ...newPlayer(0), level: 8, trophies: 100, dragons: dragons('flame', 20), defenceTeam: TEAM }

const c = LAUNCH_CATALOG
const fight = (me: BattleDragonSpec[], foe: BattleDragonSpec[]): BattleState => initBattle(me, foe, c)

describe('moveCard', () => {
  const b = fight(three('flame', 20), three('nature', 1))

  it('names the move, its element and tier, and the hint against the enemy primary', () => {
    expect(moveCard(b, 1)).toEqual({ name: 'Cinder Spit', element: 'flame', tier: 1, hint: '2x', disabledReason: null })
    expect(moveCard(fight(three('flame', 20), three('sea', 1)), 2)).toMatchObject({ name: 'Blaze Lash', tier: 2, hint: '0.5x' })
    const even = [...new Set([...c.species.values()].map(s => s.elements[0]!))].find(el => elementMultiplier('flame', el) === 1)!
    expect(moveCard(fight(three('flame', 20), three(even, 1)), 1).hint).toBe('1x')
  })

  it('Physical is always 1x, even in a mirror', () => {
    expect(moveCard(fight(three('flame', 20), three('flame', 1)), 0)).toEqual({ name: 'Strike', element: 'physical', tier: 'physical', hint: '1x', disabledReason: null })
  })

  it('0x reads IMMUNE, and an immune move is not disabled: the player may still choose it', () => {
    expect(moveCard(fight(three('flame', 20), three('flame', 1)), 1)).toMatchObject({ hint: 'IMMUNE', disabledReason: null })
  })

  it('looks only at the enemy primary (§2.3): a Flame/Sea defender takes 2x from Sea', () => {
    const hybrid = [...c.species.values()].find(s => s.elements[0] === 'flame' && s.elements.includes('sea'))!
    expect(moveCard(fight(three('sea', 20), three(hybrid.id, 1)), 1).hint).toBe('2x')
  })

  it('a locked move says its level; a resting Tier 3 says it rests', () => {
    expect(moveCard(fight(three('flame', 9), three('nature', 1)), 2).disabledReason).toBe('Lv 10')
    expect(moveCard(fight(three('flame', 9), three('nature', 1)), 3).disabledReason).toBe('Lv 20')
    const used = step(fight(three('flame', 20), three('terra', 40)), 'attacker', { kind: 'attack', move: 3 }, createRng(1))!
    expect(moveCard(used, 3).disabledReason).toBe('Rests this turn')
  })
})

describe('pvpForfeitCost', () => {
  it('states the trophies, and never more than the player has', () => {
    expect(pvpForfeitCost(100)).toBe('You lose 15 trophies')
    expect(pvpForfeitCost(1)).toBe('You lose 1 trophy')
    expect(pvpForfeitCost(0)).toBe('It counts as a loss')
  })
})

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

  it('has no undo: the seed is revealed and moves are final', () => {
    const { wrapper } = harness(s8)
    const { result } = renderHook(() => useBattle(), { wrapper })
    expect(result.current).not.toHaveProperty('undo')
    expect(result.current).not.toHaveProperty('canUndo')
  })

  it('stays the same object while nothing about the battle changed, so a clock tick can skip the screen', () => {
    const { wrapper } = harness(s8)
    const { result, rerender } = renderHook(() => useBattle(), { wrapper })
    act(() => result.current.startPvp(offer, TEAM))
    const before = result.current
    rerender()
    expect(result.current).toBe(before)
  })

  it('a PvP exit forfeits: the moves so far go to the server and the result comes back', async () => {
    const { wrapper, action } = harness(s8, { battle: undefined })
    const { result } = renderHook(() => useBattle(), { wrapper })
    act(() => result.current.startPvp(offer, TEAM))
    act(() => result.current.choose(T1))
    await act(async () => { await result.current.abandon() })
    expect(action).toHaveBeenCalledWith({ type: 'pvpBattle', offerId: 'offer-1', team: TEAM, moves: [T1] }, expect.any(String))
    expect(result.current.result).not.toBeNull()
  })
})

/** Three T1s one-shot the three bots: the battle is done and the send goes. */
async function winIt() {
  for (let i = 0; i < 3; i++) {
    await waitFor(() => expect(move(/cinder spit/i)).toBeEnabled())
    await pause()
    await userEvent.click(move(/cinder spit/i))
  }
}

/** Hosts a real hook and panel; reduced motion unless a test wants the timing. */
function host(state: PlayerState, opp: Offer = offer, opts: { motion?: boolean; reply?: Record<string, unknown>; onClose?: () => void } = {}) {
  const h = harness(state, opts.reply)
  const bridge = createBridge()
  bridge.setReducedMotion(!opts.motion)
  const Host = () => {
    const b = useBattle()
    if (!b.preview) { b.startPvp(opp, TEAM); return null }
    return <BattlePanel battle={b} bridge={bridge} onClose={opts.onClose ?? (() => {})} />
  }
  render(<Host />, { wrapper: h.wrapper })
  return { ...h, bridge }
}
/** Past the double-tap guard: two deliberate taps. */
const pause = () => act(() => new Promise<void>(r => setTimeout(r, INPUT_GUARD_MS + 20)))
const moveGroup = () => within(screen.getByRole('group', { name: /^move$/i }))
const move = (name: RegExp) => moveGroup().getByRole('button', { name })
const plate = (name: 'Enemy' | 'Yours') => within(screen.getByRole('group', { name }))

describe('BattlePanel', () => {
  afterEach(() => { vi.useRealTimers() })

  it('lays out the enemy and your dragon with names, levels, HP numbers and bench pips', () => {
    host(s8, { ...offer, opponent: { ...bot, team: [{ speciesId: 'nature', level: 1 }, { speciesId: 'sea', level: 3 }, { speciesId: 'terra', level: 2 }] } })
    expect(plate('Enemy').getByText(/L1\b/)).toBeInTheDocument()
    expect(plate('Enemy').getByText(c.species.get('nature')!.name)).toBeInTheDocument()
    expect(plate('Yours').getByText(c.species.get('flame')!.name)).toBeInTheDocument()
    expect(plate('Yours').getByText('4,718 / 4,718')).toBeInTheDocument()
    expect(plate('Yours').getByRole('progressbar', { name: 'HP' })).toHaveAttribute('aria-valuenow', '100')
    expect(plate('Enemy').getAllByRole('img', { name: /alive/ })).toHaveLength(2)
    // Never a raw id on the screen.
    expect(document.body.textContent).not.toMatch(/\bd1\b|\bnature\b/)
  })

  it('has a 2x2 grid of four moves with name and hint, then Swap', () => {
    host(s8)
    const cards = moveGroup().getAllByRole('button')
    expect(cards).toHaveLength(4)
    expect(cards[0]).toHaveTextContent('Strike')
    expect(cards[0]).toHaveTextContent('1x')
    expect(cards[1]).toHaveTextContent('Cinder Spit')
    expect(cards[1]).toHaveTextContent('2x')
    expect(screen.getByRole('button', { name: 'Swap' })).toBeEnabled()
    expect(screen.queryByRole('group', { name: /target/i })).toBeNull()
  })

  it('every battle button asks for a 44 px tap target', async () => {
    host(s8)
    for (const b of moveGroup().getAllByRole('button')) expect(b).toHaveClass('battle__move')
    expect(screen.getByRole('button', { name: 'Swap' })).toHaveClass('battle__tap')
    expect(screen.getByRole('button', { name: /exit/i })).toHaveClass('battle__tap')
    await userEvent.click(screen.getByRole('button', { name: 'Swap' }))
    for (const b of within(screen.getByRole('group', { name: /^swap$/i })).getAllByRole('button')) expect(b).toHaveClass('battle__tap')
  })

  it('shows Turn n / 30, and no star goal in PvP', () => {
    host(s8)
    expect(screen.getByText('Turn 1 / 30')).toBeInTheDocument()
    expect(screen.queryByText(/3★/)).toBeNull()
  })

  it('a locked move is disabled and says its level', () => {
    host({ ...s8, dragons: dragons('flame', 9) })
    expect(move(/strike/i)).toBeEnabled()
    expect(move(/cinder spit/i)).toBeEnabled()
    expect(move(/blaze lash/i)).toBeDisabled()
    expect(move(/blaze lash/i)).toHaveTextContent('Lv 10')
    expect(move(/inferno crown/i)).toHaveTextContent('Lv 20')
  })

  it('a Tier 3 used rests on the next action, and an immune move stays enabled', async () => {
    host(s8, { ...offer, opponent: { ...bot, team: three('flame', 1) } })
    expect(move(/cinder spit/i)).toHaveTextContent('IMMUNE')
    expect(move(/cinder spit/i)).toBeEnabled()
    await userEvent.click(move(/strike/i))
    await waitFor(() => expect(move(/strike/i)).toBeEnabled())
    expect(move(/inferno crown/i)).toBeEnabled()
    await pause()
    await userEvent.click(move(/inferno crown/i))
    await waitFor(() => expect(move(/inferno crown/i)).toHaveTextContent('Rests this turn'))
    expect(move(/inferno crown/i)).toBeDisabled()
  })

  it('Swap opens the bench with a way back; choosing one uses the turn', async () => {
    host(s8, { ...offer, opponent: { ...bot, team: three('sea', 1) } })
    await userEvent.click(screen.getByRole('button', { name: 'Swap' }))
    const sheet = within(screen.getByRole('group', { name: /^swap$/i }))
    expect(sheet.getAllByRole('button', { name: /L20/ })).toHaveLength(2)
    await userEvent.click(sheet.getByRole('button', { name: /back/i }))
    expect(screen.getByRole('group', { name: /^move$/i })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Swap' }))
    await pause()
    await userEvent.click(within(screen.getByRole('group', { name: /^swap$/i })).getAllByRole('button', { name: /L20/ })[0]!)
    await waitFor(() => expect(screen.getByText('Turn 3 / 30')).toBeInTheDocument())
    expect(screen.getByRole('group', { name: /^move$/i })).toBeInTheDocument()
  })

  it('a KO opens the same list with no way out, and a fallen dragon cannot be picked', async () => {
    // Flame L1 falls to the first hit from Sea L40, on the defender's reply.
    host({ ...s8, dragons: dragons('flame', 1) }, { ...offer, opponent: { ...bot, team: three('sea', 40) } })
    await userEvent.click(move(/strike/i))
    const group = await screen.findByRole('group', { name: /^replacement$/i })
    expect(screen.queryByRole('group', { name: /^move$/i })).toBeNull()
    expect(within(group).queryByRole('button', { name: /back/i })).toBeNull()
    const buttons = within(group).getAllByRole('button')
    expect(buttons).toHaveLength(2)
    // Escape does not close it either: it asks to abandon.
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.getByRole('alertdialog', { name: 'Abandon?' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /keep fighting/i }))
    expect(screen.getByRole('group', { name: /^replacement$/i })).toBeInTheDocument()
    await pause()
    await userEvent.click(within(screen.getByRole('group', { name: /^replacement$/i })).getAllByRole('button')[1]!)
    await screen.findByRole('group', { name: /^move$/i })
    expect(screen.queryByRole('group', { name: /^replacement$/i })).toBeNull()
  })

  it('the turn flow: your action now, the enemy after 600 ms; inputs disabled and nothing spoiled meanwhile', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] })
    host({ ...s8, dragons: dragons('flame', 1) }, { ...offer, opponent: { ...bot, team: three('sea', 40) } }, { motion: true })
    const before = plate('Yours').getByText('1,600 / 1,600')
    expect(before).toBeInTheDocument()
    fireEvent.click(move(/strike/i))
    // Your action is showing: the enemy has lost HP, your HP has not moved, and the KO coming isn't on the screen.
    await act(async () => { await vi.advanceTimersByTimeAsync(0) })
    expect(screen.getByRole('status', { name: 'Last move' })).toHaveTextContent(/strike/i)
    expect(plate('Yours').getByText('1,600 / 1,600')).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: /^replacement$/i })).toBeNull()
    expect(move(/strike/i)).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Swap' })).toBeDisabled()
    await act(async () => { await vi.advanceTimersByTimeAsync(599) })
    expect(plate('Yours').getByText('1,600 / 1,600')).toBeInTheDocument()
    // The enemy's hit lands: HP follows the event. The replacement list waits until it has been seen.
    await act(async () => { await vi.advanceTimersByTimeAsync(1) })
    expect(plate('Yours').queryByText('1,600 / 1,600')).toBeNull()
    expect(plate('Yours').getByText('0 / 1,600')).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: /^replacement$/i })).toBeNull()
    await act(async () => { await vi.advanceTimersByTimeAsync(600) })
    expect(screen.getByRole('group', { name: /^replacement$/i })).toBeInTheDocument()
  })

  it('reduced motion jumps to the result with no delay', async () => {
    host({ ...s8, dragons: dragons('flame', 1) }, { ...offer, opponent: { ...bot, team: three('sea', 40) } })
    fireEvent.click(move(/strike/i))
    expect(await screen.findByRole('group', { name: /^replacement$/i })).toBeInTheDocument()
    expect(plate('Yours').getByText('0 / 1,600')).toBeInTheDocument()
  })

  it('tells the scene how far the log has played', async () => {
    const { bridge } = host(s8, { ...offer, opponent: { ...bot, team: three('sea', 40) } })
    expect(bridge.battleShown).toBe(0)
    await userEvent.click(move(/strike/i))
    await waitFor(() => expect(bridge.battleShown).toBe(2))
  })

  it('when done, sends the action once by itself and shows the result, then Continue closes', async () => {
    const onClose = vi.fn()
    const { action } = host(s8, offer, { onClose })
    await winIt()
    expect(await screen.findByRole('status', { name: /battle result/i })).toHaveTextContent('Victory')
    expect(action).toHaveBeenCalledTimes(1)
    expect(action).toHaveBeenCalledWith({ type: 'pvpBattle', offerId: 'offer-1', team: TEAM, moves: [T1, T1, T1] }, expect.any(String))
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }))
    expect(onClose).toHaveBeenCalled()
    expect(action).toHaveBeenCalledTimes(1)
  })

  it('exit asks first and states the trophy cost; keeping on fighting sends nothing', async () => {
    const { action } = host(s8, offer, { reply: { battle: undefined } })
    await userEvent.click(screen.getByRole('button', { name: /exit/i }))
    const dialog = within(screen.getByRole('alertdialog', { name: 'Abandon?' }))
    expect(dialog.getByText('You lose 15 trophies')).toBeInTheDocument()
    await userEvent.click(dialog.getByRole('button', { name: /keep fighting/i }))
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(action).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: /exit/i }))
    await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Abandon' }))
    expect(action).toHaveBeenCalledWith({ type: 'pvpBattle', offerId: 'offer-1', team: TEAM, moves: [] }, expect.any(String))
    expect(await screen.findByRole('status', { name: /battle result/i })).toHaveTextContent('Defeat')
  })

  it('under reduced motion a double tap plays one move: there is no undo to take the second back', async () => {
    host(s8, { ...offer, opponent: { ...bot, team: three('sea', 1) } })
    fireEvent.click(move(/strike/i))
    fireEvent.click(move(/strike/i))
    await waitFor(() => expect(screen.getByText('Turn 3 / 30')).toBeInTheDocument())
    await pause()
    expect(screen.getByText('Turn 3 / 30')).toBeInTheDocument()
    // And the guard ends: the next deliberate tap counts.
    fireEvent.click(move(/strike/i))
    await waitFor(() => expect(screen.getByText('Turn 5 / 30')).toBeInTheDocument())
  })

  it('a double tap on a move that brings a KO does not also pick the replacement that appears under the finger', async () => {
    host({ ...s8, dragons: dragons('flame', 1) }, { ...offer, opponent: { ...bot, team: three('sea', 40) } })
    fireEvent.click(move(/strike/i))
    const list = await screen.findByRole('group', { name: /^replacement$/i })
    fireEvent.click(within(list).getAllByRole('button')[1]!)
    expect(screen.getByRole('group', { name: /^replacement$/i })).toBeInTheDocument()
  })

  it('a double tap on Swap opens the bench and does not also pick from it', async () => {
    host(s8, { ...offer, opponent: { ...bot, team: three('sea', 40) } })
    fireEvent.click(screen.getByRole('button', { name: 'Swap' }))
    fireEvent.click(within(screen.getByRole('group', { name: /^swap$/i })).getAllByRole('button', { name: /L20/ })[0]!)
    expect(screen.getByRole('group', { name: /^swap$/i })).toBeInTheDocument()
    expect(screen.getByText('Turn 1 / 30')).toBeInTheDocument()
  })

  it('the Abandon confirm does not sit over a battle that has ended', async () => {
    host(s8, offer, { reply: {} })
    await userEvent.click(screen.getByRole('button', { name: /exit/i }))
    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
    for (let i = 0; i < 3; i++) {
      await pause()
      fireEvent.click(move(/cinder spit/i))
    }
    expect(await screen.findByRole('status', { name: /battle result/i })).toHaveTextContent('Victory')
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('Escape closes the Swap list first, then asks to abandon', async () => {
    host(s8)
    await userEvent.click(screen.getByRole('button', { name: 'Swap' }))
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('group', { name: /^swap$/i })).toBeNull()
    expect(screen.queryByRole('alertdialog')).toBeNull()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.getByRole('alertdialog', { name: 'Abandon?' })).toBeInTheDocument()
  })

  describe('every state has a way out', () => {
    const NETWORK = async () => { throw new TypeError('offline') }
    const refuse = (status: number, code: string) => async () => { throw new ApiError(status, code) }
    const leave = () => screen.findByRole('button', { name: 'Leave' })

    it('a lost response: Try again reuses the same key, so the server replays what it already did', async () => {
      const { action } = host(s8)
      // Both sends of the first try fail, as if the reply was lost after the server applied it.
      action.mockImplementationOnce(NETWORK).mockImplementationOnce(NETWORK)
      await winIt()
      await userEvent.click(await screen.findByRole('button', { name: /try again/i }))
      expect(await screen.findByRole('status', { name: /battle result/i })).toHaveTextContent('Victory')
      const keys = action.mock.calls.map(call => call[1])
      expect(keys).toHaveLength(3)
      expect(new Set(keys).size).toBe(1)
    })

    it('a network failure can also just leave', async () => {
      const onClose = vi.fn()
      const { action } = host(s8, offer, { onClose })
      action.mockImplementation(NETWORK)
      await winIt()
      await userEvent.click(await leave())
      expect(onClose).toHaveBeenCalled()
    })

    it.each([['OFFER_NOT_FOUND'], ['OFFER_EXPIRED']])('a send refused with %s says so, refetches /me, offers Leave and no Try again', async code => {
      const onClose = vi.fn()
      const { action, me } = host(s8, offer, { onClose })
      action.mockImplementation(refuse(409, code))
      await winIt()
      const out = await leave()
      // The toast says it too; this one stays.
      expect(within(screen.getByRole('region', { name: 'Battle' })).getByRole('alert')).toHaveTextContent(messageFor(code))
      expect(screen.queryByRole('button', { name: /try again/i })).toBeNull()
      await waitFor(() => expect(me).toHaveBeenCalled())
      await userEvent.click(out)
      expect(onClose).toHaveBeenCalled()
    })

    it('a server error offers both: it may pass', async () => {
      const { action, me } = host(s8)
      action.mockImplementationOnce(refuse(500, 'INTERNAL'))
      await winIt()
      await leave()
      await waitFor(() => expect(me).toHaveBeenCalled())
      await userEvent.click(screen.getByRole('button', { name: /try again/i }))
      expect(await screen.findByRole('status', { name: /battle result/i })).toBeInTheDocument()
    })

    it('a send that never comes back offers Leave after a while', async () => {
      const { action } = host(s8)
      action.mockImplementation(() => new Promise(() => {}))
      await winIt()
      expect(await screen.findByText(/saving the result/i)).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Leave' })).toBeNull()
      expect(await screen.findByRole('button', { name: 'Leave' }, { timeout: SEND_PATIENCE_MS + 1000 })).toBeInTheDocument()
    }, SEND_PATIENCE_MS + 8000)

    it.each([['OFFER_EXPIRED'], ['OFFER_NOT_FOUND']])('Exit whose forfeit is refused with %s closes: there is nothing left to forfeit', async code => {
      const onClose = vi.fn()
      const { action, me } = host(s8, offer, { onClose })
      action.mockImplementation(refuse(409, code))
      await userEvent.click(screen.getByRole('button', { name: /exit/i }))
      await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Abandon' }))
      await waitFor(() => expect(onClose).toHaveBeenCalled())
      await waitFor(() => expect(me).toHaveBeenCalled())
    })

    it('Exit that fails on the network stays in the fight, and offers Leave', async () => {
      const onClose = vi.fn()
      const { action } = host(s8, offer, { onClose })
      action.mockImplementation(NETWORK)
      await userEvent.click(screen.getByRole('button', { name: /exit/i }))
      await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Abandon' }))
      await userEvent.click(await leave())
      expect(onClose).toHaveBeenCalled()
    })

    it('an illegal list has a real Exit, as its message says', async () => {
      const onClose = vi.fn()
      const h = harness(s8)
      h.action.mockImplementation(refuse(409, 'OFFER_EXPIRED'))
      const bridge = createBridge()
      bridge.setReducedMotion(true)
      let hook!: BattleHook
      const Host = () => {
        const b = useBattle()
        hook = b
        if (!b.setup) { b.startPvp(offer, TEAM); return null }
        return <BattlePanel battle={b} bridge={bridge} onClose={onClose} />
      }
      render(<Host />, { wrapper: h.wrapper })
      act(() => hook.choose({ kind: 'replace', to: 1 }))
      expect(screen.getByRole('alert')).toHaveTextContent(/can't go on/i)
      await userEvent.click(screen.getByRole('button', { name: /exit/i }))
      await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Abandon' }))
      await waitFor(() => expect(onClose).toHaveBeenCalled())
    })

    it('a PvP team dragon gone from /me still draws a screen with Leave, not nothing', async () => {
      const onClose = vi.fn()
      const h = harness(s8)
      const bridge = createBridge()
      bridge.setReducedMotion(true)
      const Host = () => {
        const b = useBattle()
        if (!b.setup) { b.startPvp(offer, TEAM); return null }
        return <BattlePanel battle={b} bridge={bridge} onClose={onClose} />
      }
      render(<Host />, { wrapper: h.wrapper })
      expect(screen.getByRole('group', { name: /^move$/i })).toBeInTheDocument()
      act(() => { h.qc.setQueryData(ME_KEY, (old: { state: PlayerState }) => ({ ...old, state: { ...s8, dragons: s8.dragons.slice(1) } })) })
      await userEvent.click(await leave())
      expect(onClose).toHaveBeenCalled()
    })
  })

  it('a clock tick in the parent does not render the battle screen again', () => {
    const h = harness(s8)
    const bridge = createBridge()
    // The screen reads this each render, so its reads count its renders. (A Profiler around it fires for its parent's render too.)
    let renders = 0
    Object.defineProperty(bridge, 'reducedMotion', { get: () => { renders++; return true } })
    let tick = () => {}
    const onClose = () => {}
    const Host = () => {
      const [, setN] = useState(0)
      tick = () => setN(n => n + 1)
      const b = useBattle()
      if (!b.preview) { b.startPvp(offer, TEAM); return null }
      return <BattlePanel battle={b} bridge={bridge} onClose={onClose} />
    }
    render(<Host />, { wrapper: h.wrapper })
    const settled = renders
    expect(settled).toBeGreaterThan(0)
    act(() => tick())
    act(() => tick())
    expect(renders).toBe(settled)
  })
})
