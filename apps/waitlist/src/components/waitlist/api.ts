/** POST to a waitlist API route. Returns the JSON body, or `{ error }` for a 4xx/5xx or network failure. */
export async function post<T>(path: string, body?: unknown): Promise<T | { error: string }> {
  try {
    const res = await fetch(path, {
      method: 'POST',
      credentials: 'same-origin',
      headers: body === undefined ? undefined : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const json = (await res.json().catch(() => ({}))) as T & { error?: string }
    if (!res.ok) return { error: json.error ?? 'NETWORK' }
    return json
  } catch {
    return { error: 'NETWORK' }
  }
}

export const isError = (r: unknown): r is { error: string } =>
  typeof r === 'object' && r !== null && 'error' in r && typeof (r as { error: unknown }).error === 'string'
