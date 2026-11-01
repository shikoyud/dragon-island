// §6.3 on the client: the Trials panel's reasons, and the PvE path of useBattle (A8, R69, R70).
import {
  battlePreview, battleSeed32, canFight, createRng, currentHp, maxHp, DEFAULT_PRESET, LAUNCH_CATALOG, legalMoves, newPlayer, nodeTeam, TRIAL_CHAPTERS,
  type ActiveTrial, type Dragon, type PlayerMove, type PlayerState,
} from '@wyrmhaven/game-core'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, renderHook, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useEffect, type ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiProvider } from '../src/api/ApiProvider'
import { HudArtContext } from '../src/hud/Icon'
import type { Sprite } from '../src/art/types'
import type { Api } from '../src/api/client'
import { ApiError } from '../src/api/client'
import { errorMessages, messageFor } from '../src/api/errors'
import { sessionStore } from '../src/api/session'
import { createBridge } from '../src/game/bridge'
import { BattleHub } from '../src/panels/BattleHub'
import { BattlePanel } from '../src/panels/BattlePanel'
import { attentionItems } from '../src/hud/hudModel'
import { fightsInMs, TrialsPanel } from '../src/panels/TrialsPanel'
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
    pveSeed: vi.fn(async () => ({ seedHex: SEED_HEX, index: 3 })),
    me: vi.fn(async () => qc.getQueryData(ME_KEY)),
    ...api,
  }
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}><ApiProvider api={fake as unknown as Api}><ToastProvider>{children}</ToastProvider></ApiProvider></QueryClientProvider>
  )
  return { wrapper, api: fake, qc }
}
const panel = (state: PlayerState, onFight = vi.fn(), onResume = vi.fn(), nowMs = 0, art: Record<string, Sprite> = {}) => {
  const h = harness(state)
  const ui = (now: number) => <HudArtContext.Provider value={art}><TrialsPanel nowMs={now} onFight={onFight} onResume={onResume} /></HudArtContext.Provider>
  const view = render(ui(nowMs), { wrapper: h.wrapper })
  return { ...h, onFight, onResume, at: (now: number) => view.rerender(ui(now)) }
}
const mark = (name: string): Sprite => ({ src: `/art/v1/${name}.png`, w: 16, h: 16, frames: 1, fps: 0 })
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

const chapters = () => within(screen.getByRole('list', { name: 'Chapters' }))
const nodes = () => within(screen.getByRole('list', { name: 'Nodes' }))
const node = (n: number) => nodes().getByRole('button', { name: n === 10 ? /^node 10 · boss/i : new RegExp(`^node ${n} ·`, 'i') })
const openChapter = (name: RegExp) => userEvent.click(chapters().getByRole('button', { name }))
const toTeam = async (n = 1) => { await openChapter(/terra wilds/i); await userEvent.click(node(n)) }
const hurt = (hp: number): Partial<Dragon> => ({ fatigue: { hp, atMs: 0 } })
const cardsOf = () => within(screen.getByRole('group', { name: /your dragons/i })).getAllByRole('button')

