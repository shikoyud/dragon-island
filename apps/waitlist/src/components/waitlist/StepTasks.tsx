'use client'

import { useEffect, useState } from 'react'
import { CONFIRM_DELAY_MS, TASKS, taskIntentUrl, type Task } from '../../domain/tasks'
import type { EntrantState } from '../../server/entrants'
import { isError, post } from './api'

export function taskLabel(task: Task, handle: string): string {
  switch (task) {
    case 'follow':
      return `Follow @${handle}`
    case 'like':
      return 'Like the announcement post'
    case 'repost':
      return 'Repost it'
    case 'comment':
      return 'Comment on it'
  }
}

/** Re-render every second while any task is counting down. */
function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(id)
  }, [active])
  return now
}

export function StepTasks({
  tasks,
  xHandle,
  postId,
  onDone,
}: {
  tasks: EntrantState['tasks']
  xHandle: string
  postId: string
  onDone(): Promise<void>
}) {
  // Local click time per task: this client's clock, so the countdown is not thrown off by server skew.
  const [opened, setOpened] = useState<Partial<Record<Task, number>>>({})
  const [busy, setBusy] = useState<Task | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const openedAt = (t: Task): number | null =>
    opened[t] ?? (tasks[t].openedAt ? Date.parse(tasks[t].openedAt!) : null)
  const pending = TASKS.filter((t) => !tasks[t].confirmedAt)
  const now = useNow(pending.some((t) => openedAt(t) !== null))
  const doneCount = TASKS.length - pending.length

  function onOpen(t: Task) {
    // Let the link open X in a new tab; record the open alongside, never block the navigation.
    setOpened((o) => ({ ...o, [t]: Date.now() }))
    setNotice(null)
    void post(`/api/tasks/${t}/open`).then((res) => {
      if (!isError(res)) return
      // The server has no open on record, so a countdown here would only end in TASK_NOT_OPENED.
      setOpened(({ [t]: _dropped, ...rest }) => rest)
      setNotice(
        res.error === 'UNAUTHORIZED'
          ? 'Your session expired. Reload the page and connect X again.'
          : 'Could not record that you opened this task. Please open it again.',
      )
    })
  }

  async function onConfirm(t: Task) {
    setBusy(t)
    setNotice(null)
    const res = await post<{ confirmedAt: string }>(`/api/tasks/${t}/confirm`)
    if (isError(res)) {
      if (res.error === 'TOO_EARLY') setNotice('Not yet. Give it a few more seconds, then confirm.')
      else if (res.error === 'TASK_NOT_OPENED') setNotice('Open the task on X first, then confirm.')
      else setNotice('Could not confirm that task. Please try again.')
    }
    await onDone()
    setBusy(null)
  }

  return (
    <div className="step">
      <h3 className="step-title">Do the X tasks</h3>
      <p className="step-text">Open each task on X, then confirm. Confirm unlocks 15 seconds after you open it.</p>
      <p className="task-progress" aria-live="polite">
        {doneCount} of {TASKS.length} done
      </p>
      <ul className="task-list">
        {TASKS.map((t) => {
          const confirmed = Boolean(tasks[t].confirmedAt)
          const at = openedAt(t)
          const left = at === null ? null : Math.max(0, CONFIRM_DELAY_MS - (now - at))
          const ready = left === 0
          return (
            <li key={t} className={`task ${confirmed ? 'task-done' : ''}`} data-testid={`task-${t}`}>
              <span className="task-check" aria-hidden="true">
                {confirmed ? '✔' : ''}
              </span>
              <span className="task-label">{taskLabel(t, xHandle)}</span>
              {confirmed ? (
                <span className="task-status">Done</span>
              ) : (
                <span className="task-actions">
                  <a
                    className="btn btn-small"
                    href={taskIntentUrl(t, { handle: xHandle, postId })}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => onOpen(t)}
                  >
                    Open
                  </a>
                  <button
                    type="button"
                    className="btn btn-small btn-primary"
                    disabled={!ready || busy !== null}
                    onClick={() => void onConfirm(t)}
                  >
                    {left !== null && left > 0 ? `Confirm ${Math.ceil(left / 1000)}s` : 'Confirm'}
                  </button>
                </span>
              )}
            </li>
          )
        })}
      </ul>
      {notice ? (
        <p className="notice notice-warn" role="alert">
          {notice}
        </p>
      ) : null}
    </div>
  )
}
