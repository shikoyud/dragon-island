import { describe, expect, it } from 'vitest'
import { anchor, BASE, CELL, dragonSpot, integerZoom, pointerToCell, worldSize } from '../src/game/layout'

describe('layout', () => {
  it('has the 480x270 base and 16 px cells', () => {
    expect(BASE).toEqual({ w: 480, h: 270 })
    expect(CELL).toBe(16)
    expect(worldSize(12, 12)).toEqual({ w: 192, h: 192 })
  })

  it('anchors a 5x5 at its bottom centre and keeps dragon spots unique', () => {
    expect(anchor(5, 0, 5)).toEqual({ x: 120, y: 80 })
    expect(pointerToCell(121, 79)).toEqual({ col: 7, row: 4 })
    const spots = [0, 1, 2, 3, 4, 5, 6].map(i => dragonSpot(anchor(0, 0, 5), i))
    expect(new Set(spots.map(p => `${p.x},${p.y}`)).size).toBe(7)
    for (const p of spots) expect(p.x >= 0 && p.x <= 80 && p.y <= 80).toBe(true)
    for (const p of spots) expect(Number.isInteger(p.x) && Number.isInteger(p.y)).toBe(true)
  })

  it('floors pointer positions to cells, including negatives', () => {
    expect(pointerToCell(0, 0)).toEqual({ col: 0, row: 0 })
    expect(pointerToCell(15, 16)).toEqual({ col: 0, row: 1 })
    expect(pointerToCell(-1, -17)).toEqual({ col: -1, row: -2 })
  })

  it('zooms by whole numbers only', () => {
    expect(integerZoom(1920, 1080)).toBe(4)
    expect(integerZoom(500, 280)).toBe(1)
    expect(integerZoom(400, 200)).toBe(1)
    expect(integerZoom(960, 540)).toBe(2)
    expect(integerZoom(1439, 900)).toBe(2)
  })
})
