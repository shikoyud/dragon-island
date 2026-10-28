import { utcDay } from '@wyrmhaven/game-core'
import type { PendingWithdrawResponse, WithdrawResponse } from '@wyrmhaven/shared'
import { and, desc, eq, gte, isNull, sql } from 'drizzle-orm'
import type { Address, Hex } from 'viem'
import type { PrivateKeyAccount } from 'viem/accounts'
import type { ChainClient } from '../chain/client'
import type { Clock } from '../clock'
import type { Db, Tx } from '../db/client'
import { players, vouchers } from '../db/schema'
import { AppError } from '../plugins/errors'
import { debitForWithdrawal, getBalance } from './ledger'

export const VOUCHER_TTL_MS = 60 * 60_000
/** Ruling: one request may take at most this share of the vault's remaining daily cap (after open
 *  vouchers), and one player may be issued at most this share of the chain's remaining cap per UTC day. */
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

const openVouchersSum = async (tx: Tx): Promise<bigint> => {
  const [row] = await tx
    .select({ sum: sql<string>`coalesce(sum(${vouchers.grossWei}), 0)::text` })
    .from(vouchers)
    .where(and(isNull(vouchers.claimedAt), isNull(vouchers.expiredAt)))
  return BigInt(row?.sum ?? '0')
}

const issuedTodaySum = async (tx: Tx, playerId: string, dayStart: Date): Promise<bigint> => {
  const [row] = await tx
    .select({ sum: sql<string>`coalesce(sum(${vouchers.grossWei}), 0)::text` })
    .from(vouchers)
    .where(and(eq(vouchers.playerId, playerId), isNull(vouchers.expiredAt), gte(vouchers.createdAt, dayStart)))
  return BigInt(row?.sum ?? '0')
}

/**
 * Signs an EIP-712 cumulative claim voucher for `grossWei` and debits the balance.
 * Limits: the amount fits the vault's remaining daily cap minus every voucher still open (so
 * concurrent players cannot all be promised the same cap), at most 10% of that per request, and at
 * most 10% of the chain's remaining cap per player per UTC day. One open voucher per player.
 * Chain reads happen before the transaction so no RPC call runs while the player row is locked.
 * `maxAllowed` lets the ban rules restrict a player to their own deposits.
 */
export async function requestWithdrawal(deps: WithdrawDeps, playerId: string, grossWei: bigint, maxAllowed?: bigint): Promise<WithdrawResponse> {
  const { db, clock, chain, signer, vault, chainId } = deps
  if (grossWei <= 0n) throw new AppError(400, 'INVALID_AMOUNT')
  const nowMs = clock()
  const [who] = await db.select({ address: players.address }).from(players).where(eq(players.id, playerId))
  if (!who) throw new AppError(401, 'UNAUTHORIZED')
  const address = who.address as Address
  const [chainRemaining, chainClaimed] = await Promise.all([chain.remainingPayoutToday(), chain.claimed(address)])

  return db.transaction(async tx => {
    await tx.select({ id: players.id }).from(players).where(eq(players.id, playerId)).for('update')
    const open = await tx
      .select({ id: vouchers.id })
      .from(vouchers)
      .where(and(eq(vouchers.playerId, playerId), isNull(vouchers.claimedAt), isNull(vouchers.expiredAt)))
    if (open.length > 0) throw new AppError(409, 'VOUCHER_PENDING')

    if (maxAllowed !== undefined && grossWei > maxAllowed) throw new AppError(422, 'WITHDRAW_LIMIT')
    const balance = await getBalance(tx, playerId)
    if (grossWei > balance.tokenWei) throw new AppError(402, 'INSUFFICIENT_TOKENS')

    const reserved = await openVouchersSum(tx)
    const effective = chainRemaining > reserved ? chainRemaining - reserved : 0n
    const perRequest = effective * PER_PLAYER_CAP_BPS / BPS
    const perPlayerDay = chainRemaining * PER_PLAYER_CAP_BPS / BPS
    const dayStart = new Date(utcDay(nowMs) * 86_400_000)
    const issuedToday = await issuedTodaySum(tx, playerId, dayStart)
    if (grossWei > perRequest || issuedToday + grossWei > perPlayerDay) throw new AppError(422, 'WITHDRAW_LIMIT')

    // Cumulative total: never below what the chain has already paid (a late-indexed claim), and never
    // below the last voucher we issued that was not refunded.
    const [last] = await tx
      .select()
      .from(vouchers)
      .where(and(eq(vouchers.playerId, playerId), isNull(vouchers.expiredAt)))
      .orderBy(desc(vouchers.createdAt))
      .limit(1)
    const lastCumulative = last ? last.cumulativeWei : 0n
    const base = lastCumulative > chainClaimed ? lastCumulative : chainClaimed
    const cumulative = base + grossWei
    const deadlineMs = nowMs + VOUCHER_TTL_MS
    const deadline = BigInt(Math.floor(deadlineMs / 1000))

    const signature = await signer.signTypedData({
      domain: { name: 'WyrmVault', version: '1', chainId, verifyingContract: vault },
      types: CLAIM_TYPES,
      primaryType: 'Claim',
      message: { player: address, cumulative, deadline },
    })

    await debitForWithdrawal(tx, playerId, grossWei)
    const [row] = await tx
      .insert(vouchers)
      .values({ playerId, cumulativeWei: cumulative, grossWei, deadlineAt: new Date(Number(deadline) * 1000), signature, createdAt: new Date(nowMs) })
      .returning()
    return toResponse(row!)
  })
}
