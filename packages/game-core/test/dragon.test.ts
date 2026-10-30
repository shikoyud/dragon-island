import { describe, expect, it } from 'vitest'
import { goldPerMinute, MAX_DRAGON_LEVEL } from '../src/dragon'

describe('dragon math', () => {
  it('computes gold per minute (transitional, replaced in B6)', () => {
    expect(goldPerMinute('common', 1)).toBe(2)
    expect(goldPerMinute('rare', 12)).toBe(36)
    expect(goldPerMinute('legendary', 30)).toBe(150)
  })

  it('caps dragons at level 40', () => {
    expect(MAX_DRAGON_LEVEL).toBe(40)
  })
})
