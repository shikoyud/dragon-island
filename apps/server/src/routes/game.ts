import type { FastifyInstance } from 'fastify'
import type { AppDeps } from '../app'
import { gameInfo } from '../services/game'

/** Public: the clock, the preset and the commitment are what the page shows before anyone signs in. */
export function gameRoutes(app: FastifyInstance, deps: AppDeps): void {
  const { db, clock, config } = deps
  app.get('/game', async () => gameInfo(db, clock, config))
}
