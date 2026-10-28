import { describe, expect, it } from 'vitest'
import { countJoined } from '../src/server/stats'
import { buildDeps } from '../src/server/getDeps'
import { rateLimit } from '../src/server/rateLimit'
import { FakeXClient, HttpXClient } from '../src/server/x'

const SECRET = 'test-secret-test-secret-test-secret!'

describe('buildDeps', () => {
  it('throws in production without DATABASE_URL', async () => {
    await expect(buildDeps({ NODE_ENV: 'production', SESSION_SECRET: SECRET })).rejects.toThrow(/DATABASE_URL/)
  })

  it('throws when X_FAKE=1 in production', async () => {
    await expect(
      buildDeps({ NODE_ENV: 'production', SESSION_SECRET: SECRET, DATABASE_URL: 'postgres://u:p@h/db', X_FAKE: '1' }),
    ).rejects.toThrow(/X_FAKE/)
  })

  it('uses a migrated PGlite and the fake X client in dev', async () => {
    const deps = await buildDeps({ NODE_ENV: 'development', SESSION_SECRET: SECRET, X_FAKE: '1', PGLITE_DIR: 'memory://' })
    try {
      expect(deps.x).toBeInstanceOf(FakeXClient)
      expect(await countJoined(deps)).toBe(0)
    } finally {
      await deps.close()
    }
  })

  it('uses the HTTP X client unless X_FAKE=1', async () => {
    const deps = await buildDeps({
      NODE_ENV: 'test',
      SESSION_SECRET: SECRET,
      PGLITE_DIR: 'memory://',
      X_CLIENT_ID: 'cid',
      X_CLIENT_SECRET: 'cs',
      NEXT_PUBLIC_SITE_URL: 'http://localhost:3000',
    })
    try {
      expect(deps.x).toBeInstanceOf(HttpXClient)
    } finally {
      await deps.close()
    }
  })
})

describe('rateLimit', () => {
  it('allows `limit` hits per fixed window, then resets', () => {
    const t0 = new Date('2026-11-01T00:00:00Z')
    const at = (ms: number) => new Date(t0.getTime() + ms)
    for (let i = 0; i < 3; i++) expect(rateLimit('rl-test', 3, 1000, at(i))).toBe(true)
    expect(rateLimit('rl-test', 3, 1000, at(999))).toBe(false)
    expect(rateLimit('rl-other', 3, 1000, at(999))).toBe(true)
    expect(rateLimit('rl-test', 3, 1000, at(1000))).toBe(true)
  })
})
