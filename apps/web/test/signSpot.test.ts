import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createRng, HOME_PLOT_ORDER, newPlayer, OBSTACLES, offeredPlots, plotOfTile, plotOrigin, spawnPlotObstacles, TILES_PER_PLOT, type Obstacle, type ObstacleKind } from '@wyrmhaven/game-core'
import { describe, expect, it } from 'vitest'
import { FALLBACK_ART } from '../src/art/slots'
import { artSetFromManifest } from '../src/art/fromManifest'
import { buildingBoxes, buildIslandModel } from '../src/game/islandModel'
import { LAUNCH_CATALOG } from '@wyrmhaven/game-core'
import { anchor, boxesOverlap, captionBox, cellCentre, obstacleBox, SIGN_SCALE, signBox, signSpot, type SignArt } from '../src/game/layout'

/** The art's real sizes, from the manifest. */
const manifest = JSON.parse(readFileSync(resolve(__dirname, '../public/art/v1/manifest.json'), 'utf8')) as { assets: Record<string, { w: number; h: number; top?: number }> }
const KINDS = Object.keys(OBSTACLES) as ObstacleKind[]
const art: SignArt = {
  obstacle: Object.fromEntries(KINDS.map(k => [k, manifest.assets[`obstacle.${k}`]!])) as SignArt['obstacle'],
  island: { sign: manifest.assets['island.sign']! },
}

const start = newPlayer(0).islands.obstacles
const clearCells = (plot: number, obstacles: readonly Obstacle[]) => {
  const o = plotOrigin(plot), out: { col: number; row: number }[] = []
  for (let row = o.row; row < o.row + TILES_PER_PLOT; row++) for (let col = o.col; col < o.col + TILES_PER_PLOT; col++) {
    if (!obstacles.some(x => boxesOverlap(signBox(col, row, art), obstacleBox(x, art)))) out.push({ col, row })
  }
  return out
}

describe('the start table at the art\'s real sizes', () => {
  it('reads real sizes from the manifest', () => {
    expect(art.obstacle.ancientTree).toMatchObject({ w: 64, h: 72 })
    expect(obstacleBox({ kind: 'bush', col: 8, row: 8 }, art)).toEqual({ x: -8, y: 72 - 12, w: 16, h: 12 }) // top: 4 of the 16 px is empty
  })

  it('no two obstacles\' sprite boxes overlap', () => {
    start.forEach((a, i) => start.slice(i + 1).forEach(b => {
      expect(boxesOverlap(obstacleBox(a, art), obstacleBox(b, art)), `${a.kind} (${a.col},${a.row}) / ${b.kind} (${b.col},${b.row})`).toBe(false)
    }))
  })

  it('keeps the castle\'s nest in sight: no obstacle\'s art over it', () => {
    // The Hatchery at (8, 13): the nest is about 28x14, centred 14 px above its anchor (docs/art/ui-rework-p1-art-list.md).
    const { x, y } = anchor(8, 13, 4)
    const nest = { x: x - 14, y: y - 21, w: 28, h: 14 }
    for (const o of start) expect(boxesOverlap(nest, obstacleBox(o, art)), `${o.kind} (${o.col},${o.row})`).toBe(false)
  })

  it('leaves a clear sign cell on each of the 3 first offered plots', () => {
    expect(offeredPlots(newPlayer(0), 'home')).toEqual(HOME_PLOT_ORDER.slice(0, 3))
    for (const plot of HOME_PLOT_ORDER.slice(0, 3)) {
      const clear = clearCells(plot, start)
      expect(clear.length, `plot ${plot}`).toBeGreaterThan(0)
      const spot = signSpot(plot, start, art)
      expect(clear).toContainEqual(spot)
    }
  })
})

