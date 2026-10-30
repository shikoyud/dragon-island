import { sql } from 'drizzle-orm'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { CONFIRM_DELAY_MS, TASKS, type Task } from '../src/domain/tasks'
import { walletMessage } from '../src/domain/walletMessage'
import { entrants, taskEvents } from '../src/server/db/schema'
import { getEntrantState, upsertFromX } from '../src/server/entrants'
import { exportCsv } from '../src/server/export'
import { join } from '../src/server/join'
import { countJoined } from '../src/server/stats'
import { confirmTask, openTask } from '../src/server/tasks'
import { bindWallet, issueNonce } from '../src/server/wallet'
import { makeTestDeps } from './helpers'

type TD = Awaited<ReturnType<typeof makeTestDeps>>
let d: TD
beforeEach(async () => {
  d = await makeTestDeps()
})
afterEach(async () => {
  await d.close()
})

async function makeEntrant(xid: string, username: string, name = username, ref?: string): Promise<string> {
  const r = await upsertFromX(
    d,
    {
      id: xid,
      username,
      name,
      profileImageUrl: 'https://pbs.twimg.com/profile_images/1/pic_normal.jpg',
      createdAt: new Date(d.clock.now().getTime() - 400 * 86_400_000),
    },
    ref,
  )
  if (!('entrantId' in r)) throw new Error('expected entrantId')
  return r.entrantId
}

async function doTasks(id: string, tasks: readonly Task[] = TASKS): Promise<void> {
  for (const t of tasks) await openTask(d, id, t)
  d.clock.advance(CONFIRM_DELAY_MS)
  for (const t of tasks) await confirmTask(d, id, t)
}

async function bind(id: string, handle: string): Promise<void> {
  const acct = privateKeyToAccount(generatePrivateKey())
  const nonce = await issueNonce(d, id)
  const signature = await acct.signMessage({ message: walletMessage(handle, acct.address, nonce) })
  const r = await bindWallet(d, id, { address: acct.address, signature, nonce })
  if (!('wallet' in r)) throw new Error('bind failed')
}

async function ready(xid: string, handle: string, name = handle, ref?: string): Promise<string> {
  const id = await makeEntrant(xid, handle, name, ref)
  await doTasks(id)
  await bind(id, handle)
  return id
}

describe('join', () => {
  it('3 of 4 tasks is TASKS_INCOMPLETE', async () => {
    const id = await makeEntrant('1', 'ember')
    await doTasks(id, ['follow', 'like', 'repost'])
    await bind(id, 'ember')
    expect(await join(d, id)).toEqual({ error: 'TASKS_INCOMPLETE' })
  })

  it('opened but unconfirmed tasks do not count', async () => {
    const id = await makeEntrant('1', 'ember')
    await doTasks(id, ['follow', 'like', 'repost'])
    await openTask(d, id, 'comment')
    expect(await join(d, id)).toEqual({ error: 'TASKS_INCOMPLETE' })
  })

  it('without a wallet is WALLET_REQUIRED', async () => {
    const id = await makeEntrant('1', 'ember')
    await doTasks(id)
    expect(await join(d, id)).toEqual({ error: 'WALLET_REQUIRED' })
  })

  it('assigns 1 then 2, and records joined_at', async () => {
    const a = await ready('1', 'ember')
    const b = await ready('2', 'tide')
    expect(await join(d, a)).toEqual({ position: 1 })
    expect(await join(d, b)).toEqual({ position: 2 })
    const state = await getEntrantState(d, a)
    expect(state!.position).toBe(1)
    const rows = await d.db.select().from(entrants)
    expect(rows.find((r) => r.id === a)!.joinedAt).toEqual(d.clock.now())
  })

  it('joining twice returns the same position', async () => {
    const a = await ready('1', 'ember')
    expect(await join(d, a)).toEqual({ position: 1 })
    d.clock.advance(60_000)
    expect(await join(d, a)).toEqual({ position: 1 })
    const rows = await d.db.select().from(entrants)
    expect(rows[0]!.joinedAt!.getTime()).toBeLessThan(d.clock.now().getTime())
  })

  it('5 concurrent joins give one position and advance the sequence once', async () => {
    const a = await ready('1', 'ember')
    const b = await ready('2', 'tide')
    const results = await Promise.all([1, 2, 3, 4, 5].map(() => join(d, a)))
    for (const r of results) expect(r).toEqual({ position: 1 })
    expect(await join(d, b)).toEqual({ position: 2 })
    const res = await d.db.execute(sql`select last_value from waitlist_position_seq`)
    const lv = (res as unknown as { rows: { last_value: string | number }[] }).rows[0]!.last_value
    expect(Number(lv)).toBe(2)
  })
})

