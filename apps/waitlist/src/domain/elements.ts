import { createHash } from 'node:crypto'

export const ELEMENTS = ['fire', 'water', 'earth', 'nature', 'electric', 'ice', 'metal', 'dark', 'light'] as const
export type Element = (typeof ELEMENTS)[number]

/** Starting element: first byte of sha256(UTF-8 xUserId) modulo 9. */
export function pickElement(xUserId: string): Element {
  const first = createHash('sha256').update(xUserId, 'utf8').digest()[0]!
  return ELEMENTS[first % ELEMENTS.length]!
}

/** Original palette, tuned to read on a dark night-sky background. */
export const ELEMENT_COLORS: Record<Element, { base: string; light: string; dark: string }> = {
  fire: { base: '#e8532f', light: '#ff8a5c', dark: '#a8321a' },
  water: { base: '#2f8fd8', light: '#69bdf5', dark: '#1d5f9c' },
  earth: { base: '#a8794a', light: '#cfa273', dark: '#74512f' },
  nature: { base: '#4fb35a', light: '#82db8a', dark: '#327a3c' },
  electric: { base: '#f2c635', light: '#ffe574', dark: '#b8901a' },
  ice: { base: '#7fd6e6', light: '#bdf0f7', dark: '#4a9fb3' },
  metal: { base: '#9aa6b8', light: '#c9d2e0', dark: '#667286' },
  dark: { base: '#7c4fb8', light: '#a77fe0', dark: '#4f2f82' },
  light: { base: '#f4e4b0', light: '#fff6d6', dark: '#c8b273' },
}
