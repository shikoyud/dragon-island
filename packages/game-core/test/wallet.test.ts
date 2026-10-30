import { describe, expect, it } from 'vitest'
import { newPlayer } from '../src/state'
import { earnGold, spendGold } from '../src/wallet'

describe('wallet', () => {
  const s = newPlayer(0)

  it('adds earned gold', () => {
    expect(earnGold(s, 500).gold).toBe(1500)
  })

  it('subtracts spent gold', () => {
    expect(spendGold(earnGold(s, 500), 1200)!.gold).toBe(300)
  })

  it('refuses overspending', () => {
    expect(spendGold(s, 1001)).toBeNull()
  })

  it('does not mutate input', () => {
    spendGold(earnGold(s, 5), 3)
    expect(s).toEqual(newPlayer(0))
  })
})
