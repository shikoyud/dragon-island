import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { TASKS } from '../domain/tasks'
import type { Deps } from './deps'
import { entrants } from './db/schema'
import { getEntrantState, upsertFromX } from './entrants'
import { exportCsv } from './export'
import { clientIp, error, json, redirect } from './http'
import { join as joinWaitlist } from './join'
import { LIMITS, rateLimit } from './rateLimit'
import {
  OAUTH_COOKIE,
  SESSION_COOKIE,
  clearCookie,
  readOAuthCookie,
  readSession,
  signOAuthCookie,
  signSession,
} from './session'
import { countJoined } from './stats'
import { confirmTask as confirmTaskService, openTask as openTaskService } from './tasks'
import { bindWallet, issueNonce } from './wallet'

/** One function per API route. Route files only adapt Next's signature to these. */

const b64url = (buf: Buffer) => buf.toString('base64url')

function limited(deps: Deps, req: Request, bucket: keyof typeof LIMITS): boolean {
  const { limit, windowMs } = LIMITS[bucket]
  return !rateLimit(`${bucket}:${clientIp(req)}`, limit, windowMs, deps.clock.now())
}

/** The session's entrant id, only if that entrant still exists. */
async function sessionEntrant(deps: Deps, req: Request): Promise<string | null> {
  const id = await readSession(deps, req)
  if (!id || !z.uuid().safeParse(id).success) return null
  const [row] = await deps.db.select({ id: entrants.id }).from(entrants).where(eq(entrants.id, id))
  return row?.id ?? null
}

const refSchema = z.string().regex(/^[A-Za-z0-9_-]{1,32}$/)

export async function authStart(deps: Deps, req: Request): Promise<Response> {
  if (limited(deps, req, 'auth')) return error('RATE_LIMITED')
  const ref = refSchema.safeParse(new URL(req.url).searchParams.get('ref'))
  const state = b64url(randomBytes(16))
  const verifier = b64url(randomBytes(32))
  const challenge = b64url(createHash('sha256').update(verifier).digest())
  const cookie = await signOAuthCookie(deps, { state, verifier, ...(ref.success ? { ref: ref.data } : {}) })
  return redirect(deps.x.authorizeUrl(state, challenge), [cookie])
}

function sameString(a: string, b: string): boolean {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

export async function authCallback(deps: Deps, req: Request): Promise<Response> {
  if (limited(deps, req, 'auth')) return error('RATE_LIMITED')
  const clearOAuth = clearCookie(deps, OAUTH_COOKIE)
  const fail = (x: 'denied' | 'error' | 'too_new') => redirect(`/?x=${x}#join`, [clearOAuth])

  const params = new URL(req.url).searchParams
  const xError = params.get('error')
  if (xError) return fail(xError === 'access_denied' ? 'denied' : 'error')

  const saved = await readOAuthCookie(deps, req)
  const state = params.get('state')
  const code = params.get('code')
  if (!saved || !state || !code || !sameString(saved.state, state)) return fail('error')

  let result: Awaited<ReturnType<typeof upsertFromX>>
  try {
    const token = await deps.x.exchangeCode(code, saved.verifier)
    const profile = await deps.x.me(token)
    result = await upsertFromX(deps, profile, saved.ref)
  } catch {
    return fail('error')
  }
  if ('error' in result) return fail('too_new')
  return redirect('/#join', [clearOAuth, await signSession(deps, result.entrantId)])
}

export async function logout(deps: Deps, _req: Request): Promise<Response> {
  return json({ ok: true }, { headers: { 'set-cookie': clearCookie(deps, SESSION_COOKIE) } })
}

export async function me(deps: Deps, req: Request): Promise<Response> {
  const id = await sessionEntrant(deps, req)
  const state = id ? await getEntrantState(deps, id) : null
  return state ? json(state) : error('UNAUTHORIZED')
}

const taskSchema = z.enum(TASKS)

export async function openTask(deps: Deps, req: Request, params: { task: string }): Promise<Response> {
  const id = await sessionEntrant(deps, req)
  if (!id) return error('UNAUTHORIZED')
  const task = taskSchema.safeParse(params.task)
  if (!task.success) return error('BAD_REQUEST')
  const { openedAt } = await openTaskService(deps, id, task.data)
  return json({ openedAt: openedAt.toISOString() })
}

export async function confirmTask(deps: Deps, req: Request, params: { task: string }): Promise<Response> {
  const id = await sessionEntrant(deps, req)
  if (!id) return error('UNAUTHORIZED')
  const task = taskSchema.safeParse(params.task)
  if (!task.success) return error('BAD_REQUEST')
  const res = await confirmTaskService(deps, id, task.data)
  if ('error' in res) return error(res.error)
  return json({ confirmedAt: res.confirmedAt.toISOString() })
}

export async function walletNonce(deps: Deps, req: Request): Promise<Response> {
  if (limited(deps, req, 'wallet')) return error('RATE_LIMITED')
  const id = await sessionEntrant(deps, req)
  if (!id) return error('UNAUTHORIZED')
  return json({ nonce: await issueNonce(deps, id) })
}

const walletBody = z.object({
  address: z.string(),
  signature: z.string().regex(/^0x[0-9a-fA-F]+$/),
  nonce: z.string(),
})

export async function wallet(deps: Deps, req: Request): Promise<Response> {
  if (limited(deps, req, 'wallet')) return error('RATE_LIMITED')
  const id = await sessionEntrant(deps, req)
  if (!id) return error('UNAUTHORIZED')
  const body = walletBody.safeParse(await req.json().catch(() => undefined))
  if (!body.success) return error('BAD_REQUEST')
  const res = await bindWallet(deps, id, body.data)
  if ('error' in res) return error(res.error)
  return json(res)
}

export async function join(deps: Deps, req: Request): Promise<Response> {
  if (limited(deps, req, 'join')) return error('RATE_LIMITED')
  const id = await sessionEntrant(deps, req)
  if (!id) return error('UNAUTHORIZED')
  let res: Awaited<ReturnType<typeof joinWaitlist>>
  try {
    res = await joinWaitlist(deps, id)
  } catch (e) {
    // join() throws if the entrant vanished between the session check and the transaction.
    if (!(await sessionEntrant(deps, req))) return error('UNAUTHORIZED')
    throw e
  }
  if ('error' in res) return error(res.error)
  return json(res)
}

export async function stats(deps: Deps, _req: Request): Promise<Response> {
  return json({ joined: await countJoined(deps) }, { headers: { 'cache-control': 'public, s-maxage=60' } })
}

export async function adminExport(deps: Deps, req: Request): Promise<Response> {
  const expected = deps.config.ADMIN_TOKEN
  const header = req.headers.get('authorization') ?? ''
  const given = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : ''
  if (!expected || !given) return error('UNAUTHORIZED')
  // Compare fixed-length digests so neither content nor length leaks through timing.
  const digest = (s: string) => createHash('sha256').update(s).digest()
  if (!timingSafeEqual(digest(given), digest(expected))) return error('UNAUTHORIZED')
  return new Response(await exportCsv(deps), {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': 'attachment; filename="waitlist.csv"',
      'cache-control': 'no-store',
    },
  })
}
