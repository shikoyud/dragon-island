import { describe, expect, it } from 'vitest'
import { placementRuleError } from '../src/index'
import { FREE, withPlots } from './helpers/land'
import { newPlayer, type PlayerState } from '../src/state'

const s: PlayerState = newPlayer(0)
const P = (col: number, row: number) => ({ island: 'home' as const, col, row, facing: 0 as const })
const dp = { island: 'isle6' as const, col: 8, row: 8, facing: 0 as const }
const both = withPlots({ ...s, islands: { ...s.islands, unlocked: ['home', 'isle6'] as PlayerState['islands']['unlocked'] } }, [5, 6, 9, 10], 'isle6')

describe('placementRuleError', () => {
  it('free cells for a habitat, farm or plain decoration on any unlocked island', () => {
    expect(placementRuleError(s, { kind: 'habitat', element: 'terra' }, FREE)).toBeNull()
    expect(placementRuleError(s, { kind: 'farm' }, FREE)).toBeNull()
    expect(placementRuleError(both, { kind: 'decoration', decoration: 'stonePath' }, dp)).toBeNull()
  })
  it('returns the grid error first, with the subject footprint', () => {
    expect(placementRuleError(s, { kind: 'habitat', element: 'terra' }, P(8, 8))).toBe('OVERLAP')
    expect(placementRuleError(s, { kind: 'habitat', element: 'terra' }, P(29, 8))).toBe('OUT_OF_BOUNDS')
    expect(placementRuleError(s, { kind: 'habitat', element: 'terra' }, P(0, 0))).toBe('NOT_OWNED')
    expect(placementRuleError(s, { kind: 'decoration', decoration: 'stonePath' }, P(22, 12))).toBeNull()
    expect(placementRuleError(s, { kind: 'habitat', element: 'terra' }, { ...dp })).toBe('ISLAND_LOCKED')
  })
  it("Warlord's Crown decorations only go there", () => {
    expect(placementRuleError(both, { kind: 'decoration', decoration: 'starPool' }, FREE)).toBe('WRONG_ISLAND')
    expect(placementRuleError(both, { kind: 'decoration', decoration: 'starPool' }, dp)).toBeNull()
  })
  it('moves ignore the mover and keep the island rules', () => {
    expect(placementRuleError(s, { kind: 'move', target: { type: 'habitat', id: 'h1' } }, P(13, 8))).toBeNull()
    expect(placementRuleError(both, { kind: 'move', target: { type: 'hatchery' } }, dp)).toBe('WRONG_ISLAND')
    const aerie = { ...both, habitats: [...both.habitats, { id: 'h3', element: 'aerie' as const, level: 5, lastCollectedMs: 0, placement: dp }] }
    expect(placementRuleError(aerie, { kind: 'move', target: { type: 'habitat', id: 'h3' } }, FREE)).toBeNull()
    expect(placementRuleError(aerie, { kind: 'move', target: { type: 'habitat', id: 'h3' } }, { ...dp, col: 9 })).toBeNull()
    const deco = { ...both, decorations: [{ id: 'c3', kind: 'starPool' as const, placement: dp }] }
    expect(placementRuleError(deco, { kind: 'move', target: { type: 'decoration', id: 'c3' } }, FREE)).toBe('WRONG_ISLAND')
  })
  it('a move of something missing is NOT_FOUND', () => {
    expect(placementRuleError(s, { kind: 'move', target: { type: 'habitat', id: 'h9' } }, FREE)).toBe('NOT_FOUND')
    expect(placementRuleError(s, { kind: 'move', target: { type: 'breeder', index: 9 } }, FREE)).toBe('NOT_FOUND')
  })

  describe('moves between plots and islands (R57)', () => {
    const mv = (id: string) => ({ kind: 'move' as const, target: { type: 'habitat' as const, id } })
    const i2 = withPlots({ ...s, islands: { ...s.islands, unlocked: ['home', 'isle2'] as PlayerState['islands']['unlocked'] } }, [5, 6, 9, 10], 'isle2')
    const at2 = (col: number, row: number) => ({ island: 'isle2' as const, col, row, facing: 0 as const })
    it('a habitat crosses a plot border, and onto itself offset by one tile', () => {
      // Plots 5 and 6 meet at column 16; a 4x4 at col 14 spans 14-17.
      expect(placementRuleError(s, mv('h1'), P(14, 13))).toBeNull()
      expect(placementRuleError(s, mv('h1'), P(15, 12))).toBeNull()
      // One tile over from where it stands: it ignores itself.
      expect(placementRuleError(s, mv('h1'), P(13, 9))).toBeNull()
    })
    it('onto unowned land is NOT_OWNED, also when only part of it hangs over', () => {
      expect(placementRuleError(s, mv('h1'), P(0, 0))).toBe('NOT_OWNED')
      expect(placementRuleError(s, mv('h1'), P(22, 22))).toBe('NOT_OWNED')
    })
    it('a 5x5 Mountain moves from (8, 8) to a spot straddling a plot border', () => {
      const m = { kind: 'move' as const, target: { type: 'breeder' as const, index: 0 } }
      expect(placementRuleError(s, m, P(8, 8))).toBeNull()
      expect(placementRuleError(s, m, P(13, 12))).toBeNull()
      expect(placementRuleError(s, m, P(14, 12))).toBeNull()
    })
    it('a habitat with stored Gold may go to Island 2, and the move rule never reads Gold', () => {
      const stored = { ...i2, habitats: i2.habitats.map(h => h.id === 'h1' ? { ...h, lastCollectedMs: 0 } : h) }
      expect(placementRuleError(stored, mv('h1'), at2(8, 8))).toBeNull()
      expect(placementRuleError(stored, mv('h1'), at2(14, 14))).toBeNull()
    })
    it('the Hatchery stays home, a Warlord\'s Crown decoration stays on isle6, a locked island refuses', () => {
      expect(placementRuleError(i2, { kind: 'move', target: { type: 'hatchery' } }, at2(8, 8))).toBe('WRONG_ISLAND')
      expect(placementRuleError(i2, { kind: 'move', target: { type: 'hatchery' } }, P(8, 14))).toBeNull()
      const deco = { ...both, decorations: [{ id: 'c3', kind: 'starPool' as const, placement: dp }] }
      expect(placementRuleError(deco, { kind: 'move', target: { type: 'decoration', id: 'c3' } }, { ...dp, col: 12 })).toBeNull()
      expect(placementRuleError(deco, { kind: 'move', target: { type: 'decoration', id: 'c3' } }, FREE)).toBe('WRONG_ISLAND')
      expect(placementRuleError(s, mv('h1'), at2(8, 8))).toBe('ISLAND_LOCKED')
    })
  })
})
