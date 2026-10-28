import { describe, expect, it } from 'vitest'
import { CROPS, MAX_PLOTS, plotCost } from '../src/farm'

describe('farm rules', () => {
  it('has the crop table', () => {
    expect(CROPS.sprout).toEqual({ growMs: 60_000, cost: 20, food: 10 })
    expect(CROPS.bounty).toEqual({ growMs: 43_200_000, cost: 2_500, food: 3_000 })
  })

  it('doubles plot cost', () => {
    expect(MAX_PLOTS).toBe(6)
    expect([2, 3, 5].map(plotCost)).toEqual([500, 1000, 4000])
  })
})