describe('TrialsPanel', () => {
  it('lists the 10 chapters with theme, element icon, PL and n / 30 stars', () => {
    panel({ ...base, pve: { ...base.pve, stars: { '1:1': 3, '1:2': 1 } } })
    const rows = chapters().getAllByRole('button')
    expect(rows).toHaveLength(10)
    TRIAL_CHAPTERS.forEach((c, i) => {
      expect(rows[i]).toHaveTextContent(c.theme)
      expect(rows[i]!.querySelector(`[data-icon="${c.element}"]`)).not.toBeNull()
    })
    expect(rows[0]).toHaveTextContent('PL 4')
    expect(rows[9]).toHaveTextContent('PL 28')
    expect(rows[0]).toHaveTextContent('4 / 30')
    expect(rows[1]).toHaveTextContent('Needs player level 5')
  })

  it('a chapter behind a Boss says which Boss', () => {
    panel({ ...base, level: 30 })
    expect(chapters().getByRole('button', { name: /^flame peaks/i })).toHaveTextContent('Beat the Terra Wilds Boss first')
  })

  it('opens a chapter to 10 nodes: Boss, level, enemy elements with the wildcard, stars, reward', async () => {
    panel({ ...base, pve: { ...base.pve, stars: { '1:1': 2 } } })
    await openChapter(/terra wilds/i)
    expect(screen.queryByRole('list', { name: 'Chapters' })).toBeNull()
    expect(nodes().getAllByRole('button')).toHaveLength(10)
    const first = node(1)
    expect(first).toHaveTextContent('L1')
    expect(first).toHaveTextContent('500 gold') // a replay pays half
    expect(first).toHaveTextContent('25 food')
    expect(first.querySelectorAll('.hud-icon')).toHaveLength(3)
    expect(first.querySelector('[aria-label*="wildcard"]')).not.toBeNull()
    expect(first.querySelector('[aria-label="2 stars"]')).not.toBeNull()
    expect(first).toHaveTextContent('Replays left 5')
    expect(node(2)).toHaveTextContent('1,000 gold')
    expect(node(2)).toHaveTextContent('240 XP')
    expect(node(10)).toHaveTextContent('3,000 gold')
    expect(node(10)).toHaveTextContent('Boss')
    expect(node(10)).toBeDisabled()
    expect(node(10)).toHaveAccessibleDescription('Clear the previous node first')
  })

  it('highlights the first open node', async () => {
    panel({ ...base, pve: { ...base.pve, stars: { '1:1': 3, '1:2': 1 } } })
    await openChapter(/terra wilds/i)
    expect(node(3).querySelector('.trials__node--next')).not.toBeNull()
    expect(node(1).querySelector('.trials__node--next')).toBeNull()
    expect(node(4).querySelector('.trials__node--next')).toBeNull()
  })

  it('Replays left counts down, and says when none are left', async () => {
    const day = { day: 0, counts: { '1:1': 2, '1:2': 5 } }
    panel({ ...base, pve: { ...base.pve, stars: { '1:1': 2, '1:2': 3 }, replays: day } })
    await openChapter(/terra wilds/i)
    expect(node(1)).toHaveTextContent('Replays left 3')
    expect(node(2)).toBeDisabled()
    expect(node(2)).toHaveAccessibleDescription('No replays left today')
  })

  it('a locked chapter says the level on every node', async () => {
    panel(base)
    await openChapter(/flame peaks/i)
    expect(node(1)).toBeDisabled()
    expect(node(1)).toHaveAccessibleDescription('Needs player level 5')
  })

  it('Back returns from nodes to the chapters', async () => {
    panel(base)
    await openChapter(/terra wilds/i)
    await userEvent.click(screen.getByRole('button', { name: /back to chapters/i }))
    expect(screen.getByRole('list', { name: 'Chapters' })).toBeInTheDocument()
  })

  it('the unlock line follows the table', () => {
    panel({ ...base, level: 3 })
    expect(screen.getByText('The Trials unlock at player level 4.')).toBeInTheDocument()
  })

  it('the team picker has 3 slots in order, the first is the lead; cards are 44 px, with HP and species names', async () => {
    const dragons: Dragon[] = [
      { id: 'd1', speciesId: 'sea', level: 20, feeds: 0, habitatId: 'h2' },
      { id: 'd2', speciesId: 'flame', level: 20, feeds: 0, habitatId: 'h2' },
      { id: 'd3', speciesId: 'terra', level: 20, feeds: 0, habitatId: 'h2', ...hurt(1) },
      { id: 'd4', speciesId: 'nature', level: 20, feeds: 0, habitatId: 'h2' },
    ]
    const { onFight } = panel({ ...base, dragons })
    await toTeam()
    const slots = within(screen.getByRole('list', { name: 'Team slots' })).getAllByRole('listitem')
    expect(slots).toHaveLength(3)
    expect(slots[0]).toHaveTextContent('Lead')
    expect(slots[0]).toHaveTextContent('Sea')
    const cards = cardsOf()
    expect(cards).toHaveLength(4)
    for (const c of cards) expect(c.style.minHeight).toBe('44px')
    expect(cards[0]).toHaveTextContent('Sea')
    expect(cards[0]).toHaveTextContent('100 %')
    expect(cards[0]!.querySelector('[data-icon="sea"]')).not.toBeNull()
    expect(cards[0]!.querySelector('[role="progressbar"]')).not.toBeNull()
    expect(document.body.textContent).not.toMatch(/\bd[1-4]\b/)
    // Take the lead off and put it back: it goes to the last slot, so the order of taps is the order of slots.
    await userEvent.click(cards[0]!)
    await userEvent.click(cards[0]!)
    await userEvent.click(screen.getByRole('button', { name: 'Fight' }))
    expect(onFight).toHaveBeenCalledWith(1, 1, ['d2', 'd4', 'd1'])
  })

  it('a counter dragon says 2x against the chapter element, others do not', async () => {
    const dragons: Dragon[] = [
      { id: 'd1', speciesId: 'metal', level: 20, feeds: 0, habitatId: 'h2' },
      { id: 'd2', speciesId: 'war', level: 20, feeds: 0, habitatId: 'h2' },
      { id: 'd3', speciesId: 'sea', level: 20, feeds: 0, habitatId: 'h2' },
    ]
    panel({ ...base, dragons })
    await toTeam()
    const cards = cardsOf()
    expect(cards[0]).toHaveTextContent('2x')
    expect(cards[1]).toHaveTextContent('2x')
    expect(cards[2]).not.toHaveTextContent('2x')
  })

  it('fightsInMs is the first moment the dragon can fight', () => {
    const d: Dragon = { id: 'd1', speciesId: 'terra', level: 40, feeds: 0, habitatId: null, ...hurt(960) }
    const wait = fightsInMs(d, LAUNCH_CATALOG, 0, DEFAULT_PRESET)
    expect(currentHp(d, LAUNCH_CATALOG, 0, DEFAULT_PRESET)).toBe(960)
    expect(wait).toBeGreaterThan(0)
    expect(canFight(d, LAUNCH_CATALOG, wait, DEFAULT_PRESET)).toBe(true)
    expect(canFight(d, LAUNCH_CATALOG, wait - 1, DEFAULT_PRESET)).toBe(false)
    const { fatigue: _, ...rested } = d
    expect(fightsInMs(rested, LAUNCH_CATALOG, 0, DEFAULT_PRESET)).toBe(0)
    expect(maxHp(d, LAUNCH_CATALOG)).toBeGreaterThan(960)
  })

  it('the tired card is disabled and reads Fights in Nm', async () => {
    const dragons: Dragon[] = [
      { id: 'd1', speciesId: 'terra', level: 40, feeds: 0, habitatId: null, ...hurt(960) },
      { id: 'd2', speciesId: 'sea', level: 40, feeds: 0, habitatId: null },
      { id: 'd3', speciesId: 'sea', level: 40, feeds: 0, habitatId: null },
      { id: 'd4', speciesId: 'sea', level: 40, feeds: 0, habitatId: null },
    ]
    panel({ ...base, dragons })
    await toTeam()
    const cards = cardsOf()
    expect(cards[0]).toBeDisabled()
    expect(cards[0]).toHaveTextContent(/Fights in \d+m/)
    expect(cards[0]).not.toHaveTextContent('Resting')
  })

  it('with too few rested dragons a node says how long until the third can fight', async () => {
    const dragons: Dragon[] = [
      { id: 'd1', speciesId: 'terra', level: 40, feeds: 0, habitatId: null, ...hurt(960) },
      { id: 'd2', speciesId: 'sea', level: 40, feeds: 0, habitatId: null },
      { id: 'd3', speciesId: 'sea', level: 40, feeds: 0, habitatId: null },
    ]
    panel({ ...base, dragons })
    await openChapter(/terra wilds/i)
    expect(node(1)).toBeDisabled()
    expect(node(1)).toHaveAccessibleDescription(/^Need 3 rested dragons · next fights in \d+m$/)
  })

  it('Need 3 dragons when the player owns fewer', async () => {
    panel({ ...base, dragons: newPlayer(0).dragons })
    await openChapter(/terra wilds/i)
    expect(node(1)).toBeDisabled()
    expect(node(1)).toHaveAccessibleDescription('Need 3 dragons · buy a Basic in the Shop')
  })

  it('the Fight button asks for 3 dragons and says so', async () => {
    panel(base)
    await toTeam()
    const slotButtons = within(screen.getByRole('list', { name: 'Team slots' })).getAllByRole('button')
    await userEvent.click(slotButtons[2]!)
    expect(screen.getByRole('button', { name: 'Fight' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Fight' })).toHaveAccessibleDescription('Pick 3 dragons')
  })

  it('defaults to the last used team, which a fight remembers', async () => {
    const dragons: Dragon[] = ['d1', 'd2', 'd3', 'd4'].map(id => ({ id, speciesId: 'sea', level: 20, feeds: 0, habitatId: 'h2' }))
    localStorage.setItem('dris.trialTeam.p1', JSON.stringify(['d4', 'd2', 'd1']))
    const { onFight } = panel({ ...base, dragons })
    await toTeam()
    await userEvent.click(screen.getByRole('button', { name: 'Fight' }))
    expect(onFight).toHaveBeenCalledWith(1, 1, ['d4', 'd2', 'd1'])
    expect(JSON.parse(localStorage.getItem('dris.trialTeam.p1')!)).toEqual(['d4', 'd2', 'd1'])
  })

  it('Heal all · $0.05 buys healAll when someone is hurt', async () => {
    const h = panel({ ...base, dragons: sea(20, hurt(100)) })
    await userEvent.click(screen.getByRole('button', { name: 'Heal all · $0.05' }))
    expect(h.api.action).toHaveBeenCalledWith({ type: 'buy', item: { kind: 'healAll' } }, expect.any(String))
  })

  it('Heal all is disabled with Everyone is healthy when nobody is hurt', () => {
    panel(base)
    const b = screen.getByRole('button', { name: 'Heal all · $0.05' })
    expect(b).toBeDisabled()
    expect(b).toHaveAccessibleDescription('Everyone is healthy')
  })

  it('a fatigue that healed by itself does not enable Heal all', () => {
    panel({ ...base, dragons: sea(20, hurt(100)) }, vi.fn(), vi.fn(), 10 * 60 * 60_000)
    expect(screen.getByRole('button', { name: 'Heal all · $0.05' })).toBeDisabled()
  })

  it('tapping a node and Fight starts it with the team', async () => {
    const { onFight } = panel(base)
    await toTeam()
    await userEvent.click(screen.getByRole('button', { name: 'Fight' }))
    expect(onFight).toHaveBeenCalledWith(1, 1, TEAM)
  })

  it('an active Trial offers Resume or Abandon, disables new starts and heal-all', async () => {
    localStorage.setItem(trialDraftKey('p1', 3), JSON.stringify([STRIKE]))
    const h = panel({ ...withActive, dragons: sea(20, hurt(100)) })
    expect(screen.getByRole('status', { name: 'Trial in progress' })).toHaveTextContent('Terra Wilds')
    expect(screen.getByRole('button', { name: 'Heal all · $0.05' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Heal all · $0.05' })).toHaveAccessibleDescription('Finish the Trial in progress first')
    await openChapter(/terra wilds/i)
    expect(screen.getByRole('status', { name: 'Trial in progress' })).toBeInTheDocument()
    expect(node(1)).toHaveAccessibleDescription('Finish the Trial in progress first')
    await userEvent.click(screen.getByRole('button', { name: 'Resume' }))
    expect(h.onResume).toHaveBeenCalled()
    // Abandon asks first, with the cost, like the battle's own exit: nothing is sent until it's confirmed.
    await userEvent.click(screen.getByRole('button', { name: 'Abandon' }))
    const ask = within(screen.getByRole('alertdialog', { name: 'Abandon?' }))
    expect(ask.getByText('The team falls to 1 HP')).toBeInTheDocument()
    expect(h.api.action).not.toHaveBeenCalled()
    await userEvent.click(ask.getByRole('button', { name: /keep fighting/i }))
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(h.api.action).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Abandon' }))
    await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Abandon' }))
    expect(h.api.action).toHaveBeenCalledWith({ type: 'abandonTrial', index: 3 }, expect.any(String))
    await waitFor(() => expect(localStorage.getItem(trialDraftKey('p1', 3))).toBeNull())
  })

  it('Escape on the confirm closes only the confirm', async () => {
    const outer = vi.fn()
    window.addEventListener('keydown', outer)
    try {
      panel(withActive)
      await userEvent.click(screen.getByRole('button', { name: 'Abandon' }))
      await userEvent.keyboard('{Escape}')
      expect(screen.queryByRole('alertdialog')).toBeNull()
      expect(outer).not.toHaveBeenCalled()
    } finally { window.removeEventListener('keydown', outer) }
  })

  it('reopens on the node list of the chapter fought in, when given one', () => {
    const h = harness(base)
    render(<TrialsPanel nowMs={0} chapter={1} onFight={vi.fn()} onResume={vi.fn()} />, { wrapper: h.wrapper })
    expect(screen.getByRole('list', { name: 'Nodes' })).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Chapters' })).toBeNull()
  })
})

describe('the HUD', () => {
  it('an active Trial is an attention item that opens Battle', () => {
    const item = attentionItems(withActive, 0).find(i => i.id === 'trial')
    expect(item).toMatchObject({ label: 'Trial in progress', ready: true, open: { kind: 'panel', id: 'battle' } })
    expect(attentionItems(base, 0).some(i => i.id === 'trial')).toBe(false)
  })
})

describe('BattleHub', () => {
  it('passes on the chapter to come back to', () => {
    const h = harness(base)
    render(<BattleHub nowMs={0} chapter={1} onTrial={vi.fn()} onResume={vi.fn()} onPvp={vi.fn()} onClose={vi.fn()} />, { wrapper: h.wrapper })
    expect(screen.getByRole('list', { name: 'Nodes' })).toBeInTheDocument()
  })

  it('opens on Trials, so an active Trial shows when Battle opens', () => {
    const h = harness(withActive)
    render(<BattleHub nowMs={0} onTrial={vi.fn()} onResume={vi.fn()} onPvp={vi.fn()} onClose={vi.fn()} />, { wrapper: h.wrapper })
    expect(screen.getByRole('tab', { name: 'Trials' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('status', { name: 'Trial in progress' })).toBeInTheDocument()
  })
})

describe('messageFor', () => {
  it('covers the new errors', () => {
    expect(messageFor('IN_TRIAL')).toMatch(/Resume or Abandon/)
    expect(messageFor('NOTHING_TO_HEAL')).toMatch(/healthy/)
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
    expect(result.current.setup).toMatchObject({ mode: 'pve', trial: active, seed32: battleSeed32(SEED_HEX) })
    expect(result.current.preview!.state.sides.attacker.team[0]!.hp).toBe(4_718)

    // Not done yet: Submit stays shut, as in PvP.
    act(() => result.current.choose(STRIKE))
    expect(result.current.canSubmit).toBe(false)

    const moves = complete()
    for (const m of moves.slice(1)) act(() => result.current.choose(m))
    expect(result.current.preview!.done).toMatchObject({ ok: true })
    expect(result.current.canSubmit).toBe(true)
    await act(async () => { await result.current.submit() })
    expect(h.api.action).toHaveBeenLastCalledWith({ type: 'finishTrial', moves, index: 3 }, expect.any(String))
    expect(result.current.canSubmit).toBe(false)
    expect(localStorage.getItem(trialDraftKey('p1', 3))).toBeNull()
  })

  it('a draft with no active Trial to match is cleared, for this player only', async () => {
    localStorage.setItem(trialDraftKey('p1', 2), '[]x')
    localStorage.setItem(trialDraftKey('p1', 3), JSON.stringify([STRIKE]))
    localStorage.setItem(trialDraftKey('p2', 2), JSON.stringify([STRIKE]))
    localStorage.setItem('dris.trialTeam.p1', '[]')
    const h = harness(withActive)
    renderHook(() => useBattle(), { wrapper: h.wrapper })
    expect(localStorage.getItem(trialDraftKey('p1', 2))).toBeNull()
    expect(localStorage.getItem(trialDraftKey('p1', 3))).not.toBeNull()
    expect(localStorage.getItem(trialDraftKey('p2', 2))).not.toBeNull()
    expect(localStorage.getItem('dris.trialTeam.p1')).toBe('[]')
    act(() => { h.qc.setQueryData(ME_KEY, (old: { state: PlayerState }) => ({ ...old, state: base })) })
    await waitFor(() => expect(localStorage.getItem(trialDraftKey('p1', 3))).toBeNull())
  })

  it('a move made after the Trial ended elsewhere does not write its draft back', async () => {
    const h = harness(withActive)
    const { result } = renderHook(() => useBattle(), { wrapper: h.wrapper })
    await act(async () => { await result.current.resumeTrial() })
    act(() => { h.qc.setQueryData(ME_KEY, (old: { state: PlayerState }) => ({ ...old, state: base })) })
    await waitFor(() => expect(result.current.setup).not.toBeNull())
    act(() => result.current.choose(STRIKE))
    expect(result.current.moves).toEqual([STRIKE])
    expect(localStorage.getItem(trialDraftKey('p1', 3))).toBeNull()
  })

  it('abandoning sends abandonTrial and clears the draft', async () => {
    const h = harness(withActive)
    const { result } = renderHook(() => useBattle(), { wrapper: h.wrapper })
    await act(async () => { await result.current.resumeTrial() })
    act(() => result.current.choose(STRIKE))
    expect(localStorage.getItem(trialDraftKey('p1', 3))).not.toBeNull()
    let out = ''
    await act(async () => { out = await result.current.abandon() })
    expect(out).toBe('settled')
    expect(h.api.action).toHaveBeenLastCalledWith({ type: 'abandonTrial', index: 3 }, expect.any(String))
    expect(localStorage.getItem(trialDraftKey('p1', 3))).toBeNull()
  })

  describe('on the battle screen', () => {
    const WON = { state: base, effects: [], trial: { won: true, stars: 3, gold: 1_000, food: 50, xp: 20, first: true }, battle: { winner: 'attacker', turns: 5 } }
    const mount = (state: PlayerState, onClose: () => void, art: Record<string, Sprite> = {}) => {
      const h = harness(state, { action: vi.fn(async () => WON) })
      const bridge = createBridge()
      bridge.setReducedMotion(true)
      const Host = () => {
        const b = useBattle()
        useEffect(() => { void b.resumeTrial() }, []) // eslint-disable-line
        return b.preview ? <BattlePanel battle={b} bridge={bridge} onClose={onClose} /> : null
      }
      render(<HudArtContext.Provider value={art}><Host /></HudArtContext.Provider>, { wrapper: h.wrapper })
      return h
    }
    const screenFor = async (trial: ActiveTrial, onClose = vi.fn(), art: Record<string, Sprite> = {}) => {
      const h = mount({ ...base, pve: { ...base.pve, active: trial, battles: 3 } }, onClose, art)
      await screen.findByRole('group', { name: /^move$/i })
      return { ...h, onClose }
    }

    it('shows the star goal and the node', async () => {
      await screenFor(active)
      expect(screen.getByText('3★: 8 turns, no KOs')).toBeInTheDocument()
      expect(screen.getByText(/Terra Wilds · Node 1/)).toBeInTheDocument()
      expect(screen.queryByText('Boss')).toBeNull()
    })

    it('marks the Boss', async () => {
      await screenFor({ ...active, node: 10 })
      expect(within(screen.getByRole('group', { name: 'Enemy' })).getByText('Boss')).toBeInTheDocument()
    })

    it('puts the Boss badge on its own row, so the name keeps its room', async () => {
      await screenFor({ ...active, node: 10 })
      const enemy = within(screen.getByRole('group', { name: 'Enemy' }))
      const badge = enemy.getByText('Boss')
      expect(badge.closest('.battle__plate-head')).toBeNull()
      expect(badge.closest('.battle__plate-boss')).not.toBeNull()
      // The name's row is still there, with the name in it.
      expect(enemy.getByText(/^L\d+$/).closest('.battle__plate-head')).not.toBeNull()
    })

    it('draws the crown from battle.boss.marker on the Boss only, and the tier pips from ui.tier.*', async () => {
      const art = { 'battle.boss.marker': mark('crown'), 'ui.tier.1': mark('t1'), 'ui.tier.2': mark('t2'), 'ui.tier.3': mark('t3') }
      await screenFor({ ...active, node: 10 }, vi.fn(), art)
      expect(within(screen.getByRole('group', { name: 'Enemy' })).getByText('Boss').querySelector('img[src="/art/v1/crown.png"]')).not.toBeNull()
      expect(screen.getByRole('group', { name: 'Yours' }).querySelector('img')).toBeNull()
      const moves = screen.getByRole('group', { name: /^move$/i })
      for (const t of ['t1', 't2', 't3']) expect(moves.querySelectorAll(`img[src="/art/v1/${t}.png"]`)).toHaveLength(1)
      expect(moves).toHaveTextContent('Tier 1')
    })

    it('with no battle art the Boss is a word and the tiers are text', async () => {
      await screenFor({ ...active, node: 10 })
      expect(document.querySelector('.battle img')).toBeNull()
      expect(screen.getByText('Boss')).toBeInTheDocument()
    })

    it('exit states the cost; confirming abandons and goes back', async () => {
      const { api, onClose } = await screenFor(active)
      await userEvent.click(screen.getByRole('button', { name: /exit/i }))
      const ask = within(screen.getByRole('alertdialog', { name: 'Abandon?' }))
      expect(ask.getByText('The team falls to 1 HP')).toBeInTheDocument()
      await userEvent.click(ask.getByRole('button', { name: 'Abandon' }))
      expect(api.action).toHaveBeenCalledWith({ type: 'abandonTrial', index: 3 }, expect.any(String))
      await waitFor(() => expect(onClose).toHaveBeenCalled())
    })

    // The server answers 422 for finishTrial and abandonTrial with no Trial in progress (services/actions.ts); 409 is /pve/seed's.
    const refused = () => { throw new ApiError(422, 'NO_ACTIVE_TRIAL') }

    it('a Trial settled elsewhere: finishTrial refused, /me refetched and the draft gone, Leave goes back', async () => {
      localStorage.setItem(trialDraftKey('p1', 3), JSON.stringify(complete()))
      const onClose = vi.fn()
      const h = mount(withActive, onClose)
      h.api.action.mockImplementation(async () => refused())
      h.api.me.mockImplementation(async () => ({ ...(h.qc.getQueryData(ME_KEY) as object), state: base }))
      const out = await screen.findByRole('button', { name: 'Leave' })
      expect(within(screen.getByRole('region', { name: 'Battle' })).getByRole('alert')).toHaveTextContent(messageFor('NO_ACTIVE_TRIAL'))
      expect(screen.queryByRole('button', { name: /try again/i })).toBeNull()
      await waitFor(() => expect(h.api.me).toHaveBeenCalled())
      await waitFor(() => expect(localStorage.getItem(trialDraftKey('p1', 3))).toBeNull())
      await userEvent.click(out)
      expect(onClose).toHaveBeenCalled()
    })

    it.each([[422, 'NO_ACTIVE_TRIAL'], [422, 'TRIAL_ACTIVE'], [403, 'BANNED'], [400, 'INVALID_ACTION'], [428, 'TERMS_REQUIRED']])(
      'a send refused with %s %s says so once (the panel\'s alert, no toast on top), and offers Leave but never Try again',
      async (status, code) => {
        localStorage.setItem(trialDraftKey('p1', 3), JSON.stringify(complete()))
        const h = mount(withActive, vi.fn())
        h.api.action.mockImplementation(async () => { throw new ApiError(status, code) })
        await screen.findByRole('button', { name: 'Leave' })
        expect(within(screen.getByRole('region', { name: 'Battle' })).getByRole('alert')).toHaveTextContent(messageFor(code))
        expect(screen.getAllByText(messageFor(code))).toHaveLength(1)
        expect(screen.queryByRole('button', { name: /try again/i })).toBeNull()
      },
    )

    it('Exit on a Trial that is already over closes and drops the draft', async () => {
      const onClose = vi.fn()
      const h = await screenFor(active, onClose)
      h.api.action.mockImplementation(async () => refused())
      await userEvent.click(screen.getByRole('button', { name: /exit/i }))
      await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Abandon' }))
      await waitFor(() => expect(onClose).toHaveBeenCalled())
      expect(localStorage.getItem(trialDraftKey('p1', 3))).toBeNull()
    })

    it('a draft that is already done sends finishTrial once on resume, then shows stars', async () => {
      localStorage.setItem(trialDraftKey('p1', 3), JSON.stringify(complete()))
      const { api } = mount(withActive, () => {})
      const box = await screen.findByRole('status', { name: /battle result/i })
      expect(within(box).getByLabelText('3 stars')).toBeInTheDocument()
      expect(api.action).toHaveBeenCalledTimes(1)
      expect(api.action).toHaveBeenCalledWith(expect.objectContaining({ type: 'finishTrial' }), expect.any(String))
    })
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

describe('a refusal on the Trials path refetches /me (final fix 0b)', () => {
  const refuse = (status: number, code: string) => vi.fn(async () => { throw new ApiError(status, code) })

  it('a start refused with TRIAL_ACTIVE refetches /me, so the banner can show', async () => {
    const h = harness(base, { action: refuse(422, 'TRIAL_ACTIVE') })
    const { result } = renderHook(() => useBattle(), { wrapper: h.wrapper })
    await act(async () => { await result.current.startTrial(1, 1, TEAM) })
    await waitFor(() => expect(h.api.me).toHaveBeenCalled())
    expect(result.current.setup).toBeNull()
  })

  it('a start whose reply is lost (the network fails twice) refetches /me too: the server may have started it', async () => {
    const h = harness(base, { action: vi.fn(async () => { throw new TypeError('offline') }) })
    const { result } = renderHook(() => useBattle(), { wrapper: h.wrapper })
    await act(async () => { await result.current.startTrial(1, 1, TEAM) })
    await waitFor(() => expect(h.api.me).toHaveBeenCalled())
  })

  it('a seed read refused (the Trial is over) refetches /me and enters nothing', async () => {
    const h = harness(withActive, { pveSeed: refuse(409, 'NO_ACTIVE_TRIAL') })
    const { result } = renderHook(() => useBattle(), { wrapper: h.wrapper })
    let entered = true
    await act(async () => { entered = await result.current.resumeTrial() })
    expect(entered).toBe(false)
    expect(result.current.setup).toBeNull()
    await waitFor(() => expect(h.api.me).toHaveBeenCalled())
  })

  it('a seed that belongs to another Trial is not entered: /pve/seed says index 4, the local picture says 3', async () => {
    const h = harness(withActive, { pveSeed: vi.fn(async () => ({ seedHex: SEED_HEX, index: 4 })) })
    const { result } = renderHook(() => useBattle(), { wrapper: h.wrapper })
    let entered = true
    await act(async () => { entered = await result.current.resumeTrial() })
    expect(entered).toBe(false)
    expect(result.current.setup).toBeNull()
    await waitFor(() => expect(h.api.me).toHaveBeenCalled())
  })

  it('the banner\'s Abandon refused refetches /me, so a stale banner goes', async () => {
    const h = harness(withActive, { action: refuse(422, 'NO_ACTIVE_TRIAL') })
    render(<TrialsPanel nowMs={0} onFight={vi.fn()} onResume={vi.fn()} />, { wrapper: h.wrapper })
    await userEvent.click(screen.getByRole('button', { name: 'Abandon' }))
    await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Abandon' }))
    await waitFor(() => expect(h.api.me).toHaveBeenCalled())
  })
})

describe('TrialsPanel: Need 3 dragons, 2x badges and the Fight button (final fix 0c, 0d)', () => {
  const two = newPlayer(0).dragons.slice(0, 2)

  it('a player with fewer than 3 dragons is told to buy a Basic in the Shop, with a link there', async () => {
    const onShop = vi.fn()
    const h = harness({ ...base, dragons: two })
    render(<TrialsPanel nowMs={0} onFight={vi.fn()} onResume={vi.fn()} onShop={onShop} />, { wrapper: h.wrapper })
    await openChapter(/terra wilds/i)
    expect(node(1)).toBeDisabled()
    expect(node(1)).toHaveAccessibleDescription('Need 3 dragons · buy a Basic in the Shop')
    await userEvent.click(screen.getByRole('button', { name: 'Shop' }))
    expect(onShop).toHaveBeenCalledTimes(1)
  })

  it('with 3 dragons there is no Shop link', async () => {
    panel(base)
    await openChapter(/terra wilds/i)
    expect(screen.queryByRole('button', { name: 'Shop' })).toBeNull()
  })

  it('the 2x badge reads every unlocked move\'s element: a hybrid whose second element counters the chapter has it', async () => {
    // Electric-War: Tier 1 Electric (0.5x on Terra), Tier 2 War (2x on Terra). Its primary alone would say no badge.
    const hybrid = (level: number): Dragon[] => TEAM.map(id => ({ id, speciesId: 'electric-war', level, feeds: 0, habitatId: null }))
    panel({ ...base, dragons: hybrid(20) })
    await toTeam()
    for (const card of cardsOf()) expect(within(card).getByTitle('Hits Terra for 2x')).toBeInTheDocument()
  })

  it('a move that is still locked does not earn the badge, and a plain non-counter has none', async () => {
    const hybrid = TEAM.map(id => ({ id, speciesId: 'electric-war', level: 5, feeds: 0, habitatId: null }))
    panel({ ...base, dragons: hybrid })
    await toTeam()
    for (const card of cardsOf()) expect(within(card).queryByTitle(/Hits Terra/)).toBeNull()
  })

  it('Fight shows the battle\'s pending: disabled while a start is in flight', async () => {
    const h = harness(base)
    const { rerender } = render(<TrialsPanel nowMs={0} onFight={vi.fn()} onResume={vi.fn()} fighting={false} />, { wrapper: h.wrapper })
    await toTeam()
    expect(screen.getByRole('button', { name: 'Fight' })).toBeEnabled()
    rerender(<TrialsPanel nowMs={0} onFight={vi.fn()} onResume={vi.fn()} fighting />)
    expect(screen.getByRole('button', { name: 'Fight' })).toBeDisabled()
  })
})

describe('TrialsPanel: reasons, clocks and saved teams (Task 7 review)', () => {
  it('a Trial in progress is the reason on every node, a locked one too: the server checks TRIAL_ACTIVE first', async () => {
    panel(withActive)
    await openChapter(/terra wilds/i)
    expect(node(2)).toHaveAccessibleDescription('Finish the Trial in progress first')
    expect(node(10)).toHaveAccessibleDescription('Finish the Trial in progress first')
    expect(node(1)).toHaveAccessibleDescription('Finish the Trial in progress first')
  })

  it('without a Trial in progress a locked node still says what locks it', async () => {
    panel(base)
    await openChapter(/terra wilds/i)
    expect(node(2)).toHaveAccessibleDescription('Clear the previous node first')
  })

  it('HP on a team card follows the clock', async () => {
    const [d1, d2, d3] = sea(20)
    const state: PlayerState = { ...base, dragons: [d1!, d2!, d3!].map(d => ({ ...d, ...hurt(Math.floor(maxHp(d, LAUNCH_CATALOG) * 0.5)) })) }
    const p = panel(state)
    await toTeam()
    const pct = () => Number(within(cardsOf()[0]!).getByRole('progressbar', { name: 'HP' }).getAttribute('aria-valuenow'))
    const before = pct()
    expect(before).toBe(Math.floor((currentHp(state.dragons[0]!, LAUNCH_CATALOG, 0, DEFAULT_PRESET) * 100) / maxHp(state.dragons[0]!, LAUNCH_CATALOG)))
    p.at(30 * 60_000)
    expect(pct()).toBe(Math.floor((currentHp(state.dragons[0]!, LAUNCH_CATALOG, 30 * 60_000, DEFAULT_PRESET) * 100) / maxHp(state.dragons[0]!, LAUNCH_CATALOG)))
    expect(pct()).toBeGreaterThan(before)
    expect(within(cardsOf()[0]!).getByText(new RegExp(`${pct()} %`))).toBeInTheDocument()
  })

  it('a saved team with a sold dragon is not sent: the picker falls back to dragons the player has', async () => {
    const owned = ['d1', 'd3', 'd4'].map(id => ({ id, speciesId: 'sea', level: 20, feeds: 0, habitatId: 'h2' }))
    localStorage.setItem('dris.trialTeam.p1', JSON.stringify(['d1', 'd2', 'd3']))
    const { onFight } = panel({ ...base, dragons: owned })
    await toTeam()
    expect(cardsOf().filter(b => b.getAttribute('aria-pressed') === 'true')).toHaveLength(3)
    await userEvent.click(screen.getByRole('button', { name: 'Fight' }))
    expect(onFight).toHaveBeenCalledWith(1, 1, ['d1', 'd3', 'd4'])
    expect(JSON.parse(localStorage.getItem('dris.trialTeam.p1')!)).toEqual(['d1', 'd3', 'd4'])
  })

  it('draws the chapter card and node marks from trial.* art, and the stars from ui.star', async () => {
    const art = { 'trial.chapter.terra': mark('tc-terra'), 'trial.node': mark('n'), 'trial.node.boss': mark('nb'), 'trial.node.locked': mark('nl'), 'ui.star': mark('s'), 'ui.star.empty': mark('s0') }
    panel({ ...base, pve: { ...base.pve, stars: { '1:1': 2 } } }, vi.fn(), vi.fn(), 0, art)
    expect(chapters().getAllByRole('button')[0]!.querySelector('img[src="/art/v1/tc-terra.png"]')).not.toBeNull()
    // A chapter without its card keeps the element icon.
    expect(chapters().getAllByRole('button')[1]!.querySelector('[data-icon="flame"]')).not.toBeNull()
    await openChapter(/terra wilds/i)
    expect(node(1).querySelector('img[src="/art/v1/n.png"]')).not.toBeNull()
    expect(node(2).querySelector('img[src="/art/v1/n.png"]')).not.toBeNull()
    expect(node(3).querySelector('img[src="/art/v1/nl.png"]')).not.toBeNull() // node 2 is not cleared
    expect(node(10).querySelector('img[src="/art/v1/nb.png"]')).toBeNull() // a locked Boss reads as locked
    expect(node(10).querySelector('img[src="/art/v1/nl.png"]')).not.toBeNull()
    const stars = node(1).querySelector('[aria-label="2 stars"]')!
    expect(stars.querySelectorAll('img[src="/art/v1/s.png"]')).toHaveLength(2)
    expect(stars.querySelectorAll('img[src="/art/v1/s0.png"]')).toHaveLength(1)
  })

  it('an opened Boss node is marked with trial.node.boss', async () => {
    const stars = Object.fromEntries(Array.from({ length: 9 }, (_, i) => [`1:${i + 1}`, 1])) as PlayerState['pve']['stars']
    panel({ ...base, pve: { ...base.pve, stars } }, vi.fn(), vi.fn(), 0, { 'trial.node.boss': mark('nb'), 'trial.node': mark('n') })
    await openChapter(/terra wilds/i)
    expect(node(10).querySelector('img[src="/art/v1/nb.png"]')).not.toBeNull()
    expect(node(9).querySelector('img[src="/art/v1/n.png"]')).not.toBeNull()
  })

  it('with no trial art the text stars and no marks remain', async () => {
    panel({ ...base, pve: { ...base.pve, stars: { '1:1': 2 } } })
    await openChapter(/terra wilds/i)
    expect(node(1).querySelector('img')).toBeNull()
    expect(node(1).querySelector('[aria-label="2 stars"]')).toHaveTextContent('★★☆')
  })
})
