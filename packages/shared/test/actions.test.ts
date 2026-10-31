import { ISLAND_TILES, isValidAction } from '@wyrmhaven/game-core'
import { describe, expect, it } from 'vitest'
import { actionSchema, clientActionSchema, storeItemSchema } from '../src/actions'

const TEAM = ['d1', 'd2', 'd3']
const PL = { island: 'home', col: 6, row: 7, facing: 0 }
const moves = [{ move: 0, target: 0 }]
const bot = { playerId: null, trophies: 0, level: 8, team: [1, 2, 3].map(() => ({ speciesId: 'nature', level: 1 })) }

// Same accepted set as game-core's isValidAction for every shape except pvpBattle.
const payloads: unknown[] = [
  { type: 'collectGold', habitatId: 'h1' },
  { type: 'collectGold', habitatId: '' },
  { type: 'claimGoal' },
  { type: 'claimGoal', goal: 3 },
  { type: 'placeBuilding', building: { kind: 'habitat', element: 'terra' }, placement: PL },
  { type: 'placeBuilding', building: { kind: 'habitat', element: 'war' }, placement: PL },
  { type: 'placeBuilding', building: { kind: 'habitat', element: 'fire' }, placement: PL },
  { type: 'placeBuilding', building: { kind: 'habitat', element: 'plasma' }, placement: PL },
  { type: 'placeBuilding', building: { kind: 'nexus' }, placement: { ...PL, island: 'isle6' } },
  { type: 'placeBuilding', building: { kind: 'farm' }, placement: { ...PL, island: 'isle9' } },
  { type: 'placeBuilding', building: { kind: 'farm' }, placement: { ...PL, col: 64 } },
  { type: 'placeBuilding', building: { kind: 'farm' }, placement: { ...PL, row: -1 } },
  { type: 'placeBuilding', building: { kind: 'farm' }, placement: { ...PL, facing: 4 } },
  { type: 'placeBuilding', building: { kind: 'decoration', decoration: 'moonwell' }, placement: PL },
  { type: 'placeBuilding', building: { kind: 'decoration', decoration: 'constructor' }, placement: PL },
  { type: 'placeBuilding', building: { kind: 'hatchery' }, placement: PL },
  { type: 'moveBuilding', target: { type: 'hoard' }, placement: PL },
  { type: 'moveBuilding', target: { type: 'decoration', id: 'dec1' }, placement: PL },
  { type: 'moveBuilding', target: { type: 'farm', index: 1 }, placement: PL },
  { type: 'moveBuilding', target: { type: 'breeder', index: -1 }, placement: PL },
  { type: 'moveBuilding', target: { type: 'breeder', index: 0 }, placement: PL },
  { type: 'moveBuilding', target: { type: 'nest', index: 0 }, placement: PL },
  { type: 'placeBuilding', building: { kind: 'grove' }, placement: PL },
  { type: 'placeBuilding', building: { kind: 'roost' }, placement: PL },
  { type: 'moveBuilding', target: { type: 'roost' }, placement: PL },
  { type: 'startUpgrade', building: { type: 'roost' } },
  { type: 'buy', item: { kind: 'ascension' } },
  { type: 'startUpgrade', building: { type: 'breeder', index: 0 } },
  { type: 'startUpgrade', building: { type: 'nest', index: 0 } },
  { type: 'moveBuilding', target: { type: 'habitat', id: '' }, placement: PL },
  { type: 'moveBuilding', target: { type: 'obstacle', id: 'o1' }, placement: PL },
  { type: 'removeDecoration', id: 'dec1' },
  { type: 'removeDecoration', id: '' },
  { type: 'startUpgrade', building: { type: 'hatchery' } },
  { type: 'startUpgrade', building: { type: 'habitat', id: 'h1' } },
  { type: 'startUpgrade', building: { type: 'hoard' } },
  { type: 'finishConstruction', index: 0 },
  { type: 'finishConstruction', index: -1 },
  { type: 'buyPlot', island: 'home', plot: 4 },
  { type: 'buyPlot', island: 'home', plot: 15 },
  { type: 'buyPlot', island: 'home', plot: 16 },
  { type: 'buyPlot', island: 'home', plot: -1 },
  { type: 'buyPlot', island: 'home', plot: 1.5 },
  { type: 'buyPlot', island: 'atlantis', plot: 4 },
  { type: 'buyBridge', island: 'isle2' },
  { type: 'buyBridge', island: 'home' },
  { type: 'buyBridge', island: 'atlantis' },
  { type: 'clearObstacle', obstacleId: 'o1' },
  { type: 'clearObstacle', obstacleId: 3 },
  { type: 'moveDragon', dragonId: 'd1', habitatId: 'h2' },
  { type: 'feed', dragonId: 'd1' },
  { type: 'feed', dragonId: 1 },
  { type: 'sellDragon', dragonId: 'd1' },
  { type: 'plant', plot: 0, crop: 'dragonBush' },
  { type: 'plant', plot: 0, crop: 'constructor' },
  { type: 'plant', plot: -1, crop: 'dragonBush' },
  { type: 'plant', plot: 0.5, crop: 'dragonBush' },
  { type: 'harvest', plot: 7 },
  { type: 'harvest', plot: Number.NaN },
  { type: 'startBreed', parentA: 'd1', parentB: 'd2' },
  { type: 'collectEgg', breeder: 0 },
  { type: 'collectEgg', breeder: '0' },
  { type: 'collectEgg', nest: 0 },
  { type: 'hatch', slot: 0 },
  { type: 'buyBasic', element: 'sea' },
  { type: 'buyBasic', element: 'aerie' },
  { type: 'buyBasic', element: 'plasma' },
  { type: 'buyBasic' },
  { type: 'sellGold', gold: 100 },
  { type: 'sellGold', gold: '100' },
  { type: 'buy', item: { kind: 'foodPack' } },
  { type: 'buy', item: { kind: 'habitatL5', habitatId: 'h1' } },
  { type: 'buy', item: { kind: 'habitatL5', habitatId: '' } },
  { type: 'buy', item: { kind: 'farmL5', index: 0 } },
  { type: 'buy', item: { kind: 'farmL5', index: -1 } },
  { type: 'plant', plot: 0, crop: 'sprout' },
  { type: 'buy', item: { kind: 'goldenAerie', placement: PL } },
  { type: 'buy', item: { kind: 'goldenAerie', placement: { ...PL, facing: 4 } } },
  { type: 'buy', item: { kind: 'goldenAerie' } },
  { type: 'buy', item: { kind: 'skip', target: 'breeder', index: 0 } },
  { type: 'buy', item: { kind: 'skip', target: 'nest', index: 0 } },
  { type: 'buy', item: { kind: 'hatcheryL5' } },
  { type: 'buy', item: { kind: 'groveL3', index: 1 } },
  { type: 'buy', item: { kind: 'groveL3', index: -1 } },
  { type: 'buy', item: { kind: 'groveL3' } },
  { type: 'buy', item: { kind: 'skip', target: 'construction', index: 1 } },
  { type: 'buy', item: { kind: 'skip', target: 'bank', index: 0 } },
  { type: 'buy', item: { kind: 'nest', placement: PL } },
  { type: 'buy', item: { kind: 'nest' } },
  { type: 'buy', item: { kind: 'hoard' } },
  { type: 'buy', item: { kind: 'hoard', placement: PL } },
  { type: 'buy', item: { kind: 'hoard', placement: { ...PL, col: 99 } } },
  { type: 'buy', item: { kind: 'levelUp', dragonId: 7 } },
  { type: 'buy', item: { kind: 'x' } },
  { type: 'useSpeedUp', token: '1h', target: 'breeder', index: 0 },
  { type: 'useSpeedUp', token: '2h', target: 'breeder', index: 0 },
  { type: 'useSpeedUp', token: '1h', target: 'bank', index: 0 },
  { type: 'useSpeedUp', token: '1h', target: 'farm', index: -1 },
  { type: 'useSpeedUp', token: 'constructor', target: 'farm', index: 0 },
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
    expect(actionSchema.safeParse({ ...full, opponent: { ...bot, team: bot.team.map(d => ({ ...d, level: 41 })) } }).success).toBe(false)
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

describe('land actions (§5.5)', () => {
  it('accepts a plot and a Bridge, and refuses what game-core refuses', () => {
    for (const schema of [actionSchema, clientActionSchema]) {
      expect(schema.safeParse({ type: 'buyPlot', island: 'home', plot: 15 }).success).toBe(true)
      expect(schema.safeParse({ type: 'buyBridge', island: 'isle2' }).success).toBe(true)
      expect(schema.safeParse({ type: 'buyPlot', island: 'home', plot: 16 }).success).toBe(false)
      expect(schema.safeParse({ type: 'buyPlot', island: 'atlantis', plot: 4 }).success).toBe(false)
      expect(schema.safeParse({ type: 'buyBridge', island: 'atlantis' }).success).toBe(false)
      expect(schema.safeParse({ type: 'buyBridge', island: 'home' }).success).toBe(false)
      expect(schema.safeParse({ type: 'expandIsland' }).success).toBe(false)
      expect(schema.safeParse({ type: 'unlockIsland' }).success).toBe(false)
    }
  })
})

describe('placement coordinates stop at the island edge', () => {
  it('accepts the last tile and refuses the first one past it, as isValidAction does', () => {
    for (const schema of [actionSchema, clientActionSchema]) {
      const at = (col: number, row: number) => ({ type: 'moveBuilding', target: { type: 'hatchery' }, placement: { ...PL, col, row } })
      expect(schema.safeParse(at(ISLAND_TILES - 1, ISLAND_TILES - 1)).success).toBe(true)
      expect(schema.safeParse(at(ISLAND_TILES, 0)).success).toBe(false)
      expect(schema.safeParse(at(0, ISLAND_TILES)).success).toBe(false)
    }
  })
})

describe('M0 teardown', () => {
  it('rejects sellGold, oddsBoost and hoard on the wire', () => {
    expect(clientActionSchema.safeParse({ type: 'sellGold', gold: 1 }).success).toBe(false)
    expect(storeItemSchema.safeParse({ kind: 'oddsBoost' }).success).toBe(false)
    expect(storeItemSchema.safeParse({ kind: 'hoard' }).success).toBe(false)
    expect(storeItemSchema.safeParse({ kind: 'foodPack' }).success).toBe(true)
    expect(storeItemSchema.safeParse({ kind: 'skip', target: 'breeder', index: 0 }).success).toBe(true)
    expect(storeItemSchema.safeParse({ kind: 'skip', target: 'nest', index: 0 }).success).toBe(false)
    expect(clientActionSchema.safeParse({ type: 'moveBuilding', target: { type: 'hoard' }, placement: PL }).success).toBe(false)
  })
})
