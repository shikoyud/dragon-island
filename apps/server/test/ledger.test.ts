import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import type { Db } from '../src/db/client'
import { balances, players, spendBatches } from '../src/db/schema'
import { AppError } from '../src/plugins/errors'
import { charge, creditDeposit, creditEarned, debitForWithdrawal, getBalance } from '../src/services/ledger'
import { FixedPriceSource, usdToTokenWei } from '../src/services/price'
import { testDb } from './helpers/testDb'

let db: Db
let playerId: string

beforeEach(async () => {
  ;({ db } = await testDb())
  const [p] = await db.insert(players).values({ address: '0xled', state: {} }).returning()
  playerId = p!.id
  await db.insert(balances).values({ playerId, tokenWei: 100n * 10n ** 18n })
})
afterAll(async () => {})

describe('price conversion', () => {
  it('converts micro-USD to token wei, rounding up', () => {
    expect(usdToTokenWei(500_000n, 50_000n)).toBe(10n * 10n ** 18n)   // $0.50 at $0.05/token = 10 tokens
    expect(usdToTokenWei(1n, 50_000n)).toBe(20_000_000_000_000n)       // 1e18 / 50_000 exactly
    expect(usdToTokenWei(1n, 3n)).toBe(333_333_333_333_333_334n)        // ceil
    expect(usdToTokenWei(0n, 3n)).toBe(0n)
  })

  it('fixed source returns its value or null', async () => {
    expect(await new FixedPriceSource(7n).microUsdPerToken()).toBe(7n)
    expect(await new FixedPriceSource(null).microUsdPerToken()).toBeNull()
  })
})

describe('ledger', () => {
  it('charges spend and records the daily batch', async () => {
    await db.transaction(async tx => {
      await charge(tx, () => 0, playerId, 10n * 10n ** 18n, 3, 'buy:foodPack')
    })
    const b = await getBalance(db, playerId)
    expect(b.tokenWei).toBe(90n * 10n ** 18n)
    expect(b.spentWei).toBe(10n * 10n ** 18n)
    const [batch] = await db.select().from(spendBatches).where(eq(spendBatches.day, 3))
    expect(batch!.spentWei).toBe(10n * 10n ** 18n)
    await db.transaction(async tx => charge(tx, () => 0, playerId, 5n * 10n ** 18n, 3, 'buy:nest'))
    const [again] = await db.select().from(spendBatches).where(eq(spendBatches.day, 3))
    expect(again!.spentWei).toBe(15n * 10n ** 18n)
  })

  it('refuses to overdraw and leaves nothing behind', async () => {
    await expect(db.transaction(async tx => charge(tx, () => 0, playerId, 101n * 10n ** 18n, 3, 'x')))
      .rejects.toMatchObject(new AppError(402, 'INSUFFICIENT_TOKENS'))
    expect((await getBalance(db, playerId)).tokenWei).toBe(100n * 10n ** 18n)
    expect(await db.select().from(spendBatches)).toEqual([])
  })

  it('credits earnings, deposits and withdrawals', async () => {
    await db.transaction(async tx => {
      await creditEarned(tx, playerId, 5n, 'payout')
      await creditDeposit(tx, playerId, 7n, '0xtx')
      await debitForWithdrawal(tx, playerId, 3n)
    })
    const b = await getBalance(db, playerId)
    expect(b.tokenWei).toBe(100n * 10n ** 18n + 5n + 7n - 3n)
    expect(b.earnedWei).toBe(5n)
    expect(b.depositedWei).toBe(7n)
    expect(b.withdrawnWei).toBe(3n)
    await expect(db.transaction(async tx => debitForWithdrawal(tx, playerId, 10n ** 30n)))
      .rejects.toMatchObject(new AppError(402, 'INSUFFICIENT_TOKENS'))
  })
})
