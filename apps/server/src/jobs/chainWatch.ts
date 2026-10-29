import { eq } from 'drizzle-orm'
import { formatUnits, type Hex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import type { ChainClient } from '../chain/client'
import type { Clock } from '../clock'
import type { Config } from '../config'
import type { Db } from '../db/client'
import { indexerState } from '../db/schema'
import { INDEXER_KEY } from '../services/indexer'

const MINUTE = 60_000
const DAY = 24 * 60 * MINUTE
/** Indexer is lagging when its last block has not moved for this long while there are blocks to index. */
export const INDEXER_STALL_MS = 10 * MINUTE
/** Alert above a 2.5% drop (25 per mille) within any 24 h window; the vault's design cap is 2% per day. */
const DROP_PER_MILLE = 25n

/**
 * Everything the watch remembers between runs. In memory only (no migrations on this branch), so a
 * restart forgets it: an ongoing condition alerts again once after boot, the balance window refills
 * over 24 h, and indexer lag cannot fire until 10 minutes after boot.
 */
export interface ChainWatchState {
  /** Undefined until the first successful read. */
  paused?: boolean
  signerMismatch: boolean
  /** One sample per run, pruned to the last 24 h. */
  balanceSamples: { atMs: number; balance: bigint }[]
  balanceDropped: boolean
  /** Last indexer_state.last_block seen and the clock time it last changed. */
  indexer?: { lastBlock: bigint; advancedAtMs: number }
  indexerLagging: boolean
}

export function newChainWatchState(): ChainWatchState {
  return { signerMismatch: false, balanceSamples: [], balanceDropped: false, indexerLagging: false }
}

export interface ChainWatchDeps {
  db: Db
  clock: Clock
  chain: ChainClient
  config: Config
  alert: (text: string) => Promise<void>
  /** Carried across runs; create it once with newChainWatchState() (or use createChainWatch). */
  state: ChainWatchState
  log?: (message: string, err: unknown) => void
}

const PREFIX = '[Dragon Island chain watch]'
const fmt = (wei: bigint) => `${formatUnits(wei, 18)} WYRM`

/**
 * One pass over the vault's health rules. Each rule alerts once when its condition becomes true
 * (pause also alerts on unpause; the others send a "recovered" note when they clear). A failed read
 * skips that rule for this run and leaves the others running. Returns the alert texts sent.
 */
export async function chainWatch(deps: ChainWatchDeps): Promise<string[]> {
  const { db, clock, chain, config, state } = deps
  const log = deps.log ?? ((message, err) => console.error(message, err instanceof Error ? err.message : err))
  const sent: string[] = []
  const now = clock()
  const emit = async (text: string) => {
    const full = `${PREFIX} ${text}`
    sent.push(full)
    await deps.alert(full)
  }
  const rule = async (name: string, fn: () => Promise<void>) => {
    try {
      await fn()
    } catch (err) {
      log(`chain watch: ${name} check failed`, err)
    }
  }

  await rule('pause', async () => {
    const paused = await chain.vaultPaused()
    const before = state.paused
    state.paused = paused
    if (paused && before !== true) await emit('Vault is PAUSED: claims and entries are halted.')
    else if (!paused && before === true) await emit('Vault was unpaused.')
  })

  await rule('signer', async () => {
    if (!config.SIGNER_PRIVATE_KEY) return
    const expected = privateKeyToAccount(config.SIGNER_PRIVATE_KEY as Hex).address
    const onChain = await chain.vaultSigner()
    const mismatch = onChain.toLowerCase() !== expected.toLowerCase()
    const was = state.signerMismatch
    state.signerMismatch = mismatch
    if (mismatch && !was) {
      await emit(`Vault signer ${onChain} is not the server's voucher signer ${expected}: withdrawals will fail.`)
    } else if (!mismatch && was) {
      await emit('Vault signer matches the server signer again.')
    }
  })

  await rule('balance', async () => {
    if (!config.TOKEN_ADDRESS) return
    const balance = await chain.vaultTokenBalance()
    state.balanceSamples = state.balanceSamples.filter(s => s.atMs >= now - DAY)
    let max = balance
    for (const s of state.balanceSamples) if (s.balance > max) max = s.balance
    state.balanceSamples.push({ atMs: now, balance })
    const drop = max - balance
    const dropped = max > 0n && drop * 1000n > max * DROP_PER_MILLE
    const was = state.balanceDropped
    state.balanceDropped = dropped
    if (dropped && !was) {
      const bps = (drop * 10_000n) / max
      await emit(`Vault balance fell ${bps / 100n}.${(bps % 100n).toString().padStart(2, '0')}% in 24 h: ${fmt(max)} -> ${fmt(balance)}.`)
    } else if (!dropped && was) {
      await emit(`Vault balance drop has left the 24 h window (now ${fmt(balance)}).`)
    }
  })

  await rule('indexer', async () => {
    const head = await chain.blockNumber()
    const [row] = await db.select().from(indexerState).where(eq(indexerState.key, INDEXER_KEY))
    const lastBlock = row?.lastBlock ?? config.INDEXER_START_BLOCK - 1n
    if (!state.indexer || state.indexer.lastBlock !== lastBlock) state.indexer = { lastBlock, advancedAtMs: now }
    // Only blocks the indexer is allowed to process (past the confirmation depth) count as lag.
    const pending = head - BigInt(config.CONFIRMATIONS) > lastBlock
    const lagging = pending && now - state.indexer.advancedAtMs > INDEXER_STALL_MS
    const was = state.indexerLagging
    state.indexerLagging = lagging
    if (lagging && !was) {
      const mins = Math.floor((now - state.indexer.advancedAtMs) / MINUTE)
      await emit(`Indexer stuck at block ${lastBlock} for ${mins} min; chain head is ${head}.`)
    } else if (!lagging && was) {
      await emit(`Indexer is moving again (block ${lastBlock}).`)
    }
  })

  return sent
}

/** Binds fresh state once so the job registry can call the watch repeatedly. */
export function createChainWatch(deps: Omit<ChainWatchDeps, 'state'>): () => Promise<string[]> {
  const state = newChainWatchState()
  return () => chainWatch({ ...deps, state })
}
