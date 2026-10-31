import { describe, expect, it } from 'vitest'
import { ISLANDS, ISLAND_TILES, PLOTS_PER_SIDE, STARTING_PLOTS, TILES_PER_PLOT, plotOfTile, plotOrigin, plotPrice, plotsTouch, unlockPl, type IslandId } from '../src'

const IDS: IslandId[] = ['home', 'isle2', 'isle3', 'isle4', 'isle5', 'isle6']
const sum = (a: readonly number[]) => a.reduce((x, y) => x + y, 0)

describe('§5.5 island tables', () => {
  it('names', () => {
    expect(IDS.map(i => ISLANDS[i].name)).toEqual(['Home Isle', 'Ember Reach', 'Frostspire', 'Ironhold', 'Shadowmere', "Warlord's Crown"])
  })
  it('plot price lists', () => {
    expect(ISLANDS.home.plotPrices).toEqual([100, 500, 1_500, 5_000, 8_000, 12_000, 18_000, 25_000, 35_000, 45_000, 60_000, 75_000])
    expect(ISLANDS.isle2.plotPrices).toEqual([100_000, 120_000, 140_000, 160_000, 185_000, 210_000, 240_000, 270_000, 300_000, 340_000, 380_000, 425_000])
    expect(ISLANDS.isle3.plotPrices).toEqual(Array.from({ length: 12 }, (_, i) => 450_000 + 50_000 * i))
    expect(ISLANDS.isle3.plotPrices.at(-1)).toBe(1_000_000)
    expect(ISLANDS.isle4.plotPrices).toEqual([2e6, 2.5e6, 3e6, 3.5e6, 4e6, 5e6, 6e6, 7e6, 8e6, 9e6, 10e6, 12e6])
    expect(ISLANDS.isle5.plotPrices).toEqual([15e6, 18e6, 22e6, 26e6, 30e6, 35e6, 40e6, 45e6, 50e6, 55e6, 60e6, 70e6])
    expect(ISLANDS.isle6.plotPrices).toEqual([80e6, 90e6, 100e6, 115e6, 130e6, 150e6, 170e6, 190e6, 215e6, 240e6, 270e6, 300e6])
  })
  it('every list has 12 rising integer entries', () => {
    for (const i of IDS) {
      const p = ISLANDS[i].plotPrices
      expect(p).toHaveLength(12)
      p.forEach((v, k) => { expect(Number.isInteger(v)).toBe(true); if (k) expect(v).toBeGreaterThan(p[k - 1]!) })
    }
  })
  it('bridges and obstacle multipliers', () => {
    expect(IDS.map(i => ISLANDS[i].bridgeGold)).toEqual([null, 150_000, 750_000, 5e6, 25e6, 100e6])
    expect(IDS.map(i => ISLANDS[i].obstacleMult)).toEqual([1, 3, 10, 40, 150, 500])
  })
  it('island totals with the Bridge', () => {
    expect(IDS.map(i => sum(ISLANDS[i].plotPrices) + (ISLANDS[i].bridgeGold ?? 0))).toEqual([285_100, 3_020_000, 9_450_000, 77e6, 491e6, 2.15e9])
  })
  it('plotPrice is the nth purchase, null past the list', () => {
    expect(plotPrice('home', 0)).toBe(100)
    expect(plotPrice('isle6', 11)).toBe(300e6)
    expect(plotPrice('home', 12)).toBeNull()
    expect(plotPrice('home', -1)).toBeNull()
  })
})

describe('plot geometry', () => {
  it('constants', () => {
    expect([PLOTS_PER_SIDE, TILES_PER_PLOT, ISLAND_TILES]).toEqual([4, 8, 32])
    expect(STARTING_PLOTS).toEqual([5, 6, 9, 10])
  })
  it('plotOfTile', () => {
    expect(plotOfTile(8, 8)).toBe(5)
    expect(plotOfTile(7, 8)).toBe(4)
    expect(plotOfTile(31, 31)).toBe(15)
    expect(plotOfTile(32, 0)).toBeNull()
    expect(plotOfTile(-1, 0)).toBeNull()
    expect(plotOfTile(0, 32)).toBeNull()
  })
  it('plotOrigin', () => {
    expect(plotOrigin(5)).toEqual({ col: 8, row: 8 })
    expect(plotOrigin(15)).toEqual({ col: 24, row: 24 })
  })
  it('plotsTouch shares an edge only', () => {
    expect(plotsTouch(5, 6)).toBe(true)
    expect(plotsTouch(5, 9)).toBe(true)
    expect(plotsTouch(5, 10)).toBe(false)
    expect(plotsTouch(3, 4)).toBe(false)
    expect(plotsTouch(5, 5)).toBe(false)
  })
})

describe('Home gates (R46)', () => {
  it('home:0..11 are PL 2, 2, 3 ... 12; Island 6 is PL 40', () => {
    expect(Array.from({ length: 12 }, (_, i) => unlockPl(`home:${i}`))).toEqual([2, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
    expect(unlockPl('island:isle6')).toBe(40)
  })
})
