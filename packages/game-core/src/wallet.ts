import type { PlayerState } from './state'

export function earnGold(s: PlayerState, amount: number, eligible: boolean): PlayerState {
  return { ...s, gold: s.gold + amount, eligibleGold: s.eligibleGold + (eligible ? amount : 0) }
}

/** Spends ineligible gold first, so sale/quest gold can never be sold back. `null` if short. */
export function spendGold(s: PlayerState, amount: number): PlayerState | null {
  if (amount > s.gold) return null
  const ineligible = s.gold - s.eligibleGold
  const fromEligible = Math.max(0, amount - ineligible)
  return { ...s, gold: s.gold - amount, eligibleGold: s.eligibleGold - fromEligible }
}
