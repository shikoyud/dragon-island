// §6.3 on the client: the Trials panel's reasons, and the PvE path of useBattle (A8, R69, R70).
import {
  battlePreview, battleSeed32, canFight, createRng, currentHp, maxHp, DEFAULT_PRESET, LAUNCH_CATALOG, legalMoves, newPlayer, nodeTeam, TRIAL_CHAPTERS,
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
    pveSeed: vi.fn(async () => ({ seedHex: SEED_HEX })),
    ...api,
  }
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}><ApiProvider api={fake as unknown as Api}><ToastProvider>{children}</ToastProvider></ApiProvider></QueryClientProvider>
  )
  return { wrapper, api: fake, qc }
}
const panel = (state: PlayerState, onFight = vi.fn(), onResume = vi.fn(), nowMs = 0) => {
  const h = harness(state)
  render(<TrialsPanel nowMs={nowMs} onFight={onFight} onResume={onResume} />, { wrapper: h.wrapper })
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
    expect(node(1)).toHaveAccessibleDescription('Need 3 dragons')
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
    await userEvent.click(screen.getByRole('button', { name: 'Abandon' }))
    expect(h.api.action).toHaveBeenCalledWith({ type: 'abandonTrial' }, expect.any(String))
    await waitFor(() => expect(localStorage.getItem(trialDraftKey('p1', 3))).toBeNull())
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
