import { describe, expect, it } from 'vitest'
import {
  anchor, BATTLE, cellCentre, cellTop, depthOrder, dragonSpot, footprintDiamond, HATCHERY_ITEM_SCALE, hatcherySpot, integerZoom,
  islandBox, ISO, pointerToCell,
} from '../src/game/layout'

describe('isometric layout', () => {
  it('uses 16x8 diamonds: cell (col,row) has its top vertex at ((col-row)*8, (col+row)*4)', () => {
    expect(ISO).toEqual({ w: 16, h: 8 })
    expect(cellTop(0, 0)).toEqual({ x: 0, y: 0 })
    expect(cellTop(1, 0)).toEqual({ x: 8, y: 4 })
    expect(cellTop(0, 1)).toEqual({ x: -8, y: 4 })
    expect(cellTop(3, 2)).toEqual({ x: 8, y: 20 })
    expect(cellCentre(3, 2)).toEqual({ x: 8, y: 24 })
  })

  it('anchors a size-n footprint at the bottom vertex of its n x n diamond', () => {
    // 5x5 habitat at (5,0): the diamond is 80 wide and 40 tall, the bottom vertex is the top of cell (10,5).
    expect(anchor(5, 0, 5)).toEqual({ x: 40, y: 60 })
    const d = footprintDiamond(5, 0, 5)
    expect(d).toEqual([{ x: 40, y: 20 }, { x: 80, y: 40 }, { x: 40, y: 60 }, { x: 0, y: 40 }])
    expect(d[1]!.x - d[3]!.x).toBe(80)
    expect(d[2]!.y - d[0]!.y).toBe(40)
  })

  it('maps a pointer back to the cell it is over (exact inverse, floors outside the island)', () => {
    for (const [col, row] of [[0, 0], [3, 2], [11, 0], [0, 11], [7, 9], [23, 23]] as const) {
      const c = cellCentre(col, row)
      expect(pointerToCell(c.x, c.y)).toEqual({ col, row })
      // Just inside each vertex of the cell's diamond.
      const t = cellTop(col, row)
      expect(pointerToCell(t.x, t.y + 1)).toEqual({ col, row })
      expect(pointerToCell(t.x + 7, t.y + 4)).toEqual({ col, row })
      expect(pointerToCell(t.x - 7, t.y + 4)).toEqual({ col, row })
      expect(pointerToCell(t.x, t.y + 7)).toEqual({ col, row })
    }
    expect(pointerToCell(0, -1)).toEqual({ col: -1, row: -1 })
    expect(pointerToCell(-9, 4)).toEqual({ col: -1, row: 1 })
  })

  it('bounds a w x h island by its diamond', () => {
    expect(islandBox(12, 12)).toEqual({ x: -96, y: 0, w: 192, h: 96 })
    expect(islandBox(14, 10)).toEqual({ x: -80, y: 0, w: 192, h: 96 })
  })

  it('draws back to front by col + row + size, then col', () => {
    const items = [
      { id: 'front', col: 6, row: 6, size: 1 },
      { id: 'big', col: 0, row: 0, size: 5 },
      { id: 'rightTie', col: 3, row: 2, size: 1 },
      { id: 'leftTie', col: 2, row: 3, size: 1 },
    ]
    expect([...items].sort(depthOrder).map(i => i.id)).toEqual(['big', 'leftTie', 'rightTie', 'front'])
  })

  it('keeps dragon spots unique, on whole pixels and over the platform art', () => {
    const a = anchor(0, 0, 5)
    const spots = [0, 1, 2, 3, 4, 5, 6].map(i => dragonSpot(a, i))
    expect(new Set(spots.map(p => `${p.x},${p.y}`)).size).toBe(7)
    for (const p of spots) {
      expect(Number.isInteger(p.x) && Number.isInteger(p.y)).toBe(true)
      expect(Math.abs(p.x - a.x)).toBeLessThanOrEqual(40)
      expect(p.y).toBeLessThan(a.y)
    }
  })

  it('puts hatchery eggs in the niches along the front of the 64x64 hatchery', () => {
    const a = anchor(0, 8, 4)
    const spots = [0, 1, 2, 3, 4].map(i => hatcherySpot(a, i))
    expect(new Set(spots.map(p => `${p.x},${p.y}`)).size).toBe(5)
    for (const p of spots) {
      expect(Number.isInteger(p.x) && Number.isInteger(p.y)).toBe(true)
      expect(p.x - 16 * HATCHERY_ITEM_SCALE).toBeGreaterThanOrEqual(a.x - 32)
      expect(p.x + 16 * HATCHERY_ITEM_SCALE).toBeLessThanOrEqual(a.x + 32)
      expect(p.y).toBeGreaterThanOrEqual(a.y - 26)
      expect(p.y).toBeLessThanOrEqual(a.y - 18)
    }
    for (let i = 1; i < 5; i++) expect(spots[i]!.x).toBeGreaterThan(spots[i - 1]!.x)
  })

  it('fits the 480x270 battle stage by whole-number zoom', () => {
    expect(BATTLE).toEqual({ w: 480, h: 270 })
    expect(integerZoom(1920, 1080)).toBe(4)
    expect(integerZoom(500, 280)).toBe(1)
    expect(integerZoom(390, 600)).toBe(1)
    expect(integerZoom(1439, 900)).toBe(2)
  })
})
