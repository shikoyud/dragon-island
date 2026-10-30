import { MAX_ROUNDS, TEAM_SIZE } from '../battle/sim'
import { MAX_DRAGON_LEVEL } from '../dragon'
import { DECORATIONS } from '../decorations'
import { ELEMENTS } from '../elements'
import { CROPS } from '../farm'
import { ISLAND_ORDER } from '../island'
import type { Action } from './types'

/**
 * Shape check at the engine boundary. Actions arrive as untyped JSON from
 * clients; the TypeScript types alone do not stop a `'constructor'` crop or a
 * `'0'` index from poisoning state. Returns true only for a well-formed Action.
 */
export function isValidAction(a: unknown): a is Action {
  if (typeof a !== 'object' || a === null) return false
  const x = a as Record<string, unknown>
  switch (x['type']) {
    case 'collectGold':
      return isId(x['habitatId'])
    case 'startUpgrade':
      return isBuildingRef(x['building'])
    case 'expandIsland':
    case 'unlockIsland':
      return true
    case 'clearObstacle':
      return isId(x['obstacleId'])
    case 'finishConstruction':
      return isIndex(x['index'])
    case 'placeBuilding':
      return isPlaceable(x['building']) && isPlacement(x['placement'])
    case 'moveBuilding':
      return isMovable(x['target']) && isPlacement(x['placement'])
    case 'removeDecoration':
      return isId(x['id'])
    case 'moveDragon':
      return isId(x['dragonId']) && isId(x['habitatId'])
    case 'feed':
    case 'sellDragon':
      return isId(x['dragonId'])
    case 'plant':
      return isIndex(x['plot']) && typeof x['crop'] === 'string' && Object.hasOwn(CROPS, x['crop'])
    case 'harvest':
      return isIndex(x['plot'])
    case 'startBreed':
      return isId(x['parentA']) && isId(x['parentB'])
    case 'collectEgg':
      return isIndex(x['nest'])
    case 'hatch':
      return isIndex(x['slot'])
    case 'buy':
      return isStoreItem(x['item'])
    case 'setDefenceTeam':
      return isTeam(x['dragonIds'])
    case 'pvpBattle':
      return isTeam(x['team']) && isOpponent(x['opponent']) && isMoves(x['moves'])
    case 'pveBattle':
      return Number.isInteger(x['stage']) && isTeam(x['team']) && isMoves(x['moves'])
    default:
      return false
  }
}

const isId = (v: unknown): v is string => typeof v === 'string' && v.length > 0
const isIndex = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0
const isCoord = (v: unknown): boolean => Number.isInteger(v) && (v as number) >= 0 && (v as number) < 64
function isPlacement(v: unknown): boolean {
  if (typeof v !== 'object' || v === null) return false
  const p = v as Record<string, unknown>
  return (ISLAND_ORDER as readonly unknown[]).includes(p['island']) && isCoord(p['col']) && isCoord(p['row'])
    && (p['facing'] === 0 || p['facing'] === 1 || p['facing'] === 2 || p['facing'] === 3)
}
function isPlaceable(v: unknown): boolean {
  if (typeof v !== 'object' || v === null) return false
  const b = v as Record<string, unknown>
  switch (b['kind']) {
    case 'habitat': return (ELEMENTS as readonly unknown[]).includes(b['element'])
    case 'nexus':
    case 'farm': return true
    case 'decoration': return typeof b['decoration'] === 'string' && Object.hasOwn(DECORATIONS, b['decoration'])
    default: return false
  }
}
function isBuildingRef(v: unknown): boolean {
  if (typeof v !== 'object' || v === null) return false
  const t = v as Record<string, unknown>
  switch (t['type']) {
    case 'habitat': return isId(t['id'])
    case 'farm':
    case 'nest': return isIndex(t['index'])
    case 'hatchery': return true
    default: return false
  }
}
function isMovable(v: unknown): boolean {
  if (typeof v !== 'object' || v === null) return false
  const t = v as Record<string, unknown>
  switch (t['type']) {
    case 'habitat':
    case 'decoration': return isId(t['id'])
    case 'farm':
    case 'nest': return isIndex(t['index'])
    case 'hatchery': return true
    default: return false
  }
}
const isTeam = (v: unknown): boolean => Array.isArray(v) && v.length === 3 && v.every(isId)
const MAX_MOVES = MAX_ROUNDS * TEAM_SIZE
const isLevel = (v: unknown): boolean => Number.isInteger(v) && (v as number) >= 1 && (v as number) <= MAX_DRAGON_LEVEL
const isMoves = (v: unknown): boolean => Array.isArray(v) && v.length <= MAX_MOVES && v.every(m =>
  typeof m === 'object' && m !== null && isIndex((m as Record<string, unknown>)['move']) && isIndex((m as Record<string, unknown>)['target']))

function isOpponent(v: unknown): boolean {
  if (typeof v !== 'object' || v === null) return false
  const o = v as Record<string, unknown>
  const team = o['team']
  return (o['playerId'] === null || isId(o['playerId']))
    && Number.isInteger(o['trophies']) && Number.isInteger(o['level'])
    && Array.isArray(team) && team.length === 3
    && team.every(d => typeof d === 'object' && d !== null
      && isId((d as Record<string, unknown>)['speciesId']) && isLevel((d as Record<string, unknown>)['level']))
}

function isStoreItem(v: unknown): boolean {
  if (typeof v !== 'object' || v === null) return false
  const item = v as Record<string, unknown>
  switch (item['kind']) {
    case 'skip':
      return ['nest', 'hatchery', 'farm', 'construction'].includes(item['target'] as string) && isIndex(item['index'])
    case 'foodPack':
      return true
    default:
      return false
  }
}
