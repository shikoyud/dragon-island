import { MS_PER_DAY } from '@wyrmhaven/game-core'
import { desc, eq } from 'drizzle-orm'
import { bytesToHex, type Hex } from 'viem'
import type { SeasonInfo } from '@wyrmhaven/shared'
import type { Clock } from '../clock'
import type { Db, Tx } from '../db/client'
import { seasons } from '../db/schema'
import { AppError } from '../plugins/errors'
import { commitHash, newSecret } from './seed'

export const SEASON_MS = 14 * MS_PER_DAY
export type Season = typeof seasons.$inferSelect

/**
 * Returns the season covering `now`, creating season 1 (starting at the current UTC midnight)
 * or rolling to the next one when the current has ended. Old seasons stay unrevealed until the
 * close job (Phase 6) or an admin reveals them.
 */
export async function ensureCurrentSeason(db: Db | Tx, clock: Clock, random: () => Uint8Array = newSecret): Promise<Season> {
  const now = clock()
  const [latest] = await db.select().from(seasons).orderBy(desc(seasons.id)).limit(1)
  if (latest && latest.endsAt.getTime() > now) return latest
  const startsAt = latest ? latest.endsAt.getTime() : Math.floor(now / MS_PER_DAY) * MS_PER_DAY
  // If more than one season elapsed with no traffic, skip ahead so the current window is correct.
  const start = startsAt + Math.floor(Math.max(0, now - startsAt) / SEASON_MS) * SEASON_MS
  const secret = random()
  // unique(starts_at) + DO NOTHING: concurrent callers at a rollover all converge on one row.
  const [created] = await db
    .insert(seasons)
    .values({
      startsAt: new Date(start),
      endsAt: new Date(start + SEASON_MS),
      secretHex: bytesToHex(secret),
      commitHash: commitHash(secret),
    })
    .onConflictDoNothing({ target: seasons.startsAt })
    .returning()
  if (created) return created
  const [existing] = await db.select().from(seasons).where(eq(seasons.startsAt, new Date(start)))
  return existing!
}

export function toSeasonInfo(s: Season): SeasonInfo {
  return {
    id: s.id,
    startsAtMs: s.startsAt.getTime(),
    endsAtMs: s.endsAt.getTime(),
    commitHash: s.commitHash as Hex,
    revealedSecret: s.revealed ? (s.secretHex as Hex) : null,
  }
}

export async function getSeasonInfo(db: Db, clock: Clock): Promise<SeasonInfo> {
  return toSeasonInfo(await ensureCurrentSeason(db, clock))
}

export async function getSeasonById(db: Db, id: number): Promise<Season | null> {
  const [s] = await db.select().from(seasons).where(eq(seasons.id, id))
  return s ?? null
}

/** Reveals the secret of an ended season (admin / close job). */
export async function revealSecret(db: Db, clock: Clock, id: number): Promise<Hex> {
  const s = await getSeasonById(db, id)
  if (!s) throw new AppError(404, 'NOT_FOUND')
  if (s.endsAt.getTime() > clock()) throw new AppError(409, 'SEASON_ACTIVE')
  if (!s.revealed) await db.update(seasons).set({ revealed: true }).where(eq(seasons.id, id))
  return s.secretHex as Hex
}
