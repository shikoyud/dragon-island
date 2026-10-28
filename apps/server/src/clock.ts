/** Milliseconds since the epoch. Injected everywhere so tests control time. */
export type Clock = () => number

export const systemClock: Clock = () => Date.now()

export const fixedClock = (ms: number): Clock => () => ms

/** Returns `start`, then advances by `stepMs` on every call. */
export function stepClock(start: number, stepMs: number): Clock {
  let t = start - stepMs
  return () => (t += stepMs)
}

/** A clock whose value tests can move. */
export function mutableClock(start: number): Clock & { set: (ms: number) => void; advance: (ms: number) => void } {
  let t = start
  const clock = (() => t) as Clock & { set: (ms: number) => void; advance: (ms: number) => void }
  clock.set = ms => { t = ms }
  clock.advance = ms => { t += ms }
  return clock
}
