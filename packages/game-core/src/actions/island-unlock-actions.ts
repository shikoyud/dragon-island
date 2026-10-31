import { getSpecies } from '../catalog'
import { startConstruction } from '../construction'
import { homeStripObstacles, outerObstacles } from '../data/island-layouts'
import { isUnlocked } from '../data/unlocks'
import { HOME_EXPANSION, HOME_MAX_STEP, ISLAND_ORDER, OUTER_ISLANDS } from '../island'
import { OBSTACLES, clearCost } from '../obstacles'
import { payBuildXp } from '../progression'
import { spendGold } from '../wallet'
import { failure, success, type Handler } from './types'

export const expandIsland: Handler<'expandIsland'> = (s, _a, ctx) => {
  const step = s.islands.homeStep
  if (step >= HOME_MAX_STEP) return failure('MAX_EXPANSION')
  const next = HOME_EXPANSION[step]!
  if (!isUnlocked(`home:${step}`, s.level)) return failure('LEVEL_TOO_LOW')
  const paid = spendGold(s, next.cost)
  if (!paid) return failure('INSUFFICIENT_GOLD')
  return success(payBuildXp({
    ...paid,
    islands: { ...paid.islands, homeStep: step + 1, obstacles: [...paid.islands.obstacles, ...homeStripObstacles(step + 1)] },
  }, next.cost, s, ctx.preset, ctx.day))
}

export const unlockIsland: Handler<'unlockIsland'> = (s, _a, ctx) => {
  const last = Math.max(...s.islands.unlocked.map(i => ISLAND_ORDER.indexOf(i)))
  const island = ISLAND_ORDER[last + 1]
  if (!island || island === 'home') return failure('MAX_ISLAND')
  const req = OUTER_ISLANDS[island]
  if (!isUnlocked(`island:${island}`, s.level)) return failure('LEVEL_TOO_LOW')
  if (island === 'isle6' && !s.dragons.some(d => getSpecies(ctx.catalog, d.speciesId).rarity === 'legendary')) return failure('NO_LEGENDARY')
  const paid = spendGold(s, req.cost)
  if (!paid) return failure('INSUFFICIENT_GOLD')
  return success(payBuildXp({
    ...paid,
    islands: { ...paid.islands, unlocked: [...paid.islands.unlocked, island], obstacles: [...paid.islands.obstacles, ...outerObstacles(island)] },
  }, req.cost, s, ctx.preset, ctx.day))
}

export const clearObstacle: Handler<'clearObstacle'> = (s, a, ctx) => {
  const o = s.islands.obstacles.find(x => x.id === a.obstacleId)
  if (!o) return failure('NOT_FOUND')
  if (s.constructions.some(c => c.kind === 'clear' && c.obstacleId === o.id)) return failure('UNDER_CONSTRUCTION')
  const paid = spendGold(s, clearCost(o))
  if (!paid) return failure('INSUFFICIENT_GOLD')
  const started = startConstruction(paid, { kind: 'clear', obstacleId: o.id }, OBSTACLES[o.kind].timerMs, ctx.nowMs)
  if (!started) return failure('BUILDERS_BUSY')
  return success(started)
}
