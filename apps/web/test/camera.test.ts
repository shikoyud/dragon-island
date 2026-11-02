import { LAUNCH_CATALOG, newPlayer, type PlayerState } from '@wyrmhaven/game-core'
import { describe, expect, it } from 'vitest'
import { FALLBACK_ART } from '../src/art/slots'
import { buildIslandModel } from '../src/game/islandModel'
import { withPlots } from './land'
import {
  cameraBounds, clampView, fitZoom, groundCell, isClick, landBox, landPlots, lockedTiles, offeredPlotAt, openingView, panBy, screenToWorld, SKIRT, stepZoom, worldToScreen, zoomAt, zoomRange,
  type View,
  revealPan,
} from '../src/game/camera'
import { landmass } from '../src/game/islandShape'
import { cellCentre, tapBox, tapHit } from '../src/game/layout'

const vp = { w: 1280, h: 720 }

describe('revealPan', () => {
  const screen = { w: 800, h: 600 }
  const insets = { top: 100, bottom: 120 }
  it('leaves alone a thing already in the free band', () => {
    expect(revealPan({ x: 400, top: 200, bottom: 300 }, screen, insets)).toEqual({ dx: 0, dy: 0 })
  })
  it('brings the top of the thing, its arrow included, below the top of the HUD', () => {
    const { dy } = revealPan({ x: 400, top: 40, bottom: 140 }, screen, insets)
    expect(40 + dy).toBeGreaterThanOrEqual(100)
    expect(140 + dy).toBeLessThanOrEqual(480)
  })
  it('brings the bottom above the buttons', () => {
    const { dy } = revealPan({ x: 400, top: 400, bottom: 560 }, screen, insets)
    expect(dy).toBeLessThan(0)
    expect(560 + dy).toBeLessThanOrEqual(480)
  })
  it('when the thing is taller than the band, the footprint clear of the buttons wins', () => {
    const { dy } = revealPan({ x: 400, top: 40, bottom: 560 }, screen, insets)
    expect(560 + dy).toBeLessThanOrEqual(480)
  })
  it('brings it in from the sides', () => {
    expect(revealPan({ x: 10, top: 200, bottom: 300 }, screen, insets).dx).toBeGreaterThan(0)
    expect(revealPan({ x: 790, top: 200, bottom: 300 }, screen, insets).dx).toBeLessThan(0)
  })
})

/** The state after the Bridge to Ember Reach: its 4 centre plots owned. */
function opened(s: PlayerState): PlayerState {
  return { ...s, islands: { ...s.islands, unlocked: [...s.islands.unlocked, 'isle2'], plots: { ...s.islands.plots, isle2: [5, 6, 9, 10] } } }
}

