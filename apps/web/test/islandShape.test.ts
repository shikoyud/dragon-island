import { HOME_PLOT_ORDER, plotOfTile, plotOrigin, TILES_PER_PLOT } from '@wyrmhaven/game-core'
import { describe, expect, it } from 'vitest'
import { CLIFF_DEPTH, driftCloud, landmass, landmassBox, nearestPlot, RIM_CELLS, RIM_ROCK_BOX, RIM_ROCK_SCALE, rimRockSize } from '../src/game/islandShape'
import { cellCentre, pointerToCell } from '../src/game/layout'

const start = [5, 6, 9, 10, 2, 7, 11]
const all = Array.from({ length: 16 }, (_, i) => i)
const later = [...start, 1, 14, 13]
/** Home's land after each purchase in the only buying order: owned plus the 3 on offer, as the game draws it (and owned alone, the starting 2x2 first). */
const prefixes: number[][] = [[5, 6, 9, 10], ...HOME_PLOT_ORDER.map((_, k) => [5, 6, 9, 10, ...HOME_PLOT_ORDER.slice(0, k + 1)]), all]

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
    for (const plots of prefixes) {
      const m = landmass(plots)
      expect(m.rimRocks.length).toBeGreaterThan(4)
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
    expect(m.edge(x, front - 24)).toBeGreaterThan(m.edge(x, front)) // 3 cells in: past the noise's reach
  })

  it('takes the rim cell to the plot it lies nearest', () => {
    expect(nearestPlot(start, 33, 20)).toBe(11) // just past plot 11's outer edge
    expect(nearestPlot(start, 33, 10)).toBe(7)
    expect(nearestPlot(start, 7, 12)).toBe(5)
    expect(nearestPlot(start, 28, 10)).toBe(7) // on the plot itself
  })
})

describe('rim rocks stand on the land', () => {
  it('draw at about 0.7 of the art, in whole pixels', () => {
    expect(RIM_ROCK_SCALE).toBeCloseTo(0.7)
    expect(RIM_ROCK_BOX).toEqual({ w: 34, h: 22 })
    expect(rimRockSize(40, 32)).toEqual({ w: 28, h: 22 })
    expect(rimRockSize(32, 32)).toEqual({ w: 22, h: 22 })
  })

  it('every rock\'s whole base is land, on every land set', () => {
    for (const plots of prefixes) {
      const m = landmass(plots)
      expect(m.rimRocks.length, plots.join()).toBeGreaterThan(4)
      for (const r of m.rimRocks) {
        for (const dx of [-RIM_ROCK_BOX.w / 2, -8, 0, 8, RIM_ROCK_BOX.w / 2]) expect(m.isLand(r.x + dx, r.y), `${plots.length} plots: ${r.x},${r.y} at ${dx}`).toBe(true)
        expect(m.isRiver(r.x, r.y)).toBe(false)
      }
    }
  })
})

describe('the outline as land grows', () => {
  it('keeps the opening\'s land free of the bulges: nothing past the rim and the noise', () => {
    const m = landmass(start)
    const c = cellCentre(32 + RIM_CELLS + 1.5, 12)
    expect(m.isLand(c.x, c.y)).toBe(false)
    expect(landmassBox(start)).toEqual(m.box)
  })

  it('all 16 plots: the outer edge wanders at least 20 px from the straight rim on each of the 4 sides', () => {
    const m = landmass(all)
    const span = (values: number[]) => Math.max(...values) - Math.min(...values)
    const xs = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i)
    // The plots' outer lines in world y at a column: back-left row... The island's corners are at x = 0 (back, front) and x = +-256.
    const front = (x: number) => m.frontY(x)!, back = (x: number) => m.backY(x)!
    const frontRight = xs(16, 240).map(x => front(x) - (256 - x / 2))
    const frontLeft = xs(-240, -16).map(x => front(x) - (256 + x / 2))
    const backRight = xs(16, 240).map(x => back(x) - x / 2)
    const backLeft = xs(-240, -16).map(x => back(x) + x / 2)
    for (const [name, gaps] of [['front right', frontRight], ['front left', frontLeft], ['back right', backRight], ['back left', backLeft]] as const) {
      expect(span(gaps), name).toBeGreaterThanOrEqual(20)
    }
  })

  it('the box holds the worst case, and is the same with or without rasterising', () => {
    for (const plots of prefixes) expect(landmassBox(plots)).toEqual(landmass(plots).box)
    const m = landmass(all)
    const xs = Array.from({ length: m.box.w }, (_, i) => m.box.x + i).filter(x => m.frontY(x) !== null)
    // Land stops short of the box's sides (the art's pad) and of the cliff's room at the bottom.
    expect(Math.min(...xs)).toBeGreaterThan(m.box.x)
    expect(Math.max(...xs)).toBeLessThan(m.box.x + m.box.w - 1)
    for (const x of xs) expect(m.cliffBottomY(x)!).toBeLessThanOrEqual(m.box.y + m.box.h)
  })

  it('land is whole down every column, so no wedge of rock shows in a notch between plots', () => {
    for (const plots of prefixes) {
      const m = landmass(plots)
      for (const x of columns(m)) for (let y = m.backY(x)!; y <= m.frontY(x)!; y++) expect(m.isLand(x, y), `${plots.length} plots at ${x},${y}`).toBe(true)
    }
  })

  it('every plot tile is land on every land set, and the mask is on a 2 px grid', () => {
    for (const plots of prefixes) {
      const m = landmass(plots)
      for (const plot of plots) {
        const o = plotOrigin(plot)
        for (let row = o.row; row < o.row + TILES_PER_PLOT; row++) for (let col = o.col; col < o.col + TILES_PER_PLOT; col++) { const c = cellCentre(col, row); expect(m.isLand(c.x, c.y)).toBe(true) }
      }
    }
    const m = landmass(start)
    expect(m.box.x % 2 === 0 && m.box.y % 2 === 0).toBe(true)
    for (let k = 0; k < 2000; k += 1) {
      const x = m.box.x + 2 * (k % Math.floor(m.box.w / 2)), y = m.box.y + 2 * (Math.floor(k / 7) % Math.floor((m.box.h - CLIFF_DEPTH - 4) / 2))
      const land = m.isLand(x, y)
      expect(m.isLand(x + 1, y)).toBe(land)
      expect(m.isLand(x, y + 1) === land || m.frontY(x) !== null).toBe(true) // a column's fill only adds land
    }
  })
})

