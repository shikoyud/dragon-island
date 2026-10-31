import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  aiChoice, applyAction, basicPriceGold, createRng, ELEMENTS, generateBotTeam, initBattle, LAUNCH_CATALOG, newPlayer, NODES_PER_CHAPTER, nodeTeam, runDefender, step, TRIAL_CHAPTERS, TURN_LIMIT,
  type Action, type BattleDragonSpec, type PlayerState,
} from '../src/index'
import { ok } from './helpers'

const run = (s: PlayerState, a: Action) => ok(applyAction(s, a, 0, createRng(1), LAUNCH_CATALOG))

describe('the battle sim finishes on the launch catalog (Review Focus)', () => {
  const tri: BattleDragonSpec[] = [{ speciesId: 'flame-ice-sea', level: 20 }, { speciesId: 'ice-sea', level: 20 }, { speciesId: 'terra-flame', level: 20 }]
  const check = (a: readonly BattleDragonSpec[], b: readonly BattleDragonSpec[], seed: number) => {
    const rng = createRng(seed)
    let s = initBattle(a, b, LAUNCH_CATALOG)
    while (s.winner === null) s = runDefender(step(s, 'attacker', aiChoice(s, 'attacker', rng), rng)!, rng)
    expect(s.turn).toBeLessThanOrEqual(TURN_LIMIT)
  }

  const nodes = TRIAL_CHAPTERS.flatMap(c => Array.from({ length: NODES_PER_CHAPTER }, (_, i) => nodeTeam(c.chapter, i + 1, LAUNCH_CATALOG)))

  it('over every Trial node against a seeded bot team', () => {
    nodes.forEach((team, i) => check(generateBotTeam(1 + (i % 45), LAUNCH_CATALOG, createRng(i + 1)), team, i + 1))
  })

  it('with a team that holds flame-ice-sea, on both sides', () => {
    nodes.forEach((team, i) => {
      check(tri, team, i + 1)
      check(team, tri, i + 1)
    })
  })

})

describe('Dragon Book and Basic prices (deferred gaps)', () => {
  it('sets discovered when a hatched dragon has to wait for a habitat', () => {
    const s: PlayerState = { ...newPlayer(0), hatchery: [{ speciesId: 'sea', readyAtMs: 0 }] }
    const a = run(s, { type: 'hatch', slot: 0 })
    expect(a.dragons.find(d => d.speciesId === 'sea')!.habitatId).toBeNull()
    expect(a.discovered).toEqual(['terra', 'flame', 'sea'])
  })

  it('does not duplicate a starter in discovered on a repeat buyBasic', () => {
    const s: PlayerState = { ...newPlayer(0), gold: 5_000 }
    const a = run(s, { type: 'buyBasic', element: 'terra' })
    expect(a.dragons.filter(d => d.speciesId === 'terra')).toHaveLength(2)
    expect(a.discovered).toEqual(['terra', 'flame'])
  })

  it('pins all ten Basic prices', () => {
    expect(Object.fromEntries(ELEMENTS.map(e => [e, basicPriceGold(e)]))).toEqual({
      terra: 500, flame: 2_000, sea: 5_000, nature: 10_000, electric: 25_000,
      ice: 40_000, metal: 60_000, dark: 150_000, light: 200_000, war: 250_000,
    })
  })
})

describe('game-core stays pure (CLAUDE.md)', () => {
  const src = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'src')
  const walk = (dir: string): string[] => readdirSync(dir).flatMap(n => {
    const p = join(dir, n)
    return statSync(p).isDirectory() ? walk(p) : [p]
  })
  const BANNED: [string, RegExp][] = [
    ['a node: import', /\b(?:from|import|require)\s*\(?\s*['"]node:/],
    ['an fs import', /\b(?:from|import|require)\s*\(?\s*['"]fs(?:\/[\w/]*)?['"]/],
    ['Date.now', /\bDate\.now\b/],
    ['Math.random', /\bMath\.random\b/],
    ['new Date', /\bnew\s+Date\b/],
    ['process.', /\bprocess\.\w/],
  ]
  const violations = (text: string) => BANNED.filter(([, re]) => re.test(text)).map(([name]) => name)

  it('catches each banned form', () => {
    for (const line of ["import { readFileSync } from 'node:fs'", "import fs from 'fs'", "const p = await import('node:path')", 'const t = Date.now()', 'Math.random()', 'new Date()', 'process.env.X']) {
      expect(violations(line)).not.toEqual([])
    }
    expect(violations('const nowMs = 0 // time is a parameter')).toEqual([])
  })

  it('no file under src does I/O or reads the clock or a global RNG', () => {
    const files = walk(src)
    expect(files.length).toBeGreaterThan(20)
    const bad = files.flatMap(f => violations(readFileSync(f, 'utf8')).map(v => `${f.slice(src.length + 1)}: ${v}`))
    expect(bad).toEqual([])
  })
})
