import { LAUNCH_CATALOG, type Catalog } from '@wyrmhaven/game-core'
import { eq } from 'drizzle-orm'
import Fastify, { type FastifyInstance } from 'fastify'
import { getAddress } from 'viem'
import type { Clock } from './clock'
import type { Config } from './config'
import type { Db } from './db/client'
import { balances } from './db/schema'
import { registerErrorHandler } from './plugins/errors'
import { requireSession } from './plugins/session'
import { actionRoutes } from './routes/actions'
import { authRoutes } from './routes/auth'
import { seasonRoutes } from './routes/season'
import type { ActionDeps } from './services/actions'
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
}

export async function buildApp(deps: AppDeps): Promise<FastifyInstance> {
  const app = Fastify({ logger: false })
  const { db, clock } = deps
  deps.catalog ??= LAUNCH_CATALOG
  deps.price ??= new ManualPriceSource(db)
  registerErrorHandler(app)

  const actionDeps: ActionDeps = {
    db, clock, catalog: deps.catalog, price: deps.price,
    awardSp: (tx, args) => spForAction(tx, args, clock),
  }
  authRoutes(app, deps)
  seasonRoutes(app, deps)
  actionRoutes(app, deps, actionDeps)
  spRoutes(app, deps)

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
