/** Integer-only formatting. Gold/food are plain integers; USD is micro-dollars; tokens are wei. */

const group = (digits: string): string => digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',')

export const formatGold = (n: number): string => group(Math.trunc(n).toString())

/** Gold per minute from twentieths (R7): "1,320", or one decimal only when there is a fraction ("12.5"). Integer math. */
export function formatPerMinuteX20(x20: number): string {
  if (x20 % 20 === 0) return formatGold(x20 / 20)
  const tenths = Math.round(x20 / 2)
  return tenths % 10 === 0 ? formatGold(tenths / 10) : `${formatGold(Math.floor(tenths / 10))}.${tenths % 10}`
}

/** "$0.50", "$2.00"; shows up to 6 decimals when the amount is below a cent. */
export function formatMicroUsd(micro: number | bigint): string {
  const m = BigInt(micro)
  const neg = m < 0n
  const abs = neg ? -m : m
  const dollars = abs / 1_000_000n
  const rest = abs % 1_000_000n
  let frac = rest.toString().padStart(6, '0')
  if (frac.slice(2) === '0000') frac = frac.slice(0, 2)
  else frac = frac.replace(/0+$/, '')
  return `${neg ? '-' : ''}$${group(dollars.toString())}.${frac}`
}

/**
 * A skip price as shown on a button: micro-dollars rounded (half up) to the nearest cent, never below $0.01.
 * Display only; the charge stays the exact micro-USD amount.
 */
export function formatSkipPrice(micro: number | bigint): string {
  const cents = (BigInt(micro) + 5_000n) / 10_000n
  const c = cents < 1n ? 1n : cents
  return `$${group((c / 100n).toString())}.${(c % 100n).toString().padStart(2, '0')}`
}

/** A duration as "15s", "2m 30s", "1h", "1h 30m": whole units, zero parts left out (sub-second rounds up to 1s). */
export function formatDuration(ms: number): string {
  const total = Math.max(1, Math.ceil(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  // Seconds are dropped once an hour is shown, so "1h 30m" not "1h 30m 5s".
  return [h > 0 && `${h}h`, m > 0 && `${m}m`, s > 0 && h === 0 && `${s}s`].filter(Boolean).join(' ')
}

/** Token wei → decimal string with up to `maxFrac` fraction digits, trailing zeros trimmed. */
export function formatWei(wei: bigint, decimals = 18, maxFrac = 4): string {
  const base = 10n ** BigInt(decimals)
  const whole = wei / base
  const rest = wei % base
  const fracFull = rest.toString().padStart(decimals, '0').slice(0, maxFrac).replace(/0+$/, '')
  return fracFull ? `${group(whole.toString())}.${fracFull}` : group(whole.toString())
}

export function Gold({ n }: { n: number }) {
  return <span className="money money--gold">{formatGold(n)}</span>
}
export function Usd({ micro }: { micro: number | bigint }) {
  return <span className="money money--usd">{formatMicroUsd(micro)}</span>
}
export function Tokens({ wei }: { wei: bigint }) {
  return <span className="money money--dris">{formatWei(wei)} DRIS</span>
}
