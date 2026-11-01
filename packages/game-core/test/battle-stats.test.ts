import { describe, expect, it } from 'vitest'
import { combatStats } from '../src/battle/stats'
import { FIXTURE_CATALOG as C } from './fixtures'

describe('combatStats', () => {
  it('takes HP and ATK from the §2.4 rarity curve', () => {
    expect(combatStats({ speciesId: 'flame', level: 10 }, C)).toEqual({ hp: 3077, atk: 1231 })
    expect(combatStats({ speciesId: 'fw-legend', level: 30 }, C)).toEqual({ hp: 11128, atk: 4451 })
    expect(combatStats({ speciesId: 'fw-rare', level: 1 }, C)).toEqual({ hp: 2000, atk: 800 })
  })
})
