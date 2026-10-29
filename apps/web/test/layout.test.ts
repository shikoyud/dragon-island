import { describe, expect, it } from 'vitest'
import { BASE, dragonSlots, farmPos, habitatSlots, hatcheryPos, hoardPos, integerZoom, nestPos } from '../src/game/layout'

const inside = (p: { x: number; y: number }) => p.x >= 0 && p.x < BASE.w && p.y >= 0 && p.y < BASE.h
const whole = (p: { x: number; y: number }) => Number.isInteger(p.x) && Number.isInteger(p.y)

describe('layout', () => {
  it('has the 480×270 base', () => {
    expect(BASE).toEqual({ w: 480, h: 270 })
  })

  it('places up to 12 habitats on distinct whole-pixel spots', () => {
    for (const n of [1, 2, 5, 12]) {
      const spots = Array.from({ length: n }, (_, i) => habitatSlots(i, n))
      expect(new Set(spots.map(p => `${p.x},${p.y}`)).size).toBe(n)
      for (const p of spots) {
        expect(inside(p)).toBe(true)
        expect(whole(p)).toBe(true)
      }
    }
  })

  it('places up to 7 dragons per habitat without overlap', () => {
    const spots = Array.from({ length: 7 }, (_, s) => dragonSlots(0, s, 7, 12))
    expect(new Set(spots.map(p => `${p.x},${p.y}`)).size).toBe(7)
    for (const p of spots) expect(whole(p)).toBe(true)
    // dragons sit on their platform, not on a neighbour's
    const platform = habitatSlots(0, 12)
    for (const p of spots) expect(Math.abs(p.x - platform.x)).toBeLessThan(48)
  })

  it('fits 12 v1 habitat tiles (96×64, bottom-centre origin) on the island without side overlap', () => {
    const spots = Array.from({ length: 12 }, (_, i) => habitatSlots(i, 12))
    for (const p of spots) {
      expect(p.x - 48).toBeGreaterThanOrEqual(0)
      expect(p.x + 48).toBeLessThanOrEqual(BASE.w)
      expect(p.y - 64).toBeGreaterThanOrEqual(36) // below the farm strip
      expect(p.y).toBeLessThanOrEqual(nestPos(0).y - 32) // above the nests and hatchery
    }
    for (const a of spots) for (const b of spots) {
      if (a !== b && a.y === b.y) expect(Math.abs(a.x - b.x)).toBeGreaterThanOrEqual(96)
    }
  })

  it('stands dragons on the tile face, not its front wall', () => {
    for (let s = 0; s < 7; s++) {
      const p = dragonSlots(0, s, 7, 12)
      const platform = habitatSlots(0, 12)
      expect(platform.y - p.y).toBeGreaterThanOrEqual(20)
      expect(platform.y - p.y).toBeLessThanOrEqual(44)
    }
  })

  it('has fixed spots for nests, hatchery, farm plots and the hoard', () => {
    const fixed = [nestPos(0), nestPos(3), hatcheryPos(0), hatcheryPos(2), farmPos(0), farmPos(5), hoardPos()]
    for (const p of fixed) {
      expect(inside(p)).toBe(true)
      expect(whole(p)).toBe(true)
    }
    expect(new Set(fixed.map(p => `${p.x},${p.y}`)).size).toBe(fixed.length)
  })

  it('zooms by whole numbers only', () => {
    expect(integerZoom(1920, 1080)).toBe(4)
    expect(integerZoom(500, 280)).toBe(1)
    expect(integerZoom(400, 200)).toBe(1)
    expect(integerZoom(960, 540)).toBe(2)
    expect(integerZoom(1439, 900)).toBe(2)
  })
})
