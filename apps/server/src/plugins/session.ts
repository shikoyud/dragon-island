import { and, eq, gt } from 'drizzle-orm'
import type { FastifyReply, FastifyRequest } from 'fastify'
import type { Clock } from '../clock'
import type { Db } from '../db/client'
import { players, sessions } from '../db/schema'
import { AppError } from './errors'

export type PlayerRow = typeof players.$inferSelect

declare module 'fastify' {
  interface FastifyRequest {
    player?: PlayerRow
    sessionToken?: string
  }
}

/** preHandler: resolves `Authorization: Bearer <token>` to the player row or throws 401. */
export function requireSession(db: Db, clock: Clock) {
  return async (req: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    const header = req.headers.authorization ?? ''
    const token = header.startsWith('Bearer ') ? header.slice(7) : ''
    if (!token) throw new AppError(401, 'UNAUTHORIZED')
    const [row] = await db
      .select({ player: players })
      .from(sessions)
      .innerJoin(players, eq(players.id, sessions.playerId))
      .where(and(eq(sessions.token, token), gt(sessions.expiresAt, new Date(clock()))))
    if (!row) throw new AppError(401, 'UNAUTHORIZED')
    req.player = row.player
    req.sessionToken = token
  }
}
