import { busyError, startConstruction } from '../construction'
import { ISLANDS, plotPrice } from '../data/islands'
import { OBSTACLES } from '../data/obstacles'
import { bridgeError, occupants } from '../island'
import { clearCost, clearTimerMs, spawnPlotObstacles } from '../obstacles'
import { offeredPlots, ownedPlots, plotError, plotOfTile, plotsBought, STARTING_PLOTS } from '../plots'
import { payBuildXp } from '../progression'
import type { Rng } from '../rng'
import { spendGold } from '../wallet'
import type { IslandId, Obstacle, PlayerState } from '../state'
import { failure, success, type Handler } from './types'

/** §5.5: one more plot touching owned land, priced by how many were bought on that island (R45). */
export const buyPlot: Handler<'buyPlot'> = (s, a, ctx) => {
  const bad = plotError(s, a.island, a.plot)
  if (bad) return failure(bad)
  const price = plotPrice(a.island, plotsBought(s, a.island))!
  const paid = spendGold(s, price)
  if (!paid) return failure('INSUFFICIENT_GOLD')
  const plots = { ...paid.islands.plots, [a.island]: [...ownedPlots(s, a.island), a.plot] }
  const bought: PlayerState = { ...paid, islands: { ...paid.islands, plots } }
  // U4: on Home the plots that became offered spawn their obstacles (a bought plot already has its own); R48: elsewhere the bought plot does.
  const before = offeredPlots(s, a.island)
  const spawnOn = a.island === 'home' ? offeredPlots(bought, a.island).filter(p => !before.includes(p)) : [a.plot]
  const spawned = spawnOnPlots(bought, a.island, spawnOn, paid.nextId, ctx.rng)
  const islands = { ...paid.islands, plots, obstacles: [...paid.islands.obstacles, ...spawned] }
  return success(payBuildXp({ ...paid, islands, nextId: paid.nextId + spawned.length }, price, s, ctx.preset, ctx.day))
}

/** Spawns on each plot in turn (U7): each sees the buildings and obstacles already placed, those spawned just before included. */
function spawnOnPlots(s: PlayerState, island: IslandId, plots: readonly number[], firstId: number, rng: Rng): Obstacle[] {
  const occupied: { col: number; row: number; size: number }[] = occupants(s, island).map(o => ({ col: o.col, row: o.row, size: o.size }))
  const spawned: Obstacle[] = []
  for (const plot of plots) {
    for (const o of spawnPlotObstacles(island, plot, firstId + spawned.length, rng, occupied)) {
      spawned.push(o)
      occupied.push({ col: o.col, row: o.row, size: OBSTACLES[o.kind].size })
    }
  }
  return spawned
}

/** §5.5: the Bridge opens the next island with its 4 centre plots (R47). */
export const buyBridge: Handler<'buyBridge'> = (s, a, ctx) => {
  const bad = bridgeError(s, a.island)
  if (bad) return failure(bad)
  const price = ISLANDS[a.island].bridgeGold!
  const paid = spendGold(s, price)
  if (!paid) return failure('INSUFFICIENT_GOLD')
  // R48: each of the 4 plots spawns like a purchased one, in STARTING_PLOTS order.
  const spawned = spawnOnPlots(paid, a.island, STARTING_PLOTS, paid.nextId, ctx.rng)
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
  // U5: land you don't own can't be cleared; buy the plot first.
  const plot = plotOfTile(o.col, o.row)
  if (plot === null || !ownedPlots(s, o.island).includes(plot)) return failure('PLOT_LOCKED')
  if (s.constructions.some(c => c.kind === 'clear' && c.obstacleId === o.id)) return failure('UNDER_CONSTRUCTION')
  const paid = spendGold(s, clearCost(o))
  if (!paid) return failure('INSUFFICIENT_GOLD')
  const busy = busyError(paid, 'clear')
  if (busy) return failure(busy)
  // busyError above is the same check startConstruction makes, so this cannot be null.
  return success(startConstruction(paid, { kind: 'clear', obstacleId: o.id }, clearTimerMs(o.kind, ctx.preset), ctx.nowMs)!)
}
