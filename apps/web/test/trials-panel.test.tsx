// §6.3 on the client: the Trials panel's reasons, and the PvE path of useBattle (A8, R69, R70).
import {
  battlePreview, battleSeed32, createRng, currentHp, DEFAULT_PRESET, LAUNCH_CATALOG, legalMoves, newPlayer, nodeTeam, TRIAL_CHAPTERS,
  type ActiveTrial, type Dragon, type PlayerMove, type PlayerState,
} from '@wyrmhaven/game-core'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, renderHook, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiProvider } from '../src/api/ApiProvider'
import type { Api } from '../src/api/client'
import { errorMessages, messageFor } from '../src/api/errors'
import { sessionStore } from '../src/api/session'
import { BattleHub } from '../src/panels/BattleHub'
import { TrialsPanel } from '../src/panels/TrialsPanel'
import { trialDraftKey, useBattle } from '../src/state/battle'
import { ME_KEY } from '../src/state/me'
import { ToastProvider } from '../src/ui/Toast'

const TEAM: [string, string, string] = ['d1', 'd2', 'd3']
const SEED_HEX = `0x${'ab'.repeat(32)}`
const STRIKE: PlayerMove = { kind: 'attack', move: 0 }
const sea = (level: number, over: Partial<Dragon> = {}): Dragon[] => TEAM.map(id => ({ id, speciesId: 'sea', level, feeds: 0, habitatId: 'h2', ...over }))
const base: PlayerState = { ...newPlayer(0), level: 4, dragons: sea(20) }
const active: ActiveTrial = {
  chapter: 1, node: 1, team: TEAM, index: 3, startedAtMs: 0, replay: false,
  specs: TEAM.map(() => ({ speciesId: 'sea', level: 20, hp: 4_718 })),
}
const withActive: PlayerState = { ...base, pve: { ...base.pve, active, battles: 3 } }

function harness(state: PlayerState, api: Record<string, unknown> = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  qc.setQueryData(ME_KEY, { playerId: 'p1', address: '0xabc', state, balanceWei: 0n, earningUnlocked: false, banned: false })
  sessionStore.set({ token: 't', playerId: 'p1', address: '0xabc' })
  const fake = {
    action: vi.fn(async (a: { type: string }) => ({ state: a.type === 'startTrial' ? withActive : state, effects: [] })),
    pveSeed: vi.fn(async () => ({ seedHex: SEED_HEX })),
    ...api,
  }
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}><ApiProvider api={fake as unknown as Api}><ToastProvider>{children}</ToastProvider></ApiProvider></QueryClientProvider>
  )
  return { wrapper, api: fake, qc }
}
const panel = (state: PlayerState, onFight = vi.fn(), onResume = vi.fn()) => {
  const h = harness(state)
  render(<TrialsPanel nowMs={0} onFight={onFight} onResume={onResume} />, { wrapper: h.wrapper })
  return { ...h, onFight, onResume }
}
/** The moves that finish `active`'s battle on SEED_HEX, as the client would choose them. */
function complete(): PlayerMove[] {
  const moves: PlayerMove[] = []
  const enemies = nodeTeam(1, 1, LAUNCH_CATALOG)
  for (;;) {
    const p = battlePreview(active.specs, enemies, moves, createRng(battleSeed32(SEED_HEX)), LAUNCH_CATALOG)
    if (p.done) return moves
    const legal = legalMoves(p.state, 'attacker')
    moves.push(legal.find(m => m.kind === 'attack' && m.move === 0) ?? legal[0]!)
  }
}

beforeEach(() => { localStorage.clear() })

