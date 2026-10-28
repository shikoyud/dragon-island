import { LAUNCH_CATALOG, type Catalog } from '@wyrmhaven/game-core'
import { eq } from 'drizzle-orm'
import Fastify, { type FastifyInstance } from 'fastify'
import { getAddress, type Address, type Hex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { createViemChainClient, type ChainClient } from './chain/client'
import { FakeChainClient } from './chain/fake'
import type { Clock } from './clock'
import type { Config } from './config'
import type { Db } from './db/client'
import { balances } from './db/schema'
import { registerErrorHandler } from './plugins/errors'
import { requireSession } from './plugins/session'
import { runBurnBatch } from './jobs/burnBatch'
import { expireVouchers } from './jobs/voucherExpiry'
import { actionRoutes } from './routes/actions'
import { adminRoutes, type JobRegistry } from './routes/admin'
import { authRoutes } from './routes/auth'
import { pvpRoutes } from './routes/pvp'
import { withdrawRoutes } from './routes/withdraw'
import type { WithdrawDeps } from './services/withdraw'
import { requireActive } from './services/bans'
import { runIndexer } from './services/indexer'
import { ensureCurrentSeason } from './services/season'
import { seasonRoutes } from './routes/season'
import type { ActionDeps } from './services/actions'
import { peekOfferOpponent, resolveOffer, settleDefence } from './services/battles'
import { ManualPriceSource, type PriceSource } from './services/price'
import { getSeasonInfo } from './services/season'
import { spForAction, spRoutes } from './services/sp'

/** Everything the server needs, injected so tests can swap the clock, chain and price. */
export interface AppDeps {
  db: Db
  clock: Clock
  config: Config
  catalog?: Catalog
  price?: PriceSource
  /** Defaults to a viem client when VAULT_ADDRESS is configured, else an in-memory fake (dev/tests). */
  chain?: ChainClient
}

declare module 'fastify' {
  interface FastifyInstance {
    /** Named background jobs, run by the scheduler and by POST /admin/jobs/:name/run. */
    jobs: JobRegistry
  }
}

export async function buildApp(deps: AppDeps): Promise<FastifyInstance> {
  const app = Fastify({ logger: false })
  const { db, clock } = deps
  deps.catalog ??= LAUNCH_CATALOG
  deps.price ??= new ManualPriceSource(db)
  const { config } = deps
  deps.chain ??= config.VAULT_ADDRESS && config.RPC_URL
    ? createViemChainClient({ rpcUrl: config.RPC_URL, vault: config.VAULT_ADDRESS as Address, operatorKey: config.OPERATOR_PRIVATE_KEY as Hex | undefined })
    : new FakeChainClient()
  const withdrawDeps: WithdrawDeps | null = config.SIGNER_PRIVATE_KEY && config.VAULT_ADDRESS
    ? { db, clock, chain: deps.chain, signer: privateKeyToAccount(config.SIGNER_PRIVATE_KEY as Hex), vault: config.VAULT_ADDRESS as Address, chainId: config.CHAIN_ID }
    : null
  registerErrorHandler(app)

  const actionDeps: ActionDeps = {
    db, clock, catalog: deps.catalog, price: deps.price,
    awardSp: (tx, args) => spForAction(tx, args, clock),
    resolveOffer, settleDefence, peekOfferOpponent,
  }
  authRoutes(app, deps)
  seasonRoutes(app, deps)
  actionRoutes(app, deps, actionDeps)
  spRoutes(app, deps)
  pvpRoutes(app, deps)
  withdrawRoutes(app, deps, withdrawDeps)

  const chain = deps.chain
  const jobs: JobRegistry = {
    indexer: () => runIndexer({ db, chain, confirmations: config.CONFIRMATIONS, clock }),
    voucherExpiry: () => expireVouchers({ db, clock }),
    burnBatch: () => runBurnBatch({ db, chain, clock }),
    season: () => ensureCurrentSeason(db, clock),
  }
  app.decorate('jobs', jobs)
  adminRoutes(app, deps, jobs)

  app.get('/health', async () => ({ ok: true }))

  app.get('/me', { preHandler: requireSession(db, clock) }, async req => {
    const p = req.player!
    const [bal] = await db.select().from(balances).where(eq(balances.playerId, p.id))
    return {
      playerId: p.id,
      address: getAddress(p.address),
      state: p.state,
      balanceWei: (bal?.tokenWei ?? 0n).toString(),
      earningUnlocked: p.earningUnlocked,
      banned: p.bannedAt !== null,
      season: await getSeasonInfo(db, clock),
    }
  })

  return app
}
