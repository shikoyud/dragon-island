import { prizePoolWei } from '@wyrmhaven/game-core'
import { timingSafeEqual } from 'node:crypto'
import { and, count, eq, gte, isNotNull, isNull, sql } from 'drizzle-orm'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { getAddress } from 'viem'
import { z } from 'zod'
import type { AppDeps } from '../app'
import type { Db } from '../db/client'
import { actionLog, balances, betaAllowlist, players, seasonPrizes, vouchers } from '../db/schema'
import { CLOSE_GRACE_MS, closeSeasons } from '../jobs/seasonClose'
import { AppError } from '../plugins/errors'
import { banPlayer, unbanPlayer } from '../services/bans'
import { recordInflow, seasonInflows } from '../services/inflows'
import { setManualPrice } from '../services/price'
import { ensureCurrentSeason, getSeasonById, revealSecret, toSeasonInfo } from '../services/season'
import { spTotals } from '../services/sp'
import { standings } from '../services/standings'

export type JobRegistry = Record<string, () => Promise<unknown>>

const banBody = z.object({ playerId: z.string().uuid(), reason: z.string().min(1).max(500) })
const unbanBody = z.object({ playerId: z.string().uuid() })
const priceBody = z.object({ microUsdPerToken: z.string().regex(/^[0-9]+$/) })
const inflowBody = z.object({ source: z.literal('buyback'), wei: z.string().regex(/^[0-9]+$/), ref: z.string().min(1).max(200) })
const idParam = z.object({ id: z.coerce.number().int().positive() })
const playerParam = z.object({ id: z.string().uuid() })
const addressQuery = z.object({ address: z.string().regex(/^0x[0-9a-fA-F]{40}$/) })
const betaBody = z.object({ addresses: z.array(z.string().regex(/^0x[0-9a-fA-F]{40}$/)).min(1).max(500) })
const jobParam = z.object({ name: z.string().min(1) })

const str = (v: bigint) => v.toString()