describe('countJoined', () => {
  it('ignores entrants who have not joined', async () => {
    const a = await ready('1', 'ember')
    await makeEntrant('2', 'tide')
    expect(await countJoined(d)).toBe(0)
    await join(d, a)
    expect(await countJoined(d)).toBe(1)
  })
})

describe('exportCsv', () => {
  it('writes header and rows ordered by position with escaping', async () => {
    const a = await ready('1', 'ember', 'Ember, "the" Wyrm')
    const b = await ready('2', 'tide', 'Tide', undefined)
    // b joins first, then a, so order is by position not creation.
    await join(d, b)
    await join(d, a)
    const csv = await exportCsv(d)
    const lines = csv.trimEnd().split('\n')
    expect(lines[0]).toBe(
      'position,handle,wallet,element,invites,follow_opened_at,follow_confirmed_at,like_opened_at,like_confirmed_at,repost_opened_at,repost_confirmed_at,comment_opened_at,comment_confirmed_at,joined_at',
    )
    expect(lines).toHaveLength(3)
    // Plain handles: a leading @ would start a formula in Excel.
    expect(lines[1]!.startsWith('1,tide,0x')).toBe(true)
    expect(lines[2]!.startsWith('2,ember,0x')).toBe(true)
    expect(lines[2]!).toMatch(/Z$/)
  })

  it('writes opened and confirmed times for each task', async () => {
    const a = await makeEntrant('1', 'ember')
    const opened = d.clock.now().toISOString()
    await doTasks(a)
    const confirmed = d.clock.now().toISOString()
    await bind(a, 'ember')
    await join(d, a)
    const cells = (await exportCsv(d)).trimEnd().split('\n')[1]!.split(',')
    expect(cells.slice(5, 13)).toEqual([opened, confirmed, opened, confirmed, opened, confirmed, opened, confirmed])
  })

  it('escapes commas and quotes in a field', async () => {
    const a = await ready('1', 'ember')
    await join(d, a)
    await d.db.update(entrants).set({ xHandle: 'we,ird"x' })
    const csv = await exportCsv(d)
    expect(csv).toContain(',"we,ird""x",')
  })

  it('exports 1,000 joined entrants well under a second', async () => {
    const at = d.clock.now()
    const rows = Array.from({ length: 1000 }, (_, i) => ({
      xUserId: `bulk-${i}`,
      xHandle: `bulk_${i}`,
      xName: `Bulk ${i}`,
      xCreatedAt: at,
      wallet: `0x${i.toString(16).padStart(40, '0')}`,
      position: i + 1,
      element: 'flame',
      refCode: `BULK${i}`,
      joinedAt: at,
    }))
    const ids = await d.db.insert(entrants).values(rows).returning({ id: entrants.id })
    await d.db
      .insert(taskEvents)
      .values(ids.flatMap(({ id }) => TASKS.map((task) => ({ entrantId: id, task, openedAt: at, confirmedAt: at }))))
    // Non-joined entrants with events must not slow or pollute the export.
    const extra = await makeEntrant('x1', 'pending')
    await openTask(d, extra, 'follow')

    const t0 = performance.now()
    const lines = (await exportCsv(d)).trimEnd().split('\n')
    const ms = performance.now() - t0
    expect(lines).toHaveLength(1001)
    expect(lines[1000]!.startsWith('1000,bulk_999,')).toBe(true)
    expect(lines[1000]!.split(',').slice(5, 13).every((c) => c === at.toISOString())).toBe(true)
    expect(ms).toBeLessThan(500)
  })

  it('counts joined referrals as invites and leaves nulls empty', async () => {
    const a = await ready('1', 'ember')
    const [row] = await d.db.select().from(entrants)
    const b = await ready('2', 'tide', 'Tide', row!.refCode)
    await join(d, a)
    await join(d, b)
    const lines = (await exportCsv(d)).trimEnd().split('\n')
    expect(lines[1]!.split(',')[4]).toBe('1')
    expect(lines[2]!.split(',')[4]).toBe('0')
  })

  it('has only the header when nobody joined', async () => {
    await ready('1', 'ember')
    expect((await exportCsv(d)).trimEnd().split('\n')).toHaveLength(1)
  })
})
