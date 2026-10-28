import { describe, expect, it } from 'vitest'
import { applyTrophies, LEAGUES, leagueIndex, pvpWinGold, seasonResetTrophies, TROPHY } from '../src/trophy'

describe('leagues', () => {
  it('maps trophies to league index', () => {
    expect(LEAGUES.map(l => l.name)).toEqual(['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Champion'])
    expect([0, 399, 400, 1199, 1200, 1999, 2000, 9999].map(leagueIndex)).toEqual([0, 0, 1, 2, 3, 4, 5, 5])
  })

  it('pays 100 gold per league index on a win', () => {
    expect(pvpWinGold(0)).toBe(0)
    expect(pvpWinGold(850)).toBe(200)
    expect(pvpWinGold(2500)).toBe(500)
  })
})

describe('trophies', () => {
  it('floors at zero', () => {
    expect(TROPHY).toEqual({ attackWin: 30, attackLoss: -15, defenceWin: 5, defenceLoss: -10 })
    expect(applyTrophies(10, TROPHY.attackLoss)).toBe(0)
    expect(applyTrophies(10, TROPHY.attackWin)).toBe(40)
  })

  it('compresses trophies above 1000 at season reset', () => {
    expect([0, 1000, 1001, 1500, 2001].map(seasonResetTrophies)).toEqual([0, 1000, 1000, 1250, 1500])
  })
})