describe('island camera logic', () => {
  it('every island floats like Home: its bounds are the full landmass and a margin', () => {
    expect(SKIRT).toBe(12)
    expect(cameraBounds('isle2')).toEqual(cameraBounds('home'))
    expect(cameraBounds('isle6')).toEqual(cameraBounds('home'))
  })

  it('Home\'s bounds are the full landmass and a margin, whatever land is owned', () => {
    const full = landmass(Array.from({ length: 16 }, (_, i) => i)).box
    expect(cameraBounds('home')).toEqual({ x: full.x - 24, y: full.y - 24, w: full.w + 48, h: full.h + 48 })
  })

  it('camera bounds hold the whole landmass at every zoom: each of its corners can be brought on screen', () => {
    const plotSets = [[5, 6, 9, 10, 2, 7, 11], [5, 6, 9, 10, 2, 7, 11, 1, 14, 13], Array.from({ length: 16 }, (_, i) => i)]
    const b = cameraBounds('home')
    for (const plots of plotSets) {
      const box = landmass(plots).box
      expect(box.x).toBeGreaterThanOrEqual(b.x)
      expect(box.y).toBeGreaterThanOrEqual(b.y)
      expect(box.x + box.w).toBeLessThanOrEqual(b.x + b.w)
      expect(box.y + box.h).toBeLessThanOrEqual(b.y + b.h)
      for (const [w, h] of [[1920, 1080], [844, 390], [390, 844]] as const) for (let zoom = 1; zoom <= 8; zoom++) {
        for (const c of [{ x: box.x, y: box.y }, { x: box.x + box.w, y: box.y }, { x: box.x, y: box.y + box.h }, { x: box.x + box.w, y: box.y + box.h }]) {
          const v = clampView({ cx: c.x, cy: c.y, zoom }, w, h, b)
          const s = worldToScreen(v, w, h, c.x, c.y)
          expect(s.x, `${w}x${h} at ${zoom}`).toBeGreaterThanOrEqual(0)
          expect(s.x).toBeLessThanOrEqual(w)
          expect(s.y).toBeGreaterThanOrEqual(0)
          expect(s.y).toBeLessThanOrEqual(h)
        }
      }
    }
  })

  it('a ground click yields the cell, or nothing outside the island', () => {
    const s = newPlayer(0)
    const c = cellCentre(10, 12)
    expect(groundCell(s, 'home', c.x, c.y)).toEqual({ col: 10, row: 12 })
    const out = cellCentre(32, 0)
    expect(groundCell(s, 'home', out.x, out.y)).toBeNull()
    // Other islands show owned and offered land only, as Home does: a locked one shows none.
    const corner = cellCentre(31, 31)
    expect(groundCell(s, 'isle2', corner.x, corner.y)).toBeNull()
    const centre = cellCentre(12, 12)
    expect(groundCell(opened(s), 'isle2', centre.x, centre.y)).toEqual({ col: 12, row: 12 })
    expect(groundCell(opened(s), 'isle2', corner.x, corner.y)).toBeNull()
    expect(groundCell(s, 'home', 0, -2)).toBeNull()
    expect(groundCell(null, 'home', 5, 5)).toBeNull()
  })

  it('no ground cell on a plot not yet offered on Home; a cell on an offered plot exists', () => {
    const s = newPlayer(0)
    const at = (col: number, row: number) => { const c = cellCentre(col, row); return groundCell(s, 'home', c.x, c.y) }
    expect(at(0, 0)).toBeNull() // plot 0 is not offered
    expect(at(31, 31)).toBeNull()
    expect(at(16, 0)).toEqual({ col: 16, row: 0 }) // plot 2, offered
    expect(at(8, 8)).toEqual({ col: 8, row: 8 }) // owned
  })

  it('maps screen pixels to world pixels through the view centre and zoom', () => {
    const v: View = { cx: 10, cy: 50, zoom: 2 }
    expect(screenToWorld(v, vp.w, vp.h, 640, 360)).toEqual({ x: 10, y: 50 })
    expect(screenToWorld(v, vp.w, vp.h, 660, 340)).toEqual({ x: 20, y: 40 })
  })

  it('pans by the screen delta divided by zoom (drag right moves the world right)', () => {
    expect(panBy({ cx: 0, cy: 0, zoom: 2 }, 20, -10)).toEqual({ cx: -10, cy: 5, zoom: 2 })
  })

  it('zooms about the pointer: the world point under it stays put', () => {
    const v: View = { cx: 0, cy: 60, zoom: 2 }
    const before = screenToWorld(v, vp.w, vp.h, 900, 200)
    const z = zoomAt(v, vp.w, vp.h, 900, 200, 3)
    expect(z.zoom).toBe(3)
    const after = screenToWorld(z, vp.w, vp.h, 900, 200)
    expect(after.x).toBeCloseTo(before.x)
    expect(after.y).toBeCloseTo(before.y)
  })

  it('lets an island smaller than the screen move but stay whole on screen, and clamps the edges when larger', () => {
    const box = { x: -100, y: 0, w: 200, h: 120 }
    // At zoom 1 the screen shows 1280x720: the centre may go from x -540 to 540 and y -240 to 360.
    expect(clampView({ cx: 500, cy: -400, zoom: 1 }, vp.w, vp.h, box)).toEqual({ cx: 500, cy: -240, zoom: 1 })
    expect(clampView({ cx: 0, cy: 60, zoom: 1 }, vp.w, vp.h, box)).toEqual({ cx: 0, cy: 60, zoom: 1 })
    // At zoom 8 the screen shows 160x90 world pixels: the centre may go from x -20 to 20 and y 45 to 75.
    expect(clampView({ cx: 500, cy: -400, zoom: 8 }, vp.w, vp.h, box)).toEqual({ cx: 20, cy: 45, zoom: 8 })
  })

  it('opens at the whole-number zoom nearest to fitting the island, leaning up, never below 1', () => {
    const box = { x: -120, y: 0, w: 240, h: 140 }
    expect(fitZoom(1280, 720, box)).toBe(5) // 720/140 = 5.1
    expect(fitZoom(390, 844, box)).toBe(2) // 1.6 rounds up: a little of the edge is cropped
    expect(fitZoom(844, 390, { x: 0, y: 0, w: 160, h: 300 })).toBe(2) // landscape 1.3 would round down: a landscape screen never opens below 2
    expect(fitZoom(844, 300, { x: 0, y: 0, w: 800, h: 600 })).toBe(2)
    expect(fitZoom(400, 844, { x: 0, y: 0, w: 800, h: 600 })).toBe(1) // portrait keeps its rule
    expect(fitZoom(390, 844, { x: 0, y: 0, w: 400, h: 160 })).toBe(1)
    // A phone showing a box 272 wide opens at 2: buildings readable, edges a drag away.
    expect(fitZoom(390, 680, { x: 0, y: 0, w: 272, h: 172 })).toBe(2)
    expect(fitZoom(1280, 550, { x: 0, y: 0, w: 272, h: 172 })).toBe(3)
    // Portrait screens are width-limited with height to spare: round up (a box 304 wide opens at 2, 420 wide at 1).
    expect(fitZoom(390, 680, { x: 0, y: 0, w: 304, h: 188 })).toBe(2)
    expect(fitZoom(390, 680, { x: 0, y: 0, w: 420, h: 230 })).toBe(1)
  })

  it('a press that moved 4 px or less is a click', () => {
    expect(isClick(10, 10, 14, 10)).toBe(true)
    expect(isClick(10, 10, 13, 13)).toBe(false)
  })

  it('zoom steps are whole numbers from 1 to the fit zoom + 3', () => {
    const r = zoomRange(2)
    expect(r).toEqual({ min: 1, max: 5 })
    expect(stepZoom(1, -1, r)).toBe(2)
    expect(stepZoom(5, -1, r)).toBe(5)
    expect(stepZoom(1, 1, r)).toBe(1)
  })

  it('locked tiles are the offered plots, on Home and every other island, and none once it all is', () => {
    const s = newPlayer(0)
    const tiles = lockedTiles(s, 'home')
    expect(tiles.length).toBe(3 * 64)
    expect(tiles).toContainEqual({ col: 16, row: 0 }) // plot 2's corner
    expect(tiles).not.toContainEqual({ col: 0, row: 0 }) // not offered: not land at all
    expect(tiles).not.toContainEqual({ col: 8, row: 8 })
    expect(lockedTiles({ ...s, islands: { ...s.islands, plots: { home: Array.from({ length: 16 }, (_, i) => i) } } }, 'home')).toEqual([])
    expect(lockedTiles(s, 'isle2')).toEqual([])
    // An opened island owns its 4 centre plots; the 8 round them are offered.
    expect(lockedTiles(opened(s), 'isle2').length).toBe(8 * 64)
  })

})

