// GDD §2.1 (element profiles), §3.3 (opposite elements) and §3.5 (element tiers).
// The §2.2 damage matrix is derived from STRONG_AGAINST in ../elements.ts.

export type Element =
  | 'terra' | 'flame' | 'sea' | 'nature' | 'electric' | 'ice' | 'metal' | 'dark' | 'light' | 'war'

/** GDD order. */
export const ELEMENTS: readonly Element[] = [
  'terra', 'flame', 'sea', 'nature', 'electric', 'ice', 'metal', 'dark', 'light', 'war',
]

/** §2.1 "Strong against (deals 2x)". */
export const STRONG_AGAINST: Record<Element, readonly [Element, Element]> = {
  terra: ['electric', 'flame'],
  flame: ['nature', 'ice'],
  sea: ['flame', 'war'],
  nature: ['sea', 'light'],
  electric: ['sea', 'metal'],
  ice: ['nature', 'war'],
  metal: ['terra', 'ice'],
  dark: ['metal', 'light'],
  light: ['electric', 'dark'],
  war: ['terra', 'dark'],
}

/** §3.3. Metal and Light have no opposite. */
export const OPPOSITE_PAIRS: readonly (readonly [Element, Element])[] = [
  ['flame', 'ice'],
  ['nature', 'electric'],
  ['terra', 'dark'],
  ['sea', 'war'],
]

export type ElementTier = 'A' | 'B' | 'C'

/** §3.5 breeding timer tiers. */
export const ELEMENT_TIER: Record<Element, ElementTier> = {
  terra: 'A', flame: 'A', sea: 'A', nature: 'A',
  electric: 'B', ice: 'B', metal: 'B',
  dark: 'C', light: 'C', war: 'C',
}