describe('TrialsPanel', () => {
  it('lists the 10 chapters with theme, PL and stars', () => {
    panel({ ...base, pve: { ...base.pve, stars: { '1:1': 3, '1:2': 1 } } })
    const chapters = within(screen.getByRole('list', { name: 'Chapters' })).getAllByRole('button')
    expect(chapters).toHaveLength(10)
    TRIAL_CHAPTERS.forEach((c, i) => expect(chapters[i]).toHaveTextContent(c.theme))
    expect(chapters[0]).toHaveTextContent('PL 4')
    expect(chapters[9]).toHaveTextContent('PL 28')
    expect(chapters[0]).toHaveTextContent('4/30')
  })

  it('lists nodes with level, reward and lock reason', () => {
    panel(base)
    const nodes = within(screen.getByRole('list', { name: 'Nodes' }))
    const first = nodes.getByRole('button', { name: /^node 1 ·/i })
    expect(first).toBeEnabled()
    expect(first).toHaveTextContent('L1')
    expect(first).toHaveTextContent('1,000 gold')
    expect(first).toHaveTextContent('50 food')
    expect(first).toHaveTextContent('240 XP')
    const second = nodes.getByRole('button', { name: /^node 2 ·/i })
    expect(second).toBeDisabled()
    expect(second).toHaveAccessibleDescription('Clear the previous node first')
    expect(nodes.getByRole('button', { name: /^node 10 \(boss\) ·/i })).toHaveTextContent('3,000 gold')
  })

  it('a locked chapter says the level, and a replay shows half and the replays left', async () => {
    panel({ ...base, pve: { ...base.pve, stars: { '1:1': 2 } } })
    expect(within(screen.getByRole('list', { name: 'Nodes' })).getByRole('button', { name: /^node 1 ·/i })).toHaveTextContent('500 gold')
    expect(within(screen.getByRole('list', { name: 'Nodes' })).getByRole('button', { name: /^node 1 ·/i })).toHaveTextContent('5 replays left')
    await userEvent.click(within(screen.getByRole('list', { name: 'Chapters' })).getByRole('button', { name: /flame peaks/i }))
    expect(within(screen.getByRole('list', { name: 'Nodes' })).getByRole('button', { name: /^node 1 ·/i })).toHaveAccessibleDescription('Needs player level 5')
  })

  it('the unlock line follows the table', () => {
    panel({ ...base, level: 3 })
    expect(screen.getByText('The Trials unlock at player level 4.')).toBeInTheDocument()
  })

  it('the team picker shows HP %; a dragon under 25 % reads Resting and is disabled', () => {
    const dragons: Dragon[] = [
      { id: 'd1', speciesId: 'terra', level: 40, feeds: 0, habitatId: null, fatigue: { hp: 960, atMs: 0 } },
      { id: 'd2', speciesId: 'terra', level: 40, feeds: 0, habitatId: null, fatigue: { hp: 4_000, atMs: 0 } },
      { id: 'd3', speciesId: 'terra', level: 40, feeds: 0, habitatId: null },
    ]
    expect(currentHp(dragons[0]!, LAUNCH_CATALOG, 0, DEFAULT_PRESET)).toBe(960)
    panel({ ...base, dragons })
    const team = within(screen.getByRole('group', { name: /team/i }))
    const buttons = team.getAllByRole('button')
    expect(buttons[0]).toHaveTextContent('Resting: 12 %')
    expect(buttons[0]).toBeDisabled()
    expect(buttons[1]).toHaveTextContent('50 %')
    expect(buttons[1]).toBeEnabled()
    expect(buttons[2]).toHaveTextContent('100 %')
    expect(screen.getByText('Need 3 dragons with at least 25 % HP.')).toBeInTheDocument()
    expect(within(screen.getByRole('list', { name: 'Nodes' })).getByRole('button', { name: /^node 1 ·/i })).toHaveAccessibleDescription('Need 3 dragons')
  })

  it('Need 3 dragons when the player owns fewer', () => {
    panel({ ...base, dragons: newPlayer(0).dragons })
    expect(screen.getByText('Need 3 dragons with at least 25 % HP.')).toBeInTheDocument()
    expect(within(screen.getByRole('list', { name: 'Nodes' })).getByRole('button', { name: /^node 1 ·/i })).toBeDisabled()
  })

  it('Heal all · $0.05 buys healAll when someone is hurt, and is disabled when nobody is', async () => {
    const h = panel({ ...base, dragons: sea(20, { fatigue: { hp: 100, atMs: 0 } }) })
    await userEvent.click(screen.getByRole('button', { name: 'Heal all · $0.05' }))
    expect(h.api.action).toHaveBeenCalledWith({ type: 'buy', item: { kind: 'healAll' } }, expect.any(String))
  })

  it('Heal all is disabled when nobody is hurt', () => {
    panel(base)
    expect(screen.getByRole('button', { name: 'Heal all · $0.05' })).toBeDisabled()
  })

  it('tapping a node with a team starts it', async () => {
    const { onFight } = panel(base)
    await userEvent.click(within(screen.getByRole('list', { name: 'Nodes' })).getByRole('button', { name: /^node 1 ·/i }))
    expect(onFight).toHaveBeenCalledWith(1, 1, TEAM)
  })

  it('an active Trial offers Resume or Abandon, disables new starts and heal-all', async () => {
    localStorage.setItem(trialDraftKey('p1', 3), JSON.stringify([STRIKE]))
    const h = panel({ ...withActive, dragons: sea(20, { fatigue: { hp: 100, atMs: 0 } }) })
    expect(screen.getByRole('status', { name: 'Trial in progress' })).toHaveTextContent('Terra Wilds')
    expect(within(screen.getByRole('list', { name: 'Nodes' })).getByRole('button', { name: /^node 1 ·/i })).toHaveAccessibleDescription('Finish the Trial in progress first')
    expect(screen.getByRole('button', { name: 'Heal all · $0.05' })).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: 'Resume' }))
    expect(h.onResume).toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Abandon' }))
    expect(h.api.action).toHaveBeenCalledWith({ type: 'abandonTrial' }, expect.any(String))
    await waitFor(() => expect(localStorage.getItem(trialDraftKey('p1', 3))).toBeNull())
  })
})

