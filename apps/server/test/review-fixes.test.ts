import { MS_PER_DAY, type PlayerState } from '@wyrmhaven/game-core'
import { eq, sql } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { FakeChainClient } from '../src/chain/fake'
import { actionLog, balances, burnAttempts, chainEvents, players, spendBatches, vouchers } from '../src/db/schema'
import { runBurnBatch } from '../src/jobs/burnBatch'
import { startScheduler } from '../src/jobs/scheduler'
import { expireVouchers } from '../src/jobs/voucherExpiry'
import { runIndexer } from '../src/services/indexer'
import { FixedPriceSource } from '../src/services/price'
import { ensureGame } from '../src/services/game'
import { battleSeed, secretFromHex } from '../src/services/seed'
import { bearer, testApp, type TestApp } from './helpers/testApp'
import { TEST_KEYS, wallet } from './helpers/wallet'

const E18 = 10n ** 18n
const alice = wallet(TEST_KEYS.alice)
const bob = wallet(TEST_KEYS.bob)
let t: TestApp
let chain: FakeChainClient
let A: { token: string; playerId: string }

beforeEach(async () => {
  chain = new FakeChainClient()
  chain.remainingPayout = 50n * E18
  chain.head = 100n
  t = await testApp({ chain, price: new FixedPriceSource(50_000n) }, 10 * MS_PER_DAY + 1_000)
  A = await t.login(alice)
  await t.db.update(balances).set({ tokenWei: 100n * E18 }).where(eq(balances.playerId, A.playerId))
})
afterEach(async () => {
  await t.close()
})

const withdraw = (tok: string, grossWei: bigint) =>
  t.app.inject({ method: 'POST', url: '/withdraw', headers: bearer(tok), payload: { grossWei: grossWei.toString() } })
const act = (tok: string, action: unknown) =>
  t.app.inject({ method: 'POST', url: '/actions', headers: bearer(tok), payload: { action, idempotencyKey: crypto.randomUUID() } })
const bal = async (id: string) => (await t.db.select().from(balances).where(eq(balances.playerId, id)))[0]!
const index = () => runIndexer({ db: t.db, chain, confirmations: 1, clock: t.clock, startBlock: 0n, chunk: 1_000n })
const claimedLog = (cumulative: bigint, block: bigint) => ({
  txHash: `0x${block.toString(16).padStart(64, 'c')}` as `0x${string}`, logIndex: 0, blockNumber: block, name: 'Claimed' as const,
  args: { player: alice.address, cumulative: cumulative.toString(), gross: '0', net: '0', burned: '0' },
})

describe('C1: a claim indexed after server-side expiry never pays twice', () => {
  it('re-debits when Claimed arrives for an already-refunded voucher', async () => {
    const v = (await withdraw(A.token, 5n * E18)).json()
    expect((await bal(A.playerId)).tokenWei).toBe(95n * E18)
    t.clock.advance(2 * 60 * 60_000) // past deadline + grace, indexer lagging
    expect(await expireVouchers({ db: t.db, clock: t.clock, chain })).toBe(1)
    expect((await bal(A.playerId)).tokenWei).toBe(100n * E18)
    chain.logs.push(claimedLog(BigInt(v.cumulativeWei), 50n))
    await index()
    const b = await bal(A.playerId)
    expect(b.tokenWei).toBe(95n * E18)
    expect(b.withdrawnWei).toBe(5n * E18)
    const [row] = await t.db.select().from(vouchers)
    expect(row!.claimedAt).not.toBeNull()
  })

  it('checks the chain before refunding and marks a claimed voucher instead', async () => {
    const v = (await withdraw(A.token, 5n * E18)).json()
    chain.claimedMap.set(alice.address.toLowerCase(), BigInt(v.cumulativeWei))
    t.clock.advance(2 * 60 * 60_000)
    expect(await expireVouchers({ db: t.db, clock: t.clock, chain })).toBe(0)
    expect((await bal(A.playerId)).tokenWei).toBe(95n * E18)
    const [row] = await t.db.select().from(vouchers)
    expect(row!.claimedAt).not.toBeNull()
    expect(row!.expiredAt).toBeNull()
  })

  it('never signs a cumulative below what the chain already paid', async () => {
    chain.claimedMap.set(alice.address.toLowerCase(), 40n * E18)
    await t.db.insert(vouchers).values({ playerId: A.playerId, cumulativeWei: 30n * E18, grossWei: 1n, deadlineAt: new Date(0), signature: '0x', claimedAt: new Date(0) })
    const v = (await withdraw(A.token, 2n * E18)).json()
    expect(v.cumulativeWei).toBe((42n * E18).toString())
  })
})

