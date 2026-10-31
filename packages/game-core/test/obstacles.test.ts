import { describe, expect, it } from 'vitest'
import { clearCost, clearReward, obstacleMult } from '../src/obstacles'
import type { IslandId, Obstacle } from '../src/state'

const rock = (island: IslandId): Obstacle => ({ id: 'o1', kind: 'smallRock', island, col: 8, row: 8 })

describe('obstacles', () => {
  it('multipliers read ISLANDS (§5.6)', () => {
    expect((['home', 'isle2', 'isle3', 'isle4', 'isle5', 'isle6'] as const).map(obstacleMult)).toEqual([1, 3, 10, 40, 150, 500])
  })
  it('Gold scales by island and XP does not (R52)', () => {
    expect(clearCost(rock('home'))).toBe(500)
    expect(clearCost(rock('isle2'))).toBe(1_500)
    expect(clearCost(rock('isle6'))).toBe(250_000)
    expect(clearReward(rock('isle2'))).toEqual({ xp: 25 })
    expect(clearReward({ ...rock('home'), kind: 'bush' })).toEqual({ xp: 5 })
  })
})
