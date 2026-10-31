import { applyAction, createRng, FLASH_14, LAUNCH_CATALOG, newPlayer, xpToNext, type PlayerState } from '@wyrmhaven/game-core'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { createBridge } from '../src/game/bridge'
import { Hud } from '../src/hud/Hud'
import { LevelUp, useLevelUp } from '../src/hud/LevelUp'
import { levelUnlockLines, xpFraction } from '../src/hud/hudModel'
import { useMe } from '../src/state/me'
import { harness } from './harness'
import { renderHook, waitFor } from '@testing-library/react'
import { useRefreshOnNewDay } from '../src/state/me'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const at = (level: number, xp = 0): PlayerState => ({ ...newPlayer(0), level, xp })

/** The App's wiring in miniature: the HUD, and the level-up screen over it unless something holds it back. */
function Host({ hold = false, nowMs = 0 }: { hold?: boolean; nowMs?: number }) {
  const me = useMe().data
  const up = useLevelUp(me?.state.level, hold, me?.playerId)
  const [bridge] = useState(() => createBridge())
  return (
    <>
      <Hud bridge={bridge} nowMs={nowMs} open={null} onOpen={() => {}} placing={false} />
      {up && <LevelUp from={up.from} to={up.to} onClose={up.dismiss} />}
    </>
  )
}