export function adminRoutes(app: FastifyInstance, deps: AppDeps, jobs: JobRegistry): void {
  const { db, clock, config } = deps
  const expected = Buffer.from(config.ADMIN_TOKEN)
  const requireAdmin = async (req: FastifyRequest, _reply: FastifyReply) => {
    const given = Buffer.from(typeof req.headers['x-admin-token'] === 'string' ? req.headers['x-admin-token'] : '')
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) throw new AppError(401, 'UNAUTHORIZED')
  }
  const opts = { preHandler: requireAdmin }

  app.post('/admin/beta/allow', opts, async req => {
    const { addresses } = betaBody.parse(req.body)
    const unique = [...new Set(addresses.map(a => a.toLowerCase()))]
    const inserted = await db.insert(betaAllowlist).values(unique.map(address => ({ address }))).onConflictDoNothing().returning({ a: betaAllowlist.address })
    return { added: inserted.length }
  })
  app.get('/admin/beta', opts, async () => {
    const [row] = await db.select({ n: count() }).from(betaAllowlist)
    return { count: row?.n ?? 0 }
  })

  app.post('/admin/ban', opts, async req => {
    const { playerId, reason } = banBody.parse(req.body)
    await banPlayer(db, clock, playerId, reason)
    return { ok: true }
  })

  app.post('/admin/unban', opts, async req => {
    await unbanPlayer(db, unbanBody.parse(req.body).playerId)
    return { ok: true }
  })

  app.post('/admin/price', opts, async req => {
    const price = BigInt(priceBody.parse(req.body).microUsdPerToken)
    if (price <= 0n) throw new AppError(400, 'INVALID_AMOUNT')
    await setManualPrice(db, price)
    return { ok: true, microUsdPerToken: price.toString() }
  })

  app.post('/admin/season/:id/reveal', opts, async req => {
    const { id } = idParam.parse(req.params)
    return { seasonId: id, secret: await revealSecret(db, clock, id) }
  })

  app.post('/admin/jobs/:name/run', opts, async req => {
    const { name } = jobParam.parse(req.params)
    const job = jobs[name]
    if (!job) throw new AppError(404, 'NOT_FOUND')
    return { job: name, result: await job() }
  })

  // ---- Live ops (Phase 6) ----

  app.get('/admin/players/:id', opts, async req => playerSummary(db, clock, playerParam.parse(req.params).id))
  app.get('/admin/players', opts, async req => {
    const { address } = addressQuery.parse(req.query)
    const [p] = await db.select({ id: players.id }).from(players).where(eq(players.address, address.toLowerCase()))
    if (!p) throw new AppError(404, 'NOT_FOUND')
    return playerSummary(db, clock, p.id)
  })

  app.get('/admin/season/:id/summary', opts, async req => {
    const { id } = idParam.parse(req.params)
    const s = await getSeasonById(db, id)
    if (!s) throw new AppError(404, 'NOT_FOUND')
    const inflows = await seasonInflows(db, id)
    const [paid] = await db.select({ sum: sql<string>`coalesce(sum(${seasonPrizes.wei}), 0)::text` }).from(seasonPrizes).where(eq(seasonPrizes.seasonId, id))
    return {
      season: toSeasonInfo(s),
      closedAt: s.closedAt ? s.closedAt.getTime() : null,
      inflows: { totalWei: str(inflows.totalWei), bySource: Object.fromEntries(Object.entries(inflows.bySource).map(([k, v]) => [k, str(v)])) },
      poolWei: str(prizePoolWei(inflows.totalWei)),
      standingsCount: (await standings(db, id)).length,
      prizesPaidWei: paid?.sum ?? '0',
    }
  })

  /** Buybacks (and manual corrections) enter the inflow ledger here; the other sources are recorded automatically. */
  app.post('/admin/inflow', opts, async req => {
    const { source, wei, ref } = inflowBody.parse(req.body)
    const amount = BigInt(wei)
    if (amount <= 0n) throw new AppError(400, 'INVALID_AMOUNT')
    const recorded = await db.transaction(tx => recordInflow(tx, clock, source, amount, ref))
    if (!recorded) throw new AppError(409, 'DUPLICATE_REF')
    return { ok: true, seasonId: (await ensureCurrentSeason(db, clock)).id }
  })

  app.post('/admin/season/:id/close', opts, async req => {
    const { id } = idParam.parse(req.params)
    const s = await getSeasonById(db, id)
    if (!s) throw new AppError(404, 'NOT_FOUND')
    if (s.closedAt) throw new AppError(409, 'ALREADY_CLOSED')
    if (s.endsAt.getTime() > clock()) throw new AppError(409, 'SEASON_ACTIVE')
    // Ended but inside the grace window: late actions may still commit, so closing now would drop them.
    if (s.endsAt.getTime() + CLOSE_GRACE_MS > clock()) throw new AppError(409, 'SEASON_GRACE')
    const { closed, busy } = await closeSeasons({ db, clock }, { seasonId: id })
    if (busy) throw new AppError(409, 'SEASON_BUSY')
    // Closed by a concurrent run between our read and the lock.
    if (!closed.includes(id)) throw new AppError(409, 'ALREADY_CLOSED')
    return { closed }
  })

  app.get('/admin/stats', opts, async () => {
    const since = new Date(clock() - 86_400_000)
    const [all] = await db.select({ n: count() }).from(players)
    const [unlocked] = await db.select({ n: count() }).from(players).where(eq(players.earningUnlocked, true))
    const [banned] = await db.select({ n: count() }).from(players).where(isNotNull(players.bannedAt))
    const [actions] = await db.select({ n: count() }).from(actionLog).where(gte(actionLog.createdAt, since))
    const [open] = await db.select({ n: count() }).from(vouchers).where(and(isNull(vouchers.claimedAt), isNull(vouchers.expiredAt)))
    return { players: all!.n, earningUnlocked: unlocked!.n, banned: banned!.n, actions24h: actions!.n, openVouchers: open!.n }
  })
}

async function playerSummary(db: Db, clock: () => number, playerId: string) {
  const [p] = await db.select().from(players).where(eq(players.id, playerId))
  if (!p) throw new AppError(404, 'NOT_FOUND')
  const [b] = await db.select().from(balances).where(eq(balances.playerId, playerId))
  const season = await ensureCurrentSeason(db, clock)
  const sp = await spTotals(db, playerId, season.id, Math.floor(clock() / 86_400_000))
  return {
    player: {
      id: p.id, address: getAddress(p.address), level: p.level, trophies: p.trophies, earningUnlocked: p.earningUnlocked,
      bannedAt: p.bannedAt ? p.bannedAt.getTime() : null, banReason: p.banReason, referrerId: p.referrerId, createdAtMs: p.createdAt.getTime(),
    },
    balance: b ? { tokenWei: str(b.tokenWei), depositedWei: str(b.depositedWei), withdrawnWei: str(b.withdrawnWei), spentWei: str(b.spentWei), earnedWei: str(b.earnedWei) } : null,
    sp,
  }
}
