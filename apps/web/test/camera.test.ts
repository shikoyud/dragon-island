import { newPlayer } from '@wyrmhaven/game-core'
import { describe, expect, it } from 'vitest'
import { cameraBounds, groundCell, isClick, lockedTiles, stepZoom, zoomRange } from '../src/game/camera'

describe('island camera logic', () => {
  it('bounds follow the viewed island', () => {
    const s = newPlayer(0)
    s.islands.unlocked = ['home', 'isle2']
    expect(cameraBounds(s, 'home')).toEqual({ w: 192, h: 192 })
    expect(cameraBounds(s, 'isle2')).toEqual({ w: 256, h: 256 })
    expect(cameraBounds(null, 'home')).toEqual({ w: 480, h: 270 })
  })

  it('a ground click yields the cell, or nothing outside the island', () => {
    const s = newPlayer(0)
    expect(groundCell(s, 'home', 6 * 16 + 3, 8 * 16 + 5)).toEqual({ col: 6, row: 8 })
    expect(groundCell(s, 'home', -5, 4)).toBeNull()
    expect(groundCell(s, 'home', 192, 0)).toBeNull()
    expect(groundCell(s, 'home', 191, 191)).toEqual({ col: 11, row: 11 })
    expect(groundCell(null, 'home', 5, 5)).toBeNull()
  })

  it('a press that moved 4 px or less is a click', () => {
    expect(isClick(10, 10, 14, 10)).toBe(true)
    expect(isClick(10, 10, 13, 13)).toBe(false)
    expect(isClick(10, 10, 10, 15)).toBe(false)
  })

  it('wheel steps zoom between the base and base + 2', () => {
    expect(zoomRange(480, 270)).toEqual({ min: 1, max: 3 })
    expect(zoomRange(960, 540)).toEqual({ min: 2, max: 4 })
    const r = { min: 1, max: 3 }
    expect(stepZoom(1, -1, r)).toBe(2)
    expect(stepZoom(3, -1, r)).toBe(3)
    expect(stepZoom(2, 1, r)).toBe(1)
    expect(stepZoom(1, 1, r)).toBe(1)
  })

  it('draws locked tiles on the home island only, outside the unlocked cells', () => {
    const s = newPlayer(0)
    const tiles = lockedTiles(s, 'home')
    expect(tiles.length).toBe(24 * 24 - 12 * 12)
    expect(tiles).not.toContainEqual({ col: 0, row: 0 })
    expect(tiles).toContainEqual({ col: 12, row: 0 })
    expect(lockedTiles(s, 'isle2')).toEqual([])
  })
})
