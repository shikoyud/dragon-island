/** JSON response helpers, cookie (de)serialization and client IP for the route handlers. */

export type ErrorCode =
  | 'UNAUTHORIZED'
  | 'X_ACCOUNT_TOO_NEW'
  | 'TOO_EARLY'
  | 'TASK_NOT_OPENED'
  | 'NONCE_INVALID'
  | 'INVALID_SIGNATURE'
  | 'WALLET_TAKEN'
  | 'TASKS_INCOMPLETE'
  | 'WALLET_REQUIRED'
  | 'RATE_LIMITED'
  | 'BAD_REQUEST'

const STATUS: Record<ErrorCode, number> = {
  UNAUTHORIZED: 401,
  X_ACCOUNT_TOO_NEW: 403,
  TOO_EARLY: 409,
  TASK_NOT_OPENED: 409,
  NONCE_INVALID: 400,
  INVALID_SIGNATURE: 400,
  WALLET_TAKEN: 409,
  TASKS_INCOMPLETE: 409,
  WALLET_REQUIRED: 409,
  RATE_LIMITED: 429,
  BAD_REQUEST: 400,
}

export function json(body: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers)
  headers.set('content-type', 'application/json')
  if (!headers.has('cache-control')) headers.set('cache-control', 'no-store')
  return new Response(JSON.stringify(body), { ...init, headers })
}

export function error(code: ErrorCode): Response {
  return json({ error: code }, { status: STATUS[code] })
}

/** 302 with a relative Location (allowed by RFC 9110) and any Set-Cookie headers. */
export function redirect(location: string, cookies: string[] = []): Response {
  const headers = new Headers({ location, 'cache-control': 'no-store' })
  for (const c of cookies) headers.append('set-cookie', c)
  return new Response(null, { status: 302, headers })
}

export function readCookie(req: Request, name: string): string | null {
  const header = req.headers.get('cookie')
  if (!header) return null
  for (const part of header.split(';')) {
    const i = part.indexOf('=')
    if (i < 0) continue
    if (part.slice(0, i).trim() === name) return part.slice(i + 1).trim()
  }
  return null
}

export function serializeCookie(name: string, value: string, opts: { maxAge: number; secure: boolean }): string {
  return [
    `${name}=${value}`,
    'Path=/',
    `Max-Age=${opts.maxAge}`,
    'HttpOnly',
    'SameSite=Lax',
    ...(opts.secure ? ['Secure'] : []),
  ].join('; ')
}

/** First `x-forwarded-for` entry, else `x-real-ip`, else 'unknown'. */
export function clientIp(req: Request): string {
  const first = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  if (first) return first
  return req.headers.get('x-real-ip')?.trim() || 'unknown'
}
