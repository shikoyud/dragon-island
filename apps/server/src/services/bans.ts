import { eq } from 'drizzle-orm'
import type { FastifyReply, FastifyRequest } from 'fastify'
import type { Clock } from '../clock'
import type { Db } from '../db/client'
import { balances, players, sessions } from '../db/schema'
import { AppError } from '../plugins/errors'

/**
 * Spec §16: a banned account forfeits earned balances but may still withdraw its own
 * deposits. Forfeit = the earned share of the live balance; sessions are revoked so play stops now.
 */
export async function banPlayer(db: Db, clock: Clock, playerId: string, reason: string): Promise<void> {
  await db.transaction(async tx => {
    const [p] = await tx.select().from(players).where(eq(players.id, playerId)).for('update')
    if (!p) throw new AppError(404, 'NOT_FOUND')
    const [b] = await tx.select().from(balances).where(eq(balances.playerId, playerId)).for('update')
    if (b) {
      const forfeit = b.earnedWei < b.tokenWei ? b.earnedWei : b.tokenWei
      await tx
        .update(balances)
        .set({ tokenWei: b.tokenWei - forfeit, earnedWei: 0n, updatedAt: new Date(clock()) })
        .where(eq(balances.playerId, playerId))
    }
    await tx.update(players).set({ bannedAt: new Date(clock()), banReason: reason }).where(eq(players.id, playerId))
    await tx.delete(sessions).where(eq(sessions.playerId, playerId))
  })
}

export async function unbanPlayer(db: Db, playerId: string): Promise<void> {
  const updated = await db.update(players).set({ bannedAt: null, banReason: null }).where(eq(players.id, playerId)).returning({ id: players.id })
  if (updated.length === 0) throw new AppError(404, 'NOT_FOUND')
}

/** preHandler after requireSession: banned players may only use /me and the withdrawal routes. */
export async function requireActive(req: FastifyRequest, _reply: FastifyReply): Promise<void> {
  if (req.player?.bannedAt) throw new AppError(403, 'BANNED')
}

/** What a banned player may still withdraw: their own deposits net of prior withdrawals. */
export const depositsRemaining = (b: { depositedWei: bigint; withdrawnWei: bigint }): bigint =>
  b.depositedWei > b.withdrawnWei ? b.depositedWei - b.withdrawnWei : 0n
