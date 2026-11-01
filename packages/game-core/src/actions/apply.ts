import type { Catalog } from '../catalog'
import { LAUNCH_CATALOG } from '../data/launch-catalog'
import { DEFAULT_PRESET, type Preset } from '../data/presets'
import type { Rng } from '../rng'
import type { PlayerState } from '../state'
import { pvpBattle, setDefenceTeam } from './battle-actions'
import { abandonTrial, finishTrial, startTrial } from './trial-actions'
import { buyBasic, collectEgg, hatch, startBreed } from './breed-actions'
import { buy, useSpeedUp } from './economy-actions'
import { harvest, plant } from './farm-actions'
import { claimGoal } from './goal-actions'
import { finishConstruction, moveBuilding, placeBuilding, removeDecoration, startUpgrade } from './build-actions'
import { buyBridge, buyPlot, clearObstacle } from './island-unlock-actions'
import { collectGold, feed, moveDragon, sellDragon } from './island-actions'
import { settleLevels } from '../progression'
import { failure, type Action, type ActionCtx, type ActionResult } from './types'
import { isValidAction } from './validate'

/** Single entry point: pure, deterministic given (state, action, nowMs, rng, catalog, preset). */
export function applyAction(
  s: PlayerState, a: Action, nowMs: number, rng: Rng, catalog: Catalog = LAUNCH_CATALOG, preset: Preset = DEFAULT_PRESET, day = 1,
): ActionResult {
  if (!isValidAction(a)) return failure('INVALID_ACTION')
  const ctx: ActionCtx = { nowMs, rng, catalog, preset, day }
  // Banked XP pays before the action is judged, so a first action on a new day sees the new level (R41);
  // and again after it, for what the action itself awarded.
  const r = dispatch(settleLevels(s, preset, day), a, ctx)
  return r.ok ? { ...r, state: settleLevels(r.state, preset, day) } : r
}

function dispatch(s: PlayerState, a: Action, ctx: ActionCtx): ActionResult {
  switch (a.type) {
    case 'collectGold': return collectGold(s, a, ctx)
    case 'claimGoal': return claimGoal(s, a, ctx)
    case 'placeBuilding': return placeBuilding(s, a, ctx)
    case 'moveBuilding': return moveBuilding(s, a, ctx)
    case 'removeDecoration': return removeDecoration(s, a, ctx)
    case 'startUpgrade': return startUpgrade(s, a, ctx)
    case 'finishConstruction': return finishConstruction(s, a, ctx)
    case 'buyPlot': return buyPlot(s, a, ctx)
    case 'buyBridge': return buyBridge(s, a, ctx)
    case 'clearObstacle': return clearObstacle(s, a, ctx)
    case 'moveDragon': return moveDragon(s, a, ctx)
    case 'feed': return feed(s, a, ctx)
    case 'sellDragon': return sellDragon(s, a, ctx)
    case 'plant': return plant(s, a, ctx)
    case 'harvest': return harvest(s, a, ctx)
    case 'startBreed': return startBreed(s, a, ctx)
    case 'buyBasic': return buyBasic(s, a, ctx)
    case 'collectEgg': return collectEgg(s, a, ctx)
    case 'hatch': return hatch(s, a, ctx)
    case 'buy': return buy(s, a, ctx)
    case 'useSpeedUp': return useSpeedUp(s, a, ctx)
    case 'setDefenceTeam': return setDefenceTeam(s, a, ctx)
    case 'pvpBattle': return pvpBattle(s, a, ctx)
    case 'startTrial': return startTrial(s, a, ctx)
    case 'finishTrial': return finishTrial(s, a, ctx)
    case 'abandonTrial': return abandonTrial(s, a, ctx)
  }
}
