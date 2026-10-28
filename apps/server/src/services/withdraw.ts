import type { PendingWithdrawResponse, WithdrawResponse } from '@wyrmhaven/shared'
import { and, desc, eq, isNull } from 'drizzle-orm'
import type { Address, Hex } from 'viem'
import type { PrivateKeyAccount } from 'viem/accounts'
import type { ChainClient } from '../chain/client'
import type { Clock } from '../clock'
import type { Db } from '../db/client'
import { players, vouchers } from '../db/schema'
import { AppError } from '../plugins/errors'
import { debitForWithdrawal, getBalance } from './ledger'

export const VOUCHER_TTL_MS = 60 * 60_000
/** Ruling: one request may take at most this share of the vault's remaining daily cap. */
export const PER_PLAYER_CAP_BPS = 1_000n
export const BPS = 10_000n

export const CLAIM_TYPES = {
  Claim: [
    { name: 'player', type: 'address' },
    { name: 'cumulative', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
  ],
} as const

export interface WithdrawDeps {
  db: Db
  clock: Clock
  chain: ChainClient
  signer: PrivateKeyAccount
  vault: Address
  chainId: number
}

type VoucherRow = typeof vouchers.$inferSelect

export function toResponse(v: VoucherRow): WithdrawResponse {
  return {
    voucherId: v.id,
    cumulativeWei: v.cumulativeWei.toString(),
    grossWei: v.grossWei.toString(),
    deadlineMs: v.deadlineAt.getTime(),
    signature: v.signature as Hex,
  }
}

export async function pendingVoucher(db: Db, playerId: string): Promise<PendingWithdrawResponse> {
  const [v] = await db
    .select()
    .from(vouchers)
    .where(and(eq(vouchers.playerId, playerId), isNull(vouchers.claimedAt), isNull(vouchers.expiredAt)))
  return { voucher: v ? toResponse(v) : null }
}

/**
 * Signs an EIP-712 cumulative claim voucher for `grossWei` and debits the balance. The amount must fit
 * the vault's remaining daily cap and the per-request share, and only one voucher may be open at a time.
 * `maxAllowed` lets the ban rules restrict a player to their own deposits.
 */
export async function requestWithdrawal(deps: WithdrawDeps, playerId: string, grossWei: bigint, maxAllowed?: bigint): Promise<WithdrawResponse> {
  const { db, clock, chain, signer, vault, chainId } = deps
  if (grossWei <= 0n) throw new AppError(400, 'INVALID_AMOUNT')
  const nowMs = clock()
  return db.transaction(async tx => {
    const [player] = await tx.select().from(players).where(eq(players.id, playerId)).for('update')
    if (!player) throw new AppError(401, 'UNAUTHORIZED')
    const open = await tx
      .select({ id: vouchers.id })
      .from(vouchers)
      .where(and(eq(vouchers.playerId, playerId), isNull(vouchers.claimedAt), isNull(vouchers.expiredAt)))
    if (open.length > 0) throw new AppError(409, 'VOUCHER_PENDING')

    if (maxAllowed !== undefined && grossWei > maxAllowed) throw new AppError(422, 'WITHDRAW_LIMIT')
    const balance = await getBalance(tx, playerId)
    if (grossWei > balance.tokenWei) throw new AppError(402, 'INSUFFICIENT_TOKENS')
    const remaining = await chain.remainingPayoutToday()
    const perRequest = remaining * PER_PLAYER_CAP_BPS / BPS
    if (grossWei > remaining || grossWei > perRequest) throw new AppError(422, 'WITHDRAW_LIMIT')

    // Cumulative total: continue from the last voucher we issued (claimed or expired ones were settled
    // or refunded), or from what the chain says was claimed if we never issued one.
    const [last] = await tx.select().from(vouchers).where(and(eq(vouchers.playerId, playerId), isNull(vouchers.expiredAt)))
      .orderBy(desc(vouchers.createdAt)).limit(1)
    const base = last ? last.cumulativeWei : await chain.claimed(player.address as Address)
    const cumulative = base + grossWei
    const deadlineMs = nowMs + VOUCHER_TTL_MS
    const deadline = BigInt(Math.floor(deadlineMs / 1000))

    const signature = await signer.signTypedData({
      domain: { name: 'WyrmVault', version: '1', chainId, verifyingContract: vault },
      types: CLAIM_TYPES,
      primaryType: 'Claim',
      message: { player: player.address as Address, cumulative, deadline },
    })

    await debitForWithdrawal(tx, playerId, grossWei)
    const [row] = await tx
      .insert(vouchers)
      .values({ playerId, cumulativeWei: cumulative, grossWei, deadlineAt: new Date(Number(deadline) * 1000), signature, createdAt: new Date(nowMs) })
      .returning()
    return toResponse(row!)
  })
}
