import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { FakeChainClient } from '../src/chain/fake'
import type { VaultLog } from '../src/chain/client'
import { balances, chainEvents, indexerState, players, vouchers } from '../src/db/schema'
import { runIndexer } from '../src/services/indexer'
import { testApp, type TestApp } from './helpers/testApp'
import { TEST_KEYS, wallet } from './helpers/wallet'

const E18 = 10n ** 18n
const alice = wallet(TEST_KEYS.alice)
let t: TestApp
let chain: FakeChainClient
let playerId: string

beforeEach(async () => {
  chain = new FakeChainClient()
  t = await testApp({ chain }, 1_000)
  ;({ playerId } = await t.login(alice))
})
afterEach(async () => {
  await t.close()
})

const log = (block: bigint, name: VaultLog['name'], args: Record<string, string>, txHash = `0x${block.toString(16).padStart(64, '0')}`, logIndex = 0): VaultLog =>
  ({ txHash: txHash as `0x${string}`, logIndex, blockNumber: block, name, args })

const index = () => runIndexer({ db: t.db, chain, confirmations: 1, clock: t.clock, startBlock: 0n, chunk: 1_000n })

describe('indexer', () => {
  it('processes only confirmed blocks, credits deposits by `credited`, and is idempotent', async () => {
    chain.head = 12n
    chain.logs.push(
      log(10n, 'Entered', { player: alice.address, paidWei: '1' }),
      log(11n, 'Deposited', { player: alice.address, amount: (10n * E18).toString(), credited: (98n * E18 / 10n).toString(), burned: (E18 / 10n).toString() }),
      log(12n, 'Deposited', { player: alice.address, amount: E18.toString(), credited: E18.toString(), burned: '0' }),
    )
    expect(await index()).toEqual({ processed: 2 })
    const [p] = await t.db.select().from(players).where(eq(players.id, playerId))
    expect(p!.earningUnlocked).toBe(true)
    const [b] = await t.db.select().from(balances).where(eq(balances.playerId, playerId))
    expect(b!.tokenWei).toBe(98n * E18 / 10n)
    expect(b!.depositedWei).toBe(98n * E18 / 10n)
    expect((await t.db.select().from(indexerState))[0]).toMatchObject({ key: 'vault', lastBlock: 11n })

    expect(await index()).toEqual({ processed: 0 })
    chain.head = 13n
    expect(await index()).toEqual({ processed: 1 }) // block 12 now confirmed
    expect((await t.db.select().from(balances))[0]!.tokenWei).toBe(98n * E18 / 10n + E18)

    // The same (txHash, logIndex) seen again (reorg to the same tx) is never double-credited.
    chain.head = 20n
    expect(await index()).toEqual({ processed: 0 })
    expect(await t.db.select().from(chainEvents)).toHaveLength(3)
  })

  it('ignores logs for unknown addresses but records them', async () => {
    chain.head = 5n
    chain.logs.push(log(2n, 'Deposited', { player: '0x000000000000000000000000000000000000dEaD', amount: '5', credited: '5', burned: '0' }))
    expect(await index()).toEqual({ processed: 1 })
    expect((await t.db.select().from(balances))[0]!.tokenWei).toBe(0n)
    expect(await t.db.select().from(chainEvents)).toHaveLength(1)
  })

  it('marks vouchers claimed from Claimed logs', async () => {
    await t.db.insert(vouchers).values({
      playerId, cumulativeWei: 7n * E18, grossWei: 7n * E18, deadlineAt: new Date(10_000), signature: '0x00',
    })
    chain.head = 3n
    chain.logs.push(log(1n, 'Claimed', { player: alice.address, cumulative: (7n * E18).toString(), gross: (7n * E18).toString(), net: '0', burned: '0' }))
    await index()
    const [v] = await t.db.select().from(vouchers)
    expect(v!.claimedAt).not.toBeNull()
  })
})
