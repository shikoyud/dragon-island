import { PRESETS, gameDay, phaseOf } from '@wyrmhaven/game-core'
import type { GameInfo } from '@wyrmhaven/shared'
import { eq } from 'drizzle-orm'
import { bytesToHex } from 'viem'
import type { Clock } from '../clock'
import type { Config } from '../config'
import type { Db, Tx } from '../db/client'
import { game } from '../db/schema'
import { commitHash, newSecret } from './seed'

export type Game = typeof game.$inferSelect

export const GAME_ID = 1

/**
 * The one provably-fair secret (A1): row 1 of `game`, created on first use. Its keccak256 is the public
 * commitment; the secret stays hidden until the game reveals it. Concurrent first callers converge on one
 * row (primary key + DO NOTHING).
 */
export async function ensureGame(db: Db | Tx, clock: Clock, random: () => Uint8Array = newSecret): Promise<Game> {
  const existing = await getGame(db)
  if (existing) return existing
  const secret = random()
  const [created] = await db
    .insert(game)
    .values({ id: GAME_ID, secretHex: bytesToHex(secret), commitHash: commitHash(secret), createdAt: new Date(clock()), launchAt: new Date(clock()) })
    .onConflictDoNothing({ target: game.id })
    .returning()
  if (created) return created
  return (await getGame(db))!
}

export async function getGame(db: Db | Tx): Promise<Game | null> {
  const [g] = await db.select().from(game).where(eq(game.id, GAME_ID))
  return g ?? null
}

/**
 * The public face of the game (§1.5, A12): launch time, preset, current day and phase, the commitment, and
 * the secret only once the game has revealed it. LAUNCH_AT wins over the row's dev default.
 */
export async function gameInfo(db: Db | Tx, clock: Clock, config: Pick<Config, 'LAUNCH_AT' | 'PRESET'>): Promise<GameInfo> {
  const g = await ensureGame(db, clock)
  const launchAtMs = config.LAUNCH_AT ? Date.parse(config.LAUNCH_AT) : g.launchAt.getTime()
  const day = gameDay(launchAtMs, clock())
  return {
    launchAtMs,
    preset: config.PRESET,
    day,
    phase: phaseOf(day, PRESETS[config.PRESET]),
    commitHash: g.commitHash as `0x${string}`,
    revealedSecret: g.revealed ? (g.secretHex as `0x${string}`) : null,
  }
}
