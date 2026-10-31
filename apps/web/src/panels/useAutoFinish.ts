import type { PlayerState, SpeedUpToken } from '@wyrmhaven/game-core'
import { useEffect, useRef, useState } from 'react'
import { useAction } from '../state/actions'
import { useMe } from '../state/me'
import { useToasts } from '../ui/Toast'
import { TOKEN_NAMES } from './SpeedUpButton'

/** A failed attempt on the same construction is retried after this long (e.g. client clock ahead of the server). */
export const AUTO_FINISH_RETRY_MS = 30_000

/** Index of the first construction whose timer has run out, or -1. */
export function firstReadyConstruction(s: PlayerState, nowMs: number): number {
  return s.constructions.findIndex(c => c.readyAtMs <= nowMs)
}

/**
 * The one automatic sender of `finishConstruction` (spec section 6: the client sends it while the game
 * is open; the server never finishes anything on its own). Mounted once at app level. Sends for the first
 * ready construction, one request at a time: indices shift after each finish, so the next one is picked
 * from the state the reply brings back. One attempt per construction, retried after AUTO_FINISH_RETRY_MS.
 */
export function useAutoFinish(nowMs: number): void {
  const me = useMe()
  const { run } = useAction()
  const toasts = useToasts()
  const busy = useRef(false)
  const [settled, setSettled] = useState(0) // re-runs the effect once our request is done
  const tried = useRef<{ key: string; atMs: number } | null>(null)
  const s = me.data?.state
  useEffect(() => {
    if (!s || busy.current) return
    const index = firstReadyConstruction(s, nowMs)
    if (index < 0) return
    const key = `${index}:${JSON.stringify(s.constructions[index])}`
    if (tried.current && tried.current.key === key && nowMs - tried.current.atMs < AUTO_FINISH_RETRY_MS) return
    tried.current = { key, atMs: nowMs }
    busy.current = true
    void run({ type: 'finishConstruction', index }).then(res => {
      // R54/R55: a finished clear can drop a speed-up token; say so.
      if (!res) return
      for (const k of Object.keys(TOKEN_NAMES) as SpeedUpToken[]) {
        if (res.state.speedUps[k] > s.speedUps[k]) toasts.info(`Found a ${TOKEN_NAMES[k]} speed-up`)
      }
    }).finally(() => { busy.current = false; setSettled(n => n + 1) })
  }, [s, nowMs, run, settled, toasts])
}
