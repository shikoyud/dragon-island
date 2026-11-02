import { newPlayer, type PlayerState } from '@wyrmhaven/game-core'
import { cleanup, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { GameInfo } from '@wyrmhaven/shared'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createBridge } from '../src/game/bridge'
import { Dialog } from '../src/hud/Dialog'
import { Hud, type DialogKey } from '../src/hud/Hud'
import { HudArtContext } from '../src/hud/Icon'
import { harness } from './harness'

const base = (): PlayerState => ({ ...newPlayer(0), gold: 12_345, food: 678, level: 3, xp: 225 })

function renderHud(state: PlayerState, opts: { placing?: boolean; nowMs?: number; game?: Partial<GameInfo>; open?: DialogKey | null } = {}) {
  const h = harness(state, 0, undefined, opts.game)
  const onOpen = vi.fn()
  const bridge = createBridge()
  const setInsets = vi.spyOn(bridge, 'setInsets')
  h.wrap(<Hud bridge={bridge} nowMs={opts.nowMs ?? 10_000} open={opts.open ?? null} onOpen={onOpen} placing={opts.placing ?? false} />)
  return { ...h, onOpen, bridge, setInsets }
}

afterEach(() => { try { sessionStorage.clear() } catch { /* jsdom */ } })

describe('HUD', () => {
  it('shows level, XP and the three resource pills, each with a + that opens its shop', async () => {
    const { onOpen } = renderHud(base())
    expect(screen.getByLabelText('Level 3')).toHaveTextContent('3')
    expect(screen.getByRole('progressbar', { name: 'Experience' })).toHaveAttribute('aria-valuenow', '225')
    const res = screen.getByRole('status', { name: 'Resources' })
    expect(within(res).getByLabelText('Food')).toHaveTextContent('678')
    expect(within(res).getByLabelText('Gold')).toHaveTextContent('12,345')
    expect(within(res).getByLabelText('DRIS')).toHaveTextContent('5')
    await userEvent.click(screen.getByRole('button', { name: 'Buy food' }))
    expect(onOpen).toHaveBeenLastCalledWith({ kind: 'panel', id: 'shop', tab: 'store' })
    expect(screen.queryByRole('button', { name: 'Get gold' })).toBeNull() // the Store sells no Gold yet
    await userEvent.click(screen.getByRole('button', { name: 'Add DRIS' }))
    expect(onOpen).toHaveBeenLastCalledWith({ kind: 'panel', id: 'settings', tab: 'wallet' })
  })

  it('orders the pills $DRIS, Gold, Food (design: Currencies)', () => {
    renderHud(base())
    const res = screen.getByRole('status', { name: 'Resources' })
    expect([...res.querySelectorAll('.kit-resource__value')].map(e => e.getAttribute('aria-label'))).toEqual(['DRIS', 'Gold', 'Food'])
  })

  it('shows the Dragon Book counter top left, found over total, and opens the Book', async () => {
    const { onOpen } = renderHud(base())
    const player = screen.getByRole('group', { name: 'Player' })
    const book = within(player).getByRole('button', { name: 'Dragon Book' })
    expect(book).toHaveTextContent(/^2\/\d+$/)
    await userEvent.click(book)
    expect(onOpen).toHaveBeenLastCalledWith({ kind: 'panel', id: 'book' })
  })

  it('a red badge counts species found since the Book was last opened on this device', () => {
    localStorage.setItem('dris.bookSeen.p1', JSON.stringify(['terra', 'flame']))
    renderHud({ ...base(), discovered: ['terra', 'flame', 'sea'] })
    const book = screen.getByRole('button', { name: 'Dragon Book' })
    expect(book).toHaveAccessibleDescription('1 new')
    localStorage.clear()
  })

  it('gold pill has no sell-back sub-label, even with a lot of gold', () => {
    renderHud({ ...base(), gold: 9_999_999 })
    expect(screen.queryByText(/sell .* today/)).toBeNull()
    expect(screen.queryByText(/today/)).toBeNull()
  })

  it('has Battle bottom left and Shop bottom right, and nothing that is not built (Q2, Q3)', async () => {
    const { onOpen } = renderHud(base())
    const bar = screen.getByRole('navigation', { name: 'Main menu' })
    expect(within(bar).getAllByRole('button').map(b => b.getAttribute('aria-label'))).toEqual(['Battle', 'Shop'])
    for (const name of ['Breed', 'Wings', 'Inbox', 'Quests', 'Storage', 'Search', 'News', 'Offers']) expect(screen.queryByRole('button', { name })).toBeNull()
    await userEvent.click(within(bar).getByRole('button', { name: 'Battle' }))
    expect(onOpen).toHaveBeenLastCalledWith({ kind: 'panel', id: 'battle' })
    await userEvent.click(within(bar).getByRole('button', { name: 'Shop' }))
    expect(onOpen).toHaveBeenLastCalledWith({ kind: 'panel', id: 'shop' })
  })

  it('lights Shop while placing', () => {
    renderHud(base(), { placing: true })
    expect(screen.getByRole('button', { name: 'Shop' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('Goals on the left edge opens the Goals with a Start! bubble before any progress', async () => {
    const { onOpen } = renderHud(base())
    const goals = screen.getByRole('navigation', { name: 'Goals' })
    expect(goals).toHaveTextContent('Start!')
    await userEvent.click(within(goals).getByRole('button', { name: 'Goals' }))
    expect(onOpen).toHaveBeenLastCalledWith({ kind: 'panel', id: 'quests' })
  })

  it('says Goal ready on Goals, with a Claim! bubble and shortcut, only when the current Goal is claimable', async () => {
    renderHud(base())
    expect(screen.queryByRole('img', { name: 'Goal ready' })).toBeNull()
    expect(screen.queryByText('Goal ready')).toBeNull()
    cleanup()
    const done = { ...base(), goalStats: { ...base().goalStats, collects: 1 } }
    const r = renderHud(done)
    expect(screen.getByRole('button', { name: 'Goals' })).toHaveAccessibleDescription('Goal ready')
    expect(screen.getByRole('navigation', { name: 'Goals' })).toHaveTextContent('Claim!')
    await userEvent.click(screen.getByRole('button', { name: 'Goals' }))
    expect(r.onOpen).toHaveBeenLastCalledWith({ kind: 'panel', id: 'quests' })
  })

  it('has Settings and Map at the top right (Q7); Admin only with an operator token in this tab', () => {
    renderHud(base())
    const right = screen.getByRole('navigation', { name: 'Island menu' })
    expect(within(right).getAllByRole('button').map(b => b.getAttribute('aria-label'))).toEqual(['Settings', 'Map'])
    for (const label of ['Hoard', 'Season', 'Ranks', 'Referral']) expect(screen.queryByRole('button', { name: label })).toBeNull()
    expect(within(right).queryByRole('link', { name: 'Admin' })).toBeNull()
  })

  it('the Map button opens the Map and toggles back; it is lit with an island panel open too', async () => {
    const closed = renderHud(base())
    await userEvent.click(screen.getByRole('button', { name: 'Map' }))
    expect(closed.onOpen).toHaveBeenLastCalledWith({ kind: 'panel', id: 'map' })
    cleanup()
    const open = renderHud(base(), { open: { kind: 'panel', id: 'map' } })
    expect(screen.getByRole('button', { name: 'Map' })).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(screen.getByRole('button', { name: 'Map' }))
    expect(open.onOpen).toHaveBeenLastCalledWith(null)
    cleanup()
    renderHud(base(), { open: { kind: 'target', target: { kind: 'mapIsland', id: 'isle2' } } })
    expect(screen.getByRole('button', { name: 'Map' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('the Map waits while a building is being placed', () => {
    renderHud(base(), { placing: true })
    expect(screen.getByRole('button', { name: 'Map' })).toBeDisabled()
  })

  it('on the Map, a list of buttons named for each island sits in the page (R60), and the menus stay', async () => {
    const { onOpen } = renderHud(base(), { open: { kind: 'panel', id: 'map' } })
    const list = screen.getByRole('navigation', { name: 'Islands' })
    expect(within(list).getAllByRole('button').map(b => b.textContent)).toEqual([
      'Home Isle · 4 / 16', 'Ember Reach · Level 12 · Bridge 150,000', 'Frostspire · Level 18', 'Ironhold · Level 25', 'Shadowmere · Level 32', "Warlord's Crown · Level 40",
    ])
    expect(within(list).getByRole('button', { name: /Home Isle/ })).toHaveAttribute('aria-current', 'true')
    await userEvent.click(within(list).getByRole('button', { name: /Ember Reach/ }))
    expect(onOpen).toHaveBeenLastCalledWith({ kind: 'target', target: { kind: 'mapIsland', id: 'isle2' } })
    expect(screen.getByRole('navigation', { name: 'Main menu' })).toBeInTheDocument()
    expect(screen.getByRole('status', { name: 'Resources' })).toBeInTheDocument()
  })

  it('off the Map there is no island list', () => {
    renderHud(base())
    expect(screen.queryByRole('navigation', { name: 'Islands' })).toBeNull()
  })

  it('shows Admin when the operator token is set', () => {
    sessionStorage.setItem('dris.admin', 'tok')
    renderHud(base())
    expect(screen.getByRole('link', { name: 'Admin' })).toHaveAttribute('href', '#/admin')
  })

  it('has no Needs attention column: bubbles and the action row took its place (UI rework Phase 4)', () => {
    const s = { ...base(), constructions: [{ kind: 'build' as const, building: { type: 'farm' as const, index: 1 }, readyAtMs: 5_000 }] }
    renderHud(s)
    expect(screen.queryByRole('complementary', { name: 'Needs attention' })).toBeNull()
    expect(screen.queryByText(/daily quests/i)).toBeNull()
  })

  it('has no Finals countdown on the HUD (review image-5; it lives in Settings)', () => {
    renderHud(base(), { nowMs: 86_400_000 * 10 + 3_600_000, game: { launchAtMs: 0, preset: 'flash14' } })
    expect(screen.queryByRole('timer', { name: 'Terminal countdown' })).toBeNull()
    expect(screen.queryByText(/Finals/)).toBeNull()
  })

  it('reports the space its top and bottom take to the bridge', () => {
    const { setInsets } = renderHud(base())
    expect(setInsets).toHaveBeenCalled()
  })

  it('uses manifest icons when the art has them', () => {
    const h = harness(base())
    h.wrap(
      <HudArtContext.Provider value={{ 'icon.gold.32': { src: '/art/v9/icon-gold-32.png', w: 32, h: 32, frames: 1, fps: 0 } }}>
        <Hud bridge={createBridge()} nowMs={0} open={null} onOpen={() => {}} placing={false} />
      </HudArtContext.Provider>,
    )
    const res = screen.getByRole('status', { name: 'Resources' })
    expect(res.querySelector('img[src="/art/v9/icon-gold-32.png"]')).not.toBeNull()
    expect(res.querySelector('svg[data-icon="food"]')).not.toBeNull()
  })
})

describe('Dialog', () => {
  it('closes on Escape and on the scrim', async () => {
    const onClose = vi.fn()
    harness(base()).wrap(<Dialog label="Store" onClose={onClose}><p>inside</p></Dialog>)
    expect(screen.getByRole('dialog', { name: 'Store' })).toHaveTextContent('inside')
    await userEvent.keyboard('{Escape}')
    await userEvent.click(screen.getByTestId('dialog-scrim'))
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('a non-modal dialog has no scrim', () => {
    harness(base()).wrap(<Dialog label="Battle" onClose={() => {}} modal={false}><p>fight</p></Dialog>)
    expect(screen.queryByTestId('dialog-scrim')).toBeNull()
    expect(screen.getByRole('dialog', { name: 'Battle' })).toHaveAttribute('aria-modal', 'false')
  })
})

describe('HUD skin', () => {
  it('turns present ui.* art into CSS variables and skin classes, nothing for missing keys', async () => {
    const { hudSkin } = await import('../src/hud/skin')
    const sprite = (src: string) => ({ src, w: 48, h: 48, frames: 1, fps: 0 })
    const skin = hudSkin({ 'ui.button.round': sprite('/a/r.png'), 'ui.pill': sprite('/a/p.png') })
    expect(skin.style).toEqual({ '--ui-round': 'url("/a/r.png")', '--ui-pill': 'url("/a/p.png")' })
    expect(skin.className.split(' ').sort()).toEqual(['skin-pill', 'skin-round'])
    expect(hudSkin({})).toEqual({ className: '', style: {} })
  })
})
