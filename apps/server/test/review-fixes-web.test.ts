import { describe, expect, it } from 'vitest'
import { loadConfig } from '../src/config'

const ANVIL_1 = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d'
const base = { SESSION_SECRET: 's'.repeat(32), ADMIN_TOKEN: 'a'.repeat(32) }

describe('I6: E2E mode cannot run against anything real', () => {
  it('refuses E2E=1 with a non-anvil signer, a database url, or NODE_ENV=production', () => {
    expect(() => loadConfig({ ...base, E2E: '1', SIGNER_PRIVATE_KEY: `0x${'ab'.repeat(32)}` })).toThrow(/E2E/)
    expect(() => loadConfig({ ...base, E2E: '1', DATABASE_URL: 'postgres://real' })).toThrow(/E2E/)
    expect(() => loadConfig({ ...base, E2E: '1', NODE_ENV: 'production' })).toThrow(/E2E/)
    expect(loadConfig({ ...base, E2E: '1', SIGNER_PRIVATE_KEY: ANVIL_1 }).E2E).toBe('1')
    expect(loadConfig({ ...base, E2E: '1' }).E2E).toBe('1')
  })
})

