import { createHash } from 'node:crypto'
import { ELEMENTS, type Element } from './elements'

/** Starting element: first byte of sha256(UTF-8 xUserId) modulo the element count. New entrants only: `element` is persisted on the row. Server-only (node:crypto). */
export function pickElement(xUserId: string): Element {
  const first = createHash('sha256').update(xUserId, 'utf8').digest()[0]!
  return ELEMENTS[first % ELEMENTS.length]!
}
