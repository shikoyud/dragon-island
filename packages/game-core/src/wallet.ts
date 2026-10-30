import type { PlayerState } from './state'

export function earnGold(s: PlayerState, amount: number): PlayerState {
  return { ...s, gold: s.gold + amount }
}

/** `null` if short. */
export function spendGold(s: PlayerState, amount: number): PlayerState | null {
  if (amount > s.gold) return null
  return { ...s, gold: s.gold - amount }
}
