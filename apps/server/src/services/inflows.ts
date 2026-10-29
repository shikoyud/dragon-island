import { and, eq, sql } from 'drizzle-orm'
import type { Clock } from '../clock'
import type { Db, Tx } from '../db/client'
import { vaultInflows } from '../db/schema'
import { ensureCurrentSeason } from './season'

export type InflowSource = 'spend' | 'depositFee' | 'claimFee' | 'buyback' | 'forfeit'
export const INFLOW_SOURCES: readonly InflowSource[] = ['spend', 'depositFee', 'claimFee', 'buyback', 'forfeit']

/**
 * Spec §12/§13: records a token amount the vault keeps (the vault's half of a spend, the vault's share
 * of deposit and claim fees, a buyback, a forfeited balance) against the season covering `clock()`.
 * Idempotent on (source, ref); returns false when that ref was already recorded. Zero amounts are skipped.
 */
export async function recordInflow(tx: Tx, clock: Clock, source: InflowSource, wei: bigint, ref: string): Promise<boolean> {
  if (wei <= 0n) return false
  const season = await ensureCurrentSeason(tx, clock)
  const inserted = await tx
    .insert(vaultInflows)
    .values({ seasonId: season.id, source, wei, ref, createdAt: new Date(clock()) })
    .onConflictDoNothing({ target: [vaultInflows.source, vaultInflows.ref] })
    .returning({ id: vaultInflows.id })
  return inserted.length > 0
}

export async function seasonInflows(db: Db | Tx, seasonId: number): Promise<{ totalWei: bigint; bySource: Record<InflowSource, bigint> }> {
  const rows = await db
    .select({ source: vaultInflows.source, sum: sql<string>`coalesce(sum(${vaultInflows.wei}), 0)::text` })
    .from(vaultInflows)
    .where(and(eq(vaultInflows.seasonId, seasonId)))
    .groupBy(vaultInflows.source)
  const bySource = Object.fromEntries(INFLOW_SOURCES.map(s => [s, 0n])) as Record<InflowSource, bigint>
  let totalWei = 0n
  for (const r of rows) {
    const w = BigInt(r.sum)
    bySource[r.source as InflowSource] = w
    totalWei += w
  }
  return { totalWei, bySource }
}
