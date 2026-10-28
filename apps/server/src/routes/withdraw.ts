import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { AppDeps } from '../app'
import { AppError } from '../plugins/errors'
import { PLAYER_LIMIT, rateLimit } from '../plugins/rateLimit'
import { requireSession } from '../plugins/session'
import { depositsRemaining } from '../services/bans'
import { getBalance } from '../services/ledger'
import { pendingVoucher, requestWithdrawal, type WithdrawDeps } from '../services/withdraw'

const body = z.object({ grossWei: z.string().regex(/^[0-9]+$/) })

export function withdrawRoutes(app: FastifyInstance, deps: AppDeps, withdrawDeps: WithdrawDeps | null): void {
  const { db, clock } = deps

  app.post('/withdraw', { preHandler: requireSession(db, clock) }, async req => {
    const playerId = req.player!.id
    await rateLimit(db, `player:${playerId}`, PLAYER_LIMIT.limit, PLAYER_LIMIT.windowMs, clock)
    if (!withdrawDeps) throw new AppError(503, 'WITHDRAWALS_DISABLED')
    const { grossWei } = body.parse(req.body)
    const wei = BigInt(grossWei)
    if (wei <= 0n) throw new AppError(400, 'INVALID_AMOUNT')
    // Spec §16: a banned player may withdraw only their own deposits, net of prior withdrawals.
    const maxAllowed = req.player!.bannedAt ? depositsRemaining(await getBalance(db, playerId)) : undefined
    return requestWithdrawal(withdrawDeps, playerId, wei, maxAllowed)
  })

  app.get('/withdraw/pending', { preHandler: requireSession(db, clock) }, async req => pendingVoucher(db, req.player!.id))
}
