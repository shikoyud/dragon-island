// GDD §5.5 (island archipelago prices) and §5.6 (obstacle IslandMult). Gold is integer.
import type { IslandId } from '../state'

export interface IslandInfo {
  name: string
  /** Gold for the Bridge that opens the island and grants its 4 centre plots; null for Home Isle. */
  bridgeGold: number | null
  /** Gold for the nth purchased plot (index = plots bought so far on this island). */
  plotPrices: readonly number[]
  /** §5.6 IslandMult. */
  obstacleMult: number
}

export const ISLANDS: Record<IslandId, IslandInfo> = {
  home: {
    name: 'Home Isle', bridgeGold: null, obstacleMult: 1,
    plotPrices: [100, 500, 1_500, 5_000, 8_000, 12_000, 18_000, 25_000, 35_000, 45_000, 60_000, 75_000],
  },
  isle2: {
    name: 'Ember Reach', bridgeGold: 150_000, obstacleMult: 3,
    plotPrices: [100_000, 120_000, 140_000, 160_000, 185_000, 210_000, 240_000, 270_000, 300_000, 340_000, 380_000, 425_000],
  },
  isle3: {
    name: 'Frostspire', bridgeGold: 750_000, obstacleMult: 10,
    plotPrices: [450_000, 500_000, 550_000, 600_000, 650_000, 700_000, 750_000, 800_000, 850_000, 900_000, 950_000, 1_000_000],
  },
  isle4: {
    name: 'Ironhold', bridgeGold: 5_000_000, obstacleMult: 40,
    plotPrices: [2_000_000, 2_500_000, 3_000_000, 3_500_000, 4_000_000, 5_000_000, 6_000_000, 7_000_000, 8_000_000, 9_000_000, 10_000_000, 12_000_000],
  },
  isle5: {
    name: 'Shadowmere', bridgeGold: 25_000_000, obstacleMult: 150,
    plotPrices: [15_000_000, 18_000_000, 22_000_000, 26_000_000, 30_000_000, 35_000_000, 40_000_000, 45_000_000, 50_000_000, 55_000_000, 60_000_000, 70_000_000],
  },
  isle6: {
    name: "Warlord's Crown", bridgeGold: 100_000_000, obstacleMult: 500,
    plotPrices: [80_000_000, 90_000_000, 100_000_000, 115_000_000, 130_000_000, 150_000_000, 170_000_000, 190_000_000, 215_000_000, 240_000_000, 270_000_000, 300_000_000],
  },
}

/** Gold for the nth plot purchase (0-based) on `island`; null once the list runs out. */
export function plotPrice(island: IslandId, bought: number): number | null {
  return ISLANDS[island].plotPrices[bought] ?? null
}
