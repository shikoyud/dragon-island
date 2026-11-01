import { describe, expect, it } from 'vitest'
import type { View } from '../src/game/camera'
import { createPanZoom, heldPointers, type Point } from '../src/game/panZoom'

const VP = { w: 400, h: 800 }

/** A gesture recogniser over a plain view, the way a scene wires it. */
function setup(start: View = { cx: 100, cy: 100, zoom: 2 }, range = { min: 1, max: 5 }) {
  const box = { view: start as View | null }
  const pz = createPanZoom({ view: () => box.view, apply: v => { box.view = v }, range: () => range, size: () => VP })
  return { box, pz, view: () => box.view! }
}

describe('panZoom', () => {
  it('a press that ends within 4 px is a click and does not move the view', () => {
    const { pz, view } = setup()
    pz.down({ x: 50, y: 50 }, [{ x: 50, y: 50 }])
    expect(pz.move({ x: 53, y: 50 }, [{ x: 53, y: 50 }], true)).toBe(false)
    expect(pz.up({ x: 53, y: 50 }, [])).toBe(true)
    expect(view()).toEqual({ cx: 100, cy: 100, zoom: 2 })
  })

  it('a drag pans with the pointer, from the last position, and is not a click', () => {
    const { pz, view } = setup()
    pz.down({ x: 50, y: 50 }, [{ x: 50, y: 50 }])
    expect(pz.move({ x: 53, y: 50 }, [{ x: 53, y: 50 }], true)).toBe(false) // under the threshold: nothing yet
    expect(pz.move({ x: 70, y: 60 }, [{ x: 70, y: 60 }], true)).toBe(true)
    // 20 and 10 screen pixels from the press at zoom 2: the grabbed point stays under the pointer.
    expect(view()).toEqual({ cx: 90, cy: 95, zoom: 2 })
    expect(pz.up({ x: 70, y: 60 }, [])).toBe(false)
  })

  it('a press that comes back to where it began after a pan is still a pan', () => {
    const { pz } = setup()
    pz.down({ x: 50, y: 50 }, [{ x: 50, y: 50 }])
    pz.move({ x: 90, y: 50 }, [{ x: 90, y: 50 }], true)
    pz.move({ x: 50, y: 50 }, [{ x: 50, y: 50 }], true)
    expect(pz.up({ x: 50, y: 50 }, [])).toBe(false)
  })

  it('a move with no button held does not pan', () => {
    const { pz, view } = setup()
    expect(pz.move({ x: 90, y: 50 }, [], false)).toBe(false)
    expect(view().cx).toBe(100)
  })

  it('the wheel zooms by whole numbers about the pointer, inside the range', () => {
    const { pz, view } = setup()
    pz.wheel({ x: 200, y: 400 }, -100)
    expect(view()).toEqual({ cx: 100, cy: 100, zoom: 3 }) // the screen's centre: nothing shifts
    pz.wheel({ x: 200, y: 400 }, 100)
    pz.wheel({ x: 200, y: 400 }, 100)
    pz.wheel({ x: 200, y: 400 }, 100)
    expect(view().zoom).toBe(1)
    pz.wheel({ x: 300, y: 400 }, 0)
    expect(view().zoom).toBe(1)
    const a = setup({ cx: 0, cy: 0, zoom: 1 })
    a.pz.wheel({ x: 300, y: 400 }, -1) // keeps the world point under x = 300, 100 px right of centre
    expect(a.view()).toEqual({ cx: 50, cy: 0, zoom: 2 })
  })

  it('a second finger starts a pinch: one zoom step per 1.25 of distance, never a click or a pan', () => {
    const { pz, view } = setup()
    const a = { x: 100, y: 400 }
    pz.down(a, [a])
    const b = { x: 200, y: 400 }
    pz.down(b, [a, b])
    const small = { x: 210, y: 400 } // ratio 1.1: below one step
    expect(pz.move(small, [a, small], true)).toBe(true)
    expect(view().zoom).toBe(2)
    const far = { x: 240, y: 400 } // ratio 1.4
    expect(pz.move(far, [a, far], true)).toBe(true)
    expect(view().zoom).toBe(3)
    const near = { x: 150, y: 400 } // from 140 down to 50
    pz.move(near, [a, near], true)
    expect(view().zoom).toBe(2)
    expect(pz.up(near, [a])).toBe(false)
    // The finger left behind neither pans nor clicks.
    expect(pz.move({ x: 160, y: 500 }, [{ x: 160, y: 500 }], true)).toBe(false)
    expect(view().zoom).toBe(2)
    expect(pz.up({ x: 160, y: 500 }, [])).toBe(false)
  })

  it('does nothing before the scene has a view', () => {
    const { pz, box } = setup()
    box.view = null
    pz.down({ x: 1, y: 1 }, [{ x: 1, y: 1 }])
    expect(pz.move({ x: 40, y: 1 }, [{ x: 40, y: 1 }], true)).toBe(false)
    pz.wheel({ x: 1, y: 1 }, -1)
    expect(box.view).toBeNull()
  })

  it('reset forgets a press, so a scene that sleeps mid-drag wakes without a pan or a click', () => {
    const { pz, view } = setup()
    pz.down({ x: 50, y: 50 }, [{ x: 50, y: 50 }])
    pz.reset()
    expect(pz.move({ x: 90, y: 90 }, [{ x: 90, y: 90 }], true)).toBe(false)
    expect(pz.up({ x: 90, y: 90 }, [])).toBe(false)
    expect(view().cx).toBe(100)
  })

  describe('a claimed grab', () => {
    /** A scene whose `grab` claims a press left of x = 100, as the placement ghost's footprint would. */
    function grabbing(start: View = { cx: 100, cy: 100, zoom: 2 }) {
      const box = { view: start }
      const moves: Point[] = []
      const pz = createPanZoom({
        view: () => box.view, apply: v => { box.view = v }, range: () => ({ min: 1, max: 5 }), size: () => VP,
        grab: p => p.x < 100, onGrabMove: p => moves.push(p),
      })
      return { pz, moves, view: () => box.view }
    }

    it('a press inside it never pans: its moves go to onGrabMove, past the click threshold', () => {
      const { pz, moves, view } = grabbing()
      pz.down({ x: 50, y: 50 }, [{ x: 50, y: 50 }])
      expect(pz.move({ x: 52, y: 50 }, [{ x: 52, y: 50 }], true)).toBe(false) // under the threshold: still a tap
      expect(moves).toEqual([])
      expect(pz.move({ x: 90, y: 60 }, [{ x: 90, y: 60 }], true)).toBe(true)
      expect(moves).toEqual([{ x: 90, y: 60 }])
      expect(view()).toEqual({ cx: 100, cy: 100, zoom: 2 })
      expect(pz.up({ x: 90, y: 60 }, [])).toBe(false)
    })

    it('a tap inside it is still a click', () => {
      const { pz, moves } = grabbing()
      pz.down({ x: 50, y: 50 }, [{ x: 50, y: 50 }])
      expect(pz.up({ x: 51, y: 50 }, [])).toBe(true)
      expect(moves).toEqual([])
    })

    it('a press the grab does not claim pans as ever', () => {
      const { pz, moves, view } = grabbing()
      pz.down({ x: 200, y: 50 }, [{ x: 200, y: 50 }])
      pz.move({ x: 220, y: 50 }, [{ x: 220, y: 50 }], true)
      expect(moves).toEqual([])
      expect(view().cx).toBe(90)
    })

    it('the grab lasts one press: the next press asks again', () => {
      const { pz, moves, view } = grabbing()
      pz.down({ x: 50, y: 50 }, [{ x: 50, y: 50 }])
      pz.up({ x: 50, y: 50 }, [])
      pz.down({ x: 200, y: 50 }, [{ x: 200, y: 50 }])
      pz.move({ x: 220, y: 50 }, [{ x: 220, y: 50 }], true)
      expect(moves).toEqual([])
      expect(view().cx).toBe(90)
    })

    it('a second finger cancels the grab and pinches; the finger left behind neither carries nor pans', () => {
      const { pz, moves, view } = grabbing()
      const a = { x: 50, y: 400 }
      pz.down(a, [a])
      const b = { x: 150, y: 400 }
      pz.down(b, [a, b])
      const far = { x: 190, y: 400 } // ratio 1.4
      expect(pz.move(far, [a, far], true)).toBe(true)
      expect(view().zoom).toBe(3)
      expect(moves).toEqual([])
      expect(pz.up(far, [a])).toBe(false)
      const before = view()
      expect(pz.move({ x: 90, y: 500 }, [{ x: 90, y: 500 }], true)).toBe(false)
      expect(moves).toEqual([])
      expect(view()).toEqual(before)
    })

    it('a wheel during it zooms and carries nothing; the grab goes on after', () => {
      const { pz, moves, view } = grabbing()
      pz.down({ x: 50, y: 50 }, [{ x: 50, y: 50 }])
      pz.move({ x: 70, y: 50 }, [{ x: 70, y: 50 }], true)
      moves.length = 0
      pz.wheel({ x: 70, y: 50 }, -100)
      expect(view().zoom).toBe(3)
      expect(moves).toEqual([])
      pz.move({ x: 80, y: 50 }, [{ x: 80, y: 50 }], true)
      expect(moves).toEqual([{ x: 80, y: 50 }])
    })

    it('reset forgets it', () => {
      const { pz, moves } = grabbing()
      pz.down({ x: 50, y: 50 }, [{ x: 50, y: 50 }])
      pz.reset()
      expect(pz.move({ x: 90, y: 50 }, [{ x: 90, y: 50 }], true)).toBe(false)
      expect(moves).toEqual([])
    })
  })

  it('heldPointers lists only the pressed ones of the two touch points', () => {
    const up = { isDown: false, x: 1, y: 1 }
    const down = { isDown: true, x: 2, y: 2 }
    expect(heldPointers({ pointer1: up, pointer2: down })).toEqual([down])
    expect(heldPointers({ pointer1: down })).toEqual([down])
    expect(heldPointers({})).toEqual([])
  })
})
