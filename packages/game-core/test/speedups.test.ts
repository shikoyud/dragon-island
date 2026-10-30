import { describe, expect, it } from 'vitest'
import { skipPriceMicroUsd } from '../src/data/speedups'

const cents = (ms: number) => Math.round(skipPriceMicroUsd(ms) / 10_000)

describe('skipPriceMicroUsd (GDD 3.6)', () => {
  it('matches the GDD table to the cent', () => {
    expect(cents(600_000)).toBe(3)
    expect(skipPriceMicroUsd(3_600_000)).toBe(100_000)
    expect(cents(3 * 3_600_000)).toBe(21)
    expect(cents(8 * 3_600_000)).toBe(41)
    expect(cents(24 * 3_600_000)).toBe(87)
  })
  it('is free at zero and never below 1 micro-dollar otherwise', () => {
    expect(skipPriceMicroUsd(0)).toBe(0)
    expect(skipPriceMicroUsd(-5)).toBe(0)
    expect(skipPriceMicroUsd(1e-6)).toBe(1)
  })
  it('returns an integer and is concave (longer timers cost less per hour)', () => {
    expect(Number.isInteger(skipPriceMicroUsd(5_432_100))).toBe(true)
    expect(skipPriceMicroUsd(2 * 3_600_000)).toBeLessThan(2 * skipPriceMicroUsd(3_600_000))
  })
})
