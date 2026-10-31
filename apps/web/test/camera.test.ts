import { LAUNCH_CATALOG, newPlayer } from '@wyrmhaven/game-core'
import { describe, expect, it } from 'vitest'
import { FALLBACK_ART } from '../src/art/slots'
import { buildIslandModel } from '../src/game/islandModel'
import { withPlots } from './land'
import {
  cameraBounds, clampView, fitZoom, groundCell, isClick, lockedTiles, openingView, ownedLandBox, panBy, screenToWorld, SKIRT, stepZoom, zoomAt, zoomRange,
  type View,
} from '../src/game/camera'
import { cellCentre, tapBox } from '../src/game/layout'

const vp = { w: 1280, h: 720 }

describe('island camera logic', () => {
  it('bounds the whole 32x32 diamond of any island plus the cliff skirt and a margin', () => {
    // The 32x32 island's diamond is 512 wide and 256 tall; the skirt adds 12 below and the sea margin 24 on every side.
    expect(SKIRT).toBe(12)
    expect(cameraBounds()).toEqual({ x: -280, y: -24, w: 560, h: 316 })
  })

  it('a ground click yields the cell, or nothing outside the island', () => {
    const s = newPlayer(0)
    const c = cellCentre(6, 8)
    expect(groundCell(s, c.x, c.y)).toEqual({ col: 6, row: 8 })
    const out = cellCentre(32, 0)
    expect(groundCell(s, out.x, out.y)).toBeNull()
    const corner = cellCentre(31, 31)
    expect(groundCell(s, corner.x, corner.y)).toEqual({ col: 31, row: 31 })
    expect(groundCell(s, 0, -2)).toBeNull()
    expect(groundCell(null, 5, 5)).toBeNull()
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
    expect(fitZoom(844, 390, { x: 0, y: 0, w: 160, h: 300 })).toBe(1) // landscape 1.3 rounds down
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

  it('draws fog on every tile not owned, and none once it all is', () => {
    const s = newPlayer(0)
    const tiles = lockedTiles(s, 'home')
    expect(tiles.length).toBe(32 * 32 - 16 * 16)
    expect(tiles).toContainEqual({ col: 0, row: 0 })
    expect(tiles).not.toContainEqual({ col: 8, row: 8 })
    expect(lockedTiles({ ...s, islands: { ...s.islands, plots: { home: Array.from({ length: 16 }, (_, i) => i) } } }, 'home')).toEqual([])
    expect(lockedTiles(s, 'isle2').length).toBe(32 * 32)
  })

})

describe('the opening view (R58)', () => {
  const fresh = newPlayer(0)
  const PHONE = { w: 390, h: 844 }
  const DESKTOP = { w: 1440, h: 900 }

  it('boxes the owned plots: the fresh island is the middle 16x16 tiles, and a plot at a corner extends it', () => {
    // Plots 5, 6, 9, 10 are tiles 8-23: top (0, 64), right (128, 128), bottom (0, 192), left (-128, 128).
    expect(ownedLandBox(fresh, 'home')).toEqual({ x: -128, y: 64, w: 256, h: 128 })
    // Plot 15 is tiles 24-31 in both axes: its bottom vertex is the island's, (0, 256).
    expect(ownedLandBox(withPlots(fresh, [5, 6, 9, 10, 15]), 'home')).toEqual({ x: -128, y: 64, w: 256, h: 192 })
    // Plot 0 is tiles 0-7: its top vertex is the island's, (0, 0).
    expect(ownedLandBox(withPlots(fresh, [5, 6, 9, 10, 0]), 'home')).toEqual({ x: -128, y: 0, w: 256, h: 192 })
    expect(ownedLandBox(withPlots(fresh, Array.from({ length: 16 }, (_, i) => i)), 'home')).toEqual({ x: -256, y: 0, w: 512, h: 256 })
  })

  it('an island with no owned land, or no state, boxes the whole island', () => {
    expect(ownedLandBox(fresh, 'isle2')).toEqual({ x: -256, y: 0, w: 512, h: 256 })
    expect(ownedLandBox(null, 'home')).toEqual({ x: -256, y: 0, w: 512, h: 256 })
  })

  it('centres on the owned land at a fresh start, at whole-number zoom', () => {
    expect(openingView(fresh, 'home', PHONE.w, PHONE.h)).toEqual({ cx: 0, cy: 128, zoom: 2 })
    expect(openingView(fresh, 'home', DESKTOP.w, DESKTOP.h)).toEqual({ cx: 0, cy: 128, zoom: 5 })
  })

  it('centres on the owned land after buying an outer corner plot', () => {
    expect(openingView(withPlots(fresh, [5, 6, 9, 10, 15]), 'home', PHONE.w, PHONE.h)).toEqual({ cx: 0, cy: 160, zoom: 2 })
    expect(openingView(withPlots(fresh, [5, 6, 9, 10, 0]), 'home', PHONE.w, PHONE.h)).toEqual({ cx: 0, cy: 96, zoom: 2 })
    // Plot 12 (col 0, row 24) is the island's left corner: the box grows to x -256..128, and a phone then opens at 1.
    expect(openingView(withPlots(fresh, [5, 6, 9, 10, 12]), 'home', PHONE.w, PHONE.h)).toEqual({ cx: -64, cy: 128, zoom: 1 })
  })

  it('a full island opens at 1 on a phone, and zoom never goes below 1', () => {
    const all = withPlots(fresh, Array.from({ length: 16 }, (_, i) => i))
    expect(openingView(all, 'home', PHONE.w, PHONE.h)).toEqual({ cx: 0, cy: 128, zoom: 1 })
    expect(zoomRange(openingView(all, 'home', PHONE.w, PHONE.h).zoom).min).toBe(1)
    expect(openingView(all, 'home', 200, 200).zoom).toBe(1)
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
})
