import type { ReferralMeResponse } from '@wyrmhaven/shared'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { AppDeps } from '../app'
import { requireSession } from '../plugins/session'
import { requireActive } from '../services/bans'
import { claimReferral, referralSummary } from '../services/referrals'

const claimBody = z.object({ code: z.string().min(1).max(64) })

export function referralRoutes(app: FastifyInstance, deps: AppDeps): void {
  const { db, clock } = deps
  const opts = { preHandler: [requireSession(db, clock), requireActive] }

  app.get('/referral/me', opts, async (req): Promise<ReferralMeResponse> => {
    const s = await referralSummary(db, req.player!.id)
    return { ...s, earnedWei: s.earnedWei.toString() }
  })

  app.post('/referral/claim', opts, async req => {
    const { code } = claimBody.parse(req.body)
    await db.transaction(tx => claimReferral(tx, clock, req.player!.id, code))
    return { ok: true }
  })
}
