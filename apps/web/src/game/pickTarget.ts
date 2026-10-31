import type { Pos } from './layout'

/** One thing under the pointer: what it opens, whether the pointer is on its own pixels, and where its middle is. */
export interface Hit<T> {
  target: T
  /** True when the pointer is on an opaque pixel of the sprite itself; false when only its (enlarged) tap box was hit. */
  pixel: boolean
  centre: Pos
}

/**
 * The target a tap opens, from every hit under the pointer in draw order, topmost first.
 * A hit by a sprite's own pixels beats any box-only hit (a Bush's 44 px box never takes a tap from the building it
 * stands in front of), topmost pixel hit first. With no pixel hit, the box-only hit whose middle is nearest the
 * pointer wins, topmost on a tie (three Bushes in a row: the tap goes to the one it is nearest). Null with no hits.
 */
export function pickTarget<T>(hits: readonly Hit<T>[], pointer: Pos): T | null {
  const pixel = hits.find(h => h.pixel)
  if (pixel) return pixel.target
  let best: Hit<T> | null = null
  let bestD = Infinity
  for (const h of hits) {
    const d = (h.centre.x - pointer.x) ** 2 + (h.centre.y - pointer.y) ** 2
    if (d < bestD) { best = h; bestD = d }
  }
  return best ? best.target : null
}
