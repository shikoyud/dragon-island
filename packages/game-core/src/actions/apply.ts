import type { Catalog } from '../catalog'
import { LAUNCH_CATALOG } from '../data/launch-catalog'
import { DEFAULT_PRESET, type Preset } from '../data/presets'
import type { Rng } from '../rng'
import type { PlayerState } from '../state'
import { pveBattle, pvpBattle, setDefenceTeam } from './battle-actions'
import { collectEgg, hatch, startBreed } from './breed-actions'
import { buy } from './economy-actions'
import { harvest, plant } from './farm-actions'
import { finishConstruction, moveBuilding, placeBuilding, removeDecoration, startUpgrade } from './build-actions'
import { clearObstacle, expandIsland, unlockIsland } from './island-unlock-actions'
import { collectGold, feed, moveDragon, sellDragon } from './island-actions'
import { failure, type Action, type ActionCtx, type ActionResult } from './types'
import { isValidAction } from './validate'

/** Single entry point: pure, deterministic given (state, action, nowMs, rng, catalog, preset). */
export function applyAction(
  s: PlayerState, a: Action, nowMs: number, rng: Rng, catalog: Catalog = LAUNCH_CATALOG, preset: Preset = DEFAULT_PRESET,
): ActionResult {
  if (!isValidAction(a)) return failure('INVALID_ACTION')
  const ctx: ActionCtx = { nowMs, rng, catalog, preset }
  switch (a.type) {
    case 'collectGold': return collectGold(s, a, ctx)
    case 'placeBuilding': return placeBuilding(s, a, ctx)
    case 'moveBuilding': return moveBuilding(s, a, ctx)
    case 'removeDecoration': return removeDecoration(s, a, ctx)
    case 'startUpgrade': return startUpgrade(s, a, ctx)
    case 'finishConstruction': return finishConstruction(s, a, ctx)
    case 'expandIsland': return expandIsland(s, a, ctx)
    case 'unlockIsland': return unlockIsland(s, a, ctx)
    case 'clearObstacle': return clearObstacle(s, a, ctx)
    case 'moveDragon': return moveDragon(s, a, ctx)
    case 'feed': return feed(s, a, ctx)
    case 'sellDragon': return sellDragon(s, a, ctx)
    case 'plant': return plant(s, a, ctx)
    case 'harvest': return harvest(s, a, ctx)
    case 'startBreed': return startBreed(s, a, ctx)
    case 'collectEgg': return collectEgg(s, a, ctx)
    case 'hatch': return hatch(s, a, ctx)
    case 'buy': return buy(s, a, ctx)
    case 'setDefenceTeam': return setDefenceTeam(s, a, ctx)
    case 'pvpBattle': return pvpBattle(s, a, ctx)
    case 'pveBattle': return pveBattle(s, a, ctx)
  }
}
