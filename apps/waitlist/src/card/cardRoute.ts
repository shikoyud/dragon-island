import { ACTIVE_ART } from '../art/slots'
import type { Deps } from '../server/deps'
import { getCardData } from '../server/entrants'
import { renderCard, type RenderOpts } from './renderCard'

/** `/api/card/<code>[.png]` logic. 404 for an unknown code or an entrant who has not joined. */
export async function cardResponse(deps: Deps, rawCode: string, opts: RenderOpts = {}): Promise<Response> {
  const code = rawCode.replace(/\.png$/, '')
  const data = await getCardData(deps, code)
  if (!data) return new Response('Not found', { status: 404, headers: { 'cache-control': 'no-store' } })

  const res = await renderCard(data, opts)
  const headers = new Headers(res.headers)
  headers.set('cache-control', 'public, max-age=3600')
  headers.set('etag', `"${code}-${ACTIVE_ART.version}-${data.position}"`)
  return new Response(res.body, { status: 200, headers })
}