describe('signs and buildings at the opening', () => {
  const real = artSetFromManifest('v1', manifest as never, LAUNCH_CATALOG)
  const s = newPlayer(0)
  const boxes = buildingBoxes(s, real, LAUNCH_CATALOG, 'home')

  it('counts every building and resident', () => {
    // 2 habitats, 2 dragons, a Mountain, the Hatchery, a Farm.
    expect(boxes).toHaveLength(7)
  })

  it('no sign or caption box overlaps a building\'s or resident\'s sprite box', () => {
    const { markers } = buildIslandModel(s, real, LAUNCH_CATALOG, 0, 'home', null)
    expect(markers.signs.map(x => x.plot)).toEqual([2, 7, 11])
    for (const { plot, col, row } of markers.signs) {
      for (const b of boxes) {
        expect(boxesOverlap(signBox(col, row, real), b), `sign ${plot} on ${JSON.stringify(b)}`).toBe(false)
        expect(boxesOverlap(captionBox(col, row), b), `caption ${plot} on ${JSON.stringify(b)}`).toBe(false)
      }
    }
  })

  it('signs don\'t move while a building is being moved', () => {
    const at = (placing: Parameters<typeof buildIslandModel>[5]) => buildIslandModel(s, real, LAUNCH_CATALOG, 0, 'home', placing).markers.signs
    expect(at({ what: { kind: 'move', target: { type: 'habitat', id: 'h1' } }, size: 4, col: 14, row: 13, facing: 0 })).toEqual(at(null))
    expect(at({ what: { kind: 'move', target: { type: 'farm', index: 0 } }, size: 3, col: 26, row: 12, facing: 0 })).toEqual(at(null))
  })

  it('a building counts where it stands: one on the sign\'s cell moves the sign', () => {
    const spot = signSpot(7, s.islands.obstacles, real, boxes)
    const onIt = { ...s, farms: [{ ...s.farms[0]!, placement: { island: 'home' as const, col: spot.col - 1, row: spot.row - 1, facing: 0 as const } }] }
    expect(signSpot(7, s.islands.obstacles, real, buildingBoxes(onIt, real, LAUNCH_CATALOG, 'home'))).not.toEqual(spot)
  })

  it('with no clear cell, the least overlap counts buildings too', () => {
    const o = plotOrigin(5)
    const covered = { x: -1000, y: -1000, w: 2000, h: 2000 }
    const spot = signSpot(5, [], art, [covered])
    expect(plotOfTile(spot.col, spot.row)).toBe(5)
    expect(Math.abs(spot.col + 0.5 - o.col - 4)).toBeLessThanOrEqual(0.5) // all equal: the plot's middle
  })
})

describe('signSpot', () => {
  it('stands on the plot\'s middle when nothing is in the way, the same way each time', () => {
    const o = plotOrigin(7)
    const spot = signSpot(7, [], art)
    expect(Math.abs(spot.col + 0.5 - (o.col + 4))).toBeLessThanOrEqual(0.5)
    expect(Math.abs(spot.row + 0.5 - (o.row + 4))).toBeLessThanOrEqual(0.5)
    expect(signSpot(7, [], art)).toEqual(spot)
  })

  it('uses a clear cell wherever one exists, over 300 seeds, also clear of a neighbour\'s obstacles', () => {
    let exists = 0
    for (let seed = 1; seed <= 300; seed++) {
      const plot = seed % 16
      const others = spawnPlotObstacles('home', (plot + 1) % 16, 100, createRng(seed + 1000), [])
      const obstacles = [...spawnPlotObstacles('home', plot, 40, createRng(seed), []), ...others]
      const spot = signSpot(plot, obstacles, art)
      expect(plotOfTile(spot.col, spot.row)).toBe(plot)
      const clear = clearCells(plot, obstacles)
      if (clear.length > 0) { exists++; expect(clear, `seed ${seed}`).toContainEqual(spot) }
    }
    expect(exists).toBeGreaterThan(250)
  })

  it('with no clear cell, takes the one with the least overlap', () => {
    // A wall of Ancient Trees over the whole plot and more.
    const o = plotOrigin(5)
    const wall: Obstacle[] = []
    for (let row = -8; row < 12; row += 2) for (let col = -8; col < 12; col += 2) wall.push({ id: `w${col},${row}`, kind: 'ancientTree', island: 'home', col: o.col + col, row: o.row + row })
    expect(clearCells(5, wall)).toEqual([])
    const area = (col: number, row: number) => wall.reduce((n, x) => {
      const a = signBox(col, row, art), b = obstacleBox(x, art)
      return n + Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y))
    }, 0)
    const spot = signSpot(5, wall, art)
    for (let row = o.row; row < o.row + TILES_PER_PLOT; row++) for (let col = o.col; col < o.col + TILES_PER_PLOT; col++) expect(area(spot.col, spot.row)).toBeLessThanOrEqual(area(col, row))
  })

  it('the model\'s sign and its caption stand there, at the sign\'s drawn scale', () => {
    const s = newPlayer(0)
    const { objects } = buildIslandModel(s, FALLBACK_ART, LAUNCH_CATALOG, 0, 'home', null)
    for (const plot of [2, 7, 11]) {
      const sign = objects.find(o => o.id === `sign:${plot}`)!
      const c = signSpot(plot, s.islands.obstacles, FALLBACK_ART, buildingBoxes(s, FALLBACK_ART, LAUNCH_CATALOG, 'home'))
      expect({ x: sign.x, y: sign.y }).toEqual(cellCentre(c.col, c.row))
      expect(sign.scale).toBe(SIGN_SCALE)
      expect(sign.caption).toBe('Tap to buy')
    }
  })
})
