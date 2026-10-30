import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { game } from '../src/db/schema'
import { ensureGame, getGame } from '../src/services/game'
import { commitHash, secretFromHex } from '../src/services/seed'
import { testApp, type TestApp } from './helpers/testApp'

let t: TestApp
beforeEach(async () => { t = await testApp() })
afterEach(async () => { await t.close() })

describe('ensureGame', () => {
  it('creates row 1 once and returns the same row on every call', async () => {
    expect(await getGame(t.db)).toBeNull()
    const a = await ensureGame(t.db, t.clock)
    const b = await ensureGame(t.db, t.clock)
    expect(b).toEqual(a)
    expect(a.id).toBe(1)
    expect(a.revealed).toBe(false)
    expect(await t.db.select().from(game)).toHaveLength(1)
  })

  it('commits to the secret: commit_hash is keccak256 of secret_hex', async () => {
    const g = await ensureGame(t.db, t.clock)
    expect(g.commitHash).toBe(commitHash(secretFromHex(g.secretHex)))
  })

  it('converges to one row under concurrent first calls', async () => {
    const rows = await Promise.all(Array.from({ length: 6 }, () => ensureGame(t.db, t.clock)))
    expect(new Set(rows.map(r => r.secretHex)).size).toBe(1)
    expect(await t.db.select().from(game)).toHaveLength(1)
  })
})
