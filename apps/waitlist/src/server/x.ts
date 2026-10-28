import { z } from 'zod'
import type { Config } from './config'
import type { XClient, XProfile } from './deps'

const AUTHORIZE_URL = 'https://x.com/i/oauth2/authorize'
const TOKEN_URL = 'https://api.x.com/2/oauth2/token'
const ME_URL = 'https://api.x.com/2/users/me?user.fields=created_at,profile_image_url'
const SCOPES = 'users.read tweet.read'

export const callbackPath = '/api/auth/x/callback'

const tokenSchema = z.object({ access_token: z.string().min(1) })
const meSchema = z.object({
  data: z.object({
    id: z.string().min(1),
    username: z.string().min(1),
    name: z.string(),
    profile_image_url: z.string().optional(),
    // Required: a missing or invalid date would make the account-age check fail open.
    created_at: z.string().refine((s) => !Number.isNaN(Date.parse(s)), 'invalid created_at'),
  }),
})

/** X OAuth 2.0 (confidential client, PKCE S256). The access token is used once and never stored. */
export class HttpXClient implements XClient {
  private readonly clientId: string
  private readonly clientSecret: string
  private readonly redirectUri: string

  constructor(
    config: Config,
    private readonly fetchImpl: typeof fetch = (...args) => fetch(...args),
  ) {
    if (!config.X_CLIENT_ID || !config.X_CLIENT_SECRET || !config.NEXT_PUBLIC_SITE_URL) {
      throw new Error('X OAuth needs X_CLIENT_ID, X_CLIENT_SECRET and NEXT_PUBLIC_SITE_URL')
    }
    this.clientId = config.X_CLIENT_ID
    this.clientSecret = config.X_CLIENT_SECRET
    this.redirectUri = `${config.NEXT_PUBLIC_SITE_URL.replace(/\/+$/, '')}${callbackPath}`
  }

  authorizeUrl(state: string, challenge: string): string {
    const url = new URL(AUTHORIZE_URL)
    url.search = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      scope: SCOPES,
      state,
      code_challenge: challenge,
      code_challenge_method: 'S256',
    }).toString()
    return url.toString()
  }

  async exchangeCode(code: string, verifier: string): Promise<string> {
    const basic = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')
    const res = await this.fetchImpl(TOKEN_URL, {
      method: 'POST',
      headers: { authorization: `Basic ${basic}`, 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: this.redirectUri,
        code_verifier: verifier,
      }).toString(),
    })
    if (!res.ok) throw new Error(`X token exchange failed: ${res.status}`)
    return tokenSchema.parse(await res.json()).access_token
  }

  async me(accessToken: string): Promise<XProfile> {
    const res = await this.fetchImpl(ME_URL, { headers: { authorization: `Bearer ${accessToken}` } })
    if (!res.ok) throw new Error(`X profile read failed: ${res.status}`)
    const { data } = meSchema.parse(await res.json())
    return {
      id: data.id,
      username: data.username,
      name: data.name,
      profileImageUrl: data.profile_image_url ?? '',
      createdAt: new Date(data.created_at),
    }
  }
}

const FAKE_CODE = 'fake-code'
const FAKE_TOKEN = 'fake-token'

/**
 * Local dev / e2e stand-in for X (`X_FAKE=1`, never in production). Authorize goes straight to our own
 * callback with the given state and a fake code; the profile is fixed and old enough to pass the age check.
 */
export class FakeXClient implements XClient {
  private readonly profile: XProfile

  constructor(private readonly opts: { siteUrl: string; profile?: Partial<XProfile> }) {
    this.profile = {
      id: '1000000001',
      username: 'wyrm_tester',
      name: 'Wyrm Tester',
      profileImageUrl: '',
      createdAt: new Date('2015-01-01T00:00:00Z'),
      ...opts.profile,
    }
  }

  authorizeUrl(state: string, _challenge: string): string {
    const q = new URLSearchParams({ state, code: FAKE_CODE })
    return `${this.opts.siteUrl.replace(/\/+$/, '')}${callbackPath}?${q}`
  }

  async exchangeCode(code: string, _verifier: string): Promise<string> {
    if (code !== FAKE_CODE) throw new Error('fake X: unknown code')
    return FAKE_TOKEN
  }

  async me(_accessToken: string): Promise<XProfile> {
    return { ...this.profile }
  }
}