describe('level-up screen (R38)', () => {
  it('an action raising PL 5 to 6 shows Level 6 and what opened', async () => {
    const h = harness(at(5))
    h.wrap(<Host />)
    expect(screen.queryByRole('dialog', { name: 'Level up' })).toBeNull()
    h.setState(at(6))
    const d = await screen.findByRole('dialog', { name: 'Level up' })
    expect(within(d).getByRole('heading')).toHaveTextContent('Level 6')
    expect(within(d).getByText('Electric Habitat')).toBeInTheDocument()
    expect(within(d).getByText('Electric Basic')).toBeInTheDocument()
  })

  it('a jump from PL 7 to 9 is one screen listing both levels once', async () => {
    const h = harness(at(7))
    h.wrap(<Host />)
    h.setState(at(9))
    const d = await screen.findByRole('dialog', { name: 'Level up' })
    expect(within(d).getByRole('heading')).toHaveTextContent('Level 7 → 9')
    expect(within(d).getByText('Crop: Thunder Pumpkin')).toBeInTheDocument() // PL 8
    expect(within(d).getByText('Ice Habitat')).toBeInTheDocument() // PL 8
    expect(within(d).getAllByText('Ice Habitat')).toHaveLength(1)
    expect(within(d).queryByText(/wings/i)).toBeNull()
  })

  it('the first load at PL 9 shows nothing', () => {
    harness(at(9)).wrap(<Host />)
    expect(screen.queryByRole('dialog', { name: 'Level up' })).toBeNull()
  })

  it('a reset to a lower level shows nothing, and the next rise counts from there', async () => {
    const h = harness(at(9))
    h.wrap(<Host />)
    h.setState(at(2))
    await screen.findByLabelText('Level 2')
    expect(screen.queryByRole('dialog', { name: 'Level up' })).toBeNull()
    h.setState(at(3))
    expect(await screen.findByRole('heading', { name: 'Level 3' })).toBeInTheDocument()
  })

  it('closing it leaves the HUD intact', async () => {
    const h = harness(at(5))
    h.wrap(<Host />)
    h.setState(at(6))
    await userEvent.click(await screen.findByRole('button', { name: 'Continue' }))
    expect(screen.queryByRole('dialog', { name: 'Level up' })).toBeNull()
    expect(screen.getByLabelText('Level 6')).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: 'Experience' })).toBeInTheDocument()
  })

  it('waits while something holds it back (placement, a battle) and shows when released', () => {
    const h = harness(at(5))
    const { rerender } = h.wrap(<Host hold />)
    h.setState(at(6))
    expect(screen.queryByRole('dialog', { name: 'Level up' })).toBeNull()
    rerender(<Host />)
    expect(screen.getByRole('heading', { name: 'Level 6' })).toBeInTheDocument()
  })

  it('a rise held back, then a reload (unmount and mount): the new mount shows the screen, since nothing was closed', async () => {
    const KEY = 'dragon-island:levelShown:p1'
    const h = harness(at(5))
    const first = h.wrap(<Host hold />)
    await screen.findByLabelText('Level 5')
    h.setState(at(6))
    await screen.findByLabelText('Level 6')
    expect(screen.queryByRole('dialog', { name: 'Level up' })).toBeNull()
    expect(localStorage.getItem(KEY)).toBe('5')
    first.unmount()
    h.wrap(<Host />)
    expect(await screen.findByRole('heading', { name: 'Level 6' })).toBeInTheDocument()
  })

  it('a long list scrolls between the title and Continue: the list carries the scrolling class', () => {
    harness(at(30)).wrap(<LevelUp from={1} to={30} onClose={() => {}} />)
    const d = screen.getByRole('dialog', { name: 'Level up' })
    const list = d.querySelector('ul.hud-levelup__list')
    expect(list).not.toBeNull()
    expect(list!.querySelectorAll('li').length).toBeGreaterThan(20)
    const heading = within(d).getByRole('heading')
    const button = within(d).getByRole('button', { name: 'Continue' })
    // Title above, list in the middle, Continue below, all siblings in the card (so only the list scrolls).
    expect(heading.compareDocumentPosition(list!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(list!.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(heading.parentElement).toBe(button.parentElement)
    expect(list!.parentElement).toBe(button.parentElement)
  })

  it('a level with no plain unlock says so', () => {
    expect(levelUnlockLines(1, 2).length).toBeGreaterThan(0)
    expect(levelUnlockLines(40, 41)).toEqual([])
  })

  it('names every kind of key in plain words; home steps become one line and wings are left out', () => {
    // PL 4: Farm 3, Hatchery 2, PvE, Home step; PL 8: wings.
    const lines = levelUnlockLines(3, 4)
    expect(lines).toContain('Farm 3')
    expect(lines.filter(l => l === 'Island expansion')).toHaveLength(1)
    expect(levelUnlockLines(4, 5)).toContain('Roost Tier 1')
    expect(levelUnlockLines(7, 8).join()).not.toMatch(/wings/i)
  })

  it('the XP bar reads 50 / 175 XP at PL 2 with 50 XP, and the fraction clamps at 1', () => {
    const h = harness(at(2, 50))
    h.wrap(<Host />)
    expect(screen.getByRole('progressbar', { name: 'Experience' })).toHaveTextContent('50 / 175 XP')
    expect(xpFraction(at(2, 9_999))).toBe(1)
  })

  it('at the day limit the XP bar says so, full, instead of its numbers', () => {
    const h = harness(at(12, xpToNext(12) + 40))
    h.wrap(<Host />)
    const bar = screen.getByRole('progressbar', { name: 'Experience' })
    expect(bar).toHaveTextContent('Level limit today · more tomorrow')
    expect(bar).toHaveAttribute('aria-valuenow', String(xpToNext(12)))
    expect(bar.querySelector('.hud-xp__fill')).toHaveStyle({ width: '100%' })
  })

  describe('the banked-XP text reads the synced game day (R41)', () => {
    const DAY = 86_400_000
    const game = { launchAtMs: 0, serverNowMs: 0, day: 1 }
    const banked = at(12, xpToNext(12) + 40)

    it('Flash-14 Day 1: the next day raises the limit, so "more tomorrow"', () => {
      harness(banked, 0, 'flash14', game).wrap(<Host nowMs={0} />)
      expect(screen.getByRole('progressbar', { name: 'Experience' })).toHaveTextContent('Level limit today · more tomorrow')
    })

    it('Flash-28 Day 1 has the same limit tomorrow: "more on Day 3"', () => {
      harness(banked, 0, 'flash28', game).wrap(<Host nowMs={0} />)
      expect(screen.getByRole('progressbar', { name: 'Experience' })).toHaveTextContent('Level limit today · more on Day 3')
    })

    it('Flash-28 Day 4 shares PL 25 with Day 5, so it names Day 6', () => {
      harness(at(25, xpToNext(25) + 1), 3 * DAY + 5, 'flash28', game).wrap(<Host nowMs={3 * DAY + 5} />)
      expect(screen.getByRole('progressbar', { name: 'Experience' })).toHaveTextContent('Level limit today · more on Day 6')
    })

    it('Flash-28 Day 3 says tomorrow, since Day 4 raises it to PL 25', () => {
      harness(at(18, xpToNext(18) + 1), 2 * DAY + 5, 'flash28', game).wrap(<Host nowMs={2 * DAY + 5} />)
      expect(screen.getByRole('progressbar', { name: 'Experience' })).toHaveTextContent('Level limit today · more tomorrow')
    })

    it('once the day has turned and the limit is higher, the normal numbers show (Flash-14 Day 2)', () => {
      harness(banked, DAY + 5, 'flash14', game).wrap(<Host nowMs={DAY + 5} />)
      const bar = screen.getByRole('progressbar', { name: 'Experience' })
      expect(bar).not.toHaveTextContent(/Level limit today/)
      expect(bar).toHaveTextContent(/XP/)
    })

    it('and on Flash-28 Day 3, which raises PL 12 to 18', () => {
      harness(banked, 2 * DAY + 5, 'flash28', game).wrap(<Host nowMs={2 * DAY + 5} />)
      expect(screen.getByRole('progressbar', { name: 'Experience' })).not.toHaveTextContent(/Level limit today/)
    })
  })

  it('Review Focus 5: banked XP paying on the first action of the next day is one level-up screen', async () => {
    const banked = xpToNext(12) + xpToNext(13) + xpToNext(14) + 7
    const h = harness(at(12, banked))
    h.wrap(<Host />)
    expect(screen.queryByRole('dialog', { name: 'Level up' })).toBeNull()
    const next = applyAction(at(12, banked), { type: 'collectGold', habitatId: 'h1' }, 0, createRng(1), LAUNCH_CATALOG, FLASH_14, 2)
    if (!next.ok) throw new Error(next.error)
    h.setState(next.state)
    const d = await screen.findByRole('dialog', { name: 'Level up' })
    expect(within(d).getByRole('heading')).toHaveTextContent('Level 12 → 15')
    expect(screen.getAllByRole('dialog', { name: 'Level up' })).toHaveLength(1)
    expect(screen.getByRole('progressbar', { name: 'Experience' })).toHaveTextContent(`7 / ${xpToNext(15).toLocaleString('en-US')} XP`)
  })

  describe('a returning player (item 8): the last level shown is kept per player', () => {
    const KEY = (id: string) => `dragon-island:levelShown:${id}`

    it('first load with a stored 12 and a settled 18 lists PL 13 to 18 once, with no home: lines', async () => {
      localStorage.setItem(KEY('p1'), '12')
      harness(at(18)).wrap(<Host />)
      const d = await screen.findByRole('dialog', { name: 'Level up' })
      expect(within(d).getByRole('heading')).toHaveTextContent('Level 12 → 18')
      for (const line of ['Hatchery level 3', 'Dark Habitat', 'Light Habitat', 'War Habitat', 'Roost Tier 3', 'Third island']) expect(within(d).getByText(line)).toBeInTheDocument()
      expect(within(d).queryByText(/home:/)).toBeNull()
      expect(within(d).queryByText('Electric Habitat')).toBeNull() // PL 6 is below the range
    })

    it('a reload after closing it shows nothing', async () => {
      localStorage.setItem(KEY('p1'), '12')
      const h = harness(at(18))
      const first = h.wrap(<Host />)
      await userEvent.click(await screen.findByRole('button', { name: 'Continue' }))
      expect(localStorage.getItem(KEY('p1'))).toBe('18')
      first.unmount()
      h.wrap(<Host />)
      await screen.findByLabelText('Level 18')
      expect(screen.queryByRole('dialog', { name: 'Level up' })).toBeNull()
    })

    it('a new device (nothing stored) shows nothing and takes the level as its baseline', async () => {
      harness(at(18)).wrap(<Host />)
      await screen.findByLabelText('Level 18')
      expect(screen.queryByRole('dialog', { name: 'Level up' })).toBeNull()
      expect(localStorage.getItem(KEY('p1'))).toBe('18')
    })

    it('a stored level above the current one (a reset) shows nothing and is replaced', async () => {
      localStorage.setItem(KEY('p1'), '30')
      harness(at(5)).wrap(<Host />)
      await screen.findByLabelText('Level 5')
      expect(screen.queryByRole('dialog', { name: 'Level up' })).toBeNull()
      expect(localStorage.getItem(KEY('p1'))).toBe('5')
    })

    it('a storage that throws still renders, and still shows an in-page rise', async () => {
      const get = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
      const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked') })
      try {
        const h = harness(at(5))
        h.wrap(<Host />)
        await screen.findByLabelText('Level 5')
        expect(screen.queryByRole('dialog', { name: 'Level up' })).toBeNull()
        h.setState(at(6))
        await userEvent.click(await screen.findByRole('button', { name: 'Continue' }))
        expect(screen.queryByRole('dialog', { name: 'Level up' })).toBeNull()
      } finally { get.mockRestore(); set.mockRestore() }
    })

    it('the key is per player: another account at the same level keeps its own baseline', () => {
      localStorage.setItem(KEY('p1'), '12')
      const { result, rerender } = renderHook(({ id }: { id: string }) => useLevelUp(18, false, id), { initialProps: { id: 'p1' } })
      expect(result.current).toMatchObject({ from: 12, to: 18 })
      rerender({ id: 'p2' }) // p2 has nothing stored: baseline, no screen
      expect(result.current).toBeNull()
      expect(localStorage.getItem(KEY('p2'))).toBe('18')
      expect(localStorage.getItem(KEY('p1'))).toBe('12')
    })

    it('the day turns in an open tab at PL 12, /me settles at 15: one screen from 12 to 15; a reload shows none', async () => {
      const h = harness(at(12, xpToNext(12) + 5))
      const first = h.wrap(<Host />)
      await screen.findByLabelText('Level 12')
      expect(screen.queryByRole('dialog', { name: 'Level up' })).toBeNull()
      expect(localStorage.getItem(KEY('p1'))).toBe('12')
      h.setState(at(15, 7)) // the refetch after the turn
      const d = await screen.findByRole('dialog', { name: 'Level up' })
      expect(within(d).getByRole('heading')).toHaveTextContent('Level 12 → 15')
      expect(screen.getAllByRole('dialog', { name: 'Level up' })).toHaveLength(1)
      expect(within(d).getByText('Dark Habitat')).toBeInTheDocument() // PL 14
      await userEvent.click(within(d).getByRole('button', { name: 'Continue' }))
      first.unmount()
      h.wrap(<Host />)
      await screen.findByLabelText('Level 15')
      expect(screen.queryByRole('dialog', { name: 'Level up' })).toBeNull()
    })
  })

  describe('the day turning in an open tab (item 9)', () => {
    const DAY = 86_400_000
    const wrapperFor = (qc: QueryClient) => ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    it('refetches /me when the game day changes, not before and not for the first reading', () => {
      const qc = new QueryClient()
      const spy = vi.spyOn(qc, 'invalidateQueries')
      const game = { launchAtMs: 0, serverNowMs: 0, day: 1 }
      const { rerender } = renderHook(({ nowMs }: { nowMs: number }) => useRefreshOnNewDay(game, nowMs), { wrapper: wrapperFor(qc), initialProps: { nowMs: 5 } })
      expect(spy).not.toHaveBeenCalled()
      rerender({ nowMs: DAY - 1 })
      expect(spy).not.toHaveBeenCalled()
      rerender({ nowMs: DAY + 1 })
      expect(spy).toHaveBeenCalledTimes(1)
      expect(spy).toHaveBeenCalledWith({ queryKey: ['me'] })
      rerender({ nowMs: DAY + 60_000 })
      expect(spy).toHaveBeenCalledTimes(1)
    })

    it('before launch (day 0) nothing is fetched; the turn from 0 to Day 1 fetches once', () => {
      const qc = new QueryClient()
      const spy = vi.spyOn(qc, 'invalidateQueries')
      const game = { launchAtMs: 10 * DAY, serverNowMs: 0, day: 0 }
      const { rerender } = renderHook(({ nowMs }: { nowMs: number }) => useRefreshOnNewDay(game, nowMs), { wrapper: wrapperFor(qc), initialProps: { nowMs: 5 } })
      rerender({ nowMs: 5 * DAY })
      rerender({ nowMs: 10 * DAY - 1 })
      expect(spy).not.toHaveBeenCalled()
      rerender({ nowMs: 10 * DAY })
      expect(spy).toHaveBeenCalledTimes(1)
      rerender({ nowMs: 10 * DAY + 1_000 })
      expect(spy).toHaveBeenCalledTimes(1)
    })

    it('a day that flips backwards (a clock resync) fetches at most once and never loops', () => {
      const qc = new QueryClient()
      const spy = vi.spyOn(qc, 'invalidateQueries')
      const game = { launchAtMs: 0, serverNowMs: 0, day: 1 }
      const { rerender } = renderHook(({ nowMs }: { nowMs: number }) => useRefreshOnNewDay(game, nowMs), { wrapper: wrapperFor(qc), initialProps: { nowMs: 2 * DAY + 5 } })
      rerender({ nowMs: DAY + 5 })
      const afterBack = spy.mock.calls.length
      expect(afterBack).toBeLessThanOrEqual(1)
      for (const t of [DAY + 10, DAY + 20_000, DAY + 40_000]) rerender({ nowMs: t })
      expect(spy.mock.calls.length).toBe(afterBack)
    })

    it('without game info it never refetches', () => {
      const qc = new QueryClient()
      const spy = vi.spyOn(qc, 'invalidateQueries')
      const { rerender } = renderHook(({ nowMs }: { nowMs: number }) => useRefreshOnNewDay(undefined, nowMs), { wrapper: wrapperFor(qc), initialProps: { nowMs: 5 } })
      rerender({ nowMs: 3 * DAY })
      expect(spy).not.toHaveBeenCalled()
    })

    it('after the turn and before the refetch lands, the bar never reads an over-full count', () => {
      const need = xpToNext(12)
      harness(at(12, need + 40), DAY + 5, 'flash14', { launchAtMs: 0, serverNowMs: 0, day: 1 }).wrap(<Host nowMs={DAY + 5} />)
      const text = screen.getByRole('progressbar', { name: 'Experience' }).textContent ?? ''
      expect(text).not.toContain((need + 40).toLocaleString('en-US'))
      expect(text).toContain(`${need.toLocaleString('en-US')} / ${need.toLocaleString('en-US')} XP`)
    })
  })

  describe('the bar at the day limit (item 18)', () => {
    const banked = (): PlayerState => at(12, xpToNext(12) + 40)
    it('shows a short label in the bar, with the whole sentence as its title and value text', () => {
      harness(banked(), 0, 'flash28', { launchAtMs: 0, serverNowMs: 0, day: 1 }).wrap(<Host nowMs={0} />)
      const bar = screen.getByRole('progressbar', { name: 'Experience' })
      expect(bar).toHaveAttribute('title', 'Level limit today · more on Day 3')
      expect(bar).toHaveAttribute('aria-valuetext', 'Level limit today · more on Day 3')
      expect(bar.querySelector('.hud-xp__text--short')).toHaveTextContent('Level limit')
      expect(bar.querySelector('.hud-xp__text--short')).toHaveAttribute('aria-hidden', 'true')
    })

    it('tapping it shows the whole sentence as a notice', async () => {
      harness(banked()).wrap(<Host />)
      await userEvent.click(screen.getByRole('progressbar', { name: 'Experience' }))
      await waitFor(() => expect(document.querySelector('.toast')).toHaveTextContent('Level limit today · more tomorrow'))
    })

    it('a bar with room under it (not at the limit) keeps its plain numbers, no title, and is not a button', () => {
      harness(at(2, 50)).wrap(<Host />)
      const bar = screen.getByRole('progressbar', { name: 'Experience' })
      expect(bar).not.toHaveAttribute('title')
      expect(bar).not.toHaveAttribute('tabindex')
      expect(bar).toHaveTextContent('50 / 175 XP')
    })
  })

  it('plays fx.levelUp once when the screen opens (onShown)', () => {
    const shown = vi.fn()
    harness(at(5)).wrap(<LevelUp from={5} to={6} onClose={() => {}} onShown={shown} />)
    expect(shown).toHaveBeenCalledTimes(1)
  })
})
