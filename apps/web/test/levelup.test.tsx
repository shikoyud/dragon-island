import { newPlayer, type PlayerState } from '@wyrmhaven/game-core'
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
function Host({ hold = false }: { hold?: boolean }) {
  const level = useMe().data?.state.level
  const up = useLevelUp(level, hold)
  const [bridge] = useState(() => createBridge())
  return (
    <>
      <Hud bridge={bridge} nowMs={0} open={null} onOpen={() => {}} placing={false} />
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

  it('plays fx.levelUp once when the screen opens (onShown)', () => {
    const shown = vi.fn()
    harness(at(5)).wrap(<LevelUp from={5} to={6} onClose={() => {}} onShown={shown} />)
    expect(shown).toHaveBeenCalledTimes(1)
  })
})
