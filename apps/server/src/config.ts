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
  ADMIN_TOKEN: z.string().min(1),
  CATALOG: z.enum(['launch']).default('launch'),
})

export type Config = z.infer<typeof schema>

export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
  return schema.parse(env)
}
