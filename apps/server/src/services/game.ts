import { eq } from 'drizzle-orm'
import { bytesToHex } from 'viem'
import type { Clock } from '../clock'
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
    .values({ id: GAME_ID, secretHex: bytesToHex(secret), commitHash: commitHash(secret), createdAt: new Date(clock()) })
    .onConflictDoNothing({ target: game.id })
    .returning()
  if (created) return created
  return (await getGame(db))!
}

export async function getGame(db: Db | Tx): Promise<Game | null> {
  const [g] = await db.select().from(game).where(eq(game.id, GAME_ID))
  return g ?? null
}
