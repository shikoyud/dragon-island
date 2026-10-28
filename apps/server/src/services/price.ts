import { eq } from 'drizzle-orm'
import type { Db } from '../db/client'
import { priceOverrides } from '../db/schema'

/** Token price in micro-USD per whole token (1e18 wei); `null` when no price is known. */
export interface PriceSource {
  microUsdPerToken(): Promise<bigint | null>
}

export class FixedPriceSource implements PriceSource {
  constructor(private readonly value: bigint | null) {}
  async microUsdPerToken(): Promise<bigint | null> {
    return this.value
  }
}

/** Testnet: an admin-set price (no Uniswap pool yet). Phase 6 adds the 30-minute TWAP source. */
export class ManualPriceSource implements PriceSource {
  constructor(private readonly db: Db) {}
  async microUsdPerToken(): Promise<bigint | null> {
    const [row] = await this.db.select().from(priceOverrides).where(eq(priceOverrides.id, 1))
    return row?.microUsdPerToken ?? null
  }
}

export async function setManualPrice(db: Db, microUsdPerToken: bigint): Promise<void> {
  await db
    .insert(priceOverrides)
    .values({ id: 1, microUsdPerToken })
    .onConflictDoUpdate({ target: priceOverrides.id, set: { microUsdPerToken, setAt: new Date() } })
}

/** `ceil(microUsd × 1e18 / price)`: the player never pays less than the USD price. */
export function usdToTokenWei(microUsd: bigint, priceMicroUsdPerToken: bigint): bigint {
  if (microUsd <= 0n) return 0n
  const num = microUsd * 10n ** 18n
  return (num + priceMicroUsdPerToken - 1n) / priceMicroUsdPerToken
}
