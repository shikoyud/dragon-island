// Test helper, not a game AI: bots that play the real rules through applyAction on a fake clock (§4.3, §7.2, M3 Q1).
// They start from newPlayer and are handed nothing but Gold and Food. The clock jumps to the next thing that finishes,
// so a non-stop bot loses no time to a coarse step.
import { applyAction } from '../../src/actions/apply'
import type { Action, Placeable } from '../../src/actions/types'
import { activeLegendaries, breedingOdds, breedValidity } from '../../src/breeding'
import { breederBreedMs, upgradeInfo } from '../../src/buildings'
import { getSpecies } from '../../src/catalog'
import { isUnderConstruction, isUnfinished, MAX_BUILDERS } from '../../src/construction'
import { breedTimerMs } from '../../src/data/breeding-timers'
import { LAUNCH_CATALOG } from '../../src/data/launch-catalog'
import { isUnlocked, type UnlockKey } from '../../src/data/unlocks'
import type { Preset } from '../../src/data/presets'
import { HATCH_XP, START_BREED_XP } from '../../src/data/xp'
import { foodPerFeed, levelCap } from '../../src/dragon'
import { ELEMENTS, type Element } from '../../src/elements'
import { ISLAND_ORDER } from '../../src/island'
import { ISLAND_TILES, plotError } from '../../src/plots'
import { ALL_PLOTS } from './land'
import { CROP_IDS, cropGrowMs, cropUnlocked, MAX_FARMS } from '../../src/farm'
import { gameDay } from '../../src/game-clock'
import { placementRuleError } from '../../src/placement-rules'
import { breedXpApplies } from '../../src/progression'
import { createRng } from '../../src/rng'
import { newPlayer, type Breeder, type CropId, type IslandId, type Placement, type PlayerState } from '../../src/state'
import { MS_PER_DAY } from '../../src/time'

const c = LAUNCH_CATALOG
const HOUR = 3_600_000
const MAX_IDLE_MS = 5 * 60_000
const GRANT = 1e12

export interface Reached { day: number; hours: number }
export interface BotPlan {
  name: string
  preset: Preset
  seed?: number
  /** Stop at this level, or at the end of this game day. */
  untilLevel: number
  maxDay: number
  grantGold?: boolean
  grantFood?: boolean
  /** A crop on every free plot: always the Dragon Bush, or the richest that grows between two sessions. */
  farm?: 'bush' | 'bestFit'
  breed?: boolean
  /** Feeds every dragon up to this level, within the Roost's cap. */
  feedTo?: number
  roost?: boolean
  /** Plays only in these windows, the first at launch. */
  sessions?: { perDay: number; minutes: number }
}
export interface BotResult {
  name: string
  reached: ReadonlyMap<number, Reached>
  /** Level at the end of each game day; index 0 is Day 1. */
  endOfDay: number[]
  final: PlayerState
  actions: number
}

