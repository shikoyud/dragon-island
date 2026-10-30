/** Spec §11 trophy deltas; trophies never drop below 0. */
export const TROPHY = { attackWin: 30, attackLoss: -15, defenceWin: 5, defenceLoss: -10 } as const

export const LEAGUES: readonly { name: string; min: number }[] = [
  { name: 'Bronze', min: 0 },
  { name: 'Silver', min: 400 },
  { name: 'Gold', min: 800 },
  { name: 'Platinum', min: 1200 },
  { name: 'Diamond', min: 1600 },
  { name: 'Champion', min: 2000 },
]

export function leagueIndex(trophies: number): number {
  let index = 0
  LEAGUES.forEach((l, i) => { if (trophies >= l.min) index = i })
  return index
}

/** PvP win gold = 100 × league index (Bronze pays nothing). */
export function pvpWinGold(trophies: number): number {
  return 100 * leagueIndex(trophies)
}

export function applyTrophies(trophies: number, delta: number): number {
  return Math.max(0, trophies + delta)
}
