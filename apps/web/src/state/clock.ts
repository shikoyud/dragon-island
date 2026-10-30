import { useEffect, useMemo, useState } from 'react'

/**
 * The game's now, ticking every second: the device clock plus the offset to the server measured when a /me carrying
 * `serverNowMs` arrives. Timers and Gold predictions run on this, so a device clock that is wrong does not move them.
 * Keyed on the value because an action response keeps the old `game` (its time is stale by then, not new).
 */
export function useGameClock(serverNowMs: number | undefined): number {
  const [deviceNowMs, setDeviceNowMs] = useState(() => Date.now())
  const offsetMs = useMemo(() => (serverNowMs === undefined ? 0 : serverNowMs - Date.now()), [serverNowMs])
  useEffect(() => {
    const t = setInterval(() => setDeviceNowMs(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  return deviceNowMs + offsetMs
}
