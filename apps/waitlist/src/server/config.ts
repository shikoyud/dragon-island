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

export type Config = z.infer<typeof schema>

/** Parse env into a typed config. Throws if a required key is missing or invalid. */
export function loadConfig(env: Record<string, string | undefined>): Config {
  // Treat empty strings (as in a copied .env.example) as unset.
  const cleaned = Object.fromEntries(Object.entries(env).filter(([, v]) => v !== undefined && v !== ''))
  return schema.parse(cleaned)
}
