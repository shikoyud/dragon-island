import { type Action, applyAction, createRng, islandSize, LAUNCH_CATALOG, newPlayer } from '@wyrmhaven/game-core'
import { describe, expect, it } from 'vitest'
import { hasLegalCell, nearestLegalCell, placementStart, placingAction } from '../src/state/placing'

describe('the default cell leaves room for a habitat (final fix 2)', () => {
  // A fresh step-0 island has exactly one free 5x5 (cols 6-7, rows 5-7); the nearest free cell for a Roost, Grove or farm used to take it.
  const rich = { ...newPlayer(0), level: 12, gold: 1_000_000_000 }
  const sea = { kind: 'habitat', element: 'sea' } as const

  it('the fresh island has a habitat spot', () => {
    expect(hasLegalCell(rich, sea)).toBe(true)
  })

  for (const what of [{ kind: 'roost' }, { kind: 'grove' }, { kind: 'farm' }] as const) {
    it(`a new ${what.kind} opens on a legal cell that keeps a 5x5 free, wherever the screen's middle is`, () => {
      const { w, h } = islandSize(rich, 'home')
      const foci = [undefined, ...Array.from({ length: w * h }, (_, i) => ({ col: i % w, row: Math.floor(i / w) }))]
      let taken = 0
      for (const focus of foci) {
        const { island, cell } = placementStart(rich, what, 2, 'home', focus)
        expect(island).toBe('home')
        const action = placingAction(rich, 'home', { what, size: 2, ...cell!, facing: 0 })
        expect(action).not.toBeNull()
        const r = applyAction(rich, action as Action, 0, createRng(1), LAUNCH_CATALOG)
        if (!r.ok) throw new Error(r.error)
        if (!hasLegalCell(r.state, sea)) taken++
      }
      expect(taken).toBe(0)
    })
  }

  it('a habitat-sized thing takes the nearest cell, as before', () => {
    const { cell } = placementStart(rich, sea, 5, 'home', undefined)
    expect(cell).toEqual(nearestLegalCell(rich, sea, 'home', { col: 4, row: 4 }))
  })

  it('falls back to the nearest cell when no cell would leave a 5x5', () => {
    const tight = { ...rich, habitats: [...rich.habitats, { id: 'hx', element: 'sea' as const, level: 1, lastCollectedMs: 0, placement: { island: 'home' as const, col: 6, row: 5, facing: 0 as const } }] }
    expect(hasLegalCell(tight, sea)).toBe(false)
    const { cell } = placementStart(tight, { kind: 'farm' }, 2, 'home', undefined)
    expect(cell).toEqual(nearestLegalCell(tight, { kind: 'farm' }, 'home', { col: 4, row: 4 }))
  })
})
