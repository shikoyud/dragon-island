import { eq, sql } from 'drizzle-orm'
import type { Db, Tx } from '../db/client'
import { balances, spendBatches } from '../db/schema'
import { AppError } from '../plugins/errors'

export type Balance = typeof balances.$inferSelect

/** All writes run inside the caller's transaction, after the player row is locked. */
export async function getBalance(db: Db | Tx, playerId: string): Promise<Balance> {
  const [b] = await db.select().from(balances).where(eq(balances.playerId, playerId))
  if (!b) throw new AppError(500, 'NO_BALANCE_ROW')
  return b
}

/** Store spend: debit the player and add to the UTC day's batch (50% of which the burn job burns). */
export async function charge(tx: Tx, playerId: string, wei: bigint, day: number, _reason: string): Promise<void> {
  const b = await getBalance(tx, playerId)
  if (wei > b.tokenWei) throw new AppError(402, 'INSUFFICIENT_TOKENS')
  await tx
    .update(balances)
    .set({ tokenWei: b.tokenWei - wei, spentWei: b.spentWei + wei, updatedAt: new Date() })
    .where(eq(balances.playerId, playerId))
  await tx
    .insert(spendBatches)
    .values({ day, spentWei: wei })
    .onConflictDoUpdate({ target: spendBatches.day, set: { spentWei: sql`${spendBatches.spentWei} + ${wei.toString()}::numeric` } })
}

/** Gold sell-back payouts and season prizes: forfeitable on ban. */
export async function creditEarned(tx: Tx, playerId: string, wei: bigint, _reason: string): Promise<void> {
  const b = await getBalance(tx, playerId)
  await tx
    .update(balances)
    .set({ tokenWei: b.tokenWei + wei, earnedWei: b.earnedWei + wei, updatedAt: new Date() })
    .where(eq(balances.playerId, playerId))
}

export async function creditDeposit(tx: Tx, playerId: string, wei: bigint, _txHash: string): Promise<void> {
  const b = await getBalance(tx, playerId)
  await tx
    .update(balances)
    .set({ tokenWei: b.tokenWei + wei, depositedWei: b.depositedWei + wei, updatedAt: new Date() })
    .where(eq(balances.playerId, playerId))
}

export async function debitForWithdrawal(tx: Tx, playerId: string, wei: bigint): Promise<void> {
  const b = await getBalance(tx, playerId)
  if (wei > b.tokenWei) throw new AppError(402, 'INSUFFICIENT_TOKENS')
  await tx
    .update(balances)
    .set({ tokenWei: b.tokenWei - wei, withdrawnWei: b.withdrawnWei + wei, updatedAt: new Date() })
    .where(eq(balances.playerId, playerId))
}

/** Reverses a withdrawal whose voucher expired unclaimed. */
export async function refundWithdrawal(tx: Tx, playerId: string, wei: bigint): Promise<void> {
  const b = await getBalance(tx, playerId)
  await tx
    .update(balances)
    .set({ tokenWei: b.tokenWei + wei, withdrawnWei: b.withdrawnWei - wei, updatedAt: new Date() })
    .where(eq(balances.playerId, playerId))
}