describe('the opening view (R58)', () => {
  const fresh = newPlayer(0)
  const PHONE = { w: 390, h: 844 }
  const DESKTOP = { w: 1440, h: 900 }

  it('boxes the land shown: the owned plots and the 3 offered, and a plot at a corner extends it', () => {
    // Fresh: owned 5, 6, 9, 10 (tiles 8-23) plus the offered 2, 7, 11 on the right: x -128..192, y 64..224.
    expect(landBox(fresh, 'home')).toEqual({ x: -128, y: 64, w: 320, h: 160 })
    // Plot 15 is tiles 24-31 in both axes: its bottom vertex is the island's, (0, 256).
    expect(landBox(withPlots(fresh, [5, 6, 9, 10, 15]), 'home')).toEqual({ x: -128, y: 64, w: 320, h: 192 })
    // Plot 0 is tiles 0-7: its top vertex is the island's, (0, 0).
    expect(landBox(withPlots(fresh, [5, 6, 9, 10, 0]), 'home')).toEqual({ x: -128, y: 0, w: 320, h: 224 })
    expect(landBox(withPlots(fresh, Array.from({ length: 16 }, (_, i) => i)), 'home')).toEqual({ x: -256, y: 0, w: 512, h: 256 })
  })

  it('landPlots: owned plus offered on every island', () => {
    expect(landPlots(fresh, 'home').sort((a, b) => a - b)).toEqual([2, 5, 6, 7, 9, 10, 11])
    expect(landPlots(fresh, 'isle2')).toEqual([])
    expect(landPlots(opened(fresh), 'isle2').sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].filter(p => ![0, 3, 12, 15].includes(p)))
    expect(landPlots(withPlots(fresh, Array.from({ length: 16 }, (_, i) => i)), 'home')).toHaveLength(16)
  })

  it('an island with no owned land, or no state, boxes the whole island', () => {
    expect(landBox(fresh, 'isle2')).toEqual({ x: -256, y: 0, w: 512, h: 256 }) // locked: nothing shown
    expect(landBox(null, 'home')).toEqual({ x: -256, y: 0, w: 512, h: 256 })
  })

  it('the opening view frames owned and offered land, at whole-number zoom', () => {
    // The fresh land box is x -128..192, y 64..224: centre (32, 144).
    expect(openingView(fresh, 'home', PHONE.w, PHONE.h)).toEqual({ cx: 32, cy: 144, zoom: 2 })
    expect(openingView(fresh, 'home', DESKTOP.w, DESKTOP.h)).toEqual({ cx: 32, cy: 144, zoom: 4 })
  })

  it('centres on the land after buying an outer corner plot', () => {
    expect(openingView(withPlots(fresh, [5, 6, 9, 10, 15]), 'home', PHONE.w, PHONE.h)).toEqual({ cx: 32, cy: 160, zoom: 2 })
    expect(openingView(withPlots(fresh, [5, 6, 9, 10, 0]), 'home', PHONE.w, PHONE.h)).toEqual({ cx: 32, cy: 112, zoom: 2 })
    // Plot 12 (col 0, row 24) is the island's left corner: the box grows to x -256..192, and a phone then opens at 1.
    expect(openingView(withPlots(fresh, [5, 6, 9, 10, 12]), 'home', PHONE.w, PHONE.h)).toEqual({ cx: -32, cy: 144, zoom: 1 })
  })

  it('a full island opens at 1 on a phone, and zoom never goes below 1', () => {
    const all = withPlots(fresh, Array.from({ length: 16 }, (_, i) => i))
    expect(openingView(all, 'home', PHONE.w, PHONE.h)).toEqual({ cx: 0, cy: 128, zoom: 1 })
    expect(zoomRange(openingView(all, 'home', PHONE.w, PHONE.h).zoom).min).toBe(1)
    expect(openingView(all, 'home', 200, 300).zoom).toBe(1)
  })

  it('bare ground on a plot for sale answers with the plot; owned land, plots not offered and the sky do not', () => {
    const at = (col: number, row: number) => { const c = cellCentre(col, row); return offeredPlotAt(fresh, 'home', c.x, c.y) }
    expect(at(21, 6)).toBe(2)
    expect(at(28, 12)).toBe(7)
    expect(at(14, 14)).toBeNull() // owned
    expect(at(3, 3)).toBeNull() // plot 0, not offered
    expect(at(40, 40)).toBeNull()
    expect(offeredPlotAt(null, 'home', 0, 100)).toBeNull()
  })

  it('a landscape phone opens at 2 at least, on the land\'s middle, with zoom 1 still there to go to', () => {
    const all = withPlots(fresh, Array.from({ length: 16 }, (_, i) => i))
    for (const s of [fresh, all]) {
      const v = openingView(s, 'home', 844, 300)
      expect(v.zoom).toBe(2)
      expect(zoomRange(v.zoom).min).toBe(1)
      const b = landBox(s, 'home')
      expect({ cx: v.cx, cy: v.cy }).toEqual({ cx: b.x + b.w / 2, cy: b.y + b.h / 2 })
    }
  })

  it('a plot sign is at least 44 CSS px to tap at the opening view on a 390x844 phone', () => {
    const holdings = [[5, 6, 9, 10], [5, 6, 9, 10, 4, 8], [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]]
    for (const plots of holdings) {
      const s = withPlots({ ...fresh, level: 12 }, plots)
      const { zoom } = openingView(s, 'home', PHONE.w, PHONE.h)
      const signs = buildIslandModel(s, FALLBACK_ART, LAUNCH_CATALOG, 0, 'home', null).objects.filter(o => o.id.startsWith('sign:'))
      expect(signs.length).toBeGreaterThan(0)
      for (const sign of signs) {
        // The sign sprite is 32 px: its tap box on screen is what the scene gives it at the opening zoom.
        expect(sign.minTap).toBe(44)
        const box = tapBox({ w: sign.sprite.w, h: sign.sprite.h }, zoom, sign.minTap)
        expect(box.w * zoom).toBeGreaterThanOrEqual(44)
        expect(box.h * zoom).toBeGreaterThanOrEqual(44)
      }
    }
    // Why the sprite alone is not enough: a 32 px sign opens at zoom 1 once enough land is owned.
    expect(openingView(withPlots(fresh, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]), 'home', PHONE.w, PHONE.h).zoom).toBe(1)
    // The box is the sign itself once the sign is drawn that big, and 44 CSS px below that.
    expect(tapBox({ w: 32, h: 32 }, 1)).toEqual({ w: 44, h: 44 })
    expect(tapBox({ w: 32, h: 32 }, 2)).toEqual({ w: 32, h: 32 })
    expect(tapBox({ w: 32, h: 32 }, 5)).toEqual({ w: 32, h: 32 })
    expect(tapBox({ w: 32, h: 32 }, 1, 0)).toEqual({ w: 32, h: 32 })
  })

  it('every obstacle gets the 44 px tap floor, at zoom 1 and 2 (a Bush is 16x16)', () => {
    const obstacles = buildIslandModel(fresh, FALLBACK_ART, LAUNCH_CATALOG, 0, 'home', null).objects.filter(o => o.id.startsWith('obstacle:'))
    expect(obstacles.length).toBeGreaterThan(0)
    for (const o of obstacles) {
      expect(o.minTap).toBe(44)
      for (const zoom of [1, 2]) {
        const hit = tapHit({ w: o.sprite.w, h: o.sprite.h }, zoom, o.minTap!)
        expect(hit.w * zoom).toBeGreaterThanOrEqual(44)
        expect(hit.h * zoom).toBeGreaterThanOrEqual(44)
      }
    }
  })

  it('a sign takes the box at every zoom, never the pixel test', () => {
    for (const zoom of [1, 2, 3, 5]) {
      const hit = tapHit({ w: 64, h: 64 }, zoom, 44, true)
      expect(hit.pixel).toBe(false)
      expect(hit.w).toBeGreaterThanOrEqual(64)
      expect(hit.w * zoom).toBeGreaterThanOrEqual(44)
    }
    const s = withPlots({ ...fresh, level: 12 }, [5, 6, 9, 10])
    const sign = buildIslandModel(s, FALLBACK_ART, LAUNCH_CATALOG, 0, 'home', null).objects.find(o => o.id.startsWith('sign:'))
    expect(sign?.boxAlways).toBe(true)
    // Without the flag a thing drawn at least that big keeps its pixels; a smaller one gets the box.
    expect(tapHit({ w: 64, h: 64 }, 2, 44).pixel).toBe(true)
    expect(tapHit({ w: 16, h: 16 }, 2, 44).pixel).toBe(false)
  })
})
