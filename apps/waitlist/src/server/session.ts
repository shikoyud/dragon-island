import { jwtVerify, SignJWT } from 'jose'
import { z } from 'zod'
import type { Deps } from './deps'
import { readCookie, serializeCookie } from './http'

export const SESSION_COOKIE = 'wh_session'
export const OAUTH_COOKIE = 'wh_oauth'
export const SESSION_TTL_S = 30 * 86_400
export const OAUTH_TTL_S = 10 * 60

const ALG = 'HS256'
const secure = (deps: Deps) => deps.config.NODE_ENV === 'production'
const key = (deps: Deps) => new TextEncoder().encode(deps.config.SESSION_SECRET)

async function sign(deps: Deps, claims: Record<string, unknown>, ttlS: number): Promise<string> {
  const iat = Math.floor(deps.clock.now().getTime() / 1000)
  return new SignJWT(claims).setProtectedHeader({ alg: ALG }).setIssuedAt(iat).setExpirationTime(iat + ttlS).sign(key(deps))
}

async function verify(deps: Deps, token: string | null): Promise<Record<string, unknown> | null> {
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, key(deps), { algorithms: [ALG], currentDate: deps.clock.now() })
    return payload
  } catch {
    return null
  }
}

/** `Set-Cookie` value for a fresh 30-day session holding the entrant id. */
export async function signSession(deps: Deps, entrantId: string): Promise<string> {
  const token = await sign(deps, { sub: entrantId, typ: 'session' }, SESSION_TTL_S)
  return serializeCookie(SESSION_COOKIE, token, { maxAge: SESSION_TTL_S, secure: secure(deps) })
}

/** The entrant id from a valid session cookie, or null. Does not check that the entrant still exists. */
export async function readSession(deps: Deps, req: Request): Promise<string | null> {
  const payload = await verify(deps, readCookie(req, SESSION_COOKIE))
  if (payload?.typ !== 'session' || typeof payload.sub !== 'string') return null
  return payload.sub
}

export type OAuthState = { state: string; verifier: string; ref?: string }
const oauthSchema = z.object({ typ: z.literal('oauth'), state: z.string(), verifier: z.string(), ref: z.string().optional() })

export async function signOAuthCookie(deps: Deps, value: OAuthState): Promise<string> {
  const token = await sign(deps, { typ: 'oauth', ...value }, OAUTH_TTL_S)
  return serializeCookie(OAUTH_COOKIE, token, { maxAge: OAUTH_TTL_S, secure: secure(deps) })
}

export async function readOAuthCookie(deps: Deps, req: Request): Promise<OAuthState | null> {
  const parsed = oauthSchema.safeParse(await verify(deps, readCookie(req, OAUTH_COOKIE)))
  if (!parsed.success) return null
  const { state, verifier, ref } = parsed.data
  return ref === undefined ? { state, verifier } : { state, verifier, ref }
}

export const clearCookie = (deps: Deps, name: string) => serializeCookie(name, '', { maxAge: 0, secure: secure(deps) })
