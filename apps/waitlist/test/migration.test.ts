import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { asc } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createPgliteDb, defaultMigrationsFolder, migrate, type Db } from '../src/server/db/client'
import { entrants } from '../src/server/db/schema'

const OLD_TO_NEW = [['fire', 'flame'], ['water', 'sea'], ['earth', 'terra'], ['nature', 'nature'], ['light', 'light']] as const

/** A migrations folder that stops at 0000_init: the database as deployed before the rename. */
function folderBeforeRename(): string {
  const source = defaultMigrationsFolder()
  const dir = mkdtempSync(path.join(tmpdir(), 'waitlist-migrations-'))
  mkdirSync(path.join(dir, 'meta'))
  cpSync(path.join(source, '0000_init.sql'), path.join(dir, '0000_init.sql'))
  const journal = JSON.parse(readFileSync(path.join(source, 'meta', '_journal.json'), 'utf8')) as { entries: { tag: string }[] }
  journal.entries = journal.entries.filter(e => e.tag === '0000_init')
  writeFileSync(path.join(dir, 'meta', '_journal.json'), JSON.stringify(journal))
  return dir
}

describe('0001_element_rename (R14)', () => {
  let db: Db
  let close: () => Promise<void>
  let oldFolder: string
  beforeEach(async () => {
    ({ db, close } = await createPgliteDb())
    oldFolder = folderBeforeRename()
  })
  afterEach(async () => {
    await close()
    rmSync(oldFolder, { recursive: true, force: true })
  })

  it('maps stored fire/water/earth to flame/sea/terra and leaves the rest alone', async () => {
    await migrate(db, oldFolder)
    await db.insert(entrants).values(OLD_TO_NEW.map(([element], i) => ({
      xUserId: `u${i}`, xHandle: `h${i}`, xName: `n${i}`, xCreatedAt: new Date('2020-01-01T00:00:00Z'), element, refCode: `ref${i}`,
    })))

    await migrate(db)

    const rows = await db.select({ element: entrants.element }).from(entrants).orderBy(asc(entrants.xUserId))
    expect(rows.map(r => r.element)).toEqual(OLD_TO_NEW.map(([, element]) => element))
  })
})
