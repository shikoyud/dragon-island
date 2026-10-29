const KEY = 'wyrm.device'
let memo: string | null = null

/**
 * A random id for this browser, sent as `x-device-id` so the server can refuse referral codes claimed
 * from the referrer's own device (spec §16). Falls back to a per-page id when storage is unavailable.
 */
export function deviceId(): string {
  if (memo) return memo
  try {
    const stored = localStorage.getItem(KEY)
    if (stored) return (memo = stored)
  } catch { /* private mode */ }
  memo = crypto.randomUUID()
  try { localStorage.setItem(KEY, memo) } catch { /* private mode */ }
  return memo
}
