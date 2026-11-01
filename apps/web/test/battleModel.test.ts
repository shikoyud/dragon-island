// The battle screen's pure logic: what plays next, what shows at each event, what each hit looks like.
import { battlePreview, createRng, LAUNCH_CATALOG, type BattleDragonSpec, type BattleEvent, type PlayerMove } from '@wyrmhaven/game-core'
import { describe, expect, it } from 'vitest'
import { backdropFill, battleLine, battleView, dragonFlip, hitFx, pipState, playbackQueue, turnLabel } from '../src/game/battleModel'

const c = LAUNCH_CATALOG
const three = (id: string, level: number, hp?: number): BattleDragonSpec[] => [0, 1, 2].map(() => ({ speciesId: id, level, ...(hp ? { hp } : {}) }))
type Attack = Extract<BattleEvent, { kind: 'attack' }>
const attack = (over: Partial<Attack> = {}): Attack =>
  ({ kind: 'attack', turn: 1, side: 'attacker', slot: 0, move: 1, target: 0, damage: 100, multiplier: 1, crit: false, immune: false, ko: false, ...over })
const STRIKE: PlayerMove = { kind: 'attack', move: 0 }
const play = (me: BattleDragonSpec[], foe: BattleDragonSpec[], moves: PlayerMove[]) => battlePreview(me, foe, moves, createRng(7), c).state

describe('playbackQueue', () => {
  it('is what was added, in order', () => {
    const a = attack({ turn: 1 })
    const b = attack({ turn: 2, side: 'defender' })
    expect(playbackQueue([], [a, b])).toEqual([a, b])
    expect(playbackQueue([a], [a, b])).toEqual([b])
    expect(playbackQueue([a, b], [a, b])).toEqual([])
  })

  it('a shorter log has nothing to play', () => {
    expect(playbackQueue([attack(), attack()], [attack()])).toEqual([])
  })
})

describe('battleView', () => {
  it('at 0 shows the start: entry HP, the first dragons, turn 0', () => {
    const s = play(three('flame', 20, 1_000), three('nature', 1), [STRIKE, STRIKE])
    expect(battleView(s, 0)).toMatchObject({ hp: { attacker: [1_000, 1_000, 1_000], defender: [1_600, 1_600, 1_600] }, active: { attacker: 0, defender: 0 }, turn: 0, last: null })
  })

  it('at the end equals the machine, event by event up to it', () => {
    const moves: PlayerMove[] = [STRIKE, { kind: 'swap', to: 1 }, STRIKE, STRIKE]
    const s = play(three('flame', 20), three('sea', 30), moves)
    const end = battleView(s, s.log.length)
    expect(end.hp.attacker).toEqual(s.sides.attacker.team.map(f => f.hp))
    expect(end.hp.defender).toEqual(s.sides.defender.team.map(f => f.hp))
    expect(end.active).toEqual({ attacker: s.sides.attacker.active, defender: s.sides.defender.active })
    expect(end.turn).toBe(s.turn)
  })

  it('does not spoil: an event not yet played changes nothing, however bad', () => {
    const s = play(three('flame', 1), three('sea', 40), [STRIKE])
    expect(s.sides.attacker.team[0]!.hp).toBe(0)
    const afterMine = battleView(s, 1)
    expect(afterMine.hp.attacker[0]).toBe(1_600)
    expect(afterMine.last).toEqual(s.log[0])
    expect(battleView(s, 2).hp.attacker[0]).toBe(0)
  })

  it('a replacement changes who is active and not the turn', () => {
    const s = play(three('flame', 1), three('sea', 40), [STRIKE, { kind: 'replace', to: 2 }])
    const i = s.log.findIndex(e => e.kind === 'replace')
    const before = battleView(s, i)
    const after = battleView(s, i + 1)
    expect(after.active.attacker).toBe(2)
    expect(after.turn).toBe(before.turn)
  })

  it('survives an empty team (a scene test gives one)', () => {
    const s = { sides: { attacker: { team: [], active: 0 }, defender: { team: [], active: 0 } }, log: [] } as never
    expect(battleView(s, 0).hp).toEqual({ attacker: [], defender: [] })
  })
})

