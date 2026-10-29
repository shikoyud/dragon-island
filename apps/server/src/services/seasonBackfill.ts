import { and, asc, isNull, lte, sql } from 'drizzle-orm'
import type { Clock } from '../clock'
import type { Db } from '../db/client'
import { seasons } from '../db/schema'
import { CLOSE_LOCK_ID } from '../jobs/seasonClose'

/**
 * One-off migration aid for databases that already hold ended, never-closed seasons (for example a
 * testnet beta DB from before the close job existed). Without it the first `closeSeasons` run would
 * pay prizes and halve trophies for every old season at once. This stamps `closed_at = now` and
 * `revealed = true` on every unclosed season with `ends_at <= endedBeforeMs`; it pays no prizes and
 * touches no trophies. With `dryRun` it only reports the ids.
 *
 * Runs in one transaction under the same advisory lock as `closeSeasons`. If another close or
 * backfill holds the lock this throws (rather than waiting or silently doing nothing) so the CLI
 * exits non-zero and the operator retries.
 */
export async function backfillClosedSeasons(db: Db, clock: Clock, opts: { endedBeforeMs: number; dryRun: boolean }): Promise<{ seasonIds: number[] }> {
  return db.transaction(async tx => {
    const locked = await tx.execute(sql`select pg_try_advisory_xact_lock(${CLOSE_LOCK_ID}) as ok`)
    if (!(locked as unknown as { rows: { ok: boolean }[] }).rows[0]?.ok) {
      throw new Error('season-close lock is held by another process (a close job or backfill is running); retry shortly')
    }
    const rows = await tx
      .select({ id: seasons.id })
      .from(seasons)
      .where(and(isNull(seasons.closedAt), lte(seasons.endsAt, new Date(opts.endedBeforeMs))))
      .orderBy(asc(seasons.id))
      .for('update')
    const seasonIds = rows.map(r => r.id)
    if (!opts.dryRun && seasonIds.length > 0) {
      await tx.execute(sql`update seasons set closed_at = ${new Date(clock()).toISOString()}::timestamptz, revealed = true where id in (${sql.join(seasonIds.map(id => sql`${id}`), sql`, `)})`)
    }
    return { seasonIds }
  })
}
