import { plotOfTile, plotOrigin, TILES_PER_PLOT } from '@wyrmhaven/game-core'
import { describe, expect, it } from 'vitest'
import { CLIFF_DEPTH, driftCloud, landmass, nearestPlot, RIM_CELLS, RIM_ROCK_BOX } from '../src/game/islandShape'
import { cellCentre, pointerToCell } from '../src/game/layout'

const start = [5, 6, 9, 10, 2, 7, 11]
const all = Array.from({ length: 16 }, (_, i) => i)
const later = [...start, 1, 14, 13]

const columns = (m: ReturnType<typeof landmass>) => Array.from({ length: m.box.w }, (_, i) => m.box.x + i).filter(x => m.frontY(x) !== null)
const onPlot = (plots: readonly number[], x: number, y: number) => {
  const c = pointerToCell(x, y)
  const p = plotOfTile(c.col, c.row)
  return p !== null && plots.includes(p)
}
const eachPixel = (m: ReturnType<typeof landmass>, fn: (x: number, y: number) => void) => {
  for (let y = m.box.y; y < m.box.y + m.box.h; y++) for (let x = m.box.x; x < m.box.x + m.box.w; x++) fn(x, y)
}

describe('the floating island shape', () => {
  it('every tile of every land plot is land', () => {
    const m = landmass(start)
    for (const plot of start) {
      const o = plotOrigin(plot)
      for (let row = o.row; row < o.row + TILES_PER_PLOT; row++) for (let col = o.col; col < o.col + TILES_PER_PLOT; col++) {
        const c = cellCentre(col, row)
        expect(m.isLand(c.x, c.y), `${col},${row}`).toBe(true)
      }
    }
  })

  it('tiles of plots not in the set, past the rim, are not land', () => {
    const m = landmass(start)
    // Plot 12 is (col 0..7, row 24..31): 8 or more cells from plots 9 and 5; its far corner is deep in the sky.
    for (const [col, row] of [[0, 31], [2, 28], [0, 0], [31, 31], [28, 30]] as const) {
      const c = cellCentre(col, row)
      expect(m.isLand(c.x, c.y), `${col},${row}`).toBe(false)
    }
    // Nothing is land more than the rim and the noise's whole range beyond a plot.
    const past = cellCentre(32 + RIM_CELLS + 1, 16)
    expect(m.isLand(past.x, past.y)).toBe(false)
  })

  it('is not a diamond: the outer edge wanders by at least 8 px from the straight rim', () => {
    const m = landmass(start)
    // Plot 7 and 11's front edge is the line col = 32, world y = 256 - x / 2. A straight rim would keep a fixed gap to it.
    const gaps: number[] = []
    for (let x = 100; x <= 180; x++) gaps.push(m.frontY(x)! - (256 - x / 2))
    expect(Math.max(...gaps) - Math.min(...gaps)).toBeGreaterThanOrEqual(8)
  })

  it('the same plots give the same shape', () => {
    const a = landmass(start)
    const b = landmass([...start].reverse())
    expect(b.box).toEqual(a.box)
    expect(b.falls).toEqual(a.falls)
    expect(b.rimRocks).toEqual(a.rimRocks)
    for (const x of columns(a)) {
      expect(b.frontY(x)).toBe(a.frontY(x))
      expect(b.cliffBottomY(x)).toBe(a.cliffBottomY(x))
    }
  })

  it('adding a plot grows the land and keeps what was there', () => {
    const small = landmass(start)
    const big = landmass(later)
    let grew = 0
    eachPixel(big, (x, y) => {
      if (small.isLand(x, y)) expect(big.isLand(x, y)).toBe(true)
      else if (big.isLand(x, y)) grew++
    })
    expect(grew).toBeGreaterThan(1000)
  })

  it('the river never touches a plot tile', () => {
    for (const plots of [start, later, all]) {
      const m = landmass(plots)
      let river = 0
      eachPixel(m, (x, y) => {
        if (!m.isRiver(x, y)) return
        river++
        // The 2 px bank round the river stays off the plots too.
        for (const [dx, dy] of [[0, 0], [2, 0], [-2, 0], [0, 2], [0, -2]] as const) expect(onPlot(plots, x + dx + 0.5, y + dy + 0.5)).toBe(false)
      })
      expect(river).toBeGreaterThan(200)
    }
  })

  it('keeps the river in a band 4 to 18 px above the front lip, in the left and right thirds only', () => {
    const m = landmass(start)
    const cols = columns(m)
    const lo = cols[0]!, hi = cols[cols.length - 1]!, third = (hi - lo + 1) / 3
    eachPixel(m, (x, y) => {
      if (!m.isRiver(x, y)) return
      expect(x < lo + third || x > hi - third).toBe(true)
      const up = m.frontY(x)! - y
      expect(up).toBeGreaterThanOrEqual(4)
      expect(up).toBeLessThanOrEqual(18)
    })
  })

  it('has at least 2 waterfalls, on the front lip, at least 48 px apart, with river above them', () => {
    for (const plots of [start, later, all]) {
      const m = landmass(plots)
      expect(m.falls.length).toBeGreaterThanOrEqual(2)
      m.falls.forEach((f, i) => {
        expect(f.y).toBe(m.frontY(f.x))
        const above = Array.from({ length: 15 }, (_, k) => m.isRiver(f.x, f.y - 4 - k)).filter(Boolean)
        expect(above.length).toBeGreaterThan(0)
        for (const g of m.falls.slice(i + 1)) expect(Math.abs(g.x - f.x)).toBeGreaterThanOrEqual(48)
      })
    }
  })

  it('the cliff hangs below the land in every land column, deepest near the middle', () => {
    const m = landmass(start)
    const cols = columns(m)
    const lo = cols[0]!, hi = cols[cols.length - 1]!
    let deepest = { x: 0, d: 0 }
    for (const x of cols) {
      const d = m.cliffBottomY(x)! - m.frontY(x)!
      expect(d).toBeGreaterThan(0)
      expect(d).toBeLessThanOrEqual(CLIFF_DEPTH)
      if (d > deepest.d) deepest = { x, d }
      expect(m.cliffBottomY(x)!).toBeLessThanOrEqual(m.box.y + m.box.h)
    }
    expect(deepest.d).toBeGreaterThan(CLIFF_DEPTH * 0.8)
    const width = hi - lo
    expect(deepest.x).toBeGreaterThan(lo + width / 4)
    expect(deepest.x).toBeLessThan(hi - width / 4)
    // Jagged: neighbouring stretches of the bottom edge differ, not one smooth curve.
    const steps = cols.slice(1).filter((x, i) => Math.abs(m.cliffBottomY(x)! - m.cliffBottomY(cols[i]!)!) >= 2).length
    expect(steps).toBeGreaterThan(cols.length / 10)
  })

  it('rim rocks stay off plot tiles', () => {
    for (const plots of [start, later, all]) {
      const m = landmass(plots)
      expect(m.rimRocks.length).toBeGreaterThan(8)
      for (const r of m.rimRocks) {
        expect(r.variant).toBeGreaterThanOrEqual(0)
        for (let dy = 0; dy <= RIM_ROCK_BOX.h; dy += 2) for (let dx = -RIM_ROCK_BOX.w / 2; dx <= RIM_ROCK_BOX.w / 2; dx += 2) {
          expect(onPlot(plots, r.x + dx, r.y - dy), `${r.x},${r.y}`).toBe(false)
        }
      }
      // Painted back to front.
      expect(m.rimRocks.map(r => r.y)).toEqual([...m.rimRocks.map(r => r.y)].sort((a, b) => a - b))
    }
  })

  it('edge is 0 at the outer boundary and rises inland', () => {
    const m = landmass(start)
    const x = 150
    const front = m.frontY(x)!
    expect(m.edge(x, front + 6)).toBe(0)
    expect(m.edge(x, front)).toBeLessThan(0.5)
    expect(m.edge(x, front - 10)).toBeGreaterThan(m.edge(x, front))
  })

  it('takes the rim cell to the plot it lies nearest', () => {
    expect(nearestPlot(start, 33, 20)).toBe(11) // just past plot 11's outer edge
    expect(nearestPlot(start, 33, 10)).toBe(7)
    expect(nearestPlot(start, 7, 12)).toBe(5)
    expect(nearestPlot(start, 28, 10)).toBe(7) // on the plot itself
  })
})

describe('cloud drift', () => {
  it('moves 2 px a second and wraps at the bounds', () => {
    expect(driftCloud(10, 1000, -100, 100, 48)).toBeCloseTo(12)
    expect(driftCloud(148.5, 1000, -100, 100, 48)).toBe(-148)
  })
})
