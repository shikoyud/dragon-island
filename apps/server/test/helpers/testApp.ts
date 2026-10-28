import type { FastifyInstance } from 'fastify'
import type { PrivateKeyAccount } from 'viem/accounts'
import { buildApp, type AppDeps } from '../../src/app'
import { mutableClock } from '../../src/clock'
import { loadConfig } from '../../src/config'
import type { Db } from '../../src/db/client'
import { testDb } from './testDb'
import { signSiwe } from './wallet'

/** Well-known test keys: anvil account 1 as the voucher signer; a fixed vault address for the EIP-712 domain. */
export const TEST_SIGNER_KEY = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d' as const
export const TEST_VAULT = '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0' as const

export interface TestApp {
  app: FastifyInstance
  db: Db
  clock: ReturnType<typeof mutableClock>
  deps: AppDeps
  /** Full SIWE login; returns the bearer token and player id. */
  login(account: PrivateKeyAccount): Promise<{ token: string; playerId: string }>
  close(): Promise<void>
}

export async function testApp(overrides: Partial<AppDeps> = {}, startMs = 0): Promise<TestApp> {
  const { db, close } = await testDb()
  const clock = mutableClock(startMs)
  const config = loadConfig({
    SESSION_SECRET: 't'.repeat(32), ADMIN_TOKEN: 'admin-token',
    SIGNER_PRIVATE_KEY: TEST_SIGNER_KEY, VAULT_ADDRESS: TEST_VAULT,
  })
  const deps: AppDeps = { db, clock, config, ...overrides }
  const app = await buildApp(deps)
  await app.ready()
  return {
    app, db, clock, deps,
    async login(account) {
      const n = await app.inject({ method: 'GET', url: '/auth/nonce' })
      const { nonce } = n.json<{ nonce: string }>()
      const { message, signature } = await signSiwe(account, nonce, { issuedAt: new Date(clock()) })
      const v = await app.inject({ method: 'POST', url: '/auth/verify', payload: { message, signature } })
      if (v.statusCode !== 200) throw new Error(`login failed: ${v.body}`)
      return v.json<{ token: string; playerId: string }>()
    },
    async close() {
      await app.close()
      await close()
    },
  }
}

export const bearer = (token: string) => ({ authorization: `Bearer ${token}` })
