import { describe, expect, it } from 'vitest'
import { effLevel, foodToNextLevel, goldPerMinute, MAX_DRAGON_LEVEL } from '../src/dragon'

describe('dragon math', () => {
  it('compresses levels above 10', () => {
    expect([1, 10, 11, 12, 30].map(effLevel)).toEqual([1, 10, 10, 11, 20])
  })

  it('computes gold per minute', () => {
    expect(goldPerMinute('common', 1)).toBe(2)
    expect(goldPerMinute('rare', 12)).toBe(33)
    expect(goldPerMinute('legendary', 30)).toBe(100)
  })

  it('computes food to next level by band', () => {
    expect(MAX_DRAGON_LEVEL).toBe(30)
    expect([1, 9, 10, 19, 20, 29].map(foodToNextLevel)).toEqual([4, 324, 800, 2888, 6400, 13456])
  })
})
