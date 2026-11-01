import { KIT_SIZE, MAX_BATTLE_MOVES, TEAM_SIZE } from '../data/battle'
import { MAX_DRAGON_LEVEL } from '../dragon'
import { DECORATIONS } from '../decorations'
import { ELEMENTS } from '../elements'
import { CROPS } from '../farm'
import { ISLAND_ORDER } from '../island'
import { SPEED_UP_TOKEN_MS } from '../data/speedups'
import { NODES_PER_CHAPTER, TRIAL_CHAPTERS } from '../data/trials'
import { ISLAND_TILES, isPlot } from '../plots'
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
    case 'claimGoal':
      return true
    case 'buyPlot':
      return isIsland(x['island']) && isPlot(x['plot'])
    case 'buyBridge':
      return isIsland(x['island']) && x['island'] !== 'home'
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
      return isIndex(x['breeder'])
    case 'hatch':
      return isIndex(x['slot'])
    case 'buyBasic':
      return typeof x['element'] === 'string' && (ELEMENTS as readonly string[]).includes(x['element'])
    case 'buy':
      return isStoreItem(x['item'])
    case 'useSpeedUp':
      return typeof x['token'] === 'string' && Object.hasOwn(SPEED_UP_TOKEN_MS, x['token']) && isSkipTarget(x['target']) && isIndex(x['index'])
    case 'setDefenceTeam':
      return isTeam(x['dragonIds'])
    case 'pvpBattle':
      return isTeam(x['team']) && isOpponent(x['opponent']) && isMoves(x['moves'])
    case 'startTrial':
      return isOneTo(x['chapter'], TRIAL_CHAPTERS.length) && isOneTo(x['node'], NODES_PER_CHAPTER) && isTeam(x['team'])
    case 'finishTrial':
      return isMoves(x['moves']) && isOptionalIndex(x['index'])
    case 'abandonTrial':
      return isOptionalIndex(x['index'])
    default:
      return false
  }
}

const isId = (v: unknown): v is string => typeof v === 'string' && v.length > 0
const isSkipTarget = (v: unknown): boolean => ['breeder', 'hatchery', 'farm', 'construction'].includes(v as string)
const isIndex = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0
/** `index` names the Trial a tab thinks it is settling; absent is allowed. */
const isOptionalIndex = (v: unknown): boolean => v === undefined || isIndex(v)
const isOneTo = (v: unknown, top: number): boolean => Number.isInteger(v) && (v as number) >= 1 && (v as number) <= top
const isIsland = (v: unknown): boolean => (ISLAND_ORDER as readonly unknown[]).includes(v)
const isCoord = (v: unknown): boolean => Number.isInteger(v) && (v as number) >= 0 && (v as number) < ISLAND_TILES
function isPlacement(v: unknown): boolean {
  if (typeof v !== 'object' || v === null) return false
  const p = v as Record<string, unknown>
  return isIsland(p['island']) && isCoord(p['col']) && isCoord(p['row'])
    && (p['facing'] === 0 || p['facing'] === 1 || p['facing'] === 2 || p['facing'] === 3)
}
function isPlaceable(v: unknown): boolean {
  if (typeof v !== 'object' || v === null) return false
  const b = v as Record<string, unknown>
  switch (b['kind']) {
    case 'habitat': return (ELEMENTS as readonly unknown[]).includes(b['element'])
    case 'farm':
    case 'grove':
    case 'roost': return true
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
    case 'breeder': return isIndex(t['index'])
    case 'hatchery':
    case 'roost': return true
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
    case 'breeder': return isIndex(t['index'])
    case 'hatchery':
    case 'roost': return true
    default: return false
  }
}
const isTeam = (v: unknown): boolean => Array.isArray(v) && v.length === TEAM_SIZE && v.every(isId)
const isLevel = (v: unknown): boolean => Number.isInteger(v) && (v as number) >= 1 && (v as number) <= MAX_DRAGON_LEVEL
const isSlot = (v: unknown, size: number): boolean => isIndex(v) && (v as number) < size
const isMove = (v: unknown): boolean => {
  if (typeof v !== 'object' || v === null) return false
  const m = v as Record<string, unknown>
  if (m['kind'] === 'attack') return isSlot(m['move'], KIT_SIZE)
  return (m['kind'] === 'swap' || m['kind'] === 'replace') && isSlot(m['to'], TEAM_SIZE)
}
const isMoves = (v: unknown): boolean => Array.isArray(v) && v.length <= MAX_BATTLE_MOVES && v.every(isMove)

function isOpponent(v: unknown): boolean {
  if (typeof v !== 'object' || v === null) return false
  const o = v as Record<string, unknown>
  const team = o['team']
  return (o['playerId'] === null || isId(o['playerId']))
    && Number.isInteger(o['trophies']) && Number.isInteger(o['level'])
    && Array.isArray(team) && team.length === TEAM_SIZE
    && team.every(isOpponentDragon)
}

/** A snapshot carries species and level only: HP is the battle's own (a start HP could fight hurt, or crash initBattle on 0). */
function isOpponentDragon(v: unknown): boolean {
  if (typeof v !== 'object' || v === null) return false
  const d = v as Record<string, unknown>
  return isId(d['speciesId']) && isLevel(d['level']) && !Object.hasOwn(d, 'hp')
}

function isStoreItem(v: unknown): boolean {
  if (typeof v !== 'object' || v === null) return false
  const item = v as Record<string, unknown>
  switch (item['kind']) {
    case 'skip':
      return ['breeder', 'hatchery', 'farm', 'construction'].includes(item['target'] as string) && isIndex(item['index'])
    case 'foodPack':
    case 'hatcheryL5':
    case 'ascension':
    case 'healAll':
      return true
    case 'habitatL5':
      return isId(item['habitatId'])
    case 'farmL5':
    case 'groveL3':
      return isIndex(item['index'])
    case 'goldenAerie':
      return isPlacement(item['placement'])
    default:
      return false
  }
}
