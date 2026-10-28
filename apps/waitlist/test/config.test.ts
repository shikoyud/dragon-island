import { describe, expect, it } from 'vitest'
import { loadConfig } from '../src/server/config'

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
})