describe('turnLabel', () => {
  it('counts the turn being played, so a battle ending on Turn 8 meets the 8-turn goal; never past the limit', () => {
    expect(turnLabel(0, false)).toBe('Turn 1 / 30')
    expect(turnLabel(6, false)).toBe('Turn 7 / 30')
    expect(turnLabel(8, true)).toBe('Turn 8 / 30')
    expect(turnLabel(30, false)).toBe('Turn 30 / 30')
  })
})

describe('hitFx', () => {
  it('shows the damage, no tint at 1x', () => {
    expect(hitFx(attack())).toMatchObject({ text: '-100', tint: null, crit: false, label: null, ko: false })
  })
  it('2x and 0.5x have different tints and say so', () => {
    const up = hitFx(attack({ multiplier: 2 }))
    const down = hitFx(attack({ multiplier: 0.5 }))
    expect(up.tint).not.toBeNull()
    expect(down.tint).not.toBeNull()
    expect(up.tint).not.toBe(down.tint)
    expect(up.label).toBe('2x')
    expect(down.label).toBe('0.5x')
  })
  it('IMMUNE shows no number and no tint, even with a crit rolled', () => {
    const fx = hitFx(attack({ multiplier: 0, damage: 0, immune: true, crit: true }))
    expect(fx).toMatchObject({ text: 'IMMUNE', tint: null, crit: false, label: null })
  })
  it('a crit and a KO are carried', () => {
    expect(hitFx(attack({ crit: true, ko: true }))).toMatchObject({ crit: true, ko: true })
  })
})

describe('battleLine', () => {
  const s = play(three('flame', 20), three('sea', 1), [])
  const flame = c.species.get('flame')!.name
  const sea = c.species.get('sea')!.name

  it('names the dragon and the move, never an id', () => {
    expect(battleLine(s, attack())).toBe(`${flame}: Cinder Spit, 100 damage`)
    expect(battleLine(s, attack({ side: 'defender', move: 2, multiplier: 2, crit: true }))).toBe(`Enemy ${sea}: Riptide Lash, 100 damage, 2x, critical`)
  })
  it('IMMUNE has no damage in it', () => {
    expect(battleLine(s, attack({ multiplier: 0, damage: 0, immune: true }))).toBe(`${flame}: Cinder Spit, IMMUNE`)
  })
  it('says a KO, a swap and a replacement', () => {
    expect(battleLine(s, attack({ ko: true }))).toBe(`${flame}: Cinder Spit, 100 damage. Enemy ${sea} is out`)
    expect(battleLine(s, { kind: 'swap', turn: 1, side: 'attacker', from: 0, to: 1 })).toBe(`${flame} swaps in`)
    expect(battleLine(s, { kind: 'replace', turn: 1, side: 'defender', from: 0, to: 1 })).toBe(`Enemy ${sea} enters`)
  })
})

describe('dragonFlip', () => {
  it('turns each dragon to face the other: the art faces left, but a hatchling sheet faces right', () => {
    expect(dragonFlip('attacker', 20)).toBe(true)
    expect(dragonFlip('defender', 20)).toBe(false)
    expect(dragonFlip('attacker', 5)).toBe(true)
    expect(dragonFlip('defender', 5)).toBe(false)
    expect(dragonFlip('attacker', 1)).toBe(false)
    expect(dragonFlip('defender', 1)).toBe(true)
  })
})

describe('pipState', () => {
  it('alive, hurt or KO', () => {
    expect(pipState(100, 100)).toBe('alive')
    expect(pipState(99, 100)).toBe('hurt')
    expect(pipState(0, 100)).toBe('ko')
  })
})

describe('backdropFill', () => {
  it('has a sky and ground per chapter element, and a neutral one for PvP', () => {
    const flame = backdropFill('flame')
    expect(flame.sky).not.toBe(flame.ground)
    expect(backdropFill('sea').sky).not.toBe(flame.sky)
    expect(backdropFill(null)).toEqual(expect.objectContaining({ sky: expect.any(Number), ground: expect.any(Number) }))
  })
})
