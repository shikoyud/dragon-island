import { FLASH_14, FLASH_28, getSpecies, LAUNCH_CATALOG, newPlayer } from '@wyrmhaven/game-core'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { DragonBookPanel } from '../src/panels/DragonBookPanel'
import { bookHint } from '../src/panels/bookHints'
import { harness } from './harness'

const hint = (id: string, preset = FLASH_14) => bookHint(getSpecies(LAUNCH_CATALOG, id), preset, LAUNCH_CATALOG)

describe('bookHint (§1.4, §3.4, §8.4)', () => {
  it('Basics say when the Shop sells them', () => {
    expect(hint('terra')).toBe('Buy in the Shop at level 1')
    expect(hint('sea')).toBe('Buy in the Shop at level 3')
  })
  it('hybrids say what to breed', () => {
    expect(hint('terra-flame')).toBe('Breed a Terra parent with a Flame parent')
    expect(hint('flame-ice')).toBe("Two Basics can't make this. Breed a hybrid carrying Flame with one carrying Ice")
    expect(hint('flame-ice-sea')).toBe('Breed parents carrying Flame, Ice and Sea, one with a Flame primary')
  })
  it('Legendaries show their event days for the active preset, or Not bred', () => {
    expect(hint('magma-sovereign')).toBe('Breeding event, days 1–4: Terra and Flame parents')
    expect(hint('magma-sovereign', FLASH_28)).toBe('Breeding event, days 1–7: Terra and Flame parents')
    expect(hint('last-light')).toBe('Not bred')
    expect(hint('trial-champion')).toBe('Reward: beat the Chapter 10 Boss of the Elemental Trials')
  })
})

describe('DragonBookPanel (R22)', () => {
  const total = LAUNCH_CATALOG.species.size
  const open = () => {
    const h = harness(newPlayer(0))
    h.wrap(<DragonBookPanel onSelect={() => {}} />)
  }

  it('opens on the Book tab with n / total found', () => {
    open()
    expect(screen.getByRole('tab', { name: 'Book' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText(`2 / ${total}`)).toBeInTheDocument()
  })

  it('an undiscovered tile reads ??? and its name appears nowhere in its accessible name', async () => {
    open()
    const sea = getSpecies(LAUNCH_CATALOG, 'sea')
    const tile = screen.getAllByRole('button', { name: '???' })[0]!
    expect(tile).toBeInTheDocument()
    expect(within(tile).queryByRole('img')).toBeNull()
    expect(screen.queryByText(sea.name)).toBeNull()
    expect(screen.queryByLabelText(sea.name)).toBeNull()
  })

  it('a discovered tile shows its name; tapping shows elements, rarity and the hint for both kinds', async () => {
    open()
    await userEvent.click(screen.getByRole('button', { name: 'Terra Basic' }))
    const detail = screen.getByTestId('book-detail')
    expect(within(detail).getByText('Buy in the Shop at level 1')).toBeInTheDocument()
    expect(detail).toHaveTextContent(/common/i)
    expect(detail).toHaveTextContent('Terra')
    const hidden = screen.getAllByRole('button', { name: '???' })[0]!
    await userEvent.click(hidden)
    expect(within(screen.getByTestId('book-detail')).getByText(/Buy in the Shop at level \d+/)).toBeInTheDocument()
    expect(within(screen.getByTestId('book-detail')).getByText('???')).toBeInTheDocument()
  })

  it('renders sprites only for the open rarity group', async () => {
    open()
    const commons = [...LAUNCH_CATALOG.species.values()].filter(s => s.rarity === 'common').length
    expect(screen.getAllByTestId('book-tile')).toHaveLength(commons)
    await userEvent.click(screen.getByRole('button', { name: /Legendary/ }))
    const legendaries = [...LAUNCH_CATALOG.species.values()].filter(s => s.rarity === 'legendary').length
    expect(screen.getAllByTestId('book-tile')).toHaveLength(legendaries)
    expect(screen.getAllByTestId('book-sprite')).toHaveLength(legendaries)
  })

  it('the My dragons tab lists the owned dragons', async () => {
    open()
    await userEvent.click(screen.getByRole('tab', { name: 'My dragons' }))
    expect(screen.getAllByText('Terra Basic').length).toBeGreaterThan(0)
  })
})
