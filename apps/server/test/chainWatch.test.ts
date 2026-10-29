import { privateKeyToAccount } from 'viem/accounts'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FakeChainClient } from '../src/chain/fake'
import { mutableClock } from '../src/clock'
import { loadConfig } from '../src/config'
import type { Db } from '../src/db/client'
import { indexerState } from '../src/db/schema'
import { createChainWatch } from '../src/jobs/chainWatch'
import { sendAlert } from '../src/services/alerts'
import { TEST_ADMIN_TOKEN, TEST_SIGNER_KEY, TEST_VAULT } from './helpers/testApp'
import { testDb } from './helpers/testDb'

const MIN = 60_000
const HOUR = 60 * MIN
const TOKEN = '0x5FbDB2315678afecb367f032d93F642f64180aa3'

let db: Db
let chain: FakeChainClient
let clock: ReturnType<typeof mutableClock>
let sent: string[]
let run: () => Promise<string[]>

const config = loadConfig({
  SESSION_SECRET: 't'.repeat(32), ADMIN_TOKEN: TEST_ADMIN_TOKEN,
  SIGNER_PRIVATE_KEY: TEST_SIGNER_KEY, VAULT_ADDRESS: TEST_VAULT, TOKEN_ADDRESS: TOKEN,
})

beforeEach(async () => {
  ;({ db } = await testDb())
  chain = new FakeChainClient()
  chain.signerAddress = privateKeyToAccount(TEST_SIGNER_KEY).address
  chain.vaultBalance = 1_000_000n
  clock = mutableClock(1_700_000_000_000)
  sent = []
  run = createChainWatch({ db, clock, chain, config, alert: async text => { sent.push(text) } })
})

describe('chainWatch', () => {
  it('stays quiet when everything is healthy', async () => {
    expect(await run()).toEqual([])
    clock.advance(5 * MIN)
    expect(await run()).toEqual([])
    expect(sent).toEqual([])
  })

  it('alerts when the vault pauses and again when it unpauses', async () => {
    await run()
    chain.isPaused = true
    clock.advance(5 * MIN)
    const paused = await run()
    expect(paused).toHaveLength(1)
    expect(paused[0]).toMatch(/paused/i)
    chain.isPaused = false
    clock.advance(5 * MIN)
    const unpaused = await run()
    expect(unpaused).toHaveLength(1)
    expect(unpaused[0]).toMatch(/unpaused/i)
    expect(sent).toEqual([...paused, ...unpaused])
  })

  it('alerts when the configured signer is not the vault signer', async () => {
    chain.signerAddress = privateKeyToAccount('0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a').address
    const out = await run()
    expect(out).toHaveLength(1)
    expect(out[0]).toMatch(/signer/i)
    expect(out[0]).not.toContain(TEST_SIGNER_KEY.slice(2))
  })

  it('compares signer addresses case-insensitively', async () => {
    chain.signerAddress = privateKeyToAccount(TEST_SIGNER_KEY).address.toLowerCase() as `0x${string}`
    expect(await run()).toEqual([])
  })

  it('alerts on a balance drop above 2.5% in 24 hours', async () => {
    await run()
    clock.advance(6 * HOUR)
    chain.vaultBalance = 980_000n // 2.0%: within the design cap
    expect(await run()).toEqual([])
    clock.advance(6 * HOUR)
    chain.vaultBalance = 974_000n // 2.6% below the 1,000,000 seen 12 h ago
    const out = await run()
    expect(out).toHaveLength(1)
    expect(out[0]).toMatch(/balance/i)
  })

  it('does not count a drop spread over more than 24 hours', async () => {
    await run()
    clock.advance(20 * HOUR)
    chain.vaultBalance = 985_000n
    expect(await run()).toEqual([])
    clock.advance(5 * HOUR) // the 1,000,000 sample is now older than 24 h
    chain.vaultBalance = 970_000n // 1.5% below 985,000
    expect(await run()).toEqual([])
  })

  it('alerts on indexer lag over 10 minutes', async () => {
    chain.head = 100n
    await db.insert(indexerState).values({ key: 'vault', lastBlock: 99n })
    expect(await run()).toEqual([])
    chain.head = 200n
    clock.advance(9 * MIN)
    expect(await run()).toEqual([])
    clock.advance(2 * MIN)
    const out = await run()
    expect(out).toHaveLength(1)
    expect(out[0]).toMatch(/indexer/i)
  })

  it('does not flag the indexer while the chain has nothing new to index', async () => {
    chain.head = 100n
    await db.insert(indexerState).values({ key: 'vault', lastBlock: 99n })
    await run()
    clock.advance(30 * MIN)
    expect(await run()).toEqual([])
  })

  it('does not alert when blocks arrive after a quiet chain (lag timer restarts while nothing is pending)', async () => {
    chain.head = 100n
    await db.insert(indexerState).values({ key: 'vault', lastBlock: 99n })
    await run()
    clock.advance(30 * MIN)
    expect(await run()).toEqual([])
    // New blocks land; the first watch run comes before the indexer has caught up.
    chain.head = 102n
    clock.advance(15_000)
    expect(await run()).toEqual([])
    // A real stall from here still alerts after 10 minutes.
    clock.advance(11 * MIN)
    const out = await run()
    expect(out).toHaveLength(1)
    expect(out[0]).toMatch(/indexer/i)
  })

  it('does not repeat an alert while the condition holds', async () => {
    chain.isPaused = true
    expect(await run()).toHaveLength(1)
    clock.advance(5 * MIN)
    expect(await run()).toEqual([])
    clock.advance(5 * MIN)
    expect(await run()).toEqual([])
    expect(sent).toHaveLength(1)
  })

  it('keeps checking the other rules when one read fails', async () => {
    chain.signerAddress = privateKeyToAccount('0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a').address
    chain.vaultPaused = async () => { throw new Error('rpc down') }
    const out = await run()
    expect(out).toHaveLength(1)
    expect(out[0]).toMatch(/signer/i)
  })
})

