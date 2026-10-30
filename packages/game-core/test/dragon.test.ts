import { describe, expect, it } from 'vitest'
import { MAX_DRAGON_LEVEL } from '../src/dragon'

describe('dragon math', () => {
  it('caps dragons at level 40', () => {
    expect(MAX_DRAGON_LEVEL).toBe(40)
  })
})
