import { randomBytes } from 'node:crypto'
import { and, eq, isNull } from 'drizzle-orm'
import { getAddress, isAddress, verifyMessage } from 'viem'
import { walletMessage } from '../domain/walletMessage'
import type { Deps } from './deps'
import { entrants, walletNonces } from './db/schema'

export const NONCE_TTL_MS = 10 * 60 * 1000

export type BindWalletError = 'NONCE_INVALID' | 'INVALID_SIGNATURE' | 'WALLET_TAKEN' | 'BAD_REQUEST'

/** Issue a single-use nonce for the entrant to sign; valid for 10 minutes. */
export async function issueNonce(deps: Deps, entrantId: string): Promise<string> {
  const nonce = randomBytes(16).toString('hex')
  await deps.db
    .insert(walletNonces)
    .values({ nonce, entrantId, expiresAt: new Date(deps.clock.now().getTime() + NONCE_TTL_MS) })
  return nonce
}

function isUniqueViolation(e: unknown): boolean {
  for (let err: unknown = e; err && typeof err === 'object'; err = (err as { cause?: unknown }).cause) {
    if ((err as { code?: unknown }).code === '23505') return true
  }
  return false
}

/**
 * Bind a wallet to the entrant by a signed message (EOA only). The nonce is consumed in the same
 * transaction whether the signature passes or fails. Rebinding is allowed until the entrant has joined.
 */
export async function bindWallet(
  deps: Deps,
  entrantId: string,
  input: { address: string; signature: string; nonce: string },
): Promise<{ wallet: string } | { error: BindWalletError }> {
  const { db, clock } = deps
  // Never let viem's getAddress throw on a malformed or bad-checksum address.
  if (!isAddress(input.address)) return { error: 'BAD_REQUEST' }
  const address = getAddress(input.address)

  return db.transaction(async (tx) => {
    const [entrant] = await tx.select().from(entrants).where(eq(entrants.id, entrantId)).for('update')
    if (!entrant || entrant.position !== null || entrant.joinedAt !== null) return { error: 'BAD_REQUEST' as const }

    // Consume only this entrant's nonce; a foreign or unknown nonce is left untouched.
    const [consumed] = await tx
      .delete(walletNonces)
      .where(and(eq(walletNonces.nonce, input.nonce), eq(walletNonces.entrantId, entrantId)))
      .returning({ expiresAt: walletNonces.expiresAt })
    const now = clock.now()
    if (!consumed || consumed.expiresAt.getTime() < now.getTime()) return { error: 'NONCE_INVALID' as const }

    let valid = false
    try {
      valid = await verifyMessage({
        address,
        message: walletMessage(entrant.xHandle, address, input.nonce),
        signature: input.signature as `0x${string}`,
      })
    } catch {
      valid = false
    }
    if (!valid) return { error: 'INVALID_SIGNATURE' as const }

    const wallet = address.toLowerCase()
    try {
      // Savepoint, so a unique violation does not abort the outer transaction (the nonce stays consumed).
      const updated = await tx.transaction((sp) =>
        sp
          .update(entrants)
          .set({ wallet, walletSignedAt: now })
          .where(and(eq(entrants.id, entrantId), isNull(entrants.position)))
          .returning({ id: entrants.id }),
      )
      if (updated.length === 0) return { error: 'BAD_REQUEST' as const }
    } catch (e) {
      if (isUniqueViolation(e)) return { error: 'WALLET_TAKEN' as const }
      throw e
    }
    return { wallet }
  })
}
