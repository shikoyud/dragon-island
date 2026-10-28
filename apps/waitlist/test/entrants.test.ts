import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { entrants } from '../src/server/db/schema'
import { pickElement } from '../src/domain/pickElement'
import { TASKS } from '../src/domain/tasks'
import type { XProfile } from '../src/server/deps'
import { getEntrantState, upsertFromX } from '../src/server/entrants'
import { makeTestDeps } from './helpers'

type TD = Awaited<ReturnType<typeof makeTestDeps>>
let d: TD
beforeEach(async () => {
  d = await makeTestDeps()
})
afterEach(async () => {
  await d.close()
})

const DAY = 86_400_000
const profile = (over: Partial<XProfile> = {}): XProfile => ({
  id: '1001',
  username: 'ember',
  name: 'Ember',
  profileImageUrl: 'https://pbs.twimg.com/profile_images/1/pic_normal.jpg',
  createdAt: new Date(d.clock.now().getTime() - 400 * DAY),
  ...over,
})
const rows = () => d.db.select().from(entrants)
const rowOf = async (id: string) => (await d.db.select().from(entrants).where(eq(entrants.id, id)))[0]!
const idOf = (r: Awaited<ReturnType<typeof upsertFromX>>): string => {
  if (!('entrantId' in r)) throw new Error('expected entrantId')
  return r.entrantId
}

describe('upsertFromX', () => {
  it('creates an entrant with picked element and ref code', async () => {
    const row = await rowOf(idOf(await upsertFromX(d, profile())))
    expect(row.element).toBe(pickElement('1001'))
    expect(row.refCode).toMatch(/^[0-9A-Z]{8}$/)
    expect(row.position).toBeNull()
    expect(row.xAvatarUrl).toBe('https://pbs.twimg.com/profile_images/1/pic_400x400.jpg')
  })

  it('refuses accounts younger than the minimum age and stores nothing', async () => {
    const young = profile({ createdAt: new Date(d.clock.now().getTime() - 29 * DAY) })
    expect(await upsertFromX(d, young)).toEqual({ error: 'X_ACCOUNT_TOO_NEW' })
    expect(await rows()).toHaveLength(0)
  })

  it('accepts an account exactly at the minimum age', async () => {
    const ok = profile({ createdAt: new Date(d.clock.now().getTime() - 30 * DAY) })
    expect('entrantId' in (await upsertFromX(d, ok))).toBe(true)
  })

  it('updates handle, name and avatar on later sign-in, keeping code, element, position', async () => {
    const id = idOf(await upsertFromX(d, profile()))
    await d.db.update(entrants).set({ position: 7 }).where(eq(entrants.id, id))
    const before = await rowOf(id)
    const id2 = idOf(
      await upsertFromX(d, profile({ username: 'ember2', name: 'Ember II', profileImageUrl: 'https://x/new_normal.png' })),
    )
    expect(id2).toBe(id)
    const all = await rows()
    expect(all).toHaveLength(1)
    expect(all[0]).toMatchObject({
      xHandle: 'ember2',
      xName: 'Ember II',
      xAvatarUrl: 'https://x/new_400x400.png',
      refCode: before.refCode,
      element: before.element,
      position: 7,
    })
  })

  it('creates a single row for concurrent sign-ins of the same id', async () => {
    const [a, b] = await Promise.all([upsertFromX(d, profile()), upsertFromX(d, profile())])
    expect(idOf(a)).toBe(idOf(b))
    expect(await rows()).toHaveLength(1)
  })

  describe('referral', () => {
    it('sets referred_by from a valid code on creation only', async () => {
      const a = idOf(await upsertFromX(d, profile({ id: 'A', username: 'a' })))
      const b = idOf(await upsertFromX(d, profile({ id: 'B', username: 'b' }), (await rowOf(a)).refCode))
      expect((await rowOf(b)).referredBy).toBe(a)
    })

    it('ignores unknown codes', async () => {
      const b = idOf(await upsertFromX(d, profile({ id: 'B' }), 'NOSUCHCD'))
      expect((await rowOf(b)).referredBy).toBeNull()
    })

    it('ignores own code on a later sign-in', async () => {
      const a = idOf(await upsertFromX(d, profile({ id: 'A' })))
      await upsertFromX(d, profile({ id: 'A' }), (await rowOf(a)).refCode)
      expect((await rowOf(a)).referredBy).toBeNull()
    })

    it('does not set referred_by when a code is given on a later sign-in', async () => {
      const a = idOf(await upsertFromX(d, profile({ id: 'A' })))
      const b = idOf(await upsertFromX(d, profile({ id: 'B' })))
      await upsertFromX(d, profile({ id: 'B' }), (await rowOf(a)).refCode)
      expect((await rowOf(b)).referredBy).toBeNull()
    })
  })
})

describe('getEntrantState', () => {
  it('returns null for an unknown id', async () => {
    expect(await getEntrantState(d, '00000000-0000-4000-8000-000000000000')).toBeNull()
  })

  it('returns profile, all four tasks as nulls, no wallet or position', async () => {
    const id = idOf(await upsertFromX(d, profile()))
    const s = await getEntrantState(d, id)
    expect(s).toMatchObject({
      handle: 'ember',
      name: 'Ember',
      avatarUrl: 'https://pbs.twimg.com/profile_images/1/pic_400x400.jpg',
      element: pickElement('1001'),
      inviteCount: 0,
      wallet: null,
      position: null,
    })
    expect(Object.keys(s!.tasks).sort()).toEqual([...TASKS].sort())
    for (const t of TASKS) expect(s!.tasks[t]).toEqual({ openedAt: null, confirmedAt: null })
  })

  it('counts only invitees that have joined (position not null)', async () => {
    const a = idOf(await upsertFromX(d, profile({ id: 'A', username: 'a' })))
    const code = (await getEntrantState(d, a))!.refCode
    const b = idOf(await upsertFromX(d, profile({ id: 'B', username: 'b' }), code))
    await upsertFromX(d, profile({ id: 'C', username: 'c' }), code)
    expect((await getEntrantState(d, a))!.inviteCount).toBe(0)
    await d.db.update(entrants).set({ position: 1 }).where(eq(entrants.id, b))
    expect((await getEntrantState(d, a))!.inviteCount).toBe(1)
  })
})
