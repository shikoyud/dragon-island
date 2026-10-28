import { isValidAction } from '@wyrmhaven/game-core'
import { describe, expect, it } from 'vitest'
import { actionSchema, clientActionSchema } from '../src/actions'

const TEAM = ['d1', 'd2', 'd3']
const moves = [{ move: 0, target: 0 }]
const bot = { playerId: null, trophies: 0, level: 8, team: [1, 2, 3].map(() => ({ speciesId: 'nature', level: 1 })) }

// Same accepted set as game-core's isValidAction for every shape except pvpBattle.
const payloads: unknown[] = [
  { type: 'collectGold', habitatId: 'h1' },
  { type: 'collectGold', habitatId: '' },
  { type: 'buildHabitat', element: 'earth' },
  { type: 'buildHabitat', element: 'plasma' },
  { type: 'upgradeHabitat', habitatId: 'h1' },
  { type: 'moveDragon', dragonId: 'd1', habitatId: 'h2' },
  { type: 'feed', dragonId: 'd1' },
  { type: 'feed', dragonId: 1 },
  { type: 'sellDragon', dragonId: 'd1' },
  { type: 'buyFarmPlot' },
  { type: 'plant', plot: 0, crop: 'sprout' },
  { type: 'plant', plot: 0, crop: 'constructor' },
  { type: 'plant', plot: -1, crop: 'sprout' },
  { type: 'plant', plot: 0.5, crop: 'sprout' },
  { type: 'harvest', plot: 7 },
  { type: 'harvest', plot: Number.NaN },
  { type: 'startBreed', parentA: 'd1', parentB: 'd2' },
  { type: 'collectEgg', nest: 0 },
  { type: 'collectEgg', nest: '0' },
  { type: 'hatch', slot: 0 },
  { type: 'sellGold', gold: 100 },
  { type: 'sellGold', gold: '100' },
  { type: 'buy', item: { kind: 'foodPack' } },
  { type: 'buy', item: { kind: 'skip', target: 'nest', index: 0 } },
  { type: 'buy', item: { kind: 'skip', target: 'bank', index: 0 } },
  { type: 'buy', item: { kind: 'levelUp', dragonId: 7 } },
  { type: 'buy', item: { kind: 'x' } },
  { type: 'setDefenceTeam', dragonIds: TEAM },
  { type: 'setDefenceTeam', dragonIds: ['d1', 'd2'] },
  { type: 'pveBattle', stage: 1, team: TEAM, moves },
  { type: 'pveBattle', stage: 1.5, team: TEAM, moves },
  { type: 'pveBattle', stage: 1, team: TEAM, moves: [{ move: '0', target: 0 }] },
  { type: 'pveBattle', stage: 1, team: TEAM, moves: Array(91).fill({ move: 0, target: 0 }) },
  { type: 'nope' },
  null,
]

describe('actionSchema', () => {
  it('accepts exactly what game-core accepts', () => {
    for (const p of payloads) {
      expect(actionSchema.safeParse(p).success, JSON.stringify(p)).toBe(isValidAction(p))
    }
  })

  it('handles pvpBattle with a server-built opponent', () => {
    const full = { type: 'pvpBattle', team: TEAM, opponent: bot, moves }
    expect(actionSchema.safeParse(full).success).toBe(true)
    expect(isValidAction(full)).toBe(true)
    expect(actionSchema.safeParse({ ...full, opponent: { ...bot, team: bot.team.slice(0, 2) } }).success).toBe(false)
    expect(actionSchema.safeParse({ ...full, opponent: { ...bot, team: bot.team.map(d => ({ ...d, level: 31 })) } }).success).toBe(false)
  })
})

describe('clientActionSchema', () => {
  it('takes an offerId for pvpBattle and never an opponent', () => {
    expect(clientActionSchema.safeParse({ type: 'pvpBattle', offerId: 'abc', team: TEAM, moves }).success).toBe(true)
    expect(clientActionSchema.safeParse({ type: 'pvpBattle', team: TEAM, opponent: bot, moves }).success).toBe(false)
    expect(clientActionSchema.safeParse({ type: 'pvpBattle', offerId: '', team: TEAM, moves }).success).toBe(false)
    expect(clientActionSchema.safeParse({ type: 'collectGold', habitatId: 'h1' }).success).toBe(true)
  })
})
