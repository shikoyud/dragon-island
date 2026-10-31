import { describe, expect, it } from 'vitest'
import { DAMAGE_MATRIX, ELEMENTS, elementMultiplier, type Element, type Mult } from '../src/elements'

// GDD §2.2, literal. Rows attack, columns defend, GDD order.
const ORDER: readonly Element[] = ['terra', 'flame', 'sea', 'nature', 'electric', 'ice', 'metal', 'dark', 'light', 'war']
const TABLE: readonly (readonly Mult[])[] = [
  /* terra    */ [0, 2, 1, 1, 2, 1, 0.5, 1, 1, 0.5],
  /* flame    */ [0.5, 0, 0.5, 2, 1, 2, 1, 1, 1, 1],
  /* sea      */ [1, 2, 0, 0.5, 0.5, 1, 1, 1, 1, 2],
  /* nature   */ [1, 0.5, 2, 0, 1, 0.5, 1, 1, 2, 1],
  /* electric */ [0.5, 1, 2, 1, 0, 1, 2, 1, 0.5, 1],
  /* ice      */ [1, 0.5, 1, 2, 1, 0, 0.5, 1, 1, 2],
  /* metal    */ [2, 1, 1, 1, 0.5, 2, 0, 0.5, 1, 1],
  /* dark     */ [1, 1, 1, 1, 1, 1, 2, 0, 2, 0.5],
  /* light    */ [1, 1, 1, 0.5, 2, 1, 1, 2, 0, 1],
  /* war      */ [2, 1, 0.5, 1, 1, 0.5, 1, 2, 1, 0],
]
const PHYSICAL_ROW: readonly Mult[] = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1]

describe('GDD §2.2 matrix, literal', () => {
  it('uses the GDD element order', () => {
    expect(ELEMENTS).toEqual(ORDER)
  })

  it('DAMAGE_MATRIX equals the table cell for cell', () => {
    const got = ORDER.map(a => ORDER.map(d => DAMAGE_MATRIX[a][d]))
    expect(got).toEqual(TABLE)
  })

  it('elementMultiplier equals the table, and Physical is the all-1x row', () => {
    ORDER.forEach((a, i) => ORDER.forEach((d, j) => expect(elementMultiplier(a, d), `${a} vs ${d}`).toBe(TABLE[i]![j])))
    expect(ORDER.map(d => elementMultiplier('physical', d))).toEqual(PHYSICAL_ROW)
  })

  it('§2.1: every element is 0x to itself', () => {
    for (const e of ORDER) expect(DAMAGE_MATRIX[e][e]).toBe(0)
  })

  it('§2.1: X 2x to Y means Y 0.5x to X, except Dark and Light, 2x to each other', () => {
    for (const x of ORDER) for (const y of ORDER) {
      if (DAMAGE_MATRIX[x][y] !== 2) continue
      const darkLight = (x === 'dark' && y === 'light') || (x === 'light' && y === 'dark')
      expect(DAMAGE_MATRIX[y][x], `${y} vs ${x}`).toBe(darkLight ? 2 : 0.5)
    }
  })

  it('only the primary element defends: a Flame/Sea defender takes 2x from Sea', () => {
    // Callers pass elements[0]; Sea is 2x against Flame, and Flame (the secondary) never enters.
    expect(elementMultiplier('sea', 'flame')).toBe(2)
    expect(elementMultiplier('sea', 'sea')).toBe(0)
  })
})
