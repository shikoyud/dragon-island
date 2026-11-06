import { newPlayer, type PlayerState } from '@wyrmhaven/game-core'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { DragonPanel } from '../src/panels/DragonPanel'
import { HatcheryPanel } from '../src/panels/HatcheryPanel'
import { StoragePanel } from '../src/panels/StoragePanel'
import { storageItems } from '../src/panels/storageModel'
import { harness } from './harness'

const base = newPlayer(0)
const at = { atMs: 0 }
const stocked: PlayerState = {
  ...base,
  habitats: base.habitats.map(h => (h.id === 'h2' ? { ...h, stored: at } : h)),
  dragons: [...base.dragons, { id: 'd7', speciesId: 'sea', level: 3, feeds: 0, habitatId: null, stored: true }],
  storedEggs: [{ speciesId: 'flame', remainingMs: 60_000 }],
  decorations: [{ id: 'c4', kind: 'flowerPatch', placement: { island: 'home', col: 1, row: 1, facing: 0 }, stored: at }],
  speedUps: { '15m': 2, '1h': 0, '3h': 0 },
}

describe('storageItems (Storage, shiko 2026-11-01)', () => {
  it('lists stored buildings, dragons, eggs and speed-up tokens', () => {
    const items = storageItems(stocked)
    expect(items.map(i => [i.kind, i.name])).toEqual([
      ['dragon', 'Sea Basic'], ['egg', 'Egg'], ['building', 'Flame Habitat'], ['building', 'Flower patch'], ['token', '15m token'],
    ])
    expect(items.find(i => i.kind === 'building' && i.name === 'Flame Habitat')!.use).toEqual({ kind: 'place', target: { type: 'habitat', id: 'h2' }, size: 4 })
    expect(items.find(i => i.kind === 'egg')!.use).toEqual({ kind: 'run', action: { type: 'takeEgg', index: 0 } })
    expect(items.find(i => i.kind === 'dragon')!.sell).toEqual({ type: 'sellDragon', dragonId: 'd7' })
    expect(items.find(i => i.kind === 'token')).toMatchObject({ count: 2 })
    expect(items.find(i => i.kind === 'token')!.use).toBeUndefined()
    expect(storageItems(base)).toEqual([])
  })
})

describe('StoragePanel (design Phase 5: storage)', () => {
  it('counts items on the plank; search and the filter panel narrow the cards', async () => {
    harness(stocked).wrap(<StoragePanel onPlace={vi.fn()} onHome={vi.fn()} onShop={vi.fn()} />)
    expect(screen.getByRole('region', { name: 'Storage · 5' })).toBeInTheDocument()
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search' }), 'flower')
    expect(screen.getAllByRole('article').map(a => a.getAttribute('aria-label'))).toEqual(['Flower patch'])
    await userEvent.clear(screen.getByRole('searchbox', { name: 'Search' }))
    await userEvent.click(within(screen.getByRole('group', { name: 'Type' })).getByRole('button', { name: 'Dragons' }))
    expect(screen.getAllByRole('article').map(a => a.getAttribute('aria-label'))).toEqual(['Sea Basic'])
  })

  it('Use places a building, takes an egg back, and opens the home finder for a dragon', async () => {
    const onPlace = vi.fn(), onHome = vi.fn()
    const { wrap, action } = harness(stocked)
    wrap(<StoragePanel onPlace={onPlace} onHome={onHome} onShop={vi.fn()} />)
    const use = (name: string) => userEvent.click(within(screen.getByRole('article', { name })).getByRole('button', { name: 'Use' }))
    await use('Flame Habitat')
    expect(onPlace).toHaveBeenCalledWith({ type: 'habitat', id: 'h2' }, 4)
    await use('Egg')
    expect(action).toHaveBeenCalledWith({ type: 'takeEgg', index: 0 }, expect.any(String))
    await use('Sea Basic')
    expect(onHome).toHaveBeenCalledWith('d7')
  })

  it('says it is empty, with Go to shop', async () => {
    const onShop = vi.fn()
    harness(base).wrap(<StoragePanel onPlace={vi.fn()} onHome={vi.fn()} onShop={onShop} />)
    expect(screen.getByText('Storage is empty')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Go to shop' }))
    expect(onShop).toHaveBeenCalled()
  })
})

describe('Store for a dragon and an egg (shiko 2026-11-01, rules 1 and S4-S5)', () => {
  it('the dragon detail stores the dragon, but not one in the defence team', async () => {
    const { wrap, action } = harness(base)
    const { unmount } = wrap(<DragonPanel dragonId="d1" />)
    await userEvent.click(screen.getByRole('button', { name: 'Store' }))
    expect(action).toHaveBeenCalledWith({ type: 'putInStorage', target: { type: 'dragon', id: 'd1' } }, expect.any(String))
    unmount()
    harness({ ...base, defenceTeam: ['d1', 'd2', 'd2'] as never }).wrap(<DragonPanel dragonId="d1" />)
    expect(screen.getByRole('button', { name: 'Store' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Store' })).toHaveAccessibleDescription('It is in the defence team')
  })

  it('a Hatchery egg has Store', async () => {
    const { wrap, action } = harness({ ...base, hatchery: [{ speciesId: 'sea', readyAtMs: 99_000 }] })
    wrap(<HatcheryPanel nowMs={0} />)
    await userEvent.click(screen.getByRole('button', { name: 'Store' }))
    expect(action).toHaveBeenCalledWith({ type: 'putInStorage', target: { type: 'egg', slot: 0 } }, expect.any(String))
  })
})
