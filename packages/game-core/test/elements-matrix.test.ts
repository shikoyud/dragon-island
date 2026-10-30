import { describe, expect, it } from 'vitest'
import {
  DAMAGE_MATRIX, ELEMENTS, ELEMENT_TIER, OPPOSITE_PAIRS, STRONG_AGAINST,
  elementMultiplier, highestTier, isOpposite, type Element, type Mult,
} from '../src/elements'

// GDD §2.2, copied cell for cell. Rows attack, columns defend, in the GDD's column order.
const COLUMNS: readonly Element[] = ['terra', 'flame', 'sea', 'nature', 'electric', 'ice', 'metal', 'dark', 'light', 'war']
const TABLE: Record<Element, readonly Mult[]> = {
  terra: [0, 2, 1, 1, 2, 1, 0.5, 1, 1, 0.5],
  flame: [0.5, 0, 0.5, 2, 1, 2, 1, 1, 1, 1],
  sea: [1, 2, 0, 0.5, 0.5, 1, 1, 1, 1, 2],
  nature: [1, 0.5, 2, 0, 1, 0.5, 1, 1, 2, 1],
  electric: [0.5, 1, 2, 1, 0, 1, 2, 1, 0.5, 1],
  ice: [1, 0.5, 1, 2, 1, 0, 0.5, 1, 1, 2],
  metal: [2, 1, 1, 1, 0.5, 2, 0, 0.5, 1, 1],
  dark: [1, 1, 1, 1, 1, 1, 2, 0, 2, 0.5],
  light: [1, 1, 1, 0.5, 2, 1, 1, 2, 0, 1],
  war: [2, 1, 0.5, 1, 1, 0.5, 1, 2, 1, 0],
}
const PHYSICAL_ROW: readonly Mult[] = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1]

describe('GDD §2.2 damage matrix', () => {
  it('lists the ten elements in GDD order', () => {
    expect(ELEMENTS).toEqual(COLUMNS)
  })

  for (const atk of COLUMNS) {
    it(`matches the ${atk} row`, () => {
      expect(COLUMNS.map(def => DAMAGE_MATRIX[atk][def])).toEqual(TABLE[atk])
      expect(COLUMNS.map(def => elementMultiplier(atk, def))).toEqual(TABLE[atk])
    })
  }

  it('matches the Physical row', () => {
    expect(COLUMNS.map(def => elementMultiplier('physical', def))).toEqual(PHYSICAL_ROW)
  })

  it('makes every element immune to itself', () => {
    for (const e of ELEMENTS) expect(elementMultiplier(e, e)).toBe(0)
  })

  it('gives dark and light 2x against each other', () => {
    expect(elementMultiplier('dark', 'light')).toBe(2)
    expect(elementMultiplier('light', 'dark')).toBe(2)
  })

  it('gives each element exactly 2 strengths and 2 weaknesses', () => {
    for (const e of ELEMENTS) {
      expect(STRONG_AGAINST[e]).toHaveLength(2)
      expect(ELEMENTS.filter(def => DAMAGE_MATRIX[e][def] === 2), `${e} strengths`).toHaveLength(2)
      expect(ELEMENTS.filter(atk => DAMAGE_MATRIX[atk][e] === 2), `${e} weaknesses`).toHaveLength(2)
    }
  })

  it('gives dark and light only one resistance, everyone else two (§2.1)', () => {
    const resists = (e: Element) => ELEMENTS.filter(atk => DAMAGE_MATRIX[atk][e] === 0.5)
    expect(resists('dark')).toEqual(['metal'])
    expect(resists('light')).toEqual(['electric'])
    for (const e of ELEMENTS) if (e !== 'dark' && e !== 'light') expect(resists(e), e).toHaveLength(2)
  })
})

describe('GDD §3.3 opposites', () => {
  it('has the four opposite pairs, in both directions', () => {
    expect(OPPOSITE_PAIRS).toHaveLength(4)
    expect(isOpposite('flame', 'ice')).toBe(true)
    expect(isOpposite('ice', 'flame')).toBe(true)
    expect(isOpposite('nature', 'electric')).toBe(true)
    expect(isOpposite('terra', 'dark')).toBe(true)
    expect(isOpposite('war', 'sea')).toBe(true)
  })

  it('leaves metal and light with no opposite', () => {
    for (const e of ELEMENTS) {
      expect(isOpposite('metal', e)).toBe(false)
      expect(isOpposite('light', e)).toBe(false)
    }
  })
})

describe('GDD §3.5 element tiers', () => {
  it('assigns the tiers', () => {
    expect(ELEMENT_TIER).toEqual({
      terra: 'A', flame: 'A', sea: 'A', nature: 'A',
      electric: 'B', ice: 'B', metal: 'B',
      dark: 'C', light: 'C', war: 'C',
    })
  })

  it('takes the highest tier among the elements', () => {
    expect(highestTier(['terra', 'war'])).toBe('C')
    expect(highestTier(['terra', 'ice'])).toBe('B')
    expect(highestTier(['terra', 'flame'])).toBe('A')
    expect(highestTier(['war', 'terra', 'ice'])).toBe('C')
  })
})
