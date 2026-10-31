import { busyError, startConstruction } from '../construction'
import { ISLANDS, plotPrice } from '../data/islands'
import { bridgeError } from '../island'
import { clearCost, clearTimerMs, spawnPlotObstacles } from '../obstacles'
import { ownedPlots, plotError, plotsBought, STARTING_PLOTS } from '../plots'
import { payBuildXp } from '../progression'
import { spendGold } from '../wallet'
import type { Obstacle } from '../state'
import { failure, success, type Handler } from './types'

/** §5.5: one more plot touching owned land, priced by how many were bought on that island (R45). */
export const buyPlot: Handler<'buyPlot'> = (s, a, ctx) => {
  const bad = plotError(s, a.island, a.plot)
  if (bad) return failure(bad)
  const price = plotPrice(a.island, plotsBought(s, a.island))!
  const paid = spendGold(s, price)
  if (!paid) return failure('INSUFFICIENT_GOLD')
  const plots = { ...paid.islands.plots, [a.island]: [...ownedPlots(s, a.island), a.plot] }
  // R48: every purchased plot spawns its own obstacles, drawn from the action's Rng.
  const spawned = spawnPlotObstacles(a.island, a.plot, paid.nextId, ctx.rng)
  const islands = { ...paid.islands, plots, obstacles: [...paid.islands.obstacles, ...spawned] }
  return success(payBuildXp({ ...paid, islands, nextId: paid.nextId + spawned.length }, price, s, ctx.preset, ctx.day))
}

/** §5.5: the Bridge opens the next island with its 4 centre plots (R47). */
export const buyBridge: Handler<'buyBridge'> = (s, a, ctx) => {
  const bad = bridgeError(s, a.island)
  if (bad) return failure(bad)
  const price = ISLANDS[a.island].bridgeGold!
  const paid = spendGold(s, price)
  if (!paid) return failure('INSUFFICIENT_GOLD')
  // R48: each of the 4 plots spawns like a purchased one, in STARTING_PLOTS order.
  const spawned: Obstacle[] = []
  for (const plot of STARTING_PLOTS) spawned.push(...spawnPlotObstacles(a.island, plot, paid.nextId + spawned.length, ctx.rng))
  const islands = {
    ...paid.islands,
    unlocked: [...paid.islands.unlocked, a.island],
    plots: { ...paid.islands.plots, [a.island]: [...STARTING_PLOTS] },
    obstacles: [...paid.islands.obstacles, ...spawned],
  }
  return success(payBuildXp({ ...paid, islands, nextId: paid.nextId + spawned.length }, price, s, ctx.preset, ctx.day))
}

export const clearObstacle: Handler<'clearObstacle'> = (s, a, ctx) => {
  const o = s.islands.obstacles.find(x => x.id === a.obstacleId)
  if (!o) return failure('NOT_FOUND')
  if (s.constructions.some(c => c.kind === 'clear' && c.obstacleId === o.id)) return failure('UNDER_CONSTRUCTION')
  const paid = spendGold(s, clearCost(o))
  if (!paid) return failure('INSUFFICIENT_GOLD')
  const busy = busyError(paid, 'clear')
  if (busy) return failure(busy)
  const started = startConstruction(paid, { kind: 'clear', obstacleId: o.id }, clearTimerMs(o.kind, ctx.preset), ctx.nowMs)
  if (!started) return failure('CLEARS_BUSY')
  return success(started)
}
