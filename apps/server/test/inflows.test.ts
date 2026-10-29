import { newPlayer, type PlayerState } from '@wyrmhaven/game-core'
import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { VaultLog } from '../src/chain/client'
import { FakeChainClient } from '../src/chain/fake'
import { balances, players, vaultInflows } from '../src/db/schema'
import { banPlayer } from '../src/services/bans'
import { runIndexer } from '../src/services/indexer'
import { recordInflow, seasonInflows } from '../src/services/inflows'
import { FixedPriceSource } from '../src/services/price'
import { ensureCurrentSeason } from '../src/services/season'
import { bearer, testApp, type TestApp } from './helpers/testApp'
import { TEST_KEYS, wallet } from './helpers/wallet'

const E18 = 10n ** 18n
const alice = wallet(TEST_KEYS.alice)
let t: TestApp
let chain: FakeChainClient
let playerId: string
let token: string

beforeEach(async () => {
  chain = new FakeChainClient()
  t = await testApp({ chain, price: new FixedPriceSource(500_000n) }, 1_000) // $0.50 per token
  ;({ playerId, token } = await t.login(alice))
})
afterEach(async () => { await t.close() })

const log = (block: bigint, name: VaultLog['name'], args: Record<string, string>, logIndex = 0): VaultLog =>
  ({ txHash: `0x${block.toString(16).padStart(64, '0')}`, logIndex, blockNumber: block, name, args })
const rows = () => t.db.select().from(vaultInflows)

describe('recordInflow', () => {
  it('writes once per (source, ref) and sums by source for the season', async () => {
    const season = await ensureCurrentSeason(t.db, t.clock)
    await t.db.transaction(async tx => {
      expect(await recordInflow(tx, t.clock, 'buyback', 10n, 'bb:1')).toBe(true)
      expect(await recordInflow(tx, t.clock, 'buyback', 99n, 'bb:1')).toBe(false)
      expect(await recordInflow(tx, t.clock, 'forfeit', 5n, 'f:1')).toBe(true)
      expect(await recordInflow(tx, t.clock, 'spend', 0n, 'zero')).toBe(false)
    })
    expect(await seasonInflows(t.db, season.id)).toEqual({ totalWei: 15n, bySource: { spend: 0n, depositFee: 0n, claimFee: 0n, buyback: 10n, forfeit: 5n } })
  })
})

describe('inflow sources', () => {
  it('a store purchase records half the charged tokens as spend', async () => {
    await t.db.update(balances).set({ tokenWei: 100n * E18 }).where(eq(balances.playerId, playerId))
    const r = await t.app.inject({ method: 'POST', url: '/actions', headers: bearer(token), payload: { action: { type: 'buy', item: { kind: 'foodPack' } }, idempotencyKey: 'k1' } })
    expect(r.statusCode).toBe(200)
    const [row] = await rows()
    expect(row).toMatchObject({ source: 'spend', wei: E18 / 2n }) // $0.50 = 1 token charged, half kept by the vault
    expect(row!.ref).toMatch(new RegExp(`^spend:${playerId}:1$`))
  })

  it('indexed Deposited and Claimed logs record the vault fee shares', async () => {
    chain.head = 5n
    chain.logs.push(
      log(2n, 'Deposited', { player: alice.address, amount: '100', credited: '98', burned: '1' }),
      log(3n, 'Claimed', { player: alice.address, cumulative: '1000', gross: '1000', net: '950', burned: '25' }),
    )
    await runIndexer({ db: t.db, chain, confirmations: 1, clock: t.clock, startBlock: 0n, chunk: 1_000n })
    const all = await rows()
    expect(all.map(r => [r.source, r.wei, r.ref])).toEqual([
      ['depositFee', 1n, `${log(2n, 'Deposited', {}).txHash}:0`],
      ['claimFee', 25n, `${log(3n, 'Claimed', {}).txHash}:0`],
    ])
  })

  it('a ban records the forfeited earned balance', async () => {
    await t.db.update(balances).set({ tokenWei: 10n, earnedWei: 7n }).where(eq(balances.playerId, playerId))
    await banPlayer(t.db, t.clock, playerId, 'test')
    const [row] = await rows()
    expect(row).toMatchObject({ source: 'forfeit', wei: 7n, ref: `ban:${playerId}:${t.clock()}` })
    const [p] = await t.db.select().from(players).where(eq(players.id, playerId))
    expect((p!.state as PlayerState).level).toBe(newPlayer(0).level) // state untouched by the ban
  })
})
