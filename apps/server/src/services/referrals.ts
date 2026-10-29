import { and, eq, like, ne, or, sql } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import type { Clock } from '../clock'
import type { Db, Tx } from '../db/client'
import { players, referralPayouts, signInOrigins } from '../db/schema'
import { AppError } from '../plugins/errors'
import { creditEarned, getBalance } from './ledger'

/** Spec §16: the referrer earns 5% of a referred player's token spend. */
export const REFERRAL_BPS = 500n

/** A player's referral code: the first 8 hex chars of their id. Lookup is by prefix; a collision is NOT_FOUND. */
export function referralCode(playerId: string): string {
  return playerId.replace(/-/g, '').slice(0, 8).toLowerCase()
}

/**
 * Sets `players.referrer_id` once, before the player's first purchase, and never for a referrer who
 * signed in from the same IP or device (hashes compared; a missing hash never matches).
 */
export async function claimReferral(tx: Tx, clock: Clock, playerId: string, code: string): Promise<void> {
  const normalized = code.trim().toLowerCase()
  if (!/^[0-9a-f]{8}$/.test(normalized)) throw new AppError(404, 'NOT_FOUND')
  const candidates = await tx
    .select({ id: players.id, ipHash: players.ipHash, deviceHash: players.deviceHash })
    .from(players)
    .where(like(sql`replace(${players.id}::text, '-', '')`, `${normalized}%`))
    .limit(2)
  if (candidates.length !== 1) throw new AppError(404, 'NOT_FOUND')
  const referrer = candidates[0]!
  if (referrer.id === playerId) throw new AppError(409, 'REFERRAL_SELF')

  const [me] = await tx.select().from(players).where(eq(players.id, playerId)).for('update')
  if (!me) throw new AppError(401, 'UNAUTHORIZED')
  if (me.referrerId) throw new AppError(409, 'REFERRAL_ALREADY_SET')
  const balance = await getBalance(tx, playerId)
  if (balance.spentWei > 0n) throw new AppError(409, 'REFERRAL_AFTER_SPEND')
  if (await originsOverlap(tx, playerId, referrer.id)) throw new AppError(403, 'REFERRAL_SAME_DEVICE')

  await tx.update(players).set({ referrerId: referrer.id, updatedAt: new Date(clock()) }).where(eq(players.id, playerId))
}

/** True when the two players have ever signed in from the same IP or the same device (unknown values never match). */
export async function originsOverlap(tx: Db | Tx, a: string, b: string): Promise<boolean> {
  const x = alias(signInOrigins, 'x')
  const y = alias(signInOrigins, 'y')
  const [row] = await tx
    .select({ n: sql<number>`count(*)::int` })
    .from(x)
    .innerJoin(y, or(
      and(ne(x.ipHash, ''), eq(x.ipHash, y.ipHash)),
      and(ne(x.deviceHash, ''), eq(x.deviceHash, y.deviceHash)),
    ))
    .where(and(eq(x.playerId, a), eq(y.playerId, b)))
  return Number(row?.n ?? 0) > 0
}

/**
 * Called by `charge`: pays the referrer their share of `spendWei` (idempotent on `ref`) and returns
 * the wei paid, which the caller takes out of the vault's share. 0 without a referrer.
 */
export async function payReferral(tx: Tx, clock: Clock, playerId: string, spendWei: bigint, ref: string): Promise<bigint> {
  const [me] = await tx.select({ referrerId: players.referrerId }).from(players).where(eq(players.id, playerId))
  if (!me?.referrerId) return 0n
  const wei = (spendWei * REFERRAL_BPS) / 10_000n
  if (wei <= 0n) return 0n
  // Spec §16: banned accounts forfeit earnings, and a shared IP or device (even one seen later) pays nothing.
  const [referrer] = await tx.select({ bannedAt: players.bannedAt }).from(players).where(eq(players.id, me.referrerId))
  if (!referrer || referrer.bannedAt) return 0n
  if (await originsOverlap(tx, playerId, me.referrerId)) return 0n
  const inserted = await tx
    .insert(referralPayouts)
    .values({ referrerId: me.referrerId, referredId: playerId, wei, ref, createdAt: new Date(clock()) })
    .onConflictDoNothing({ target: referralPayouts.ref })
    .returning({ id: referralPayouts.id })
  if (inserted.length === 0) return 0n
  await tx.select({ id: players.id }).from(players).where(eq(players.id, me.referrerId)).for('update')
  await creditEarned(tx, me.referrerId, wei, `referral:${playerId}`)
  return wei
}

export async function referralSummary(db: Db | Tx, playerId: string): Promise<{ code: string; referredCount: number; earnedWei: bigint; referrer: boolean }> {
  const [me] = await db.select({ referrerId: players.referrerId }).from(players).where(eq(players.id, playerId))
  const [count] = await db.select({ n: sql<number>`count(*)::int` }).from(players).where(eq(players.referrerId, playerId))
  const [earned] = await db.select({ sum: sql<string>`coalesce(sum(${referralPayouts.wei}), 0)::text` }).from(referralPayouts).where(and(eq(referralPayouts.referrerId, playerId)))
  return { code: referralCode(playerId), referredCount: Number(count?.n ?? 0), earnedWei: BigInt(earned?.sum ?? '0'), referrer: Boolean(me?.referrerId) }
}
