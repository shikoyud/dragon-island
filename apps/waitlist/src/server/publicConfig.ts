/** Non-secret config the landing page passes to client components as props (read at request time). */
export type PublicConfig = { xHandle: string; postId: string; siteUrl: string; minAccountAgeDays: number }

/** Placeholders for local dev only; production must set both (see publicConfig). */
const DEV_HANDLE = 'wyrmhaven'
const DEV_POST_ID = ''

export function publicConfig(env: Record<string, string | undefined> = process.env): PublicConfig {
  if (env.NODE_ENV === 'production') {
    const missing = ['X_ACCOUNT_HANDLE', 'ANNOUNCEMENT_POST_ID'].filter((k) => !env[k])
    if (missing.length) throw new Error(`Missing required config in production: ${missing.join(', ')}`)
  }
  const days = Number(env.MIN_X_ACCOUNT_AGE_DAYS)
  return {
    xHandle: (env.X_ACCOUNT_HANDLE || DEV_HANDLE).replace(/^@/, ''),
    postId: env.ANNOUNCEMENT_POST_ID || DEV_POST_ID,
    siteUrl: (env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/+$/, ''),
    minAccountAgeDays: env.MIN_X_ACCOUNT_AGE_DAYS && Number.isInteger(days) && days >= 0 ? days : 30,
  }
}
