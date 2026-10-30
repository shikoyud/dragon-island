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
