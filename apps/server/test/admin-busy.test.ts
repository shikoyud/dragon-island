import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ensureCurrentSeason, SEASON_MS } from '../src/services/season'
import { TEST_ADMIN_TOKEN, testApp, type TestApp } from './helpers/testApp'

// The advisory lock cannot be contended on PGlite (single connection), so the job reports busy via a mock.
vi.mock('../src/jobs/seasonClose', async orig => ({ ...(await orig<typeof import('../src/jobs/seasonClose')>()), closeSeasons: vi.fn(async () => ({ closed: [], busy: true })) }))

let t: TestApp
beforeEach(async () => { t = await testApp({}, 1_000) })
afterEach(async () => { await t.close() })

describe('POST /admin/season/:id/close', () => {
  it('returns 409 SEASON_BUSY while another close holds the lock', async () => {
    const s = await ensureCurrentSeason(t.db, t.clock)
    t.clock.advance(SEASON_MS + 6 * 60_000)
    const r = await t.app.inject({ method: 'POST', url: `/admin/season/${s.id}/close`, headers: { 'x-admin-token': TEST_ADMIN_TOKEN } })
    expect(r.statusCode).toBe(409)
    expect(r.json()).toEqual({ error: 'SEASON_BUSY' })
  })
})
