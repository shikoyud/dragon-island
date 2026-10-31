import { type Action, applyAction, createRng, FOOTPRINT, ISLAND_TILES, LAUNCH_CATALOG, newPlayer, placementRuleError, type Footprint, type PlayerState } from '@wyrmhaven/game-core'
import { describe, expect, it } from 'vitest'
import { hasLegalCell, nearestLegalCell, placementStart, placingAction } from '../src/state/placing'

/** With no focus, the default cell aims at the owned land's middle, less half the footprint. */
const midFor = (size: number) => ({ col: 16 - Math.floor((size - 1) / 2), row: 16 - Math.floor((size - 1) / 2) })

describe('the default cell leaves room for a habitat (final fix 2)', () => {
  const rich = { ...newPlayer(0), level: 12, gold: 1_000_000_000 }
  const sea = { kind: 'habitat', element: 'sea' } as const

  it('the fresh island has a habitat spot', () => {
    expect(hasLegalCell(rich, sea)).toBe(true)
  })

  const things = [[{ kind: 'roost' }, FOOTPRINT.roost], [{ kind: 'grove' }, FOOTPRINT.breeder], [{ kind: 'farm' }, FOOTPRINT.farm]] as const
  for (const [what, size] of things) {
    it(`a new ${what.kind} opens on a legal cell that keeps a habitat's room free, wherever the screen's middle is`, () => {
      const stride = 5
      const foci = [undefined]  as ({ col: number; row: number } | undefined)[]
      for (let row = 0; row < ISLAND_TILES; row += stride) for (let col = 0; col < ISLAND_TILES; col += stride) foci.push({ col, row })
      let taken = 0
      for (const focus of foci) {
        const { island, cell } = placementStart(rich, what, size, 'home', focus)
        expect(island).toBe('home')
        const action = placingAction(rich, 'home', { what, size, ...cell!, facing: 0 })
        expect(action).not.toBeNull()
        const r = applyAction(rich, action as Action, 0, createRng(1), LAUNCH_CATALOG)
        if (!r.ok) throw new Error(r.error)
        if (!hasLegalCell(r.state, sea)) taken++
      }
      expect(taken).toBe(0)
    })
  }

  it('a habitat-sized thing takes the nearest cell to the owned land\'s middle', () => {
    const { cell } = placementStart(rich, sea, FOOTPRINT.habitat, 'home', undefined)
    expect(cell).toEqual(nearestLegalCell(rich, sea, 'home', midFor(FOOTPRINT.habitat)))
  })

  it('falls back to the nearest cell when no cell would leave a habitat\'s room', () => {
    // Everything owned is taken but one 4x4 block: a farm anywhere in it spoils the last habitat spot.
    const decorations: PlayerState['decorations'] = []
    for (let row = 0; row < ISLAND_TILES; row++) for (let col = 0; col < ISLAND_TILES; col++) {
      if (col >= 20 && row >= 20) continue
      const at = { island: 'home' as const, col, row, facing: 0 as const }
      if (placementRuleError({ ...rich, decorations }, { kind: 'decoration', decoration: 'flowerPatch' }, at) === null) decorations.push({ id: `f${col}-${row}`, kind: 'flowerPatch', placement: at })
    }
    const tight = { ...rich, decorations }
    expect(hasLegalCell(tight, sea)).toBe(true)
    const size: Footprint = FOOTPRINT.farm
    const { cell } = placementStart(tight, { kind: 'farm' }, size, 'home', undefined)
    expect(cell).toEqual(nearestLegalCell(tight, { kind: 'farm' }, 'home', midFor(size)))
  })
})
