import { and, asc, eq } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { AppDeps } from '../app'
import { actionLog } from '../db/schema'
import { AppError } from '../plugins/errors'
import { requireSession } from '../plugins/session'
import { getSeasonById, getSeasonInfo, toSeasonInfo } from '../services/season'

const params = z.object({ id: z.coerce.number().int().positive() })
const query = z.object({ playerId: z.string().uuid() })

export function seasonRoutes(app: FastifyInstance, deps: AppDeps): void {
  const { db, clock } = deps

  app.get('/season', async () => getSeasonInfo(db, clock))

  app.get('/season/:id', async req => {
    const { id } = params.parse(req.params)
    const s = await getSeasonById(db, id)
    if (!s) throw new AppError(404, 'NOT_FOUND')
    return toSeasonInfo(s)
  })

  /** A player's own action log for a season, for re-verification after the secret is revealed. */
  app.get('/season/:id/actions', { preHandler: requireSession(db, clock) }, async req => {
    const { id } = params.parse(req.params)
    const { playerId } = query.parse(req.query)
    if (playerId !== req.player!.id) throw new AppError(403, 'FORBIDDEN')
    const rows = await db
      .select()
      .from(actionLog)
      .where(and(eq(actionLog.seasonId, id), eq(actionLog.playerId, playerId)))
      .orderBy(asc(actionLog.nonce))
    return {
      actions: rows.map(r => ({
        nonce: r.nonce.toString(),
        seedHex: r.seedHex,
        seedLabel: r.seedLabel,
        action: r.action,
        status: r.status,
        createdAtMs: r.createdAt.getTime(),
      })),
    }
  })
}