export function runBot(p: BotPlan): BotResult {
  const rng = createRng(p.seed ?? 1)
  let s = newPlayer(0)
  let now = 0
  let actions = 0
  const reached = new Map<number, Reached>()
  const endOfDay: number[] = []
  const day = () => gameDay(0, now)

  const act = (a: Action): boolean => {
    actions++
    const r = applyAction(s, a, now, rng, c, p.preset, day())
    if (!r.ok) return false
    for (let pl = s.level + 1; pl <= r.state.level; pl++) reached.set(pl, { day: day(), hours: now / HOUR })
    s = r.state
    return true
  }

  const builderFree = () => s.constructions.length < MAX_BUILDERS
  const unlocked = (k: UnlockKey) => isUnlocked(k, s.level)

  /** The first free cell: a habitat from the top-left, anything small from the far corner, so habitats keep their room. */
  const spot = (subject: Placeable, small: boolean): Placement | null => {
    const islands: readonly IslandId[] = small ? [...s.islands.unlocked].reverse() : s.islands.unlocked
    for (const island of islands) {
      for (let i = 0; i < ISLAND_TILES * ISLAND_TILES; i++) {
        const k = small ? ISLAND_TILES * ISLAND_TILES - 1 - i : i
        const placement: Placement = { island, col: k % ISLAND_TILES, row: Math.floor(k / ISLAND_TILES), facing: 0 }
        if (placementRuleError(s, subject, placement) === null) return placement
      }
    }
    return null
  }
  const makeRoom = () => {
    for (const island of s.islands.unlocked) {
      for (const plot of ALL_PLOTS) if (plotError(s, island, plot) === null && act({ type: 'buyPlot', island, plot })) return
    }
    const next = ISLAND_ORDER.find(i => !s.islands.unlocked.includes(i))
    if (next && next !== 'home' && act({ type: 'buyBridge', island: next })) return
    const o = s.islands.obstacles.find(x => !s.constructions.some(k => k.kind === 'clear' && k.obstacleId === x.id))
    if (o && builderFree()) act({ type: 'clearObstacle', obstacleId: o.id })
  }
  const place = (building: Placeable, small: boolean) => {
    if (!builderFree()) return
    const placement = spot(building, small)
    if (placement) act({ type: 'placeBuilding', building, placement })
    else makeRoom()
  }

  const finishBuilds = () => {
    for (let i = s.constructions.length - 1; i >= 0; i--) {
      if (s.constructions[i]!.readyAtMs <= now) act({ type: 'finishConstruction', index: i })
    }
  }

  const cropFor = (): CropId => {
    if (p.farm === 'bush') return 'dragonBush'
    const gap = MS_PER_DAY / (p.sessions?.perDay ?? 24)
    const fits = CROP_IDS.filter(k => cropUnlocked(k, s.level) && cropGrowMs(k, p.preset) <= gap)
    return fits[fits.length - 1] ?? 'dragonBush'
  }
  const tendFarms = () => {
    s.farms.forEach((f, plot) => {
      if (isUnfinished(s, { type: 'farm', index: plot })) return
      if (f.crop !== null && f.readyAtMs <= now) act({ type: 'harvest', plot })
      if (s.farms[plot]!.crop === null && !act({ type: 'plant', plot, crop: cropFor() })) act({ type: 'plant', plot, crop: 'dragonBush' })
    })
    if (s.farms.length < MAX_FARMS && unlocked(`farm:${s.farms.length + 1}` as UnlockKey)) place({ kind: 'farm' }, true)
  }

  /** Lowest level first, so every Food buys the most XP. */
  const feedAll = (to: number) => {
    for (;;) {
      const top = Math.min(to, levelCap(s.roostTier))
      const d = s.dragons.filter(x => x.level < top).sort((a, b) => a.level - b.level)[0]
      if (!d || s.food < foodPerFeed(d.level) || !act({ type: 'feed', dragonId: d.id })) return
    }
  }

  /** Expected XP per ms of building time for a pair: what `breedLoop` maximises. */
  const breedScore = (a: string, b: string, building: Breeder): number => {
    const sa = getSpecies(c, a), sb = getSpecies(c, b)
    const odds = breedingOdds(sa, sb, { activeLegendaries: activeLegendaries(day(), p.preset), firstHybridPending: !s.firstHybridDone }, c)
    let xp = 0, ms = 0
    for (const [id, chance] of Object.entries(odds)) {
      const child = getSpecies(c, id)
      if (breedXpApplies(sa, sb, child)) xp += chance * (START_BREED_XP + HATCH_XP[child.rarity])
      ms += chance * breederBreedMs(breedTimerMs(child.rarity, child.elements, p.preset), building)
    }
    return ms > 0 ? xp / ms : 0
  }
  const startBestBreeds = () => {
    for (;;) {
      const building = s.breeders.find((b, i) => b.egg === null && !isUnfinished(s, { type: 'breeder', index: i }))
      if (!building || !unlocked('mountain:1')) return
      const adults = s.dragons.filter(d => d.level >= 4)
      let best: [string, string] | null = null, bestScore = 0
      const seen = new Set<string>()
      for (const a of adults) for (const b of adults) {
        const key = `${a.speciesId}|${b.speciesId}`
        if (a.id === b.id || seen.has(key) || breedValidity(getSpecies(c, a.speciesId), getSpecies(c, b.speciesId))) continue
        seen.add(key)
        const score = breedScore(a.speciesId, b.speciesId, building)
        if (score > bestScore) { bestScore = score; best = [a.id, b.id] }
      }
      if (!best || !act({ type: 'startBreed', parentA: best[0], parentB: best[1] })) return
    }
  }
  const tendEggs = () => {
    s.breeders.forEach((b, breeder) => { if (b.egg && b.egg.readyAtMs <= now) act({ type: 'collectEgg', breeder }) })
    for (let slot = s.hatchery.length - 1; slot >= 0; slot--) {
      if (s.hatchery[slot]!.readyAtMs <= now) act({ type: 'hatch', slot })
    }
    // A hatchling with no room, or a second of a species, only blocks a slot: sell it (Legendaries can't be sold).
    const kept = new Set<string>()
    for (const d of s.dragons) {
      if (d.habitatId === null || kept.has(d.speciesId)) act({ type: 'sellDragon', dragonId: d.id })
      else kept.add(d.speciesId)
    }
  }

  const upgrade = (ref: Parameters<typeof upgradeInfo>[1]) => {
    const u = upgradeInfo(s, ref, p.preset)
    if (u && builderFree() && !isUnderConstruction(s, ref) && s.level >= u.minLevel && s.gold >= u.cost) act({ type: 'startUpgrade', building: ref })
  }
  /** A habitat, then a Basic to live in it, one element at a time. */
  const growElements = () => {
    for (const element of ELEMENTS as readonly Element[]) {
      if (!unlocked(`habitat:${element}`)) continue
      if (!s.habitats.some(h => h.element === element)) { place({ kind: 'habitat', element }, false); return }
      if (!s.dragons.some(d => d.speciesId === element) && s.habitats.some(h => h.element === element && !isUnfinished(s, { type: 'habitat', id: h.id }))) act({ type: 'buyBasic', element })
    }
  }
  const growRoost = () => {
    if (s.roostPlacement === null) { if (unlocked('roost:1')) place({ kind: 'roost' }, true) } else upgrade({ type: 'roost' })
  }
  const growBreeding = () => {
    upgrade({ type: 'hatchery' })
    if (unlocked('grove:1') && !s.breeders.some(b => b.kind === 'grove')) place({ kind: 'grove' }, true)
    s.breeders.forEach((_, index) => { if (!isUnfinished(s, { type: 'breeder', index })) upgrade({ type: 'breeder', index }) })
  }

  const pass = () => {
    if (p.grantGold) s = { ...s, gold: GRANT }
    if (p.grantFood) s = { ...s, food: GRANT }
    finishBuilds()
    for (const h of s.habitats) if (!p.grantGold) act({ type: 'collectGold', habitatId: h.id })
    if (p.farm) tendFarms()
    if (p.breed) tendEggs()
    if (p.feedTo !== undefined) feedAll(p.feedTo)
    if (p.roost) growRoost()
    if (p.breed || p.feedTo === Infinity) growElements()
    if (p.breed) { growBreeding(); startBestBreeds() }
    while (act({ type: 'claimGoal' })) { /* each Claim opens the next Goal */ }
  }

  const nextWake = (): number => {
    const times: number[] = [(day()) * MS_PER_DAY, now + MAX_IDLE_MS]
    for (const f of s.farms) if (f.crop !== null) times.push(f.readyAtMs)
    for (const b of s.breeders) if (b.egg) times.push(b.egg.readyAtMs)
    for (const e of s.hatchery) times.push(e.readyAtMs)
    for (const k of s.constructions) times.push(k.readyAtMs)
    const next = Math.min(...times.filter(t => t > now))
    if (!p.sessions) return next
    const gap = MS_PER_DAY / p.sessions.perDay
    return next % gap < p.sessions.minutes * 60_000 ? next : (Math.floor(next / gap) + 1) * gap
  }

  while (s.level < p.untilLevel && day() <= p.maxDay) {
    pass()
    const before = day()
    now = nextWake()
    if (day() !== before) endOfDay.push(s.level)
  }
  return { name: p.name, reached, endOfDay, final: s, actions }
}

export const breedLoop = (preset: Preset, untilLevel: number, maxDay: number, seed?: number): BotPlan =>
  ({ name: 'breedLoop', preset, untilLevel, maxDay, grantGold: true, grantFood: true, breed: true, feedTo: 4, ...(seed === undefined ? {} : { seed }) })
export const harvestLoop = (preset: Preset, untilLevel: number, maxDay: number): BotPlan =>
  ({ name: 'harvestLoop', preset, untilLevel, maxDay, grantGold: true, farm: 'bush' })
export const harvestAndFeed = (preset: Preset, untilLevel: number, maxDay: number): BotPlan =>
  ({ name: 'harvestAndFeed', preset, untilLevel, maxDay, grantGold: true, farm: 'bush', feedTo: Infinity, roost: true })
/** 30 minutes, 6 times a day: normal play, on the Gold and Food the game itself gives. */
export const casual = (preset: Preset, untilLevel: number, maxDay: number): BotPlan =>
  ({ name: 'casual', preset, untilLevel, maxDay, farm: 'bestFit', breed: true, feedTo: Infinity, roost: true, sessions: { perDay: 6, minutes: 30 } })