describe('I2: the action log records the seed a battle actually used', () => {
  it('stores the battle seed and offer id', async () => {
    const TEAM: [string, string, string] = ['d1', 'd2', 'd3']
    const [p] = await t.db.select().from(players).where(eq(players.id, A.playerId))
    const base = p!.state as PlayerState
    await t.db.update(players).set({
      state: { ...base, level: 8, defenceTeam: TEAM, dragons: TEAM.map(id => ({ id, speciesId: 'water', level: 20, habitatId: 'h2' })) },
      level: 8, defenceTeam: TEAM,
    }).where(eq(players.id, A.playerId))
    const pve = await act(A.token, { type: 'pveBattle', stage: 1, team: TEAM, moves: [{ move: 0, target: 0 }, { move: 0, target: 1 }, { move: 0, target: 2 }] })
    expect(pve.statusCode).toBe(200)
    const [log] = await t.db.select().from(actionLog).where(eq(actionLog.playerId, A.playerId))
    const g = await ensureGame(t.db, t.clock)
    expect(log!.seedHex).toBe(battleSeed(secretFromHex(g.secretHex), `${A.playerId}:1`).seedHex)
    expect(log!.seedLabel).toBe(`battle:${A.playerId}:1`)

    const offers = (await t.app.inject({ method: 'GET', url: '/pvp/offers', headers: bearer(A.token) })).json().offers
    const pvp = await act(A.token, { type: 'pvpBattle', offerId: offers[0].offerId, team: TEAM, moves: [] })
    expect([200, 422]).toContain(pvp.statusCode)
    const logs = await t.db.select().from(actionLog).where(eq(actionLog.playerId, A.playerId))
    const last = logs.find(l => l.nonce === 2n)!
    expect(last.seedHex).toBe(offers[0].seedHex)
    expect(last.seedLabel).toBe(`battle:${offers[0].offerId}`)
    expect((last.action as { offerId?: string }).offerId).toBe(offers[0].offerId)
  })
})

describe('I3: withdrawal sizing reserves open vouchers and caps a player per day', () => {
  it('subtracts open vouchers from the remaining cap', async () => {
    const B = await t.login(bob)
    await t.db.update(balances).set({ tokenWei: 100n * E18 }).where(eq(balances.playerId, B.playerId))
    expect((await withdraw(A.token, 5n * E18)).statusCode).toBe(200)     // remaining 50 → cap 5
    expect((await withdraw(B.token, 5n * E18)).statusCode).toBe(422)     // effective remaining 45 → cap 4.5
    expect((await withdraw(B.token, 45n * E18 / 10n)).statusCode).toBe(200)
  })

  it('limits one player to 10% of the day’s cap across requests', async () => {
    const v = (await withdraw(A.token, 5n * E18)).json()
    chain.logs.push(claimedLog(BigInt(v.cumulativeWei), 50n))
    await index()
    expect((await withdraw(A.token, 1n)).statusCode).toBe(422)
    t.clock.advance(MS_PER_DAY)
    expect((await withdraw(A.token, 1n)).statusCode).toBe(200)
  })
})

describe('I4: burn batch is crash-safe and receipt-checked', () => {
  const deps = () => ({ db: t.db, chain, clock: t.clock })

  it('records a pending attempt, confirms the receipt, and never double-burns', async () => {
    await t.db.insert(spendBatches).values({ day: 9, spentWei: 100n * E18 })
    chain.remainingBurn = 100n * E18
    expect(await runBurnBatch(deps())).toEqual({ burnedWei: 50n * E18, txs: 1 })
    const [attempt] = await t.db.select().from(burnAttempts)
    expect(attempt).toMatchObject({ day: 9, amountWei: 50n * E18, status: 'confirmed' })
    expect(await runBurnBatch(deps())).toEqual({ burnedWei: 0n, txs: 0 })
  })

  it('does not count a reverted burn', async () => {
    await t.db.insert(spendBatches).values({ day: 9, spentWei: 100n * E18 })
    chain.remainingBurn = 100n * E18
    chain.nextTxStatus = 'reverted'
    expect(await runBurnBatch(deps())).toEqual({ burnedWei: 0n, txs: 1 })
    expect((await t.db.select().from(spendBatches))[0]!.burnedWei).toBe(0n)
    expect((await t.db.select().from(burnAttempts))[0]!.status).toBe('reverted')
  })

  it('resolves a pending attempt left by a crash before burning more', async () => {
    await t.db.insert(spendBatches).values({ day: 9, spentWei: 100n * E18 })
    const hash = await chain.burn(50n * E18) // "sent" by a previous process
    await t.db.insert(burnAttempts).values({ day: 9, amountWei: 50n * E18, txHash: hash, status: 'pending' })
    chain.burns = []
    chain.remainingBurn = 100n * E18
    expect(await runBurnBatch(deps())).toEqual({ burnedWei: 50n * E18, txs: 0 })
    expect(chain.burns).toEqual([])
    expect((await t.db.select().from(spendBatches))[0]!.burnedWei).toBe(50n * E18)
  })

  it('scheduler.stop waits for in-flight jobs', async () => {
    let finished = false
    const s = startScheduler({
      jobs: { slow: () => new Promise(r => setTimeout(() => { finished = true; r(undefined) }, 60)) },
      intervalsMs: { slow: 5 }, log: () => {},
    })
    await new Promise(r => setTimeout(r, 10))
    await s.stop()
    expect(finished).toBe(true)
  })
})

