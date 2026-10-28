import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ACTIVE_ART } from '../src/art/slots'
import { cardResponse } from '../src/card/cardRoute'
import { renderCard } from '../src/card/renderCard'
import { ELEMENTS } from '../src/domain/elements'
import { CONFIRM_DELAY_MS, TASKS } from '../src/domain/tasks'
import { entrants } from '../src/server/db/schema'
import { getCardData, upsertFromX } from '../src/server/entrants'
import { join } from '../src/server/join'
import { openTask, confirmTask } from '../src/server/tasks'
import { eq } from 'drizzle-orm'
import { makeTestDeps } from './helpers'

type TD = Awaited<ReturnType<typeof makeTestDeps>>
let d: TD
beforeEach(async () => {
  d = await makeTestDeps()
})
afterEach(async () => {
  await d.close()
})

async function entrant(xid: string, username: string, joined: boolean): Promise<string> {
  const r = await upsertFromX(d, {
    id: xid,
    username,
    name: username,
    profileImageUrl: 'https://pbs.twimg.com/profile_images/1/pic_normal.jpg',
    createdAt: new Date(d.clock.now().getTime() - 400 * 86_400_000),
  })
  if (!('entrantId' in r)) throw new Error('no entrant')
  if (joined) {
    for (const t of TASKS) await openTask(d, r.entrantId, t)
    d.clock.advance(CONFIRM_DELAY_MS)
    for (const t of TASKS) await confirmTask(d, r.entrantId, t)
    await d.db.update(entrants).set({ wallet: '0x' + 'ab'.repeat(20) }).where(eq(entrants.id, r.entrantId))
    expect(await join(d, r.entrantId)).toEqual({ position: 1 })
  }
  return r.entrantId
}

const dims = (buf: Buffer) => [buf.readUInt32BE(16), buf.readUInt32BE(20)]

describe('renderCard', () => {
  it.each(ELEMENTS)('renders a 1200x675 PNG for %s', async (element) => {
    const res = await renderCard(
      { handle: 'ember', avatarUrl: 'https://pbs.twimg.com/a.jpg', position: 42, element },
      { fetchImage: async () => null },
    )
    expect(res.headers.get('content-type')).toBe('image/png')
    const buf = Buffer.from(await res.arrayBuffer())
    expect(buf.subarray(1, 4).toString()).toBe('PNG')
    expect(dims(buf)).toEqual([1200, 675])
  })

  it('renders with an empty avatar url and with a failing fetch', async () => {
    for (const avatarUrl of ['', null, 'https://x/y.png']) {
      const res = await renderCard(
        { handle: 'ember', avatarUrl, position: 1, element: 'fire' },
        { fetchImage: async () => { throw new Error('boom') } },
      )
      expect(dims(Buffer.from(await res.arrayBuffer()))).toEqual([1200, 675])
    }
  })
})

describe('getCardData', () => {
  it('returns data for a joined entrant and null otherwise', async () => {
    const id = await entrant('1', 'ember', true)
    const [row] = await d.db.select().from(entrants).where(eq(entrants.id, id))
    const data = await getCardData(d, row!.refCode)
    expect(data).toMatchObject({ handle: 'ember', position: 1 })
    expect(ELEMENTS).toContain(data!.element)
    expect(await getCardData(d, 'nope')).toBeNull()
  })

  it('is null for an entrant without a position', async () => {
    const id = await entrant('2', 'tide', false)
    const [row] = await d.db.select().from(entrants).where(eq(entrants.id, id))
    expect(await getCardData(d, row!.refCode)).toBeNull()
  })
})

describe('cardResponse', () => {
  it('404s for unknown and not-joined codes', async () => {
    const id = await entrant('2', 'tide', false)
    const [row] = await d.db.select().from(entrants).where(eq(entrants.id, id))
    expect((await cardResponse(d, 'unknown')).status).toBe(404)
    expect((await cardResponse(d, row!.refCode)).status).toBe(404)
  })

  it('serves a cached PNG with an ETag, stripping .png', async () => {
    const id = await entrant('1', 'ember', true)
    const [row] = await d.db.select().from(entrants).where(eq(entrants.id, id))
    const res = await cardResponse(d, `${row!.refCode}.png`, { fetchImage: async () => null })
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('image/png')
    expect(res.headers.get('cache-control')).toBe('public, max-age=3600')
    expect(res.headers.get('etag')).toBe(`"${row!.refCode}-${ACTIVE_ART.version}-1"`)
  })
})
