import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { CONFIRM_DELAY_MS } from '../src/domain/tasks'
import { getEntrantState, upsertFromX } from '../src/server/entrants'
import { confirmTask, openTask } from '../src/server/tasks'
import { makeTestDeps } from './helpers'

type TD = Awaited<ReturnType<typeof makeTestDeps>>
let d: TD
let id: string
beforeEach(async () => {
  d = await makeTestDeps()
  const r = await upsertFromX(d, {
    id: '1001',
    username: 'ember',
    name: 'Ember',
    profileImageUrl: 'https://pbs.twimg.com/profile_images/1/pic_normal.jpg',
    createdAt: new Date(d.clock.now().getTime() - 400 * 86_400_000),
  })
  if (!('entrantId' in r)) throw new Error('expected entrantId')
  id = r.entrantId
})
afterEach(async () => {
  await d.close()
})

describe('honor tasks', () => {
  it('confirm before open is TASK_NOT_OPENED', async () => {
    expect(await confirmTask(d, id, 'follow')).toEqual({ error: 'TASK_NOT_OPENED' })
  })

  it('confirm is TOO_EARLY at 14s and ok at 15s', async () => {
    const { openedAt } = await openTask(d, id, 'follow')
    d.clock.advance(CONFIRM_DELAY_MS - 1000)
    expect(await confirmTask(d, id, 'follow')).toEqual({ error: 'TOO_EARLY' })
    d.clock.advance(1000)
    expect(await confirmTask(d, id, 'follow')).toEqual({ confirmedAt: new Date(openedAt.getTime() + CONFIRM_DELAY_MS) })
  })

  it('repeat confirm returns the stored time', async () => {
    await openTask(d, id, 'like')
    d.clock.advance(CONFIRM_DELAY_MS)
    const first = await confirmTask(d, id, 'like')
    d.clock.advance(60_000)
    expect(await confirmTask(d, id, 'like')).toEqual(first)
  })

  it('reopen keeps the first opened_at, and after confirm keeps confirmed_at', async () => {
    const first = await openTask(d, id, 'repost')
    d.clock.advance(5000)
    expect((await openTask(d, id, 'repost')).openedAt).toEqual(first.openedAt)
    d.clock.advance(CONFIRM_DELAY_MS)
    const confirmed = await confirmTask(d, id, 'repost')
    d.clock.advance(60_000)
    expect((await openTask(d, id, 'repost')).openedAt).toEqual(first.openedAt)
    expect(await confirmTask(d, id, 'repost')).toEqual(confirmed)
    const t = (await getEntrantState(d, id))!.tasks.repost
    expect(t.openedAt).toBe(first.openedAt.toISOString())
  })

  it('shows ISO openedAt/confirmedAt in entrant state; other tasks stay null', async () => {
    const { openedAt } = await openTask(d, id, 'comment')
    d.clock.advance(CONFIRM_DELAY_MS)
    const c = await confirmTask(d, id, 'comment')
    if (!('confirmedAt' in c)) throw new Error('expected confirmedAt')
    const tasks = (await getEntrantState(d, id))!.tasks
    expect(tasks.comment).toEqual({ openedAt: openedAt.toISOString(), confirmedAt: c.confirmedAt.toISOString() })
    for (const t of ['follow', 'like', 'repost'] as const) {
      expect(tasks[t]).toEqual({ openedAt: null, confirmedAt: null })
    }
  })
})