describe('I5: indexer start block, chunking, and late player creation', () => {
  it('honours the start block and chunk size', async () => {
    chain.logs.push({ txHash: '0x01', logIndex: 0, blockNumber: 5n, name: 'Entered', args: { player: alice.address, paidWei: '1' } })
    chain.logs.push({ txHash: '0x02', logIndex: 0, blockNumber: 60n, name: 'Entered', args: { player: alice.address, paidWei: '1' } })
    const calls: [bigint, bigint][] = []
    const orig = chain.vaultLogs.bind(chain)
    chain.vaultLogs = async (f, to) => { calls.push([f, to]); return orig(f, to) }
    expect(await runIndexer({ db: t.db, chain, confirmations: 1, clock: t.clock, startBlock: 50n, chunk: 20n })).toEqual({ processed: 1 })
    expect(calls).toEqual([[50n, 69n], [70n, 89n], [90n, 99n]])
  })

  it('credits a deposit that arrived before the wallet ever signed in', async () => {
    const carol = wallet(TEST_KEYS.carol)
    chain.logs.push({ txHash: '0x03', logIndex: 0, blockNumber: 5n, name: 'Deposited', args: { player: carol.address, amount: '10', credited: '9', burned: '1' } })
    await index()
    expect((await t.db.select().from(chainEvents))[0]!.applied).toBe(false)
    const C = await t.login(carol)
    expect((await bal(C.playerId)).tokenWei).toBe(9n)
    expect((await t.db.select().from(chainEvents))[0]!.applied).toBe(true)
    await t.login(carol) // second login never re-applies
    expect((await bal(C.playerId)).tokenWei).toBe(9n)
  })
})

describe('I8: a new offer set invalidates the previous one', () => {
  it('rejects offers from an earlier GET', async () => {
    const TEAM: [string, string, string] = ['d1', 'd2', 'd3']
    const [p] = await t.db.select().from(players).where(eq(players.id, A.playerId))
    await t.db.update(players).set({
      state: { ...(p!.state as PlayerState), level: 8, defenceTeam: TEAM, dragons: TEAM.map(id => ({ id, speciesId: 'water', level: 20, habitatId: 'h2' })) },
      level: 8, defenceTeam: TEAM,
    }).where(eq(players.id, A.playerId))
    const first = (await t.app.inject({ method: 'GET', url: '/pvp/offers', headers: bearer(A.token) })).json().offers
    await t.app.inject({ method: 'GET', url: '/pvp/offers', headers: bearer(A.token) })
    const r = await act(A.token, { type: 'pvpBattle', offerId: first[0].offerId, team: TEAM, moves: [] })
    expect(r.statusCode).toBe(409)
    expect(r.json()).toEqual({ error: 'OFFER_EXPIRED' })
  })
})

describe('I9: hot queries have indexes', () => {
  it('has indexes on sessions, offers, vouchers and the action log', async () => {
    const rows = (await t.db.execute(sql`select indexname from pg_indexes where schemaname = 'public'`)) as unknown as { rows: { indexname: string }[] }
    const names = rows.rows.map(r => r.indexname)
    for (const expected of ['sessions_player_idx', 'battle_offers_player_idx', 'vouchers_open_idx', 'action_log_player_key']) {
      expect(names, expected).toContain(expected)
    }
  })
})
