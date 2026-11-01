import { describe, expect, it } from 'vitest'
import {
  anchor, BATTLE, BATTLE_CONTROLS_H, BATTLE_DRAGON_SCALE, BATTLE_SPOT, battleCamera, battleStage, cellCentre, cellTop, depthOrder, dragonSpot, footprintDiamond, HATCHERY_ITEM_SCALE, hatcherySpot, integerZoom,
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
    // A 4x4 habitat at (5,0): the diamond is 64 wide and 32 tall, the bottom vertex is the top of cell (9,4).
    expect(anchor(5, 0, 4)).toEqual({ x: 40, y: 52 })
    const d = footprintDiamond(5, 0, 4)
    expect(d).toEqual([{ x: 40, y: 20 }, { x: 72, y: 36 }, { x: 40, y: 52 }, { x: 8, y: 36 }])
    expect(d[1]!.x - d[3]!.x).toBe(64)
    expect(d[2]!.y - d[0]!.y).toBe(32)
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

  it('keeps every dragon spot unique, on whole pixels and with its feet inside the 4x4 habitat diamond', () => {
    const a = anchor(8, 8, 4)
    // The diamond is 64 wide and 32 tall, its bottom vertex at the anchor: centre (0, -16), half-axes 32 and 16.
    const inside = (p: { x: number; y: number }) => Math.abs(p.x - a.x) / 32 + Math.abs(p.y - (a.y - 16)) / 16
    const spots = [0, 1, 2, 3, 4, 5, 6].map(i => dragonSpot(a, i))
    expect(new Set(spots.map(p => `${p.x},${p.y}`)).size).toBe(7)
    for (const p of spots) {
      expect(Number.isInteger(p.x) && Number.isInteger(p.y)).toBe(true)
      expect(inside(p)).toBeLessThanOrEqual(0.9)
    }
    expect(spots[0]).toEqual({ x: a.x, y: a.y - 16 }) // the first dragon stands in the middle
    // The art list's habitat silhouette (docs/art/gdd-m4-art-list.md): a 52x26 top face centred 16 px above the anchor; every spot is on it.
    for (const p of spots) expect(Math.abs(p.x - a.x) / 26 + Math.abs(p.y - (a.y - 16)) / 13).toBeLessThanOrEqual(1)
    expect(dragonSpot(a, 12)).toEqual(spots[6]) // past the last, they share it
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

  it('fits the 360x420 portrait battle stage by whole-number zoom, never below 1', () => {
    expect(BATTLE).toEqual({ w: 360, h: 420 })
    expect(integerZoom(1920, 1080)).toBe(2)
    expect(integerZoom(390, 600)).toBe(1)
    expect(integerZoom(720, 840)).toBe(2)
    expect(integerZoom(719, 840)).toBe(1)
    expect(integerZoom(200, 200)).toBe(1)
  })

  describe('battleStage', () => {
    it('rests the stage 8 px above the controls, spare room over it, by whole pixels, on the three screens that matter', () => {
      expect(battleStage(390, 844)).toEqual({ zoom: 1, x: 15, y: 844 - BATTLE_CONTROLS_H - 8 - 420, w: 360, h: 420 })
      expect(battleStage(360, 640)).toEqual({ zoom: 1, x: 0, y: 640 - BATTLE_CONTROLS_H - 8 - 420, w: 360, h: 420 })
      expect(battleStage(1440, 900)).toEqual({ zoom: 1, x: 540, y: 900 - BATTLE_CONTROLS_H - 8 - 420, w: 360, h: 420 })
    })
    it('the stage and the controls together fit 360x640 with nothing covered', () => {
      const s = battleStage(360, 640)
      expect(s.y).toBeGreaterThanOrEqual(0)
      expect(s.y + s.h).toBeLessThanOrEqual(640 - BATTLE_CONTROLS_H)
    })
    it('zooms only as far as the room above the controls allows', () => {
      expect(battleStage(1920, 1080).zoom).toBe(2)
      expect(battleStage(2560, 1440).zoom).toBe(2)
      expect(battleStage(3840, 2160).zoom).toBe(4)
    })
    it('a short screen pins the stage to the top: the controls stay reachable over it', () => {
      expect(battleStage(844, 390)).toMatchObject({ zoom: 1, y: 0 })
    })
    it('the camera centre puts the stage where the box says', () => {
      for (const [w, h] of [[390, 844], [360, 640], [1440, 900], [1920, 1080]] as const) {
        const box = battleStage(w, h)
        const cam = battleCamera(w, h)
        // screen = (world - centre) * zoom + viewport / 2
        expect((0 - cam.x) * box.zoom + w / 2).toBe(box.x)
        expect((0 - cam.y) * box.zoom + h / 2).toBe(box.y)
      }
    })
    it('the dragons stand on the stage, the enemy upper right and yours lower left', () => {
      const scale = BATTLE_DRAGON_SCALE
      const halfAdult = (48 * scale) / 2
      for (const side of ['attacker', 'defender'] as const) {
        expect(BATTLE_SPOT[side].x - halfAdult).toBeGreaterThanOrEqual(0)
        expect(BATTLE_SPOT[side].x + halfAdult).toBeLessThanOrEqual(BATTLE.w)
        expect(BATTLE_SPOT[side].y).toBeLessThanOrEqual(BATTLE.h)
      }
      expect(BATTLE_SPOT.defender.x).toBeGreaterThan(BATTLE_SPOT.attacker.x)
      expect(BATTLE_SPOT.defender.y).toBeLessThan(BATTLE_SPOT.attacker.y)
    })
  })
})
