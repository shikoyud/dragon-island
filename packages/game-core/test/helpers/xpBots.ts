// Test helper, not a game AI: bots that play the real rules through applyAction on a fake clock (§4.3, §7.2, M3 Q1).
// They start from newPlayer and are handed nothing but Gold and Food. The clock jumps to the next thing that finishes,
// so a non-stop bot loses no time to a coarse step.
import { applyAction } from '../../src/actions/apply'
import type { Action, ActionResult, Placeable, TeamIds } from '../../src/actions/types'
import { aiChoice } from '../../src/battle/ai'
import { baseDamage } from '../../src/battle/damage'
import { legalMoves, type BattleState, type PlayerMove } from '../../src/battle/machine'
import { moveUnlocked } from '../../src/battle/moves'
import { battlePreview } from '../../src/battle/preview'
import { combatStats, type BattleDragonSpec } from '../../src/battle/stats'
import { activeLegendaries, breedingOdds, breedValidity } from '../../src/breeding'
import { breederBreedMs, upgradeInfo } from '../../src/buildings'
import { getSpecies } from '../../src/catalog'
import { clearCost, MAX_CLEARS } from '../../src/obstacles'
import { activeClears, isUnderConstruction, isUnfinished, MAX_BUILDERS } from '../../src/construction'
import { breedTimerMs } from '../../src/data/breeding-timers'
import { LAUNCH_CATALOG } from '../../src/data/launch-catalog'
import { isUnlocked, type UnlockKey } from '../../src/data/unlocks'
import type { Preset } from '../../src/data/presets'
import { HATCH_XP, START_BREED_XP } from '../../src/data/xp'
import { foodPerFeed, levelCap } from '../../src/dragon'
import { canFight, maxHp } from '../../src/fatigue'
import { nodeKey, nodeLocked, nodeTeam } from '../../src/trials'
import { BOSS_NODE, NODES_PER_CHAPTER, TRIAL_CHAPTERS } from '../../src/data/trials'
import { ELEMENTS, elementMultiplier, type Element } from '../../src/elements'
import { ISLAND_ORDER } from '../../src/island'
import { ISLAND_TILES, plotError } from '../../src/plots'
import { ALL_PLOTS, cheapestClears } from './land'
import { CROP_IDS, cropGrowMs, cropUnlocked, MAX_FARMS } from '../../src/farm'
import { gameDay } from '../../src/game-clock'
import { placementRuleError } from '../../src/placement-rules'
import { breedXpApplies, cumulativeXp } from '../../src/progression'
import { createRng, type Rng } from '../../src/rng'
import { newPlayer, type Dragon, type Breeder, type CropId, type IslandId, type Obstacle, type Placement, type PlayerState } from '../../src/state'
import { MS_PER_DAY } from '../../src/time'

const c = LAUNCH_CATALOG
const HOUR = 3_600_000
const MAX_IDLE_MS = 5 * 60_000
const GRANT = 1e12

type Fighter = BattleState['sides']['attacker']['team'][number]
/** The best multiplier of a fighter's unlocked element moves against `primary`; Physical is left out, as in `aiChoice`. */
const bestElementMult = (f: Fighter, primary: Element): number =>
  Math.max(0, ...f.moves.filter(m => m.tier !== 'physical' && moveUnlocked(m, f.spec.level)).map(m => elementMultiplier(m.element, primary)))
/** The most a fighter's unlocked moves do at no crit and variance 1000. */
const bestExpected = (f: Fighter, primary: Element): number =>
  Math.max(...f.moves.filter(m => moveUnlocked(m, f.spec.level)).map(m => baseDamage(f.stats.atk, m, primary, false, 1000)))

/**
 * A better player than §6.4's AI, for the attacker: the legal attack with the highest expected damage (ties: lowest slot);
 * a swap to the bench dragon with a 2x move when the active has only 0.5x or worse element moves; a replacement with the
 * best matchup (highest multiplier, then expected damage, then lowest slot). Draws nothing.
 */
export function greedyChoice(b: BattleState): PlayerMove {
  const legal = legalMoves(b, 'attacker')
  if (legal.length === 0) throw new Error('greedyChoice: no move to make')
  const me = b.sides.attacker
  const foe = b.sides.defender
  const primary = foe.team[foe.active]!.species.elements[0]!
  const best = (moves: Extract<PlayerMove, { to: number }>[]): PlayerMove => {
    let pick = moves[0]!
    let top: [number, number] = [-1, -1]
    for (const m of moves) {
      const r: [number, number] = [bestElementMult(me.team[m.to]!, primary), bestExpected(me.team[m.to]!, primary)]
      if (r[0] > top[0] || (r[0] === top[0] && r[1] > top[1])) { pick = m; top = r }
    }
    return pick
  }
  if (b.awaiting === 'replace') return best(legal.flatMap(m => (m.kind === 'replace' ? [m] : [])))
  const actor = me.team[me.active]!
  if (bestElementMult(actor, primary) <= 0.5) {
    const swaps = legal.flatMap(m => (m.kind === 'swap' && bestElementMult(me.team[m.to]!, primary) === 2 ? [m] : []))
    if (swaps.length > 0) return best(swaps)
  }
  let pick: PlayerMove = legal.find(m => m.kind === 'attack')!
  let top = -1
  for (const m of legal) {
    if (m.kind !== 'attack') continue
    const d = baseDamage(actor.stats.atk, actor.moves[m.move]!, primary, false, 1000)
    if (d > top) { top = d; pick = m }
  }
  return pick
}

