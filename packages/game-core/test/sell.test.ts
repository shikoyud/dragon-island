import { describe, expect, it } from 'vitest'
import { dailySellLimitMicroUsd, HOARD, MICRO_USD_PER_GOLD, remainingSellMicroUsd, utcDay } from '../src/sell'
import { newPlayer } from '../src/state'

const L = (dep: number, w: number, sold = 0) => ({ depositedMicroUsd: dep, withdrawnMicroUsd: w, soldMicroUsd: sold })

describe('dailySellLimitMicroUsd', () => {
  it('is zero without a Hoard', () => {
    expect(dailySellLimitMicroUsd(0, L(10_000_000, 0))).toBe(0)
  })

  it('uses the Hoard limit or deposit repayment, whichever is larger', () => {
    expect(dailySellLimitMicroUsd(1, L(0, 0))).toBe(1_000_000)
    expect(dailySellLimitMicroUsd(1, L(6_000_000, 0))).toBe(2_000_000)
    expect(dailySellLimitMicroUsd(1, L(6_000_000, 0, 5_500_000))).toBe(1_000_000)
    expect(dailySellLimitMicroUsd(1, L(6_000_000, 0, 9_000_000))).toBe(1_000_000)
    expect(dailySellLimitMicroUsd(7, L(0, 0))).toBe(30_000_000)
  })

  it('applies withdrawal penalties', () => {
    expect(dailySellLimitMicroUsd(1, L(6_000_000, 6_000_000))).toBe(2_000_000)
    expect(dailySellLimitMicroUsd(1, L(6_000_000, 7_000_000))).toBe(1_000_000)
    expect(dailySellLimitMicroUsd(1, L(6_000_000, 13_000_000))).toBe(400_000)
    expect(dailySellLimitMicroUsd(1, L(6_000_000, 19_000_000))).toBe(0)
  })

  it('pauses selling after any withdrawal with zero deposits', () => {
    expect(dailySellLimitMicroUsd(7, L(0, 1))).toBe(0)
  })
})

describe('remainingSellMicroUsd', () => {
  const day5 = 5 * 86_400_000
  const s = { ...newPlayer(day5), hoardLevel: 1, sell: { day: 5, soldTodayMicroUsd: 300_000 } }

  it('subtracts today’s sales and resets at 00:00 UTC', () => {
    expect(utcDay(day5 + 86_399_999)).toBe(5)
    expect(remainingSellMicroUsd(s, day5 + 1)).toBe(700_000)
    expect(remainingSellMicroUsd(s, day5 + 86_400_000)).toBe(1_000_000)
  })

  it('never goes negative', () => {
    expect(remainingSellMicroUsd({ ...s, sell: { day: 5, soldTodayMicroUsd: 5_000_000 } }, day5)).toBe(0)
  })

  it('has the rate and Hoard table', () => {
    expect(MICRO_USD_PER_GOLD * 10_000).toBe(50_000)
    expect(HOARD).toHaveLength(7)
    expect(HOARD[6]).toEqual({ costMicroUsd: 60_000_000, limitMicroUsd: 30_000_000 })
  })
})
