import { describe, expect, it } from 'vitest'
import { getSpecies } from '../src/catalog'
import { generateBot, generateBotTeam, pickOpponents, type OpponentSnapshot, type Seeker } from '../src/matchmaking'
import { createRng } from '../src/rng'
import { FIXTURE_CATALOG as C } from './fixtures'

const me: Seeker = { trophies: 50, level: 8, teamLevel: 6 }
const cand = (playerId: string, trophies: number, level: number): OpponentSnapshot =>
  ({ playerId, trophies, level, team: [{ speciesId: 'flame', level: 5 }, { speciesId: 'sea', level: 5 }, { speciesId: 'ice', level: 5 }] })

describe('generateBotTeam', () => {
  it('picks common or rare non-recipe species at the clamped level', () => {
    const team = generateBotTeam(40, C, createRng(1))
    expect(team).toHaveLength(3)
    for (const d of team) {
      expect(d.level).toBe(40)
      const sp = getSpecies(C, d.speciesId)
      expect(sp.recipeOnly).toBe(false)
      expect(['common', 'rare']).toContain(sp.rarity)
    }
    expect(generateBotTeam(0, C, createRng(1))[0]!.level).toBe(1)
  })
})

describe('generateBot', () => {
  it('matches the seeker’s level and sits within ±100 trophies', () => {
    const bot = generateBot(me, C, createRng(2))
    expect(bot.playerId).toBeNull()
    expect(bot.level).toBe(8)
    expect(bot.trophies).toBeGreaterThanOrEqual(0)
    expect(bot.trophies).toBeLessThanOrEqual(150)
    expect(bot.team.every(d => d.level === 6)).toBe(true)
  })
})

describe('pickOpponents', () => {
  const eligible = [cand('a', 0, 8), cand('b', 150, 3), cand('c', 50, 13), cand('d', 149, 10), cand('e', 10, 5)]
  const ineligible = [cand('far', 151, 8), cand('low', 50, 2)]

  it('offers three distinct eligible players when enough exist', () => {
    const picks = pickOpponents(me, [...ineligible, ...eligible], C, createRng(3))
    expect(picks).toHaveLength(3)
    const ids = picks.map(p => p.playerId)
    expect(new Set(ids).size).toBe(3)
    for (const id of ids) expect(['a', 'b', 'c', 'd', 'e']).toContain(id)
  })

  it('fills with bots when few or none are eligible', () => {
    const one = pickOpponents(me, [eligible[0]!, ...ineligible], C, createRng(4))
    expect(one.map(p => p.playerId)).toEqual(['a', null, null])
    const none = pickOpponents(me, ineligible, C, createRng(5))
    expect(none.map(p => p.playerId)).toEqual([null, null, null])
  })

  it('is deterministic and does not mutate candidates', () => {
    const input = [...eligible]
    expect(pickOpponents(me, input, C, createRng(6))).toEqual(pickOpponents(me, input, C, createRng(6)))
    expect(input).toEqual(eligible)
  })
})
