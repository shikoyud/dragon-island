import { newPlayer, type PlayerState } from '@wyrmhaven/game-core'
import { cleanup, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { GameInfo } from '@wyrmhaven/shared'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createBridge } from '../src/game/bridge'
import { Dialog } from '../src/hud/Dialog'
import { Hud } from '../src/hud/Hud'
import { HudArtContext } from '../src/hud/Icon'
import { harness } from './harness'

const base = (): PlayerState => ({ ...newPlayer(0), gold: 12_345, food: 678, level: 3, xp: 225 })

function renderHud(state: PlayerState, opts: { placing?: boolean; nowMs?: number; game?: Partial<GameInfo> } = {}) {
  const h = harness(state, 0, undefined, opts.game)
  const onOpen = vi.fn()
  const bridge = createBridge()
  const setInsets = vi.spyOn(bridge, 'setInsets')
  h.wrap(<Hud bridge={bridge} nowMs={opts.nowMs ?? 10_000} open={null} onOpen={onOpen} placing={opts.placing ?? false} />)
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
    expect(onOpen).toHaveBeenLastCalledWith({ kind: 'panel', id: 'settings' })
  })

  it('gold pill has no sell-back sub-label, even with a lot of gold', () => {
    renderHud({ ...base(), gold: 9_999_999 })
    expect(screen.queryByText(/sell .* today/)).toBeNull()
    expect(screen.queryByText(/today/)).toBeNull()
  })

  it('has the seven genre buttons at the bottom, in order, and highlights Shop while placing', async () => {
    const { onOpen } = renderHud(base(), { placing: true })
    const bar = screen.getByRole('navigation', { name: 'Main menu' })
    expect(within(bar).getAllByRole('button').map(b => b.getAttribute('aria-label'))).toEqual(['Shop', 'Breed', 'Dragon Book', 'Battle', 'Wings', 'Quests', 'Inbox'])
    expect(within(bar).getByRole('button', { name: 'Shop' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(bar).getByRole('button', { name: 'Dragon Book' })).toHaveAttribute('aria-pressed', 'false')
    await userEvent.click(within(bar).getByRole('button', { name: 'Battle' }))
    expect(onOpen).toHaveBeenLastCalledWith({ kind: 'panel', id: 'battle' })
  })

  it('opens Shop, Breed and Dragon Book from the bar', async () => {
    const { onOpen } = renderHud(base())
    const bar = screen.getByRole('navigation', { name: 'Main menu' })
    await userEvent.click(within(bar).getByRole('button', { name: 'Shop' }))
    expect(onOpen).toHaveBeenLastCalledWith({ kind: 'panel', id: 'shop' })
    await userEvent.click(within(bar).getByRole('button', { name: 'Breed' }))
    expect(onOpen).toHaveBeenLastCalledWith({ kind: 'panel', id: 'breed' })
    await userEvent.click(within(bar).getByRole('button', { name: 'Dragon Book' }))
    expect(onOpen).toHaveBeenLastCalledWith({ kind: 'panel', id: 'book' })
  })

  it('disables Wings and Inbox with the coming-later note; Quests is enabled', async () => {
    const { onOpen } = renderHud(base())
    const bar = screen.getByRole('navigation', { name: 'Main menu' })
    for (const name of ['Wings', 'Inbox']) {
      const b = within(bar).getByRole('button', { name })
      expect(b).toBeDisabled()
      expect(b).toHaveAccessibleDescription('Coming in a later milestone')
      await userEvent.click(b)
    }
    expect(onOpen).not.toHaveBeenCalled()
    for (const name of ['Shop', 'Breed', 'Dragon Book', 'Battle', 'Quests']) expect(within(bar).getByRole('button', { name })).toBeEnabled()
    await userEvent.click(within(bar).getByRole('button', { name: 'Quests' }))
    expect(onOpen).toHaveBeenLastCalledWith({ kind: 'panel', id: 'quests' })
  })

  it('shows a dot on Quests and a Goal ready shortcut only when the current Goal is claimable', async () => {
    renderHud(base())
    expect(screen.queryByRole('img', { name: 'Goal ready' })).toBeNull()
    expect(screen.queryByText('Goal ready')).toBeNull()
    cleanup()
    const done = { ...base(), goalStats: { ...base().goalStats, collects: 1 } }
    const r = renderHud(done)
    expect(screen.getByRole('img', { name: 'Goal ready' })).toBeInTheDocument()
    const list = screen.getByRole('complementary', { name: 'Needs attention' })
    expect(within(list).getByText('Goal ready')).toBeInTheDocument()
    await userEvent.click(within(list).getByRole('button', { name: 'Claim' }))
    expect(r.action).toHaveBeenCalledWith({ type: 'claimGoal' }, expect.any(String))
  })

  it('has the island menu on the right (Map; Settings sits in the top bar); Admin only with an operator token in this tab', () => {
    renderHud(base())
    const right = screen.getByRole('navigation', { name: 'Island menu' })
    expect(within(right).getAllByRole('button').map(b => b.getAttribute('aria-label'))).toEqual(['Map'])
    for (const label of ['Hoard', 'Season', 'Ranks', 'Referral']) expect(screen.queryByRole('button', { name: label })).toBeNull()
    expect(within(right).queryByRole('link', { name: 'Admin' })).toBeNull()
  })

  it('shows Admin when the operator token is set', () => {
    sessionStorage.setItem('dris.admin', 'tok')
    renderHud(base())
    expect(screen.getByRole('link', { name: 'Admin' })).toHaveAttribute('href', '#/admin')
  })

  it('lists what needs attention, with Finish on a ready build', async () => {
    const s = { ...base(), constructions: [{ kind: 'build' as const, building: { type: 'farm' as const, index: 1 }, readyAtMs: 5_000 }] }
    const { action, onOpen } = renderHud(s)
    const left = screen.getByRole('complementary', { name: 'Needs attention' })
    expect(within(left).getByText('Building Farm plot 2')).toBeInTheDocument()
    await userEvent.click(within(left).getByRole('button', { name: 'Finish' }))
    expect(action).toHaveBeenCalledWith({ type: 'finishConstruction', index: 0 }, expect.any(String))
    await userEvent.click(within(left).getByRole('button', { name: /Building Farm plot 2/ }))
    expect(onOpen).toHaveBeenLastCalledWith({ kind: 'target', target: { kind: 'farm', plot: 1 } })
  })

  it('has no Daily quests attention item', () => {
    renderHud(base())
    const left = screen.getByRole('complementary', { name: 'Needs attention' })
    expect(within(left).queryByText(/quests/i)).toBeNull()
    expect(screen.queryByText(/daily quests/i)).toBeNull()
  })

  it('shows the Terminal clock under the pills', () => {
    renderHud(base(), { nowMs: 86_400_000 * 10 + 3_600_000, game: { launchAtMs: 0, preset: 'flash14' } })
    expect(screen.getByRole('timer', { name: 'Terminal countdown' })).toHaveTextContent('Finals lock in 3d 23:00:00')
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
