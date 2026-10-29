import type { SeasonInfo } from '@wyrmhaven/shared'
import { ApiError } from './client'

export interface AdminPlayer {
  player: {
    id: string; address: `0x${string}`; level: number; trophies: number; earningUnlocked: boolean
    bannedAt: number | null; banReason: string | null; referrerId: string | null; createdAtMs: number
  }
  balance: { tokenWei: string; depositedWei: string; withdrawnWei: string; spentWei: string; earnedWei: string } | null
  sp: { total: number; today: number }
}
export interface AdminSeasonSummary {
  season: SeasonInfo
  closedAt: number | null
  inflows: { totalWei: string; bySource: Record<string, string> }
  poolWei: string
  standingsCount: number
  prizesPaidWei: string
}
export interface AdminStats { players: number; earningUnlocked: number; banned: number; actions24h: number; openVouchers: number }

export interface AdminApi {
  player(id: string): Promise<AdminPlayer>
  playerByAddress(address: string): Promise<AdminPlayer>
  ban(playerId: string, reason: string): Promise<{ ok: true }>
  unban(playerId: string): Promise<{ ok: true }>
  seasonSummary(id: number): Promise<AdminSeasonSummary>
  closeSeason(id: number): Promise<{ closed: number[] }>
  revealSeason(id: number): Promise<{ seasonId: number; secret: string }>
  recordInflow(source: string, wei: string, ref: string): Promise<{ ok: true; seasonId: number }>
  setPrice(microUsdPerToken: string): Promise<{ ok: true; microUsdPerToken: string }>
  runJob(name: string): Promise<{ job: string; result: unknown }>
  betaCount(): Promise<{ count: number }>
  betaAllow(addresses: string[]): Promise<{ added: number }>
  stats(): Promise<AdminStats>
}

/** The operator's view of the server (`x-admin-token` routes); the token never leaves this tab. */
export function createAdminApi(baseUrl: string, token: string, fetchImpl: typeof fetch = fetch): AdminApi {
  async function call<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
    const headers = new Headers({ accept: 'application/json', 'x-admin-token': token })
    if (body !== undefined) headers.set('content-type', 'application/json')
    const res = await fetchImpl(`${baseUrl}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>
    if (!res.ok) throw new ApiError(res.status, typeof json['error'] === 'string' ? json['error'] : `HTTP_${res.status}`)
    return json as T
  }
  return {
    player: id => call('GET', `/admin/players/${encodeURIComponent(id)}`),
    playerByAddress: address => call('GET', `/admin/players?address=${encodeURIComponent(address)}`),
    ban: (playerId, reason) => call('POST', '/admin/ban', { playerId, reason }),
    unban: playerId => call('POST', '/admin/unban', { playerId }),
    seasonSummary: id => call('GET', `/admin/season/${id}/summary`),
    closeSeason: id => call('POST', `/admin/season/${id}/close`),
    revealSeason: id => call('POST', `/admin/season/${id}/reveal`),
    recordInflow: (source, wei, ref) => call('POST', '/admin/inflow', { source, wei, ref }),
    setPrice: microUsdPerToken => call('POST', '/admin/price', { microUsdPerToken }),
    runJob: name => call('POST', `/admin/jobs/${encodeURIComponent(name)}/run`),
    betaCount: () => call('GET', '/admin/beta'),
    betaAllow: addresses => call('POST', '/admin/beta/allow', { addresses }),
    stats: () => call('GET', '/admin/stats'),
  }
}
