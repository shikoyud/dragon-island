import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const SKIP = new Set(['node_modules', 'dist', '.next'])
const EXT = /\.(ts|tsx|css|md)$/

function walk(dir: string, out: string[] = []): string[] {
  let names: string[]
  try { names = readdirSync(dir) } catch { return out }
  for (const n of names) {
    if (SKIP.has(n)) continue
    const p = join(dir, n)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (EXT.test(n)) out.push(p)
  }
  return out
}

function sources(): string[] {
  const dirs = [join(root, 'packages'), join(root, 'docs')]
  for (const app of readdirSync(join(root, 'apps'))) dirs.push(join(root, 'apps', app, 'src'), join(root, 'apps', app, 'test'))
  return dirs.flatMap(d => walk(d))
}

describe('source encoding', () => {
  it('every .ts, .tsx, .css and .md source is valid UTF-8', () => {
    const files = sources()
    expect(files.length).toBeGreaterThan(50)
    const decoder = new TextDecoder('utf-8', { fatal: true })
    const bad = files.filter(f => {
      try { decoder.decode(readFileSync(f)); return false } catch { return true }
    })
    expect(bad.map(f => f.slice(root.length + 1))).toEqual([])
  })
})
