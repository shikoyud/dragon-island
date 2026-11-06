import { formatGold } from '../ui/Money'

/** A Bridge price on an island's caption: 150,000, then 5M or 2.5M from a million up. Integer math. */
export function mapPrice(gold: number): string {
  if (gold < 1_000_000) return formatGold(gold)
  const whole = Math.floor(gold / 1_000_000)
  const tenth = Math.floor((gold % 1_000_000) / 100_000)
  return tenth === 0 ? `${whole}M` : `${whole}.${tenth}M`
}
