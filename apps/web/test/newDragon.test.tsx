import { DEFAULT_PRESET, newPlayer, type PlayerState } from '@wyrmhaven/game-core'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { hatchedDragon, newDragonCard } from '../src/hud/newDragonCard'
import { NewDragon } from '../src/hud/NewDragon'
import { harness } from './harness'

const base = newPlayer(0)
const hatched: PlayerState = {
  ...base,
  dragons: [...base.dragons, { id: 'd3', speciesId: 'terra', level: 1, feeds: 0, habitatId: 'h1' }],
  goalStats: { ...base.goalStats, hatches: 1 },
}

describe('New dragon (design Phase 5: new-dragon)', () => {
  it('names the dragon a hatch just added, and nothing for other changes', () => {
    expect(hatchedDragon(base, hatched)).toBe('d3')
    expect(hatchedDragon(undefined, hatched)).toBeNull()
    expect(hatchedDragon(hatched, hatched)).toBeNull()
    const bought = { ...hatched, goalStats: base.goalStats }
    expect(hatchedDragon(base, bought)).toBeNull()
  })

  it('the card has XP, rarity, elements, skills and income', () => {
    const card = newDragonCard(hatched, 'd3', DEFAULT_PRESET)!
    expect(card).toMatchObject({ name: 'Terra Basic', rarity: 'common', elements: ['terra'], habitatId: 'h1' })
    expect(card.skills[0]).toBe('Strike')
    expect(card.skills).toHaveLength(2)
    expect(card.xp).toBeGreaterThan(0)
  })

  it('sells for its price, or closes when it already has a home', async () => {
    const onClose = vi.fn()
    const { wrap, action } = harness(hatched)
    wrap(<NewDragon dragonId="d3" canPlace={false} onPlace={() => {}} onClose={onClose} />)
    expect(screen.getByRole('dialog', { name: 'New dragon' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Terra' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /^Sell for / }))
    expect(action).toHaveBeenCalledWith({ type: 'sellDragon', dragonId: 'd3' }, expect.any(String))
    await userEvent.click(screen.getByRole('button', { name: 'Done' }))
    expect(onClose).toHaveBeenCalled()
  })

  it('Place in Habitat opens the home finder when a habitat has room', async () => {
    const onPlace = vi.fn()
    harness(hatched).wrap(<NewDragon dragonId="d3" canPlace onPlace={onPlace} onClose={() => {}} />)
    await userEvent.click(screen.getByRole('button', { name: 'Place in Habitat' }))
    expect(onPlace).toHaveBeenCalled()
  })
})
