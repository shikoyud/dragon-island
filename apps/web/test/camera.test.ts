import { newPlayer } from '@wyrmhaven/game-core'
import { describe, expect, it } from 'vitest'
import {
  cameraBounds, clampView, fitZoom, groundCell, isClick, lockedTiles, panBy, screenToWorld, SKIRT, stepZoom, zoomAt, zoomRange,
  type View,
} from '../src/game/camera'
import { cellCentre } from '../src/game/layout'

const vp = { w: 1280, h: 720 }

describe('island camera logic', () => {
  it('bounds the shown island diamond plus the cliff skirt and a margin, home with its two-cell locked ring', () => {
    const s = newPlayer(0)
    s.islands.unlocked = ['home', 'isle2']
    const home = cameraBounds(s, 'home') // 12x12 unlocked + ring = 14x14 shown
    expect(home.w).toBeGreaterThan(14 * 16)
    expect(home.x).toBeLessThan(-14 * 8)
    expect(home.y + home.h).toBeGreaterThan(14 * 8 + SKIRT)
    const full = cameraBounds({ ...s, islands: { ...s.islands, homeStep: 12 } }, 'home')
    expect(full).toEqual(cameraBounds({ ...s, islands: { ...s.islands, homeStep: 11 } }, 'home'))
    expect(full.w).toBeGreaterThan(home.w)
  })

  it('a ground click yields the cell, or nothing outside the island', () => {
    const s = newPlayer(0)
    const c = cellCentre(6, 8)
    expect(groundCell(s, 'home', c.x, c.y)).toEqual({ col: 6, row: 8 })
    const out = cellCentre(12, 0)
    expect(groundCell(s, 'home', out.x, out.y)).toBeNull()
    const corner = cellCentre(11, 11)
    expect(groundCell(s, 'home', corner.x, corner.y)).toEqual({ col: 11, row: 11 })
    expect(groundCell(s, 'home', 0, -2)).toBeNull()
    expect(groundCell(null, 'home', 5, 5)).toBeNull()
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

  it('centres the island when it is smaller than the screen and clamps the edges when larger', () => {
    const box = { x: -100, y: 0, w: 200, h: 120 }
    expect(clampView({ cx: 500, cy: -400, zoom: 1 }, vp.w, vp.h, box)).toEqual({ cx: 0, cy: 60, zoom: 1 })
    // At zoom 8 the screen shows 160x90 world pixels: the centre may go from x -20 to 20 and y 45 to 75.
    expect(clampView({ cx: 500, cy: -400, zoom: 8 }, vp.w, vp.h, box)).toEqual({ cx: 20, cy: 45, zoom: 8 })
  })

  it('opens at the whole-number zoom nearest to fitting the island, leaning up, never below 1', () => {
    const box = { x: -120, y: 0, w: 240, h: 140 }
    expect(fitZoom(1280, 720, box)).toBe(5) // 720/140 = 5.1
    expect(fitZoom(390, 844, box)).toBe(2) // 1.6 rounds up: a little of the edge is cropped
    expect(fitZoom(390, 844, { x: 0, y: 0, w: 300, h: 160 })).toBe(1) // 1.3
    expect(fitZoom(390, 844, { x: 0, y: 0, w: 400, h: 160 })).toBe(1)
    // A phone showing the starting home island (14x14 shown) opens at 2: buildings readable, edges a drag away.
    expect(fitZoom(390, 680, { x: 0, y: 0, w: 272, h: 172 })).toBe(2)
    expect(fitZoom(1280, 550, { x: 0, y: 0, w: 272, h: 172 })).toBe(3)
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

  it('draws locked tiles on the home island only, in the visible ring outside the unlocked cells', () => {
    const s = newPlayer(0)
    const tiles = lockedTiles(s, 'home')
    expect(tiles.length).toBe(14 * 14 - 12 * 12)
    expect(tiles).toContainEqual({ col: 12, row: 0 })
    expect(tiles).not.toContainEqual({ col: 0, row: 0 })
    expect(lockedTiles({ ...s, islands: { ...s.islands, homeStep: 12 } }, 'home')).toEqual([])
    expect(lockedTiles(s, 'isle2')).toEqual([])
  })
})
