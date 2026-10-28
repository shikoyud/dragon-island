import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { FakeChainClient } from '../src/chain/fake'
import { spendBatches } from '../src/db/schema'
import { runBurnBatch } from '../src/jobs/burnBatch'
import { startScheduler } from '../src/jobs/scheduler'
import { testApp, type TestApp } from './helpers/testApp'

const E18 = 10n ** 18n
const DAY = 86_400_000
let t: TestApp
let chain: FakeChainClient

beforeEach(async () => {
  chain = new FakeChainClient()
  t = await testApp({ chain }, 5 * DAY + 1000)
})
afterEach(async () => {
  await t.close()
})

describe('burn batch job', () => {
  it('burns half of past days’ spend within the operator limit, resuming across runs', async () => {
    await t.db.insert(spendBatches).values([{ day: 4, spentWei: 100n * E18 }, { day: 5, spentWei: 40n * E18 }])
    chain.remainingBurn = 30n * E18
    expect(await runBurnBatch({ db: t.db, chain, clock: t.clock })).toEqual({ burnedWei: 30n * E18, txs: 1 })
    expect(chain.burns).toEqual([30n * E18])
    let [d4] = await t.db.select().from(spendBatches).where(eq(spendBatches.day, 4))
    expect(d4!.burnedWei).toBe(30n * E18)
    expect(d4!.burnTx).toMatch(/^0x/)

    chain.remainingBurn = 100n * E18
    expect(await runBurnBatch({ db: t.db, chain, clock: t.clock })).toEqual({ burnedWei: 20n * E18, txs: 1 })
    ;[d4] = await t.db.select().from(spendBatches).where(eq(spendBatches.day, 4))
    expect(d4!.burnedWei).toBe(50n * E18)
    const [d5] = await t.db.select().from(spendBatches).where(eq(spendBatches.day, 5))
    expect(d5!.burnedWei).toBe(0n) // today is untouched until tomorrow

    expect(await runBurnBatch({ db: t.db, chain, clock: t.clock })).toEqual({ burnedWei: 0n, txs: 0 })
  })

  it('does nothing when the operator allowance is exhausted', async () => {
    await t.db.insert(spendBatches).values([{ day: 4, spentWei: 100n * E18 }])
    chain.remainingBurn = 0n
    expect(await runBurnBatch({ db: t.db, chain, clock: t.clock })).toEqual({ burnedWei: 0n, txs: 0 })
    expect(chain.burns).toEqual([])
  })
})

describe('scheduler', () => {
  it('runs each job on its interval and survives a failing job', async () => {
    const runs: string[] = []
    const scheduler = startScheduler({
      jobs: {
        a: async () => { runs.push('a') },
        b: async () => { runs.push('b'); throw new Error('boom') },
      },
      intervalsMs: { a: 10, b: 15 },
      log: () => {},
    })
    await new Promise(r => setTimeout(r, 70))
    scheduler.stop()
    const a = runs.filter(x => x === 'a').length, b = runs.filter(x => x === 'b').length
    expect(a).toBeGreaterThanOrEqual(3)
    expect(b).toBeGreaterThanOrEqual(2)
    const before = runs.length
    await new Promise(r => setTimeout(r, 40))
    expect(runs.length).toBe(before)
  })
})
