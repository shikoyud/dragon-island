import type { FastifyInstance } from 'fastify'
import type { AppDeps } from '../app'
import { PLAYER_LIMIT, rateLimit } from '../plugins/rateLimit'
import { requireSession } from '../plugins/session'
import { createOffers } from '../services/battles'

export function pvpRoutes(app: FastifyInstance, deps: AppDeps): void {
  const { db, clock } = deps
  app.get('/pvp/offers', { preHandler: requireSession(db, clock) }, async req => {
    await rateLimit(db, `player:${req.player!.id}`, PLAYER_LIMIT.limit, PLAYER_LIMIT.windowMs, clock)
    return { offers: await createOffers({ db, clock, catalog: deps.catalog! }, req.player!) }
  })
}
