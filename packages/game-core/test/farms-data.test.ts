import { describe, expect, it } from 'vitest'
import { CROPS, FARM_LEVELS, FARM_UNLOCK_PL, FIRST_FARM_CLASSIC_MS, FIRST_FARM_GOLD, MAX_FARMS } from '../src/data/farms'

describe('§5.3 crop table (classic values)', () => {
  it('pins the Dragon Bush and Warlord Pepper rows', () => {
    expect(CROPS.dragonBush).toEqual({ tier: 1, name: 'Dragon Bush', unlockPl: 1, growClassicMs: 30_000, gold: 50, food: 5 })
    expect(CROPS.warlordPepper).toEqual({ tier: 6, name: 'Warlord Pepper', unlockPl: 15, growClassicMs: 86_400_000, gold: 20_000, food: 2_600 })
  })
  it('pins every row', () => {
    const ids = ['dragonBush', 'emberWheat', 'seaMelon', 'thunderPumpkin', 'frostBerries', 'warlordPepper'] as const
    expect(ids.map(c => [c, CROPS[c].tier, CROPS[c].unlockPl, CROPS[c].growClassicMs, CROPS[c].gold, CROPS[c].food])).toEqual([
      ['dragonBush', 1, 1, 30_000, 50, 5],
      ['emberWheat', 2, 3, 300_000, 250, 30],
      ['seaMelon', 3, 5, 1_800_000, 1_000, 120],
      ['thunderPumpkin', 4, 8, 7_200_000, 3_000, 360],
      ['frostBerries', 5, 12, 28_800_000, 8_000, 1_000],
      ['warlordPepper', 6, 15, 86_400_000, 20_000, 2_600],
    ])
    expect(Object.keys(CROPS)).toEqual([...ids])
  })
})

describe('§5.3 farm levels and unlocks', () => {
  it('pins the five levels', () => {
    expect(FARM_LEVELS).toEqual([
      { yieldPct: 100, upgradeGold: null, upgradeUsdMicro: null, classicMs: 60_000 },
      { yieldPct: 125, upgradeGold: 15_000, upgradeUsdMicro: null, classicMs: 3_600_000 },
      { yieldPct: 150, upgradeGold: 75_000, upgradeUsdMicro: null, classicMs: 14_400_000 },
      { yieldPct: 175, upgradeGold: 400_000, upgradeUsdMicro: null, classicMs: 43_200_000 },
      { yieldPct: 200, upgradeGold: null, upgradeUsdMicro: 2_000_000, classicMs: 0 },
    ])
  })
  it('pins unlocks, the cap and the first farm', () => {
    expect(FARM_UNLOCK_PL).toEqual([1, 3, 4, 7, 10, 15, 20, 25])
    expect([MAX_FARMS, FIRST_FARM_GOLD, FIRST_FARM_CLASSIC_MS]).toEqual([8, 1_000, 60_000])
  })
})