describe('BattleHub', () => {
  it('opens on Trials, so an active Trial shows when Battle opens', () => {
    const h = harness(withActive)
    render(<BattleHub nowMs={0} onTrial={vi.fn()} onResume={vi.fn()} onPvp={vi.fn()} onClose={vi.fn()} />, { wrapper: h.wrapper })
    expect(screen.getByRole('tab', { name: 'Trials' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('status', { name: 'Trial in progress' })).toBeInTheDocument()
  })
})

describe('messageFor', () => {
  it('covers the new errors', () => {
    for (const code of ['DRAGON_TIRED', 'TRIAL_ACTIVE', 'NO_ACTIVE_TRIAL', 'IN_TRIAL', 'NOTHING_TO_HEAL']) {
      expect(errorMessages[code]).toBeTruthy()
      expect(messageFor(code)).not.toBe(code)
    }
  })
})

describe('useBattle, PvE', () => {
  it('starts, then reads the seed, plays from the snapshot exactly, and finishes when done', async () => {
    const h = harness(base)
    const { result } = renderHook(() => useBattle(), { wrapper: h.wrapper })
    await act(async () => { await result.current.startTrial(1, 1, TEAM) })
    expect(h.api.action).toHaveBeenCalledWith({ type: 'startTrial', chapter: 1, node: 1, team: TEAM }, expect.any(String))
    expect(h.api.pveSeed).toHaveBeenCalledTimes(1)
    expect(result.current.exactPreview).toBe(true)
    expect(result.current.setup).toMatchObject({ mode: 'pve', trial: active, seed32: battleSeed32(SEED_HEX) })
    expect(result.current.preview!.state.sides.attacker.team[0]!.hp).toBe(4_718)

    // Not done yet: Submit stays shut, as in PvP.
    act(() => result.current.choose(STRIKE))
    expect(result.current.canSubmit).toBe(false)
    act(() => result.current.undo())

    const moves = complete()
    for (const m of moves) act(() => result.current.choose(m))
    expect(result.current.preview!.done).toMatchObject({ ok: true })
    expect(result.current.canSubmit).toBe(true)
    await act(async () => { await result.current.submit() })
    expect(h.api.action).toHaveBeenLastCalledWith({ type: 'finishTrial', moves }, expect.any(String))
    expect(result.current.canSubmit).toBe(false)
    expect(localStorage.getItem(trialDraftKey('p1', 3))).toBeNull()
  })

  it('no seed is asked for when the start is refused', async () => {
    const h = harness(base, { action: vi.fn(async () => { throw new Error('nope') }) })
    const { result } = renderHook(() => useBattle(), { wrapper: h.wrapper })
    await act(async () => { await result.current.startTrial(1, 1, TEAM) })
    expect(h.api.pveSeed).not.toHaveBeenCalled()
    expect(result.current.setup).toBeNull()
  })

  it('keeps the draft by player and index, and a reload resumes it', async () => {
    const h = harness(withActive)
    const first = renderHook(() => useBattle(), { wrapper: h.wrapper })
    await act(async () => { await first.result.current.resumeTrial() })
    act(() => first.result.current.choose(STRIKE))
    expect(JSON.parse(localStorage.getItem(trialDraftKey('p1', 3))!)).toEqual([STRIKE])
    first.unmount()

    const second = renderHook(() => useBattle(), { wrapper: h.wrapper })
    await act(async () => { await second.result.current.resumeTrial() })
    expect(second.result.current.moves).toEqual([STRIKE])
  })

  it.each([
    ['not JSON', '{oops'],
    ['not a list', '{"a":1}'],
    ['junk entries', '[null]'],
    ['an illegal move', JSON.stringify([{ kind: 'replace', to: 1 }])],
  ])('drops a bad draft: %s', async (_name, raw) => {
    localStorage.setItem(trialDraftKey('p1', 3), raw)
    const h = harness(withActive)
    const { result } = renderHook(() => useBattle(), { wrapper: h.wrapper })
    await act(async () => { await result.current.resumeTrial() })
    expect(result.current.moves).toEqual([])
    expect(localStorage.getItem(trialDraftKey('p1', 3))).toBeNull()
    expect(result.current.setup).not.toBeNull()
  })

  it('survives storage that throws', async () => {
    const get = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
    const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked') })
    const remove = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('blocked') })
    try {
      const h = harness(withActive)
      const { result } = renderHook(() => useBattle(), { wrapper: h.wrapper })
      await act(async () => { await result.current.resumeTrial() })
      act(() => result.current.choose(STRIKE))
      expect(result.current.moves).toEqual([STRIKE])
    } finally {
      get.mockRestore(); set.mockRestore(); remove.mockRestore()
    }
  })
})
