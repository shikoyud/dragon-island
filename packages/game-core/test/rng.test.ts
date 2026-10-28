import { describe, expect, it } from 'vitest'
import { createRng } from '../src/rng'

describe('createRng', () => {
  it('is deterministic for a seed', () => {
    const a = createRng(42), b = createRng(42)
    expect([1, 2, 3, 4, 5].map(() => a.next())).toEqual([1, 2, 3, 4, 5].map(() => b.next()))
  })

  it('differs across seeds', () => {
    expect(createRng(1).next()).not.toBe(createRng(2).next())
  })

  it('spreads int() roughly uniformly', () => {
    const r = createRng(7), counts = [0, 0, 0, 0]
    for (let i = 0; i < 10_000; i++) counts[r.int(4)]!++
    expect(counts.every(c => c >= 2_000)).toBe(true)
  })
})
