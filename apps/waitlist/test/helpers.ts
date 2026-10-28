import { newRefCode } from '../src/domain/refCode'
import { loadConfig } from '../src/server/config'
import { createPgliteDb, migrate, type Db } from '../src/server/db/client'
import type { Clock, Deps } from '../src/server/deps'

/** A fresh, migrated in-memory Postgres. */
export async function makeTestDb(): Promise<{ db: Db; close(): Promise<void> }> {
  const { db, close } = await createPgliteDb()
  await migrate(db)
  return { db, close }
}

export class FakeClock implements Clock {
  private t: Date
  constructor(start: Date = new Date('2026-11-01T12:00:00Z')) {
    this.t = start
  }
  now(): Date {
    return new Date(this.t)
  }
  set(d: Date): void {
    this.t = new Date(d)
  }
  advance(ms: number): void {
    this.t = new Date(this.t.getTime() + ms)
  }
}

const unused = (): never => {
  throw new Error('not used')
}

/** Deps over a fresh migrated PGlite db, a fake clock and a stub X client. */
export async function makeTestDeps(): Promise<Deps & { clock: FakeClock; close(): Promise<void> }> {
  const { db, close } = await makeTestDb()
  return {
    db,
    clock: new FakeClock(),
    x: { authorizeUrl: unused, exchangeCode: unused, me: unused },
    newCode: newRefCode,
    config: loadConfig({ SESSION_SECRET: 'test-secret-test-secret-test-secret!' }),
    close,
  }
}
