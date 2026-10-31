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

const at = (level: number, xp = 0): PlayerState => ({ ...newPlayer(0), level, xp })

/** The App's wiring in miniature: the HUD, and the level-up screen over it unless something holds it back. */
function Host({ hold = false, nowMs = 0 }: { hold?: boolean; nowMs?: number }) {
  const level = useMe().data?.state.level
  const up = useLevelUp(level, hold)
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

  it('plays fx.levelUp once when the screen opens (onShown)', () => {
    const shown = vi.fn()
    harness(at(5)).wrap(<LevelUp from={5} to={6} onClose={() => {}} onShown={shown} />)
    expect(shown).toHaveBeenCalledTimes(1)
  })
})
