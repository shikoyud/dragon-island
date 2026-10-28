'use client'

import { useEffect, useState } from 'react'
import { ACTIVE_ART } from '../../art/slots'
import { Sprite } from '../../art/Sprite'
import { TASKS } from '../../domain/tasks'
import type { EntrantState } from '../../server/entrants'
import { Panel } from '../Panel'
import { Joined } from './Joined'
import { StepJoin } from './StepJoin'
import { StepTasks } from './StepTasks'
import { StepWallet } from './StepWallet'
import { StepX, type XStatus } from './StepX'
import { useEntrant } from './useEntrant'

export interface WaitlistPanelProps {
  xHandle: string
  postId: string
  siteUrl: string
  minAccountAgeDays: number
  xStatus?: string | null
  refCode?: string | null
}

type Step = 'x' | 'tasks' | 'wallet' | 'join' | 'joined'

const STEPS: { id: Exclude<Step, 'joined'>; label: string }[] = [
  { id: 'x', label: 'X' },
  { id: 'tasks', label: 'Tasks' },
  { id: 'wallet', label: 'Wallet' },
  { id: 'join', label: 'Join' },
]

/** First incomplete step. */
export function stepFor(state: EntrantState | null): Step {
  if (!state) return 'x'
  if (state.position !== null) return 'joined'
  if (!TASKS.every((t) => state.tasks[t].confirmedAt)) return 'tasks'
  if (!state.wallet) return 'wallet'
  return 'join'
}

const X_STATUSES: readonly XStatus[] = ['denied', 'error', 'too_new']
const asXStatus = (s?: string | null): XStatus | null =>
  X_STATUSES.includes(s as XStatus) ? (s as XStatus) : null

function Identity({ state, onSignOut }: { state: EntrantState; onSignOut(): void }) {
  return (
    <div className="identity">
      {state.avatarUrl ? (
        <img className="identity-avatar" src={state.avatarUrl} alt="" width={40} height={40} />
      ) : (
        <Sprite sprite={ACTIVE_ART.hatchling[state.element]} element={state.element} scale={2} />
      )}
      <span className="identity-text">
        <span className="identity-handle">@{state.handle}</span>
        <span className={`identity-element el-text-${state.element}`}>{state.element} hatchling</span>
      </span>
      <button type="button" className="btn-link" onClick={onSignOut}>
        Sign out
      </button>
    </div>
  )
}

export function WaitlistPanel(props: WaitlistPanelProps) {
  const { state, refresh } = useEntrant()
  const [expired, setExpired] = useState(false)
  const xStatus: XStatus | null = expired ? 'expired' : asXStatus(props.xStatus)

  useEffect(() => {
    if (state && state !== 'loading') setExpired(false)
  }, [state])

  async function signOut() {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' }).catch(() => undefined)
    await refresh()
  }

  if (state === 'loading') {
    return (
      <Panel className="waitlist-panel">
        <p className="step-text" aria-busy="true">
          Loading your progress…
        </p>
      </Panel>
    )
  }

  const step = stepFor(state)
  const current = step === 'joined' ? STEPS.length : STEPS.findIndex((s) => s.id === step)

  return (
    <Panel className="waitlist-panel">
      <ol className="stepper" aria-label="Waitlist steps">
        {STEPS.map((s, i) => (
          <li
            key={s.id}
            className={`stepper-item ${i < current ? 'is-done' : ''} ${i === current ? 'is-current' : ''}`}
            aria-current={i === current ? 'step' : undefined}
          >
            <span className="stepper-num">{i < current ? '✔' : i + 1}</span>
            <span className="stepper-label">{s.label}</span>
          </li>
        ))}
      </ol>

      {state ? <Identity state={state} onSignOut={() => void signOut()} /> : null}

      {step === 'x' && (
        <StepX xStatus={xStatus} refCode={props.refCode} minAccountAgeDays={props.minAccountAgeDays} />
      )}
      {step === 'tasks' && state && (
        <StepTasks tasks={state.tasks} xHandle={props.xHandle} postId={props.postId} onDone={refresh} />
      )}
      {step === 'wallet' && state && <StepWallet handle={state.handle} onDone={refresh} onExpired={() => setExpired(true)} />}
      {step === 'join' && state && <StepJoin wallet={state.wallet!} onDone={refresh} />}
      {step === 'joined' && state && <Joined state={state} siteUrl={props.siteUrl} />}
    </Panel>
  )
}
