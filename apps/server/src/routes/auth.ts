import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { AppDeps } from '../app'
import { AUTH_LIMIT, rateLimit } from '../plugins/rateLimit'
import { requireSession } from '../plugins/session'
import { issueNonce, logout, originHash, verifyAndLogin } from '../services/auth'

const verifyBody = z.object({ message: z.string().min(1), signature: z.string().regex(/^0x[0-9a-fA-F]+$/), termsVersion: z.string().max(64).optional() })

export function authRoutes(app: FastifyInstance, deps: AppDeps): void {
  const { db, clock, config } = deps
  const perIp = async (ip: string) => rateLimit(db, `auth:${ip}`, AUTH_LIMIT.limit, AUTH_LIMIT.windowMs, clock)

  app.get('/auth/nonce', async req => {
    await perIp(req.ip)
    return { nonce: await issueNonce(db, clock) }
  })

  app.post('/auth/verify', async req => {
    await perIp(req.ip)
    const body = verifyBody.parse(req.body)
    const device = req.headers['x-device-id']
    const origin = { ipHash: originHash(config.SESSION_SECRET, req.ip), deviceHash: originHash(config.SESSION_SECRET, typeof device === 'string' ? device.slice(0, 128) : null) }
    return verifyAndLogin(db, clock, config, body.message, body.signature as `0x${string}`, origin, body.termsVersion)
  })

  app.post('/auth/logout', { preHandler: requireSession(db, clock) }, async (req, reply) => {
    await logout(db, req.sessionToken!)
    return reply.status(204).send()
  })
}
