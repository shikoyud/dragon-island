import { type Action, applyAction, createRng, FOOTPRINT, ISLAND_TILES, LAUNCH_CATALOG, newPlayer, placementRuleError, type Footprint, type PlayerState } from '@wyrmhaven/game-core'
import { describe, expect, it } from 'vitest'
import { hasLegalCell, nearestLegalCell, placementStart, placingAction } from '../src/state/placing'

/** With no focus, the default cell aims at the owned land's middle, less half the footprint. */
const midFor = (size: number) => ({ col: 16 - Math.floor((size - 1) / 2), row: 16 - Math.floor((size - 1) / 2) })

describe('the default cell leaves room for a habitat (final fix 2)', () => {
  // The tests carve their own free land, so Home's starting obstacles (R50) are cleared.
  const start = newPlayer(0)
  const rich = { ...start, islands: { ...start.islands, obstacles: [] }, level: 12, gold: 1_000_000_000 }
  const sea = { kind: 'habitat', element: 'sea' } as const

  it('the fresh island has a habitat spot', () => {
    expect(hasLegalCell(rich, sea)).toBe(true)
  })

  const things = [[{ kind: 'roost' }, FOOTPRINT.roost], [{ kind: 'grove' }, FOOTPRINT.breeder], [{ kind: 'farm' }, FOOTPRINT.farm]] as const
  for (const [what, size] of things) {
    it(`a new ${what.kind} opens on a legal cell, wherever the screen's middle is`, () => {
      const stride = 5
      const foci = [undefined]  as ({ col: number; row: number } | undefined)[]
      for (let row = 0; row < ISLAND_TILES; row += stride) for (let col = 0; col < ISLAND_TILES; col += stride) foci.push({ col, row })
      for (const focus of foci) {
        const { island, cell } = placementStart(rich, what, size, 'home', focus)
        expect(island).toBe('home')
        expect(placingAction(rich, 'home', { what, size, ...cell!, facing: 0 })).not.toBeNull()
      }
    })
  }

  /** Decorations on all owned land except where `keep` says, so only that land is free. */
  const onlyFree = (keep: (col: number, row: number) => boolean): PlayerState => {
    const decorations: PlayerState['decorations'] = []
    for (let row = 0; row < ISLAND_TILES; row++) for (let col = 0; col < ISLAND_TILES; col++) {
      if (keep(col, row)) continue
      const at = { island: 'home' as const, col, row, facing: 0 as const }
      if (placementRuleError({ ...rich, decorations }, { kind: 'decoration', decoration: 'flowerPatch' }, at) === null) decorations.push({ id: `f${col}-${row}`, kind: 'flowerPatch', placement: at })
    }
    return { ...rich, decorations }
  }
  const placeFarm = (s: PlayerState, cell: { col: number; row: number }): PlayerState => {
    const action = placingAction(s, 'home', { what: { kind: 'farm' }, size: FOOTPRINT.farm, ...cell, facing: 0 })
    expect(action).not.toBeNull()
    const r = applyAction(s, action as Action, 0, createRng(1), LAUNCH_CATALOG)
    if (!r.ok) throw new Error(r.error)
    return r.state
  }

  describe('with free land only 4x7 (cols 20-23, rows 17-23)', () => {
    const strip = onlyFree((col, row) => col >= 20 && row >= 17)
    // The screen's middle over the strip's middle: the farm's nearest cell is (20, 18), which leaves no 4x4 clear.
    const focus = { col: 21, row: 19 }

    it('the nearest cell would spoil the last habitat spot', () => {
      expect(hasLegalCell(strip, sea)).toBe(true)
      const nearest = nearestLegalCell(strip, { kind: 'farm' }, 'home', { col: focus.col - 1, row: focus.row - 1 })!
      expect(nearest).toEqual({ col: 20, row: 18 })
      expect(hasLegalCell(placeFarm(strip, nearest), sea)).toBe(false)
    })

    it('a new farm opens on a cell that keeps the habitat spot', () => {
      const { island, cell } = placementStart(strip, { kind: 'farm' }, FOOTPRINT.farm, 'home', focus)
      expect(island).toBe('home')
      expect(hasLegalCell(placeFarm(strip, cell!), sea)).toBe(true)
    })
  })

  it('a habitat-sized thing takes the nearest cell to the owned land\'s middle', () => {
    const { cell } = placementStart(rich, sea, FOOTPRINT.habitat, 'home', undefined)
    expect(cell).toEqual(nearestLegalCell(rich, sea, 'home', midFor(FOOTPRINT.habitat)))
  })

  it('falls back to the nearest cell when no cell would leave a habitat\'s room', () => {
    // Everything owned is taken but one 4x4 block: a farm anywhere in it spoils the last habitat spot.
    const tight = onlyFree((col, row) => col >= 20 && row >= 20)
    expect(hasLegalCell(tight, sea)).toBe(true)
    const size: Footprint = FOOTPRINT.farm
    const { cell } = placementStart(tight, { kind: 'farm' }, size, 'home', undefined)
    expect(cell).toEqual(nearestLegalCell(tight, { kind: 'farm' }, 'home', midFor(size)))
  })
})

describe('on a fresh island with its starting obstacles (R50, M4 Task 6)', () => {
  const fresh = { ...newPlayer(0), level: 12, gold: 1_000_000_000 }
  const sea = { kind: 'habitat', element: 'sea' } as const
  const foci = [undefined, null, { col: 0, row: 0 }, { col: 16, row: 16 }, { col: 31, row: 31 }, { col: 20, row: 10 }, { col: 9, row: 25 }]

  it('a habitat opens on a legal cell wherever the screen is centred', () => {
    for (const focus of foci) {
      const { island, cell } = placementStart(fresh, sea, FOOTPRINT.habitat, 'home', focus)
      expect(island).toBe('home')
      expect(placingAction(fresh, 'home', { what: sea, size: FOOTPRINT.habitat, ...cell!, facing: 0 })).not.toBeNull()
    }
  })

  for (const [what, size] of [[{ kind: 'roost' }, FOOTPRINT.roost], [{ kind: 'farm' }, FOOTPRINT.farm], [{ kind: 'grove' }, FOOTPRINT.breeder]] as const) {
    it(`a new ${what.kind} opens on a legal cell that leaves a legal 4x4 free, wherever the screen is centred`, () => {
      for (const focus of foci) {
        const { island, cell } = placementStart(fresh, what, size, 'home', focus)
        expect(island).toBe('home')
        const action = placingAction(fresh, 'home', { what, size, ...cell!, facing: 0 })
        expect(action).not.toBeNull()
        const r = applyAction(fresh, action as Action, 0, createRng(1), LAUNCH_CATALOG)
        if (!r.ok) throw new Error(r.error)
        expect(hasLegalCell(r.state, sea)).toBe(true)
      }
    })
  }

  it('with the screen over the fog corner, a farm opens on the first clear cell past the Mountain, not in the fog', () => {
    expect(placementStart(fresh, { kind: 'farm' }, FOOTPRINT.farm, 'home', { col: 0, row: 0 })).toEqual({ island: 'home', cell: { col: 13, row: 12 } })
  })
})
