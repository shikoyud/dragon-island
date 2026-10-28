import type { Action } from '@wyrmhaven/game-core'
import { z } from 'zod'

// Mirrors game-core's isValidAction: the client sends JSON, this is the wire-level shape check.
const id = z.string().min(1)
const index = z.number().int().min(0)
const level = z.number().int().min(1).max(30)
const elementSchema = z.enum(['fire', 'water', 'earth', 'nature', 'electric', 'ice', 'metal', 'dark', 'light'])
const cropSchema = z.enum(['sprout', 'bushel', 'harvest', 'bounty'])

export const teamIdsSchema = z.tuple([id, id, id])
export const playerMoveSchema = z.object({ move: index, target: index })
const movesSchema = z.array(playerMoveSchema).max(90)

export const storeItemSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('skip'), target: z.enum(['nest', 'hatchery', 'farm']), index }),
  z.object({ kind: z.literal('nest') }),
  z.object({ kind: z.literal('foodPack') }),
  z.object({ kind: z.literal('levelUp'), dragonId: id }),
  z.object({ kind: z.literal('oddsBoost') }),
  z.object({ kind: z.literal('hoard') }),
])

export const opponentSnapshotSchema = z.object({
  playerId: id.nullable(),
  trophies: z.number().int(),
  level: z.number().int(),
  team: z.array(z.object({ speciesId: id, level })).length(3),
})

const common = [
  z.object({ type: z.literal('collectGold'), habitatId: id }),
  z.object({ type: z.literal('buildHabitat'), element: elementSchema }),
  z.object({ type: z.literal('upgradeHabitat'), habitatId: id }),
  z.object({ type: z.literal('moveDragon'), dragonId: id, habitatId: id }),
  z.object({ type: z.literal('feed'), dragonId: id }),
  z.object({ type: z.literal('sellDragon'), dragonId: id }),
  z.object({ type: z.literal('buyFarmPlot') }),
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
