import { newPlayer } from '@wyrmhaven/game-core'
import { randomBytes } from 'node:crypto'
import { and, eq, gt } from 'drizzle-orm'
import { getAddress, isAddressEqual, recoverMessageAddress, type Address } from 'viem'
import { generateSiweNonce, parseSiweMessage, validateSiweMessage } from 'viem/siwe'
import type { Clock } from '../clock'
import type { Config } from '../config'
import type { Db } from '../db/client'
import { balances, players, sessions, siweNonces } from '../db/schema'
import { AppError } from '../plugins/errors'

export const NONCE_TTL_MS = 10 * 60_000

export async function issueNonce(db: Db, clock: Clock): Promise<string> {
  const nonce = generateSiweNonce()
  await db.insert(siweNonces).values({ nonce, expiresAt: new Date(clock() + NONCE_TTL_MS) })
  return nonce
}

/** Verifies a SIWE message for this app's domain/uri/chain, consumes its nonce, and opens a session. */
export async function verifyAndLogin(
  db: Db, clock: Clock, config: Config, message: string, signature: `0x${string}`,
): Promise<{ token: string; playerId: string; address: Address }> {
  const parsed = parseSiweMessage(message)
  const now = new Date(clock())
  const valid = validateSiweMessage({
    message: parsed, domain: config.SIWE_DOMAIN, nonce: parsed.nonce, scheme: undefined, time: now,
  })
  if (!valid || !parsed.address || !parsed.nonce || parsed.chainId !== config.CHAIN_ID || parsed.uri !== config.SIWE_URI) {
    throw new AppError(401, 'UNAUTHORIZED')
  }
  const recovered = await recoverMessageAddress({ message, signature }).catch(() => null)
  if (!recovered || !isAddressEqual(recovered, parsed.address)) throw new AppError(401, 'UNAUTHORIZED')

  // Consume the nonce exactly once; an expired or unknown nonce is a replay.
  const consumed = await db
    .delete(siweNonces)
    .where(and(eq(siweNonces.nonce, parsed.nonce), gt(siweNonces.expiresAt, now)))
    .returning()
  if (consumed.length === 0) throw new AppError(401, 'UNAUTHORIZED')

  const address = parsed.address.toLowerCase() as Address
  const playerId = await db.transaction(async tx => {
    const [existing] = await tx.select({ id: players.id }).from(players).where(eq(players.address, address))
    if (existing) return existing.id
    const [created] = await tx.insert(players).values({ address, state: newPlayer(clock()) }).returning({ id: players.id })
    await tx.insert(balances).values({ playerId: created!.id })
    return created!.id
  })

  const token = randomBytes(32).toString('hex')
  await db.insert(sessions).values({ token, playerId, expiresAt: new Date(clock() + config.SESSION_TTL_MS) })
  return { token, playerId, address: getAddress(address) }
}

export async function logout(db: Db, token: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.token, token))
}
