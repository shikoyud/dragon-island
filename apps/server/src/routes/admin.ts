import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import type { AppDeps } from '../app'
import { AppError } from '../plugins/errors'
import { banPlayer, unbanPlayer } from '../services/bans'
import { setManualPrice } from '../services/price'
import { revealSecret } from '../services/season'

export type JobRegistry = Record<string, () => Promise<unknown>>

const banBody = z.object({ playerId: z.string().uuid(), reason: z.string().min(1).max(500) })
const unbanBody = z.object({ playerId: z.string().uuid() })
const priceBody = z.object({ microUsdPerToken: z.string().regex(/^[0-9]+$/) })
const idParam = z.object({ id: z.coerce.number().int().positive() })
const jobParam = z.object({ name: z.string().min(1) })

export function adminRoutes(app: FastifyInstance, deps: AppDeps, jobs: JobRegistry): void {
  const { db, clock, config } = deps
  const requireAdmin = async (req: FastifyRequest, _reply: FastifyReply) => {
    if (req.headers['x-admin-token'] !== config.ADMIN_TOKEN) throw new AppError(401, 'UNAUTHORIZED')
  }
  const opts = { preHandler: requireAdmin }

  app.post('/admin/ban', opts, async req => {
    const { playerId, reason } = banBody.parse(req.body)
    await banPlayer(db, clock, playerId, reason)
    return { ok: true }
  })

  app.post('/admin/unban', opts, async req => {
    await unbanPlayer(db, unbanBody.parse(req.body).playerId)
    return { ok: true }
  })

  app.post('/admin/price', opts, async req => {
    const price = BigInt(priceBody.parse(req.body).microUsdPerToken)
    if (price <= 0n) throw new AppError(400, 'INVALID_AMOUNT')
    await setManualPrice(db, price)
    return { ok: true, microUsdPerToken: price.toString() }
  })

  app.post('/admin/season/:id/reveal', opts, async req => {
    const { id } = idParam.parse(req.params)
    return { seasonId: id, secret: await revealSecret(db, clock, id) }
  })

  app.post('/admin/jobs/:name/run', opts, async req => {
    const { name } = jobParam.parse(req.params)
    const job = jobs[name]
    if (!job) throw new AppError(404, 'NOT_FOUND')
    return { job: name, result: await job() }
  })
}
