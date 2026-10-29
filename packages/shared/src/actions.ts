import { DECORATIONS, ISLAND_ORDER, type Action, type DecorationId, type IslandId } from '@wyrmhaven/game-core'
import { z } from 'zod'

// Mirrors game-core's isValidAction: the client sends JSON, this is the wire-level shape check.
const id = z.string().min(1)
const index = z.number().int().min(0)
const level = z.number().int().min(1).max(30)
const elementSchema = z.enum(['fire', 'water', 'earth', 'nature', 'electric', 'ice', 'metal', 'dark', 'light'])
const coord = z.number().int().min(0).max(63)
const decorationSchema = z.custom<DecorationId>(v => typeof v === 'string' && Object.hasOwn(DECORATIONS, v))
const cropSchema = z.enum(['sprout', 'bushel', 'harvest', 'bounty'])

export const placementSchema = z.object({
  island: z.enum(ISLAND_ORDER as unknown as [IslandId, ...IslandId[]]),
  col: coord,
  row: coord,
  facing: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
})
const placeableSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('habitat'), element: elementSchema }),
  z.object({ kind: z.literal('nexus') }),
  z.object({ kind: z.literal('farm') }),
  z.object({ kind: z.literal('decoration'), decoration: decorationSchema }),
])
const buildingRefSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('habitat'), id }),
  z.object({ type: z.literal('farm'), index }),
  z.object({ type: z.literal('nest'), index }),
  z.object({ type: z.literal('hatchery') }),
])
const movableRefSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('habitat'), id }),
  z.object({ type: z.literal('farm'), index }),
  z.object({ type: z.literal('nest'), index }),
  z.object({ type: z.literal('hatchery') }),
  z.object({ type: z.literal('hoard') }),
  z.object({ type: z.literal('decoration'), id }),
])

export const teamIdsSchema = z.tuple([id, id, id])
export const playerMoveSchema = z.object({ move: index, target: index })
const movesSchema = z.array(playerMoveSchema).max(90)

export const storeItemSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('skip'), target: z.enum(['nest', 'hatchery', 'farm', 'construction']), index }),
  z.object({ kind: z.literal('nest'), placement: placementSchema }),
  z.object({ kind: z.literal('foodPack') }),
  z.object({ kind: z.literal('levelUp'), dragonId: id }),
  z.object({ kind: z.literal('oddsBoost') }),
  z.object({ kind: z.literal('hoard'), placement: placementSchema.optional() }),
])

export const opponentSnapshotSchema = z.object({
  playerId: id.nullable(),
  trophies: z.number().int(),
  level: z.number().int(),
  team: z.array(z.object({ speciesId: id, level })).length(3),
})

const common = [
  z.object({ type: z.literal('collectGold'), habitatId: id }),
  z.object({ type: z.literal('placeBuilding'), building: placeableSchema, placement: placementSchema }),
  z.object({ type: z.literal('moveBuilding'), target: movableRefSchema, placement: placementSchema }),
  z.object({ type: z.literal('removeDecoration'), id }),
  z.object({ type: z.literal('startUpgrade'), building: buildingRefSchema }),
  z.object({ type: z.literal('finishConstruction'), index }),
  z.object({ type: z.literal('expandIsland') }),
  z.object({ type: z.literal('unlockIsland') }),
  z.object({ type: z.literal('clearObstacle'), obstacleId: id }),
  z.object({ type: z.literal('moveDragon'), dragonId: id, habitatId: id }),
  z.object({ type: z.literal('feed'), dragonId: id }),
  z.object({ type: z.literal('sellDragon'), dragonId: id }),
  z.object({ type: z.literal('plant'), plot: index, crop: cropSchema }),
  z.object({ type: z.literal('harvest'), plot: index }),
  z.object({ type: z.literal('startBreed'), parentA: id, parentB: id }),
  z.object({ type: z.literal('collectEgg'), nest: index }),
  z.object({ type: z.literal('hatch'), slot: index }),
  z.object({ type: z.literal('sellGold'), gold: z.number() }),
  z.object({ type: z.literal('buy'), item: storeItemSchema }),
  z.object({ type: z.literal('setDefenceTeam'), dragonIds: teamIdsSchema }),
  z.object({ type: z.literal('pveBattle'), stage: z.number().int(), team: teamIdsSchema, moves: movesSchema }),
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
