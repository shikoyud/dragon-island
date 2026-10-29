import { lt } from 'drizzle-orm'
import type { Clock } from '../clock'
import type { Db } from '../db/client'
import { battleOffers, rateLimits, siweNonces } from '../db/schema'

const DAY_MS = 86_400_000

/**
 * Hourly housekeeping. Expired sign-in nonces and stale rate-limit windows (their keys hold raw client IPs,
 * so keeping them is a privacy cost) go; so do battle offers that expired over 7 days ago, used or not.
 * Nothing references battle_offers by foreign key, and a resolved battle keeps its seed in action_log.
 */
export async function prune(deps: { db: Db; clock: Clock }): Promise<{ nonces: number; rateLimits: number; offers: number }> {
  const { db, clock } = deps
  const now = clock()
  const nonces = await db.delete(siweNonces).where(lt(siweNonces.expiresAt, new Date(now))).returning({ n: siweNonces.nonce })
  const limits = await db.delete(rateLimits).where(lt(rateLimits.windowStart, new Date(now - DAY_MS))).returning({ k: rateLimits.key })
  const offers = await db.delete(battleOffers).where(lt(battleOffers.expiresAt, new Date(now - 7 * DAY_MS))).returning({ id: battleOffers.id })
  return { nonces: nonces.length, rateLimits: limits.length, offers: offers.length }
}
