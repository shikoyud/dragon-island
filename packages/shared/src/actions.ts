import { CROP_IDS, DECORATIONS, ELEMENTS, ISLAND_ORDER, ISLAND_TILES, KIT_SIZE, MAX_BATTLE_MOVES, MAX_DRAGON_LEVEL, NODES_PER_CHAPTER, PLOTS_PER_SIDE, TEAM_SIZE, TRIAL_CHAPTERS, type Action, type CropId, type DecorationId, type Element, type IslandId } from '@wyrmhaven/game-core'
import { z } from 'zod'

// Mirrors game-core's isValidAction: the client sends JSON, this is the wire-level shape check.
const id = z.string().min(1)
const index = z.number().int().min(0)
const level = z.number().int().min(1).max(MAX_DRAGON_LEVEL)
const elementSchema = z.enum(ELEMENTS as unknown as [Element, ...Element[]])
const coord = z.number().int().min(0).max(ISLAND_TILES - 1)
const decorationSchema = z.custom<DecorationId>(v => typeof v === 'string' && Object.hasOwn(DECORATIONS, v))
const cropSchema = z.enum(CROP_IDS as [CropId, ...CropId[]])

const islandSchema = z.enum(ISLAND_ORDER as unknown as [IslandId, ...IslandId[]])
const bridgeIslandSchema = islandSchema.exclude(['home'])

export const placementSchema = z.object({
  island: islandSchema,
  col: coord,
  row: coord,
  facing: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
})
const placeableSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('habitat'), element: elementSchema }),
  z.object({ kind: z.literal('farm') }),
  z.object({ kind: z.literal('grove') }),
  z.object({ kind: z.literal('roost') }),
  z.object({ kind: z.literal('decoration'), decoration: decorationSchema }),
])
const buildingRefSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('habitat'), id }),
  z.object({ type: z.literal('farm'), index }),
  z.object({ type: z.literal('breeder'), index }),
  z.object({ type: z.literal('hatchery') }),
  z.object({ type: z.literal('roost') }),
])
const movableRefSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('habitat'), id }),
  z.object({ type: z.literal('farm'), index }),
  z.object({ type: z.literal('breeder'), index }),
  z.object({ type: z.literal('hatchery') }),
  z.object({ type: z.literal('roost') }),
  z.object({ type: z.literal('decoration'), id }),
])

export const teamIdsSchema = z.tuple([id, id, id])
const teamSlot = index.max(TEAM_SIZE - 1)
export const playerMoveSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('attack'), move: index.max(KIT_SIZE - 1) }),
  z.object({ kind: z.literal('swap'), to: teamSlot }),
  z.object({ kind: z.literal('replace'), to: teamSlot }),
])
const movesSchema = z.array(playerMoveSchema).max(MAX_BATTLE_MOVES)

export const storeItemSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('skip'), target: z.enum(['breeder', 'hatchery', 'farm', 'construction']), index }),
  z.object({ kind: z.literal('foodPack') }),
  z.object({ kind: z.literal('habitatL5'), habitatId: id }),
  z.object({ kind: z.literal('farmL5'), index }),
  z.object({ kind: z.literal('goldenAerie'), placement: placementSchema }),
  z.object({ kind: z.literal('hatcheryL5') }),
  z.object({ kind: z.literal('groveL3'), index }),
  z.object({ kind: z.literal('ascension') }),
  z.object({ kind: z.literal('healAll') }),
])

export const opponentSnapshotSchema = z.object({
  playerId: id.nullable(),
  trophies: z.number().int(),
  level: z.number().int(),
  team: z.array(z.object({ speciesId: id, level })).length(3),
})

const common = [
  z.object({ type: z.literal('collectGold'), habitatId: id }),
  z.object({ type: z.literal('claimGoal') }),
  z.object({ type: z.literal('placeBuilding'), building: placeableSchema, placement: placementSchema }),
  z.object({ type: z.literal('moveBuilding'), target: movableRefSchema, placement: placementSchema }),
  z.object({ type: z.literal('removeDecoration'), id }),
  z.object({ type: z.literal('startUpgrade'), building: buildingRefSchema }),
  z.object({ type: z.literal('finishConstruction'), index }),
  z.object({ type: z.literal('buyPlot'), island: islandSchema, plot: z.number().int().min(0).max(PLOTS_PER_SIDE * PLOTS_PER_SIDE - 1) }),
  z.object({ type: z.literal('buyBridge'), island: bridgeIslandSchema }),
  z.object({ type: z.literal('clearObstacle'), obstacleId: id }),
  z.object({ type: z.literal('moveDragon'), dragonId: id, habitatId: id }),
  z.object({ type: z.literal('feed'), dragonId: id }),
  z.object({ type: z.literal('sellDragon'), dragonId: id }),
  z.object({ type: z.literal('plant'), plot: index, crop: cropSchema }),
  z.object({ type: z.literal('harvest'), plot: index }),
  z.object({ type: z.literal('startBreed'), parentA: id, parentB: id }),
  z.object({ type: z.literal('collectEgg'), breeder: index }),
  z.object({ type: z.literal('hatch'), slot: index }),
  z.object({ type: z.literal('buyBasic'), element: elementSchema }),
  z.object({ type: z.literal('buy'), item: storeItemSchema }),
  z.object({ type: z.literal('useSpeedUp'), token: z.enum(['15m', '1h', '3h']), target: z.enum(['breeder', 'hatchery', 'farm', 'construction']), index }),
  z.object({ type: z.literal('setDefenceTeam'), dragonIds: teamIdsSchema }),
  z.object({ type: z.literal('startTrial'), chapter: z.number().int().min(1).max(TRIAL_CHAPTERS.length), node: z.number().int().min(1).max(NODES_PER_CHAPTER), team: teamIdsSchema }),
  z.object({ type: z.literal('finishTrial'), moves: movesSchema, index: index.optional() }),
  z.object({ type: z.literal('abandonTrial'), index: index.optional() }),
] as const

/** The full game-core Action, including the server-built pvpBattle opponent. */
export const actionSchema: z.ZodType<Action> = z.discriminatedUnion('type', [
  ...common,
  z.object({ type: z.literal('pvpBattle'), team: teamIdsSchema, opponent: opponentSnapshotSchema, moves: movesSchema }),
]) as unknown as z.ZodType<Action>

/** What clients may send: pvpBattle names a stored offer instead of carrying an opponent. */
export const clientActionSchema = z.discriminatedUnion('type', [
  ...common,
  z.object({ type: z.literal('pvpBattle'), offerId: id, team: teamIdsSchema, moves: movesSchema }),
])

export type ClientAction = z.infer<typeof clientActionSchema>
