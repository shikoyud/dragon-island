import { isClick, panBy, stepZoom, zoomAt, type View } from './camera'

/** Pinch distance ratio that counts as one zoom step. */
const PINCH_STEP = 1.25

export interface Point { x: number; y: number }

export interface PanZoomHost {
  /** The current view; null until the scene has framed one. */
  view(): View | null
  /** Shows a view: the scene clamps it to its bounds. */
  apply(v: View): void
  range(): { min: number; max: number }
  /** The viewport in screen pixels. */
  size(): { w: number; h: number }
}

/** The pressed pointers of the two touch points a game tracks (config.ts `activePointers`), for `down` and `move`. */
export function heldPointers<P extends Point & { isDown: boolean }>(input: { pointer1?: P; pointer2?: P }): P[] {
  return [input.pointer1, input.pointer2].filter((p): p is P => Boolean(p?.isDown))
}

const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y)

/**
 * The gestures every scrollable scene shares: drag pans, the wheel or a pinch zooms about the pointer by whole numbers,
 * and a press that ends within `isClick`'s 4 px is a click. Pure over the host's view: a scene feeds it its pointer events.
 */
export function createPanZoom(host: PanZoomHost) {
  let down: Point | null = null
  let last: Point | null = null
  let panning = false
  let pinch: number | null = null

  const zoomTo = (zoom: number, at: Point) => {
    const v = host.view()
    if (!v || zoom === v.zoom) return
    const { w, h } = host.size()
    host.apply(zoomAt(v, w, h, at.x, at.y, zoom))
  }

  return {
    down(p: Point, held: readonly Point[]): void {
      if (held.length === 2) {
        // A second finger: this press is a pinch, never a click or a pan.
        pinch = distance(held[0]!, held[1]!)
        down = null
        panning = true
        return
      }
      down = { x: p.x, y: p.y }
      last = { x: p.x, y: p.y }
      panning = false
    },

    /** True when the move was part of a pan or a pinch, so it means nothing else to the scene. */
    move(p: Point, held: readonly Point[], pressed: boolean): boolean {
      const v = host.view()
      if (held.length === 2 && pinch !== null && v) {
        const [a, b] = held as [Point, Point]
        const dist = distance(a, b)
        const ratio = dist / pinch
        if (ratio >= PINCH_STEP || ratio <= 1 / PINCH_STEP) {
          zoomTo(stepZoom(v.zoom, ratio > 1 ? -1 : 1, host.range()), { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })
          pinch = dist
        }
        return true
      }
      if (!down || !last || !pressed || !v) return false
      // Pan once the press has moved past the click threshold, from where it went down: the grabbed point stays
      // under the pointer. Deltas come from our own last position, never Phaser's prevPosition (stale on a new press).
      if (!panning && !isClick(down.x, down.y, p.x, p.y)) panning = true
      if (!panning) return false
      host.apply(panBy(v, p.x - last.x, p.y - last.y))
      last = { x: p.x, y: p.y }
      return true
    },

    /** True when this release ends a click. */
    up(p: Point, held: readonly Point[]): boolean {
      if (held.length === 0) pinch = null
      const click = !panning && down !== null && isClick(down.x, down.y, p.x, p.y)
      down = null
      last = null
      panning = false
      return click
    },

    wheel(p: Point, dy: number): void {
      const v = host.view()
      if (!v || dy === 0) return
      zoomTo(stepZoom(v.zoom, dy < 0 ? -1 : 1, host.range()), p)
    },

    /** Forgets any press: a scene that goes to sleep mid-gesture wakes with none. */
    reset(): void {
      down = null
      last = null
      panning = false
      pinch = null
    },
  }
}
