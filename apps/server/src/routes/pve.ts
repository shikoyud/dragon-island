import type { PveSeedResponse } from '@wyrmhaven/shared'
import type { FastifyInstance } from 'fastify'
import type { AppDeps } from '../app'
import { AppError } from '../plugins/errors'
import { PLAYER_LIMIT, rateLimit } from '../plugins/rateLimit'
import { requireSession } from '../plugins/session'
import { ensureGame } from '../services/game'
import { pveSeedLabel } from '../services/actions'
import { battleSeed, secretFromHex } from '../services/seed'
import { migrateState } from '../services/stateMigration'

export function pveRoutes(app: FastifyInstance, deps: AppDeps): void {
  const { db, clock } = deps
  /** A8, R69: the seed of the active Trial and no other, readable only once the Trial is frozen. */
  app.get('/pve/seed', { preHandler: requireSession(db, clock) }, async (req): Promise<PveSeedResponse> => {
    const player = req.player!
    await rateLimit(db, `player:${player.id}`, PLAYER_LIMIT.limit, PLAYER_LIMIT.windowMs, clock)
    const active = migrateState(player.state, clock(), () => deps.onStateReset?.(player.id)).pve.active
    if (!active) throw new AppError(409, 'NO_ACTIVE_TRIAL')
    const game = await ensureGame(db, clock)
    return { seedHex: battleSeed(secretFromHex(game.secretHex), pveSeedLabel(player.id, active.index)).seedHex }
  })
}
