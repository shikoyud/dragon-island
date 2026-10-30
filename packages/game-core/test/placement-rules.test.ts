import { describe, expect, it } from 'vitest'
import { placementRuleError } from '../src/index'
import { newPlayer, type PlayerState } from '../src/state'

const s: PlayerState = newPlayer(0)
const P = (col: number, row: number) => ({ island: 'home' as const, col, row, facing: 0 as const })
const dp = { island: 'dawnspire' as const, col: 0, row: 0, facing: 0 as const }
const both = { ...s, islands: { ...s.islands, unlocked: ['home', 'dawnspire'] as PlayerState['islands']['unlocked'] } }

describe('placementRuleError', () => {
  it('free cells for a habitat, farm or plain decoration on any unlocked island', () => {
    expect(placementRuleError(s, { kind: 'habitat', element: 'terra' }, P(7, 7))).toBeNull()
    expect(placementRuleError(s, { kind: 'farm' }, P(7, 7))).toBeNull()
    expect(placementRuleError(both, { kind: 'decoration', decoration: 'stonePath' }, dp)).toBeNull()
  })
  it('returns the grid error first, with the subject footprint', () => {
    expect(placementRuleError(s, { kind: 'habitat', element: 'terra' }, P(0, 0))).toBe('OVERLAP')
    expect(placementRuleError(s, { kind: 'habitat', element: 'terra' }, P(10, 10))).toBe('OUT_OF_BOUNDS')
    expect(placementRuleError(s, { kind: 'decoration', decoration: 'stonePath' }, P(11, 11))).toBeNull()
    expect(placementRuleError(s, { kind: 'habitat', element: 'terra' }, { ...dp })).toBe('ISLAND_LOCKED')
  })
  it('Dawnspire decorations only go on Dawnspire', () => {
    expect(placementRuleError(both, { kind: 'decoration', decoration: 'starPool' }, P(7, 7))).toBe('WRONG_ISLAND')
    expect(placementRuleError(both, { kind: 'decoration', decoration: 'starPool' }, dp)).toBeNull()
  })
  it('moves ignore the mover and keep the island rules', () => {
    expect(placementRuleError(s, { kind: 'move', target: { type: 'habitat', id: 'h1' } }, P(0, 1))).toBeNull()
    expect(placementRuleError(both, { kind: 'move', target: { type: 'hatchery' } }, dp)).toBe('WRONG_ISLAND')
    const aerie = { ...both, habitats: [...both.habitats, { id: 'h3', element: 'aerie' as const, level: 5, lastCollectedMs: 0, placement: dp }] }
    expect(placementRuleError(aerie, { kind: 'move', target: { type: 'habitat', id: 'h3' } }, P(7, 7))).toBeNull()
    expect(placementRuleError(aerie, { kind: 'move', target: { type: 'habitat', id: 'h3' } }, { ...dp, col: 1 })).toBeNull()
    const deco = { ...both, decorations: [{ id: 'c3', kind: 'starPool' as const, placement: dp }] }
    expect(placementRuleError(deco, { kind: 'move', target: { type: 'decoration', id: 'c3' } }, P(7, 7))).toBe('WRONG_ISLAND')
  })
  it('a move of something missing is NOT_FOUND', () => {
    expect(placementRuleError(s, { kind: 'move', target: { type: 'habitat', id: 'h9' } }, P(7, 7))).toBe('NOT_FOUND')
    expect(placementRuleError(s, { kind: 'move', target: { type: 'breeder', index: 9 } }, P(7, 7))).toBe('NOT_FOUND')
  })
})
