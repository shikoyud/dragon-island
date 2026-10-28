import { describe, expect, it } from 'vitest'
import { loadConfig } from '../src/server/config'
import { FakeXClient, HttpXClient } from '../src/server/x'

const config = loadConfig({
  SESSION_SECRET: 'test-secret-test-secret-test-secret!',
  X_CLIENT_ID: 'cid',
  X_CLIENT_SECRET: 'csecret',
  NEXT_PUBLIC_SITE_URL: 'https://wyrm.example',
})

type Call = { url: string; init: RequestInit | undefined }
function stubFetch(body: unknown, status = 200): { fetch: typeof fetch; calls: Call[] } {
  const calls: Call[] = []
  const f = (async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(input), init })
    return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
  }) as typeof fetch
  return { fetch: f, calls }
}

describe('HttpXClient', () => {
  it('authorize URL carries state, challenge, scopes and redirect URI', () => {
    const url = new URL(new HttpXClient(config).authorizeUrl('st4te', 'ch4llenge'))
    expect(url.origin + url.pathname).toBe('https://x.com/i/oauth2/authorize')
    const p = url.searchParams
    expect(p.get('response_type')).toBe('code')
    expect(p.get('client_id')).toBe('cid')
    expect(p.get('redirect_uri')).toBe('https://wyrm.example/api/auth/x/callback')
    expect(p.get('scope')).toBe('users.read tweet.read')
    expect(p.get('state')).toBe('st4te')
    expect(p.get('code_challenge')).toBe('ch4llenge')
    expect(p.get('code_challenge_method')).toBe('S256')
  })

  it('token exchange sends Basic auth, code, verifier and redirect URI', async () => {
    const { fetch, calls } = stubFetch({ access_token: 'tok', token_type: 'bearer' })
    const token = await new HttpXClient(config, fetch).exchangeCode('the-code', 'the-verifier')
    expect(token).toBe('tok')
    expect(calls).toHaveLength(1)
    const { url, init } = calls[0]!
    expect(url).toBe('https://api.x.com/2/oauth2/token')
    expect(init?.method).toBe('POST')
    const headers = new Headers(init?.headers)
    expect(headers.get('authorization')).toBe(`Basic ${Buffer.from('cid:csecret').toString('base64')}`)
    expect(headers.get('content-type')).toBe('application/x-www-form-urlencoded')
    const body = new URLSearchParams(String(init?.body))
    expect(body.get('grant_type')).toBe('authorization_code')
    expect(body.get('code')).toBe('the-code')
    expect(body.get('code_verifier')).toBe('the-verifier')
    expect(body.get('redirect_uri')).toBe('https://wyrm.example/api/auth/x/callback')
  })

  it('token exchange throws on an error status', async () => {
    const { fetch } = stubFetch({ error: 'invalid_request' }, 400)
    await expect(new HttpXClient(config, fetch).exchangeCode('c', 'v')).rejects.toThrow()
  })

  it('me() reads the profile with a bearer token and maps created_at to a Date', async () => {
    const { fetch, calls } = stubFetch({
      data: {
        id: '42',
        username: 'ember',
        name: 'Ember',
        profile_image_url: 'https://pbs.twimg.com/profile_images/1/pic_normal.jpg',
        created_at: '2019-05-01T10:00:00.000Z',
      },
    })
    const profile = await new HttpXClient(config, fetch).me('tok')
    expect(profile).toEqual({
      id: '42',
      username: 'ember',
      name: 'Ember',
      profileImageUrl: 'https://pbs.twimg.com/profile_images/1/pic_normal.jpg',
      createdAt: new Date('2019-05-01T10:00:00.000Z'),
    })
    expect(calls[0]!.url).toBe('https://api.x.com/2/users/me?user.fields=created_at,profile_image_url')
    expect(new Headers(calls[0]!.init?.headers).get('authorization')).toBe('Bearer tok')
  })

  it('me() throws when created_at is missing or not a date', async () => {
    const base = { id: '42', username: 'ember', name: 'Ember' }
    await expect(new HttpXClient(config, stubFetch({ data: base }).fetch).me('t')).rejects.toThrow()
    await expect(
      new HttpXClient(config, stubFetch({ data: { ...base, created_at: 'not-a-date' } }).fetch).me('t'),
    ).rejects.toThrow()
  })

  it('me() throws on an error status', async () => {
    await expect(new HttpXClient(config, stubFetch({ title: 'Unauthorized' }, 401).fetch).me('t')).rejects.toThrow()
  })
})

describe('FakeXClient', () => {
  it('authorize URL points to the local callback with the state and a fake code', async () => {
    const x = new FakeXClient({ siteUrl: 'http://localhost:3000' })
    const url = new URL(x.authorizeUrl('st4te', 'ch'))
    expect(url.origin + url.pathname).toBe('http://localhost:3000/api/auth/x/callback')
    expect(url.searchParams.get('state')).toBe('st4te')
    const token = await x.exchangeCode(url.searchParams.get('code')!, 'v')
    const me = await x.me(token)
    expect(me.createdAt.getTime()).toBeLessThan(new Date('2020-01-01').getTime())
    expect(me.id).toMatch(/^\d+$/)
  })

  it('uses the given profile and rejects other codes', async () => {
    const x = new FakeXClient({ siteUrl: '', profile: { id: '7', username: 'tide' } })
    expect((await x.me('any')).username).toBe('tide')
    await expect(x.exchangeCode('wrong', 'v')).rejects.toThrow()
  })
})
