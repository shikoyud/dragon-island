import { newPlayer, type PlayerState } from '@wyrmhaven/game-core'
import { eq } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { getAddress } from 'viem'
import { z } from 'zod'
import type { AppDeps } from '../app'
import { balances, players } from '../db/schema'
import { AppError } from '../plugins/errors'

const grantBody = z.object({
  address: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  tokenWei: z.string().regex(/^[0-9]+$/).optional(),
  earningUnlocked: z.boolean().optional(),
  /** Shallow patch merged over the stored PlayerState (level, dragons, food, gold, …). */
  state: z.record(z.string(), z.unknown()).optional(),
})

/**
 * Test-only setup route, registered only when E2E=1: creates the player if needed and grants
 * tokens / earning / state. Never mounted in a normal server.
 */
export function e2eRoutes(app: FastifyInstance, deps: AppDeps): void {
  const { db, clock } = deps
  app.post('/e2e/grant', async req => {
    const body = grantBody.parse(req.body)
    const address = getAddress(body.address).toLowerCase()
    const id = await db.transaction(async tx => {
      let [p] = await tx.select().from(players).where(eq(players.address, address))
      if (!p) {
        ;[p] = await tx.insert(players).values({ address, state: newPlayer(clock()) }).returning()
        await tx.insert(balances).values({ playerId: p!.id })
      }
      if (!p) throw new AppError(500, 'E2E_GRANT_FAILED')
      const state = { ...(p.state as PlayerState), ...(body.state ?? {}) } as PlayerState
      await tx.update(players).set({
        state,
        level: state.level,
        trophies: state.trophies,
        defenceTeam: state.defenceTeam,
        ...(body.earningUnlocked !== undefined ? { earningUnlocked: body.earningUnlocked } : {}),
      }).where(eq(players.id, p.id))
      if (body.tokenWei) await tx.update(balances).set({ tokenWei: BigInt(body.tokenWei) }).where(eq(balances.playerId, p.id))
      return p.id
    })
    return { playerId: id }
  })
}
