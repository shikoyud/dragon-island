import { startConstruction } from '../construction'
import { ISLANDS, plotPrice } from '../data/islands'
import { bridgeError } from '../island'
import { OBSTACLES, clearCost } from '../obstacles'
import { ownedPlots, plotError, plotsBought, STARTING_PLOTS } from '../plots'
import { payBuildXp } from '../progression'
import { spendGold } from '../wallet'
import { failure, success, type Handler } from './types'

/** §5.5: one more plot touching owned land, priced by how many were bought on that island (R45). */
export const buyPlot: Handler<'buyPlot'> = (s, a, ctx) => {
  const bad = plotError(s, a.island, a.plot)
  if (bad) return failure(bad)
  const price = plotPrice(a.island, plotsBought(s, a.island))!
  const paid = spendGold(s, price)
  if (!paid) return failure('INSUFFICIENT_GOLD')
  const plots = { ...paid.islands.plots, [a.island]: [...ownedPlots(s, a.island), a.plot] }
  return success(payBuildXp({ ...paid, islands: { ...paid.islands, plots } }, price, s, ctx.preset, ctx.day))
}

/** §5.5: the Bridge opens the next island with its 4 centre plots (R47). */
export const buyBridge: Handler<'buyBridge'> = (s, a, ctx) => {
  const bad = bridgeError(s, a.island)
  if (bad) return failure(bad)
  const price = ISLANDS[a.island].bridgeGold!
  const paid = spendGold(s, price)
  if (!paid) return failure('INSUFFICIENT_GOLD')
  const islands = {
    ...paid.islands,
    unlocked: [...paid.islands.unlocked, a.island],
    plots: { ...paid.islands.plots, [a.island]: [...STARTING_PLOTS] },
  }
  return success(payBuildXp({ ...paid, islands }, price, s, ctx.preset, ctx.day))
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
