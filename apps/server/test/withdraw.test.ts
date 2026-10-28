import { eq } from 'drizzle-orm'
import { recoverTypedDataAddress } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { FakeChainClient } from '../src/chain/fake'
import { balances, vouchers } from '../src/db/schema'
import { expireVouchers, VOUCHER_GRACE_MS } from '../src/jobs/voucherExpiry'
import { runIndexer } from '../src/services/indexer'
import { CLAIM_TYPES, VOUCHER_TTL_MS } from '../src/services/withdraw'
import { bearer, testApp, TEST_SIGNER_KEY, TEST_VAULT, type TestApp } from './helpers/testApp'
import { TEST_KEYS, wallet } from './helpers/wallet'

const E18 = 10n ** 18n
const alice = wallet(TEST_KEYS.alice)
let t: TestApp
let chain: FakeChainClient
let token: string
let playerId: string

beforeEach(async () => {
  chain = new FakeChainClient()
  chain.remainingPayout = 50n * E18
  t = await testApp({ chain }, 1_000)
  ;({ token, playerId } = await t.login(alice))
  await t.db.update(balances).set({ tokenWei: 100n * E18 }).where(eq(balances.playerId, playerId))
})
afterEach(async () => {
  await t.close()
})

const withdraw = (grossWei: string) =>
  t.app.inject({ method: 'POST', url: '/withdraw', headers: bearer(token), payload: { grossWei } })
const balance = async () => (await t.db.select().from(balances).where(eq(balances.playerId, playerId)))[0]!

describe('POST /withdraw', () => {
  it('caps each voucher at 10% of the vault’s remaining daily payout', async () => {
    const over = await withdraw((6n * E18).toString())
    expect(over.statusCode).toBe(422)
    expect(over.json()).toEqual({ error: 'WITHDRAW_LIMIT' })
    expect((await balance()).tokenWei).toBe(100n * E18)
  })

  it('signs a cumulative EIP-712 voucher the vault will accept and debits the balance', async () => {
    chain.claimedMap.set(alice.address.toLowerCase(), 3n * E18) // already claimed on-chain earlier
    const r = await withdraw((5n * E18).toString())
    expect(r.statusCode).toBe(200)
    const v = r.json()
    expect(v.grossWei).toBe((5n * E18).toString())
    expect(v.cumulativeWei).toBe((8n * E18).toString())
    expect(v.deadlineMs).toBe(1_000 + VOUCHER_TTL_MS)
    const signer = await recoverTypedDataAddress({
      domain: { name: 'WyrmVault', version: '1', chainId: 46630, verifyingContract: TEST_VAULT },
      types: CLAIM_TYPES,
      primaryType: 'Claim',
      message: { player: alice.address, cumulative: 8n * E18, deadline: BigInt(Math.floor(v.deadlineMs / 1000)) },
      signature: v.signature,
    })
    expect(signer).toBe(privateKeyToAccount(TEST_SIGNER_KEY).address)
    const b = await balance()
    expect(b.tokenWei).toBe(95n * E18)
    expect(b.withdrawnWei).toBe(5n * E18)

    const pending = await t.app.inject({ method: 'GET', url: '/withdraw/pending', headers: bearer(token) })
    expect(pending.json().voucher.voucherId).toBe(v.voucherId)

    const second = await withdraw(E18.toString())
    expect(second.statusCode).toBe(409)
    expect(second.json()).toEqual({ error: 'VOUCHER_PENDING' })
  })

  it('chains cumulative totals off the previous voucher once it is claimed', async () => {
    const first = (await withdraw((5n * E18).toString())).json()
    chain.head = 2n
    chain.logs.push({
      txHash: '0x01', logIndex: 0, blockNumber: 1n, name: 'Claimed',
      args: { player: alice.address, cumulative: first.cumulativeWei, gross: first.grossWei, net: '0', burned: '0' },
    })
    await runIndexer({ db: t.db, chain, confirmations: 1, clock: t.clock })
    const second = (await withdraw((2n * E18).toString())).json()
    expect(second.cumulativeWei).toBe((7n * E18).toString())
  })

  it('re-credits an unclaimed voucher after its deadline, exactly once', async () => {
    const r = await withdraw((5n * E18).toString())
    expect(r.statusCode).toBe(200)
    t.clock.set(1_000 + VOUCHER_TTL_MS + VOUCHER_GRACE_MS - 1)
    expect(await expireVouchers({ db: t.db, clock: t.clock })).toBe(0)
    t.clock.set(1_000 + VOUCHER_TTL_MS + VOUCHER_GRACE_MS + 1)
    expect(await expireVouchers({ db: t.db, clock: t.clock })).toBe(1)
    const b = await balance()
    expect(b.tokenWei).toBe(100n * E18)
    expect(b.withdrawnWei).toBe(0n)
    expect(await expireVouchers({ db: t.db, clock: t.clock })).toBe(0)
    expect((await t.db.select().from(vouchers))[0]!.expiredAt).not.toBeNull()
    expect((await t.app.inject({ method: 'GET', url: '/withdraw/pending', headers: bearer(token) })).json()).toEqual({ voucher: null })
  })

  it('validates amounts and the balance', async () => {
    for (const bad of ['1.5', '-1', '0', 'abc']) expect((await withdraw(bad)).statusCode).toBe(400)
    await t.db.update(balances).set({ tokenWei: 1n }).where(eq(balances.playerId, playerId))
    expect((await withdraw('2')).statusCode).toBe(402)
  })
})
