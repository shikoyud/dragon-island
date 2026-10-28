'use client'

import { useEffect, useState } from 'react'

/** Live entrant count from `/api/stats`; renders nothing until it loads (or if it fails). */
export function LiveCount() {
  const [joined, setJoined] = useState<number | null>(null)
  useEffect(() => {
    let live = true
    fetch('/api/stats')
      .then((r) => (r.ok ? (r.json() as Promise<{ joined: number }>) : null))
      .then((b) => {
        if (live && b && Number.isInteger(b.joined)) setJoined(b.joined)
      })
      .catch(() => undefined)
    return () => {
      live = false
    }
  }, [])
  return (
    <p className="live-count" aria-live="polite">
      <span className="live-dot" aria-hidden="true" />
      {!joined ? 'Waitlist open' : `${joined.toLocaleString('en-US')} on the waitlist`}
    </p>
  )
}