describe('sendAlert', () => {
  it('posts the text to the Discord webhook', async () => {
    const calls: { url: string; init: RequestInit }[] = []
    const fetchFn = (async (url: string, init: RequestInit) => {
      calls.push({ url, init })
      return new Response(null, { status: 204 })
    }) as unknown as typeof fetch
    await sendAlert({ ALERT_WEBHOOK_URL: 'https://discord.example/hook' }, fetchFn, 'hello')
    expect(calls).toHaveLength(1)
    expect(calls[0]!.url).toBe('https://discord.example/hook')
    expect(calls[0]!.init.method).toBe('POST')
    expect(JSON.parse(String(calls[0]!.init.body))).toEqual({ content: 'hello' })
  })

  it('gives up on a hung webhook after 10 seconds', async () => {
    let signal: AbortSignal | undefined
    const fetchFn = (async (_url: string, init: RequestInit) => {
      signal = init.signal ?? undefined
      return new Response(null, { status: 204 })
    }) as unknown as typeof fetch
    const timeout = vi.spyOn(AbortSignal, 'timeout')
    try {
      await sendAlert({ ALERT_WEBHOOK_URL: 'https://discord.example/hook' }, fetchFn, 'hello')
      expect(timeout).toHaveBeenCalledWith(10_000)
      expect(signal).toBe(timeout.mock.results[0]!.value)
    } finally {
      timeout.mockRestore()
    }
  })

  it('does nothing without a webhook URL', async () => {
    let called = false
    const fetchFn = (async () => { called = true; return new Response(null) }) as unknown as typeof fetch
    await sendAlert({ ALERT_WEBHOOK_URL: undefined }, fetchFn, 'hello')
    expect(called).toBe(false)
  })

  it('never throws on network errors or bad statuses', async () => {
    const boom = (async () => { throw new Error('offline') }) as unknown as typeof fetch
    await expect(sendAlert({ ALERT_WEBHOOK_URL: 'https://discord.example/hook' }, boom, 'x')).resolves.toBeUndefined()
    const bad = (async () => new Response('nope', { status: 500 })) as unknown as typeof fetch
    await expect(sendAlert({ ALERT_WEBHOOK_URL: 'https://discord.example/hook' }, bad, 'x')).resolves.toBeUndefined()
  })
})
