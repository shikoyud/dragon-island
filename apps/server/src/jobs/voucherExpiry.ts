import { and, eq, isNull, lt } from 'drizzle-orm'
import type { Address } from 'viem'
import type { ChainClient } from '../chain/client'
import type { Clock } from '../clock'
import type { Db } from '../db/client'
import { players, vouchers } from '../db/schema'
import { refundWithdrawal } from '../services/ledger'

/** Grace after the on-chain deadline so a claim mined at the last second is indexed before we refund. */
export const VOUCHER_GRACE_MS = 10 * 60_000

/**
 * Re-credits vouchers that passed their deadline (plus grace) without being claimed. Before refunding,
 * the chain is asked whether the player's cumulative total already covers the voucher: if it does, the
 * claim simply has not been indexed yet, and the voucher is marked claimed instead. Returns refunds made.
 */
export async function expireVouchers(deps: { db: Db; clock: Clock; chain: ChainClient }): Promise<number> {
  const { db, clock, chain } = deps
  const cutoff = new Date(clock() - VOUCHER_GRACE_MS)
  const stale = await db
    .select({ id: vouchers.id, playerId: vouchers.playerId, cumulative: vouchers.cumulativeWei, address: players.address })
    .from(vouchers)
    .innerJoin(players, eq(players.id, vouchers.playerId))
    .where(and(isNull(vouchers.claimedAt), isNull(vouchers.expiredAt), lt(vouchers.deadlineAt, cutoff)))
  let expired = 0
  for (const { id, playerId, cumulative, address } of stale) {
    const paid = await chain.claimed(address as Address) // outside the lock: an RPC call
    await db.transaction(async tx => {
      await tx.select({ id: players.id }).from(players).where(eq(players.id, playerId)).for('update')
      const [v] = await tx.select().from(vouchers).where(eq(vouchers.id, id)).for('update')
      if (!v || v.claimedAt || v.expiredAt) return
      if (paid >= cumulative) {
        await tx.update(vouchers).set({ claimedAt: new Date(clock()) }).where(eq(vouchers.id, id))
        return
      }
      await tx.update(vouchers).set({ expiredAt: new Date(clock()) }).where(eq(vouchers.id, id))
      await refundWithdrawal(tx, playerId, v.grossWei)
      expired++
    })
  }
  return expired
}
