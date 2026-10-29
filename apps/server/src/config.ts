import { z } from 'zod'

const hex32 = z.string().regex(/^0x[0-9a-fA-F]{64}$/)
const address = z.string().regex(/^0x[0-9a-fA-F]{40}$/)

const schema = z.object({
  PORT: z.coerce.number().int().default(3000),
  /** Postgres URL; when absent the server runs on a file-backed PGlite under PGLITE_DIR. */
  DATABASE_URL: z.string().optional(),
  PGLITE_DIR: z.string().default('./.pglite'),
  SESSION_SECRET: z.string().min(32),
  SESSION_TTL_MS: z.coerce.number().int().default(7 * 86_400_000),
  SIWE_DOMAIN: z.string().default('localhost'),
  SIWE_URI: z.string().default('http://localhost:5173'),
  /** Robinhood Chain testnet only. */
  CHAIN_ID: z.coerce.number().int().refine(n => n === 46630, 'testnet 46630 only').default(46630),
  RPC_URL: z.string().default('https://rpc.testnet.chain.robinhood.com'),
  VAULT_ADDRESS: address.optional(),
  TOKEN_ADDRESS: address.optional(),
  SIGNER_PRIVATE_KEY: hex32.optional(),
  OPERATOR_PRIVATE_KEY: hex32.optional(),
  CONFIRMATIONS: z.coerce.number().int().min(0).default(1),
  /** First block the indexer scans (the vault's deployment block) and the getLogs range per call. */
  INDEXER_START_BLOCK: z.coerce.bigint().nonnegative().default(0n),
  INDEXER_CHUNK: z.coerce.bigint().positive().default(2_000n),
  /** Compared in constant time; long enough that guessing is hopeless. */
  ADMIN_TOKEN: z.string().min(32),
  /** Closed beta: only wallets in `beta_allowlist` may sign in. Existing sessions are unaffected. */
  BETA_CLOSED: z.enum(['true', 'false']).default('false').transform(v => v === 'true'),
  /** Behind a reverse proxy, take the client IP from X-Forwarded-For (rate limits, referral checks). */
  TRUST_PROXY: z.enum(['true', 'false']).default('false').transform(v => v === 'true'),
  /** 1 = Playwright mode: in-memory PGlite, fake chain, fixed price, POST /e2e/grant. Never in production. */
  E2E: z.enum(['0', '1']).default('0'),
  CATALOG: z.enum(['launch']).default('launch'),
  /** Discord webhook for chain-watch alerts; alerts are only logged when absent. Treat as a secret. */
  ALERT_WEBHOOK_URL: z.string().url().optional(),
  /** Sentry error reporting; the SDK is only loaded when this is set. */
  SENTRY_DSN: z.string().optional(),
  NODE_ENV: z.string().optional(),
}).superRefine((c, ctx) => {
  // E2E mode hands out free tokens: refuse anything that could be a real deployment.
  if (c.E2E !== '1') return
  const bad = c.NODE_ENV === 'production' ? 'NODE_ENV=production'
    : c.DATABASE_URL ? 'a DATABASE_URL'
    : c.SIGNER_PRIVATE_KEY && !ANVIL_KEYS.has(c.SIGNER_PRIVATE_KEY.toLowerCase()) ? 'a non-anvil SIGNER_PRIVATE_KEY'
    : c.OPERATOR_PRIVATE_KEY && !ANVIL_KEYS.has(c.OPERATOR_PRIVATE_KEY.toLowerCase()) ? 'a non-anvil OPERATOR_PRIVATE_KEY'
    : null
  if (bad) ctx.addIssue({ code: 'custom', path: ['E2E'], message: `E2E=1 cannot be combined with ${bad}` })
})

/** Anvil's default accounts 0–9: the only signers E2E mode accepts. */
const ANVIL_KEYS = new Set([
  '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
  '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d',
  '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a',
  '0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6',
  '0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a',
  '0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba',
  '0x92db14e403b83dfe3df233f83dfa3a0d7096f21ca9b0d6d6b8d88b2b4ec1564e',
  '0x4bbbf85ce3377467afe5d46f804f221813b2bb87f24d81f60f1fcdbf7cbf4356',
  '0xdbda1821b80551c9d65939329250298aa3472ba22feea921c0cf5d620ea67b97',
  '0x2a871d0798f97d79848a013d4936a73bf4cc922c825d33c1cf7073dff6d409c6',
])

export type Config = z.infer<typeof schema>

export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
  return schema.parse(env)
}
