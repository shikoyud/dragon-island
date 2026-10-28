export type Element =
  | 'fire' | 'water' | 'earth' | 'nature' | 'electric' | 'ice' | 'metal' | 'dark' | 'light'

export const ELEMENTS: readonly Element[] = [
  'fire', 'water', 'earth', 'nature', 'electric', 'ice', 'metal', 'dark', 'light',
]

/** Attacker element → defender elements it deals ×2 against (spec §3). */
export const STRENGTHS: Record<Element, readonly Element[]> = {
  fire: ['nature', 'ice'],
  water: ['fire', 'metal'],
  earth: ['electric', 'fire'],
  nature: ['water', 'earth'],
  electric: ['water', 'metal'],
  ice: ['nature', 'electric'],
  metal: ['ice', 'earth'],
  dark: ['light'],
  light: ['dark'],
}

/** Strong check runs first, so dark↔light is ×2 both ways. */
export function elementMultiplier(move: Element | 'neutral', defender: Element): 2 | 1 | 0.5 {
  if (move === 'neutral') return 1
  if (STRENGTHS[move].includes(defender)) return 2
  if (STRENGTHS[defender].includes(move)) return 0.5
  return 1
}

/** Unordered pair key, alphabetical: pairKey('water', 'fire') === 'fire+water'. */
export function pairKey(a: Element, b: Element): string {
  return a <= b ? `${a}+${b}` : `${b}+${a}`
}