/** The enemy's AI turned on the attacker, on its own stream so it never shifts the battle's. */
export const aiPlayer = (seed: number): ((b: BattleState) => PlayerMove) => {
  const own = createRng(seed)
  return b => aiChoice(b, 'attacker', own)
}

/**
 * The attacker's move list for a battle that `finishTrial` will re-simulate on `createRng(battleSeed)`: it drives
 * `battlePreview` on that same seed, so what it sees is what the action plays.
 */
export function playBattle(
  attacker: readonly BattleDragonSpec[], defender: readonly BattleDragonSpec[], battleSeed: number,
  choose: (b: BattleState) => PlayerMove,
): PlayerMove[] {
  const moves: PlayerMove[] = []
  for (;;) {
    const p = battlePreview(attacker, defender, moves, createRng(battleSeed), c)
    if (p.done) return moves
    moves.push(choose(p.state))
  }
}

export const trialStrength = (d: Dragon): number => {
  const s = combatStats({ speciesId: d.speciesId, level: d.level }, c)
  return s.hp * s.atk
}

export interface TrialFight {
  day: number; hours: number; chapter: number; node: number; won: boolean; stars: number; turns: number; kos: number
  gold: number; xp: number
  /** Minutes for the team to heal fully after the battle: the mean over its dragons, and the slowest. */
  restMean: number; restMax: number
}
export interface TrialLog {
  fights: TrialFight[]
  /** The first clear of each chapter's Boss. */
  bossFell: Map<number, Reached>
  /** Times the bot had a node open and 3+ dragons but fewer than 3 fit to fight; a rising edge, so one wait counts once. */
  healAllsWanted: number
  /** Gold the bot earned by every source but Trials, and by Trials (first clears only). */
  goldOther: number
  goldTrials: number
  /** Total XP (`cumulativeXp(level) + xp`) per action: the worst fall, the sum of rises, and the Trial XP awarded against seen. */
  xpWorstFall: number
  xpRises: number
  trialXpAwarded: number
  trialXpSeen: number
}

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
  /** Plays on from this state instead of a new player (for tests that need a blocked island). */
  start?: PlayerState
  /** When a team of 3 can fight and a node is open, starts it, plays it with `greedyChoice` and finishes it (first clears only). */
  fightTrials?: boolean
}
export interface BotResult {
  trials: TrialLog
  name: string
  reached: ReadonlyMap<number, Reached>
  /** Level at the end of each game day; index 0 is Day 1. */
  endOfDay: number[]
  final: PlayerState
  actions: number
}

