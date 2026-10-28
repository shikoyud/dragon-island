/** Non-secret config the landing page passes to client components as props (read at request time). */
export type PublicConfig = { xHandle: string; postId: string; siteUrl: string; minAccountAgeDays: number }

/** Placeholder only for local dev; production sets X_ACCOUNT_HANDLE. */
const DEV_HANDLE = 'wyrmhaven'

export function publicConfig(env: Record<string, string | undefined> = process.env): PublicConfig {
  const days = Number(env.MIN_X_ACCOUNT_AGE_DAYS)
  return {
    xHandle: (env.X_ACCOUNT_HANDLE || DEV_HANDLE).replace(/^@/, ''),
    postId: env.ANNOUNCEMENT_POST_ID ?? '',
    siteUrl: (env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/+$/, ''),
    minAccountAgeDays: Number.isInteger(days) && days >= 0 && env.MIN_X_ACCOUNT_AGE_DAYS ? days : 30,
  }
}
