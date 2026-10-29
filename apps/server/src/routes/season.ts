import { PRIZE, prizePoolWei } from '@wyrmhaven/game-core'
import type { LeaderboardResponse, PrizeInfo, PrizeResponse } from '@wyrmhaven/shared'
import { and, asc, eq, inArray } from 'drizzle-orm'
import type { FastifyInstance, FastifyRequest } from 'fastify'
import { getAddress } from 'viem'
import { z } from 'zod'
import type { AppDeps } from '../app'
import type { Db } from '../db/client'
import { actionLog, players, seasonPrizes } from '../db/schema'
import { AppError } from '../plugins/errors'
import { requireSession } from '../plugins/session'
import { seasonInflows } from '../services/inflows'
import { getSeasonById, getSeasonInfo, toSeasonInfo } from '../services/season'
import { playerRank, standings } from '../services/standings'

async function prizeOf(db: Db, seasonId: number, playerId: string): Promise<PrizeInfo | null> {
  const [p] = await db.select().from(seasonPrizes).where(and(eq(seasonPrizes.seasonId, seasonId), eq(seasonPrizes.playerId, playerId)))
  return p ? { wei: p.wei.toString(), tier: p.tier, rank: p.rank } : null
}

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

  /** Spec §12 standings: top 100 eligible players, the prize pool so far, and the caller's own rank when signed in. */
  app.get('/season/:id/leaderboard', async (req): Promise<LeaderboardResponse> => {
    const { id } = params.parse(req.params)
    const s = await getSeasonById(db, id)
    if (!s) throw new AppError(404, 'NOT_FOUND')
    const [{ totalWei }, top] = await Promise.all([seasonInflows(db, id), standings(db, id, PRIZE.topN)])
    const addresses = new Map((await db.select({ id: players.id, address: players.address }).from(players).where(inArray(players.id, top.map(t => t.playerId)))).map(r => [r.id, r.address]))
    const me = await optionalPlayer(req)
    return {
      seasonId: id,
      poolWei: prizePoolWei(totalWei).toString(),
      closed: s.closedAt !== null,
      top: top.map((t, i) => ({ rank: i + 1, playerId: t.playerId, address: getAddress(addresses.get(t.playerId)!), sp: t.sp })),
      ...(me ? { me: { ...(await playerRank(db, id, me.id)), prizeWei: (await prizeOf(db, id, me.id))?.wei ?? null } } : {}),
    }
  })

  app.get('/season/:id/prizes/me', { preHandler: requireSession(db, clock) }, async (req): Promise<PrizeResponse> => {
    const { id } = params.parse(req.params)
    return { prize: await prizeOf(db, id, req.player!.id) }
  })

  /** Session is optional on public routes: a bad or missing token means an anonymous caller. */
  const optionalPlayer = async (req: FastifyRequest) => {
    if (!req.headers.authorization) return null
    try {
      await requireSession(db, clock)(req, undefined as never)
      return req.player ?? null
    } catch {
      return null
    }
  }

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
