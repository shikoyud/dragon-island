import { expect } from 'vitest'
import type { ActionError, ActionResult } from '../src/actions/types'
import type { PlayerState } from '../src/state'

export function ok(r: ActionResult): PlayerState {
  if (!r.ok) throw new Error(`expected ok, got ${r.error}`)
  return r.state
}

export function err(r: ActionResult, error: ActionError): void {
  expect(r).toEqual({ ok: false, error })
}
