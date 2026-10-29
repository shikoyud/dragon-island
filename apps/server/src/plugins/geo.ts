import type { FastifyInstance } from 'fastify'
import type { Config } from '../config'
import { AppError } from './errors'

/**
 * Paths a blocked country may not use: sign-in (/auth/*), play (/actions) and withdrawals (/withdraw,
 * /withdraw/*). /health, /admin/*, /me, /season* and the rest are never geo-blocked.
 */
export function isGeoBlockedPath(url: string): boolean {
  const path = url.split('?', 1)[0]!
  return path.startsWith('/auth/')
    || path === '/actions' || path.startsWith('/actions/')
    || path === '/withdraw' || path.startsWith('/withdraw/')
}

/**
 * Cloudflare codes that do not name a country: XX (unknown) and T1 (Tor). While a block list is set they
 * are refused like a listed country, because the block cannot be enforced for a request whose country is
 * hidden; Tor is the cheapest way round a country block. Whether Tor must stay refused is counsel question 7.6.
 */
const UNPLACEABLE = new Set(['XX', 'T1'])

/**
 * Country block list (off by default). Only behind the proxy (TRUST_PROXY) is CF-IPCountry Cloudflare's
 * own value; without it any client could send the header, so it is ignored. Config is read per request.
 *
 * Fails closed while the list is non-empty: a missing or empty header means the request did not come
 * through Cloudflare (Caddy strips CF-IPCountry from any peer outside Cloudflare's ranges), so it is refused.
 */
export function registerGeoBlock(app: FastifyInstance, config: Config): void {
  app.addHook('onRequest', async req => {
    if (!config.TRUST_PROXY || config.BLOCKED_COUNTRIES.length === 0) return
    // The matched route pattern, so percent-encoded paths (`/%61ctions`) cannot slip past; raw URL for 404s.
    if (!isGeoBlockedPath(req.routeOptions.url ?? req.url)) return
    const header = req.headers['cf-ipcountry']
    const country = (Array.isArray(header) ? header[0] : header)?.trim().toUpperCase()
    if (!country || UNPLACEABLE.has(country) || config.BLOCKED_COUNTRIES.includes(country)) {
      throw new AppError(451, 'REGION_BLOCKED')
    }
  })
}