describe('the river and its falls', () => {
  /** The river's columns, by side of the land's middle, as contiguous runs. */
  const riverRuns = (m: ReturnType<typeof landmass>) => {
    const cols = columns(m)
    const mid = (cols[0]! + cols[cols.length - 1]!) / 2
    const wet = cols.filter(x => { for (let y = m.backY(x)!; y <= m.frontY(x)!; y++) if (m.isRiver(x, y)) return true; return false })
    const runs: { from: number; to: number }[] = []
    for (const x of wet) { const last = runs[runs.length - 1]; if (last && x - last.to <= 2) last.to = x; else runs.push({ from: x, to: x }) }
    return { left: runs.filter(r => r.to < mid), right: runs.filter(r => r.from > mid) }
  }

  it('one contiguous stretch a side at most, none a pond under 40 px, on every land set with a real river', () => {
    for (const plots of prefixes) {
      const { left, right } = riverRuns(landmass(plots))
      expect(left.length, `${plots.length} plots left`).toBeLessThanOrEqual(1)
      expect(right.length, `${plots.length} plots right`).toBeLessThanOrEqual(1)
    }
  })

  it('the rule on falls: at least 1 on any land set, 2 from the opening\'s land up, from kept runs only', () => {
    for (const plots of prefixes) {
      const m = landmass(plots)
      expect(m.falls.length, `${plots.length} plots`).toBeGreaterThanOrEqual(plots.length >= 7 ? 2 : 1)
      expect(m.falls.length).toBeLessThanOrEqual(2)
      m.falls.forEach((f, i) => {
        expect(f.y).toBe(m.frontY(f.x))
        const above = Array.from({ length: 15 }, (_, k) => m.isRiver(f.x, f.y - 4 - k)).filter(Boolean)
        expect(above.length, `${plots.length} plots, fall ${i}`).toBeGreaterThan(0)
        for (const g of m.falls.slice(i + 1)) expect(Math.abs(g.x - f.x)).toBeGreaterThanOrEqual(48)
      })
    }
  })
})

describe('no land at all', () => {
  it('is an empty landmass, not a throw', () => {
    const m = landmass([])
    expect(m.box).toEqual({ x: 0, y: 0, w: 0, h: 0 })
    expect(m.mask).toHaveLength(0)
    expect(m.isLand(0, 100)).toBe(false)
    expect(m.isRiver(0, 100)).toBe(false)
    expect(m.edge(0, 100)).toBe(0)
    expect(m.frontY(0)).toBeNull()
    expect(m.backY(0)).toBeNull()
    expect(m.cliffBottomY(0)).toBeNull()
    expect(m.falls).toEqual([])
    expect(m.rimRocks).toEqual([])
  })
})

describe('cloud drift', () => {
  it('moves 2 px a second and wraps at the bounds', () => {
    expect(driftCloud(10, 1000, -100, 100, 48)).toBeCloseTo(12)
    expect(driftCloud(148.5, 1000, -100, 100, 48)).toBe(-148)
  })
})
