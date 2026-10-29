import { describe, expect, it } from 'vitest'
import { HOME_MAX_STEP, occupants, overlaps, placementError } from '../src/island'
import { layoutLegacyState } from '../src/legacy-layout'
import { newPlayer } from '../src/state'

function legacy(extra: Record<string, unknown> = {}): Record<string, unknown> {
  const old = { ...newPlayer(0), ...extra } as unknown as Record<string, unknown>
  for (const k of ['islands', 'hatcheryLevel', 'hatcheryPlacement', 'hoardPlacement', 'decorations', 'constructions']) delete old[k]
  old['habitats'] = (old['habitats'] as Record<string, unknown>[]).map(({ placement, ...h }) => { void placement; return h })
  old['farms'] = [{ crop: null, readyAtMs: 0 }, { crop: 'sprout', readyAtMs: 9 }]
  old['tutorial'] = { breedDone: true, hatchDone: true }
  return old
}

describe('layoutLegacyState', () => {
  it('lays out a Phase 6 state without islands', () => {
    const old = { ...newPlayer(0), nests: [null, { speciesId: 'fire', readyAtMs: 5 }], habitats: [...newPlayer(0).habitats, { id: 'h3', element: 'earth', level: 2, lastCollectedMs: 0 }], hoardLevel: 1 } as unknown as Record<string, unknown>
    delete old['islands']
    const s = layoutLegacyState(old)
    expect(s.islands.unlocked).toEqual(['home'])
    expect(s.nests.map(n => n.egg)).toEqual([null, { speciesId: 'fire', readyAtMs: 5 }])
    expect(s.hoardPlacement).not.toBeNull()
    for (const o of occupants(s, 'home')) expect(placementError({ ...s, habitats: [], farms: [], nests: [], decorations: [], hoardPlacement: null, hatcheryPlacement: { island: 'home', col: 60, row: 60, facing: 0 } }, { island: 'home', col: o.col, row: o.row, facing: 0 }, o.size)).not.toBe('OUT_OF_BOUNDS')
    const boxes = occupants(s, 'home'); boxes.forEach((a, i) => boxes.slice(i + 1).forEach(b => expect(overlaps(a, b)).toBe(false)))
    expect(layoutLegacyState(s as unknown as Record<string, unknown>)).toEqual(s)
  })

  it('keeps starting buildings at the spec layout and fills the new fields', () => {
    const s = layoutLegacyState(legacy())
    expect(s.habitats.map(h => h.placement)).toEqual([{ island: 'home', col: 0, row: 0, facing: 0 }, { island: 'home', col: 5, row: 0, facing: 0 }])
    expect(s.hatcheryPlacement).toEqual({ island: 'home', col: 0, row: 8, facing: 0 })
    expect(s.farms.map(f => [f.level, f.placement.col, f.placement.row])).toEqual([[1, 10, 0], [1, 10, 2]])
    expect(s.farms[1]!.crop).toBe('sprout')
    expect(s.nests[0]).toEqual({ egg: null, level: 1, placement: { island: 'home', col: 4, row: 8, facing: 0 } })
    expect(s.hatcheryLevel).toBe(1)
    expect(s.decorations).toEqual([])
    expect(s.constructions).toEqual([])
    expect(s.hoardPlacement).toBeNull()
    expect(s.islands).toEqual({ homeStep: 0, unlocked: ['home'], obstacles: [] })
    expect(s.tutorial).toEqual({ breedDone: true, hatchDone: true, buildsStarted: 2 })
  })

  it('raises the home step until many extra buildings fit', () => {
    const habitats = Array.from({ length: 8 }, (_, i) => ({ id: `x${i}`, element: 'earth', level: 1, lastCollectedMs: 0 }))
    const s = layoutLegacyState(legacy({ habitats: [...newPlayer(0).habitats, ...habitats], hoardLevel: 2 }))
    expect(s.islands.homeStep).toBeGreaterThan(0)
    expect(s.islands.homeStep).toBeLessThanOrEqual(HOME_MAX_STEP)
    const boxes = occupants(s, 'home')
    expect(boxes).toHaveLength(2 + 8 + 2 + 1 + 1 + 1)
    boxes.forEach((a, i) => boxes.slice(i + 1).forEach(b => expect(overlaps(a, b)).toBe(false)))
  })
})
