import { describe, expect, it } from 'vitest'
import { newPlayer } from '../src/state'
import { earnGold, spendGold } from '../src/wallet'

describe('wallet', () => {
  const s = newPlayer(0)

  it('tracks eligible gold on earn', () => {
    const e = earnGold(s, 500, true)
    expect([e.gold, e.eligibleGold]).toEqual([1500, 500])
    expect(earnGold(s, 100, false).eligibleGold).toBe(0)
  })

  it('spends ineligible gold first', () => {
    const sp = spendGold(earnGold(s, 500, true), 1200)!
    expect([sp.gold, sp.eligibleGold]).toEqual([300, 300])
    const small = spendGold(earnGold(s, 500, true), 200)!
    expect([small.gold, small.eligibleGold]).toEqual([1300, 500])
  })

  it('refuses overspending', () => {
    expect(spendGold(s, 1001)).toBeNull()
  })

  it('does not mutate input', () => {
    spendGold(earnGold(s, 5, true), 3)
    expect(s).toEqual(newPlayer(0))
  })
})
