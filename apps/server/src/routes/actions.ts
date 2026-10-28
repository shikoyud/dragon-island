import { clientActionSchema } from '@wyrmhaven/shared'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { AppDeps } from '../app'
import { PLAYER_LIMIT, rateLimit } from '../plugins/rateLimit'
import { requireSession } from '../plugins/session'
import { runAction, type ActionDeps } from '../services/actions'

const body = z.object({ action: clientActionSchema, idempotencyKey: z.string().min(1).max(128) })

export function actionRoutes(app: FastifyInstance, deps: AppDeps, actionDeps: ActionDeps): void {
  const { db, clock } = deps
  app.post('/actions', { preHandler: requireSession(db, clock) }, async (req, reply) => {
    const playerId = req.player!.id
    await rateLimit(db, `player:${playerId}`, PLAYER_LIMIT.limit, PLAYER_LIMIT.windowMs, clock)
    const parsed = body.parse(req.body)
    const { status, body: out } = await runAction(actionDeps, playerId, parsed)
    return reply.status(status).send(out)
  })
}
