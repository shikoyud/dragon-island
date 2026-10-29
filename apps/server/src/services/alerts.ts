import type { Config } from '../config'

/**
 * Posts `text` to the Discord webhook as `{ content }`. A no-op without ALERT_WEBHOOK_URL, and it
 * never throws: a failed alert is logged (without the URL, which is a secret) and dropped.
 */
export async function sendAlert(
  cfg: Pick<Config, 'ALERT_WEBHOOK_URL'>,
  fetchFn: typeof fetch,
  text: string,
): Promise<void> {
  if (!cfg.ALERT_WEBHOOK_URL) return
  try {
    const res = await fetchFn(cfg.ALERT_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      // Discord rejects content over 2000 characters.
      body: JSON.stringify({ content: text.slice(0, 2000) }),
    })
    if (!res.ok) console.error(`alert webhook returned HTTP ${res.status}`)
  } catch (err) {
    console.error(`alert webhook failed: ${err instanceof Error ? err.message : String(err)}`)
  }
}
