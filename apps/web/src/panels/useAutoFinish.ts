import { useEffect, useRef } from 'react'
import { useAction } from '../state/actions'

/**
 * Sends `finishConstruction` once a construction's timer has run out while the game is open (the server
 * never finishes anything on its own). One attempt per `readyAtMs`; waits while another action of this
 * hook is in flight so a busy `run` cannot swallow the attempt.
 */
export function useAutoFinish(index: number, readyAtMs: number | undefined, nowMs: number): void {
  const { run, pending } = useAction()
  const tried = useRef<number | null>(null)
  useEffect(() => {
    if (readyAtMs === undefined || index < 0 || nowMs < readyAtMs || pending) return
    if (tried.current === readyAtMs) return
    tried.current = readyAtMs
    void run({ type: 'finishConstruction', index })
  }, [index, readyAtMs, nowMs, pending, run])
}
