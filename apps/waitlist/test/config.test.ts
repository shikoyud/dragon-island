import { describe, expect, it } from 'vitest'
import { loadConfig } from '../src/server/config'
import { publicConfig } from '../src/server/publicConfig'

const PROD_SECRET = 's'.repeat(32)

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
    expect(loadConfig({ NODE_ENV: 'production', SESSION_SECRET: PROD_SECRET }).NODE_ENV).toBe('production')
    expect(loadConfig({ NODE_ENV: 'development', SESSION_SECRET: 'short' }).SESSION_SECRET).toBe('short')
  })
  it('requires an ADMIN_TOKEN of at least 32 characters in production when set', () => {
    expect(() => loadConfig({ NODE_ENV: 'production', SESSION_SECRET: PROD_SECRET, ADMIN_TOKEN: 'a'.repeat(31) })).toThrow(
      /ADMIN_TOKEN must be at least 32/,
    )
    expect(loadConfig({ NODE_ENV: 'production', SESSION_SECRET: PROD_SECRET, ADMIN_TOKEN: 'a'.repeat(32) }).ADMIN_TOKEN).toBe(
      'a'.repeat(32),
    )
    // Unset keeps the export disabled; short tokens are fine outside production.
    expect(loadConfig({ NODE_ENV: 'production', SESSION_SECRET: PROD_SECRET }).ADMIN_TOKEN).toBeUndefined()
    expect(loadConfig({ NODE_ENV: 'development', SESSION_SECRET: 'x', ADMIN_TOKEN: 'short' }).ADMIN_TOKEN).toBe('short')
  })
})

describe('publicConfig', () => {
  const prod = { NODE_ENV: 'production', X_ACCOUNT_HANDLE: '@w', ANNOUNCEMENT_POST_ID: '1', NEXT_PUBLIC_REOWN_PROJECT_ID: 'p' }

  it('falls back to dev placeholders outside production', () => {
    expect(publicConfig({ NODE_ENV: 'development' })).toMatchObject({ xHandle: 'dragonisland', postId: '' })
  })

  it('throws in production when the X handle or post id is missing', () => {
    expect(() => publicConfig({ ...prod, X_ACCOUNT_HANDLE: undefined })).toThrow(/X_ACCOUNT_HANDLE/)
    expect(() => publicConfig({ ...prod, ANNOUNCEMENT_POST_ID: undefined })).toThrow(/ANNOUNCEMENT_POST_ID/)
    expect(publicConfig(prod)).toMatchObject({ xHandle: 'w', postId: '1' })
  })

  it('throws in production when NEXT_PUBLIC_REOWN_PROJECT_ID is missing, not in development', () => {
    expect(() => publicConfig({ ...prod, NEXT_PUBLIC_REOWN_PROJECT_ID: '' })).toThrow(/NEXT_PUBLIC_REOWN_PROJECT_ID/)
    expect(() => publicConfig({ ...prod, NEXT_PUBLIC_REOWN_PROJECT_ID: undefined })).toThrow(/NEXT_PUBLIC_REOWN_PROJECT_ID/)
    expect(() => publicConfig({ NODE_ENV: 'development' })).not.toThrow()
  })
})
