import { describe, expect, it } from 'vitest'
import { OBSTACLES, clearCost, clearReward } from '../src/obstacles'
import { OUTER_LAYOUT, homeStripObstacles, outerObstacles } from '../src/data/island-layouts'
import { overlaps } from '../src/island'

describe('obstacles', () => {
  it('an outer island layout has the spec counts, fits, and never overlaps', () => {
    const counts = Object.fromEntries(OUTER_LAYOUT.map(o => o.kind).reduce((m, k) => m.set(k, (m.get(k) ?? 0) + 1), new Map()))
    expect(counts).toEqual({ bush: 10, rock: 8, tree: 6, boulder: 4, ruin: 2 })
    for (const o of OUTER_LAYOUT) expect(o.col + OBSTACLES[o.kind].size <= 16 && o.row + OBSTACLES[o.kind].size <= 16 && o.col >= 0 && o.row >= 0).toBe(true)
    const boxes = OUTER_LAYOUT.map(o => ({ ...o, size: OBSTACLES[o.kind].size }))
    boxes.forEach((a, i) => boxes.slice(i + 1).forEach(b => expect(overlaps(a, b)).toBe(false)))
    expect(OUTER_LAYOUT.reduce((n, o) => n + OBSTACLES[o.kind].size ** 2, 0)).toBe(76)
  })
  it('keeps a 5x5 clear block near the island centre', () => {
    const block = { col: 5, row: 5, size: 5 }
    for (const o of OUTER_LAYOUT) expect(overlaps(block, { ...o, size: OBSTACLES[o.kind].size })).toBe(false)
  })
  it('costs and rewards scale by island', () => {
    const isle2 = outerObstacles('isle2')
    expect(isle2.reduce((n, o) => n + clearCost(o), 0)).toBe(55_600)
    expect(isle2.reduce((n, o) => n + clearReward(o).xp, 0)).toBe(7_040)
    expect(outerObstacles('isle6').reduce((n, o) => n + clearCost(o), 0)).toBe(1_112_000)
    expect(isle2[0]!.id).toBe('isle2-0')
  })
  it('each home strip carries a bush and a rock inside the new strip', () => {
    const s1 = homeStripObstacles(1)
    expect(s1.map(o => [o.kind, o.col, o.row])).toEqual([['bush', 12, 1], ['rock', 13, 10]])
    const s2 = homeStripObstacles(2)
    expect(s2.map(o => [o.kind, o.col, o.row])).toEqual([['bush', 1, 12], ['rock', 12, 13]])
    expect(s1.reduce((n, o) => n + clearReward(o).xp, 0)).toBe(60)
    expect(s1.map(o => o.id)).toEqual(['home-s1-bush', 'home-s1-rock'])
  })
})
