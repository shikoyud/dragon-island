import { describe, expect, it } from 'vitest'
import { loadConfig } from '../src/server/config'
import { publicConfig } from '../src/server/publicConfig'

describe('loadConfig', () => {
  it('throws when SESSION_SECRET is missing', () => {
    expect(() => loadConfig({})).toThrow()
  })
  it('defaults MIN_X_ACCOUNT_AGE_DAYS to 30', () => {
    expect(loadConfig({ SESSION_SECRET: 's'.repeat(32) }).MIN_X_ACCOUNT_AGE_DAYS).toBe(30)
  })
  it('reads MIN_X_ACCOUNT_AGE_DAYS from env', () => {
    expect(loadConfig({ SESSION_SECRET: 'x', MIN_X_ACCOUNT_AGE_DAYS: '7' }).MIN_X_ACCOUNT_AGE_DAYS).toBe(7)
  })
  it('requires a SESSION_SECRET of at least 32 characters in production only', () => {
    expect(() => loadConfig({ NODE_ENV: 'production', SESSION_SECRET: 's'.repeat(31) })).toThrow(/at least 32/)
    expect(loadConfig({ NODE_ENV: 'production', SESSION_SECRET: 's'.repeat(32) }).NODE_ENV).toBe('production')
    expect(loadConfig({ NODE_ENV: 'development', SESSION_SECRET: 'short' }).SESSION_SECRET).toBe('short')
  })
})

describe('publicConfig', () => {
  it('falls back to dev placeholders outside production', () => {
    expect(publicConfig({ NODE_ENV: 'development' })).toMatchObject({ xHandle: 'wyrmhaven', postId: '' })
  })

  it('throws in production when the X handle or post id is missing', () => {
    expect(() => publicConfig({ NODE_ENV: 'production', ANNOUNCEMENT_POST_ID: '1' })).toThrow(/X_ACCOUNT_HANDLE/)
    expect(() => publicConfig({ NODE_ENV: 'production', X_ACCOUNT_HANDLE: 'w' })).toThrow(/ANNOUNCEMENT_POST_ID/)
    expect(publicConfig({ NODE_ENV: 'production', X_ACCOUNT_HANDLE: '@w', ANNOUNCEMENT_POST_ID: '1' })).toMatchObject({
      xHandle: 'w',
      postId: '1',
    })
  })
})
