import { z } from 'zod'

const schema = z.object({
  DATABASE_URL: z.string().optional(),
  SESSION_SECRET: z.string().min(1),
  X_CLIENT_ID: z.string().optional(),
  X_CLIENT_SECRET: z.string().optional(),
  X_ACCOUNT_HANDLE: z.string().optional(),
  ANNOUNCEMENT_POST_ID: z.string().optional(),
  NEXT_PUBLIC_REOWN_PROJECT_ID: z.string().optional(),
  NEXT_PUBLIC_SITE_URL: z.string().optional(),
  ADMIN_TOKEN: z.string().optional(),
  MIN_X_ACCOUNT_AGE_DAYS: z.coerce.number().int().min(0).default(30),
  NODE_ENV: z.string().optional(),
  /** Local dev / e2e only: `1` swaps X OAuth for FakeXClient. Refused in production. */
  X_FAKE: z.string().optional(),
  X_FAKE_ID: z.string().optional(),
  X_FAKE_USERNAME: z.string().optional(),
  /** PGlite data dir used when DATABASE_URL is unset outside production (default `.pglite`). */
  PGLITE_DIR: z.string().optional(),
})

/**
 * Sessions are HS256 JWTs and the admin export is bearer-token gated; short secrets are brute-forceable.
 * Use 32+ random bytes (e.g. `openssl rand -base64 48`).
 */
const MIN_PROD_SECRET_LENGTH = 32

export type Config = z.infer<typeof schema>

/** Parse env into a typed config. Throws if a required key is missing or invalid. */
export function loadConfig(env: Record<string, string | undefined>): Config {
  // Treat empty strings (as in a copied .env.example) as unset.
  const cleaned = Object.fromEntries(Object.entries(env).filter(([, v]) => v !== undefined && v !== ''))
  const config = schema.parse(cleaned)
  if (config.NODE_ENV === 'production') {
    if (config.SESSION_SECRET.length < MIN_PROD_SECRET_LENGTH) {
      throw new Error(`SESSION_SECRET must be at least ${MIN_PROD_SECRET_LENGTH} characters in production`)
    }
    // Unset keeps the export disabled; a set token must not be guessable.
    if (config.ADMIN_TOKEN !== undefined && config.ADMIN_TOKEN.length < MIN_PROD_SECRET_LENGTH) {
      throw new Error(`ADMIN_TOKEN must be at least ${MIN_PROD_SECRET_LENGTH} characters in production`)
    }
  }
  return config
}
