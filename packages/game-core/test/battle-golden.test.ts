// One battle, fixed seed, its whole log pinned literally. Every draw (damage variance, crit, the AI's own picks) shares
// the battle's Rng, so a change in draw order, in the damage formula or in the AI shows here as a different log, not only as a
// different winner. If this test fails on purpose, regenerate the literals and say why in the commit.
import { expect, it } from 'vitest'
import { battlePreview, createRng, LAUNCH_CATALOG as C, simulateBattle, type BattleDragonSpec, type PlayerMove } from '../src/index'

const ATTACKER: BattleDragonSpec[] = [{ speciesId: 'terra', level: 14 }, { speciesId: 'flame', level: 14 }, { speciesId: 'sea', level: 14 }]
// Chapter 4 node 6's team, written out so a change to the enemy tables doesn't move this test.
const DEFENDER: BattleDragonSpec[] = [{ speciesId: 'nature-dark', level: 11 }, { speciesId: 'nature-dark', level: 11 }, { speciesId: 'flame-light', level: 11 }]
const SEED = 3
const MOVES: PlayerMove[] = [
  { kind: 'attack', move: 0 }, { kind: 'attack', move: 1 }, { kind: 'replace', to: 1 }, { kind: 'swap', to: 2 }, { kind: 'replace', to: 1 },
  { kind: 'attack', move: 2 }, { kind: 'attack', move: 0 }, { kind: 'attack', move: 1 }, { kind: 'attack', move: 2 },
]

const LOG = [
  { kind: 'attack', turn: 1, side: 'attacker', slot: 0, move: 0, target: 0, damage: 704, multiplier: 1, crit: false, immune: false, ko: false },
  { kind: 'attack', turn: 2, side: 'defender', slot: 0, move: 2, target: 0, damage: 2302, multiplier: 1, crit: true, immune: false, ko: false },
  { kind: 'attack', turn: 3, side: 'attacker', slot: 0, move: 1, target: 0, damage: 1265, multiplier: 1, crit: false, immune: false, ko: false },
  { kind: 'attack', turn: 4, side: 'defender', slot: 0, move: 2, target: 0, damage: 1474, multiplier: 1, crit: false, immune: false, ko: true },
  { kind: 'replace', turn: 4, side: 'attacker', from: 0, to: 1 },
  { kind: 'swap', turn: 5, side: 'attacker', from: 1, to: 2 },
  { kind: 'attack', turn: 6, side: 'defender', slot: 0, move: 1, target: 2, damage: 3877, multiplier: 2, crit: true, immune: false, ko: true },
  { kind: 'replace', turn: 6, side: 'attacker', from: 2, to: 1 },
  { kind: 'attack', turn: 7, side: 'attacker', slot: 1, move: 2, target: 0, damage: 3162, multiplier: 2, crit: false, immune: false, ko: true },
  { kind: 'replace', turn: 7, side: 'defender', from: 0, to: 1 },
  { kind: 'attack', turn: 8, side: 'defender', slot: 1, move: 0, target: 1, damage: 725, multiplier: 1, crit: false, immune: false, ko: false },
  { kind: 'attack', turn: 9, side: 'attacker', slot: 1, move: 0, target: 1, damage: 780, multiplier: 1, crit: false, immune: false, ko: false },
  { kind: 'attack', turn: 10, side: 'defender', slot: 1, move: 1, target: 1, damage: 1000, multiplier: 0.5, crit: true, immune: false, ko: false },
  { kind: 'attack', turn: 11, side: 'attacker', slot: 1, move: 1, target: 1, damage: 2761, multiplier: 2, crit: false, immune: false, ko: false },
  { kind: 'attack', turn: 12, side: 'defender', slot: 1, move: 2, target: 1, damage: 1520, multiplier: 1, crit: false, immune: false, ko: false },
  { kind: 'attack', turn: 13, side: 'attacker', slot: 1, move: 2, target: 1, damage: 2905, multiplier: 2, crit: false, immune: false, ko: true },
  { kind: 'replace', turn: 13, side: 'defender', from: 1, to: 2 },
  { kind: 'attack', turn: 14, side: 'defender', slot: 2, move: 2, target: 1, damage: 1970, multiplier: 1, crit: true, immune: false, ko: true },
]

it('a fixed-seed battle keeps its full log, draw for draw', () => {
  const out = simulateBattle(ATTACKER, DEFENDER, MOVES, createRng(SEED), C)
  expect(out).toEqual({ ok: true, winner: 'defender', turns: 14, log: LOG, attacker: [0, 0, 0], defender: [0, 0, 3646], attackerKos: 3 })
})

it('the same battle seen through the preview, one move at a time, is the same log', () => {
  for (let n = 0; n <= MOVES.length; n++) {
    const p = battlePreview(ATTACKER, DEFENDER, MOVES.slice(0, n), createRng(SEED), C)
    expect(p.state.log).toEqual(LOG.slice(0, p.state.log.length))
  }
})