export function runBot(p: BotPlan): BotResult {
  const rng = createRng(p.seed ?? 1)
  let s = p.start ?? newPlayer(0)
  let now = 0
  let actions = 0
  const reached = new Map<number, Reached>()
  const endOfDay: number[] = []
  const day = () => gameDay(0, now)

  const trials: TrialLog = {
    fights: [], bossFell: new Map(), healAllsWanted: 0, goldOther: 0, goldTrials: 0,
    xpWorstFall: 0, xpRises: 0, trialXpAwarded: 0, trialXpSeen: 0,
  }
  const totalXp = (x: PlayerState) => cumulativeXp(x.level) + x.xp
  const last: { r: ActionResult | null } = { r: null }

  const act = (a: Action, actionRng: Rng = rng): boolean => {
    actions++
    const r = applyAction(s, a, now, actionRng, c, p.preset, day())
    last.r = r
    if (!r.ok) return false
    for (let pl = s.level + 1; pl <= r.state.level; pl++) reached.set(pl, { day: day(), hours: now / HOUR })
    const dXp = totalXp(r.state) - totalXp(s)
    if (dXp < 0) trials.xpWorstFall = Math.max(trials.xpWorstFall, -dXp)
    else trials.xpRises += dXp
    if (a.type === 'finishTrial') {
      trials.trialXpSeen += dXp
      trials.trialXpAwarded += r.trial?.xp ?? 0
      trials.goldTrials += r.trial?.gold ?? 0
    } else if (r.state.gold > s.gold) trials.goldOther += r.state.gold - s.gold
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
  const makeRoom = (subject: Placeable) => {
    for (const island of s.islands.unlocked) {
      for (const plot of ALL_PLOTS) if (plotError(s, island, plot) === null && act({ type: 'buyPlot', island, plot })) return
    }
    const next = ISLAND_ORDER.find(i => !s.islands.unlocked.includes(i))
    if (next && next !== 'home' && act({ type: 'buyBridge', island: next })) return
    // Nothing to buy: clear what blocks the cheapest cell for this building, the cheapest blocker first. A clear runs against MAX_CLEARS, not the builders (`builderFree` above still counts a clear as a busy builder, which is conservative).
    if (activeClears(s) >= MAX_CLEARS) return
    let blockers: Obstacle[] | null = null
    for (const island of s.islands.unlocked) {
      const hit = cheapestClears(s, subject, island)
      if (hit && (blockers === null || hit.length < blockers.length)) blockers = hit
    }
    const o = (blockers ?? [])
      .filter(x => !s.constructions.some(k => k.kind === 'clear' && k.obstacleId === x.id))
      .sort((a, b) => clearCost(a) - clearCost(b))[0]
    if (o) act({ type: 'clearObstacle', obstacleId: o.id })
  }
  const place = (building: Placeable, small: boolean) => {
    if (!builderFree()) return
    const placement = spot(building, small)
    if (placement) act({ type: 'placeBuilding', building, placement })
    else makeRoom(building)
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

  /** The lowest Chapter-then-node not yet cleared, if it is open. Clears only, in order; no replays. */
  const nextNode = (): [number, number] | null => {
    for (let chapter = 1; chapter <= TRIAL_CHAPTERS.length; chapter++) {
      for (let node = 1; node <= NODES_PER_CHAPTER; node++) {
        if (s.pve.stars[nodeKey(chapter, node)]) continue
        return nodeLocked(s, chapter, node) === null ? [chapter, node] : null
      }
    }
    return null
  }
  let waitingToHeal = false
  const lostAt = new Map<string, { strength: number; tries: number }>()
  /** The three strongest dragons that can fight, at their actual levels; battles until one is lost or the team is spent. */
  const fightTrials = () => {
    for (let n = 0; n < 12; n++) {
      const node = nextNode()
      if (!node) return
      const fit = s.dragons.filter(d => canFight(d, c, now, p.preset)).sort((a, b) => trialStrength(b) - trialStrength(a))
      if (fit.length < 3) {
        if (s.dragons.length >= 3 && !waitingToHeal) trials.healAllsWanted++
        waitingToHeal = s.dragons.length >= 3
        return
      }
      waitingToHeal = false
      // After 3 losses at one strength a node waits for a stronger team; the seeds differ, so a loss can still be luck.
      const strength = fit.slice(0, 3).reduce((x, d) => x + trialStrength(d), 0)
      const lost = lostAt.get(nodeKey(node[0], node[1]))
      if (lost && strength <= lost.strength && lost.tries >= 3) return
      const team = fit.slice(0, 3).map(d => d.id) as TeamIds
      if (!act({ type: 'startTrial', chapter: node[0], node: node[1], team })) return
      const active = s.pve.active!
      const battleSeed = rng.int(2 ** 32)
      const moves = playBattle(active.specs, nodeTeam(node[0], node[1], c), battleSeed, greedyChoice)
      const previewed = battlePreview(active.specs, nodeTeam(node[0], node[1], c), moves, createRng(battleSeed), c).done
      if (!act({ type: 'finishTrial', moves }, createRng(battleSeed))) return
      const res = last.r
      if (!res || !res.ok || !res.trial || !res.battle) throw new Error('finishTrial did not settle with a battle')
      // The bot chose its moves on the preview: if the action's own replay disagrees about who won, the Rng stream drifted, and every number here is wrong.
      const previewWon = previewed?.ok === true && previewed.winner === 'attacker'
      if (res.trial.won !== previewWon) throw new Error(`finishTrial won=${res.trial.won} but the preview said ${previewWon} (chapter ${node[0]} node ${node[1]})`)
      const rest = team.map(id => {
        const d = s.dragons.find(x => x.id === id)!
        return d.fatigue ? ((maxHp(d, c) - d.fatigue.hp) * 100) / (maxHp(d, c) * p.preset.healPctPerMin) : 0
      })
      trials.fights.push({
        day: day(), hours: now / HOUR, chapter: node[0], node: node[1], won: res.trial.won, stars: res.trial.stars,
        turns: res.battle.turns, kos: res.battle.attackerKos, gold: res.trial.gold, xp: res.trial.xp,
        restMean: rest.reduce((x, y) => x + y, 0) / 3, restMax: Math.max(...rest),
      })
      if (res.trial.won && node[1] === BOSS_NODE && !trials.bossFell.has(node[0])) trials.bossFell.set(node[0], { day: day(), hours: now / HOUR })
      if (!res.trial.won) {
        const same = lost && strength <= lost.strength
        lostAt.set(nodeKey(node[0], node[1]), { strength: same ? lost.strength : strength, tries: same ? lost.tries + 1 : 1 })
        return
      }
    }
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
    if (p.fightTrials && unlocked('pve')) fightTrials()
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
  return { name: p.name, reached, endOfDay, final: s, actions, trials }
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
/** The same economy as `casual`, played non-stop: every wake is a session. */
export const nonStop = (preset: Preset, untilLevel: number, maxDay: number): BotPlan =>
  ({ name: 'nonStop', preset, untilLevel, maxDay, farm: 'bestFit', breed: true, feedTo: Infinity, roost: true })
/** The plan plus Trials: a team of the three strongest dragons that can fight, whenever a node is open. */
export const withTrials = (plan: BotPlan): BotPlan => ({ ...plan, name: `${plan.name}+trials`, fightTrials: true })
