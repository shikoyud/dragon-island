import { CROPS, currentGoal, goalProgress, ISLANDS, LAUNCH_CATALOG, levelLimit, TRIAL_CHAPTERS, unlocksAt, xpToNext, type Preset, type BreederKind, type CropId, type UnlockKey, type BuildingRef, type Construction, type IslandId, type PlayerState } from '@wyrmhaven/game-core'
import type { ClientAction } from '@wyrmhaven/shared'
import type { Target } from '../game/bridge'
import { hatcheryHasRoom } from '../game/islandModel'
import { clearingLabel } from '../ui/obstacleNames'
import type { DialogKey } from './Hud'

/** Pure numbers and lists the HUD shows; no React, so they are tested directly. */

/** How far the player is towards the next level, 0..1. */
export function xpFraction(s: PlayerState): number {
  const need = xpToNext(s.level)
  return Number.isFinite(need) ? Math.min(1, Math.max(0, s.xp / need)) : 1
}

/** More XP than the level needs: it stopped at the day's limit, and the rest pays on the next day's first action (R41). */
export function xpBanked(s: PlayerState): boolean {
  return s.xp >= xpToNext(s.level)
}

/** The synced clock's view of the level limit: the preset and the game day. Without it the client can't tell the day. */
export interface LimitClock { preset: Preset; day: number }

/** The first game day after `day` whose limit is higher than today's (Finals, with no limit, counts as higher); null if none. */
function nextRaiseDay(clock: LimitClock): number | null {
  const today = levelLimit(clock.day, clock.preset)
  if (today === null) return null
  for (let d = clock.day + 1; d <= clock.day + 60; d++) {
    const limit = levelLimit(d, clock.preset)
    if (limit === null || limit > today) return d
  }
  return null
}

/** The XP bar's words. Banked XP reads "Level limit today" until the day's limit has risen past the player's level (R41). */
export function xpBarText(s: PlayerState, format: (n: number) => string, clock?: LimitClock): string {
  const need = xpToNext(s.level)
  if (!Number.isFinite(need)) return 'MAX'
  const plain = `${format(s.xp)} / ${format(need)} XP`
  if (!xpBanked(s)) return plain
  if (!clock) return 'Level limit today · more tomorrow'
  const limit = levelLimit(clock.day, clock.preset)
  // The day has turned and the next action (or the refetch the App starts at the turn) pays it: until then the bar is full, never over-full.
  if (limit === null || limit > s.level) return `${format(Math.min(s.xp, need))} / ${format(need)} XP`
  const raise = nextRaiseDay(clock)
  return raise === null || raise === clock.day + 1 ? 'Level limit today · more tomorrow' : `Level limit today · more on Day ${raise}`
}

/** What the bar shows in its small form while the day's limit holds; the whole sentence is its title and value text. */
export const XP_LIMIT_SHORT = 'Level limit'

/** One unlock key in plain words; null for what the level-up screen leaves out (`wings`, `pve`, and `home:n`, which is one shared line). */
function unlockLine(key: UnlockKey): string | null {
  const [kind, arg = ''] = key.split(':') as [string, string?]
  switch (kind) {
    case 'habitat': return `${cap(arg)} Habitat`
    case 'basic': return `${cap(arg)} Basic`
    case 'crop': return `Crop: ${CROPS[arg as CropId].name}`
    case 'farm': return `Farm ${arg}`
    case 'mountain': return `Breeding Mountain level ${arg}`
    case 'grove': return `Breeding Grove level ${arg}`
    case 'hatchery': return `Hatchery level ${arg}`
    case 'hatcheryFifthSlot': return 'Hatchery fifth slot'
    case 'roost': return `Roost Tier ${arg}`
    case 'pve': return null // the same level opens `trial:1`, which names it: one line (R71)
    case 'trial': return `Elemental Trials: ${TRIAL_CHAPTERS[Number(arg) - 1]!.theme}`
    case 'island': return `Bridge to ${ISLANDS[arg as IslandId].name}`
    default: return null
  }
}

/** What opened between two levels (`from` exclusive, `to` inclusive), in plain words, once each: the level-up screen's list. */
export function levelUnlockLines(from: number, to: number): string[] {
  const lines: string[] = []
  let home = false
  for (let pl = from + 1; pl <= to; pl++) {
    for (const key of unlocksAt(pl)) {
      if (key.startsWith('home:')) { home = true; continue }
      const line = unlockLine(key)
      if (line && !lines.includes(line)) lines.push(line)
    }
  }
  if (home) lines.push(`${ISLANDS.home.name} plot`)
  return lines
}

/** Something waiting for the player, shown as a shortcut in the HUD's left column. */
interface AttentionBase {
  id: string
  label: string
  /** Ready now (the timer has run out, or there is nothing to wait for). */
  ready: boolean
  readyAtMs?: number
  /** Sent by the shortcut's button when ready. */
  action?: ClientAction
}

/** What a shortcut opens: the panel of the thing on the island, or a named HUD panel (such as Quests). */
export type AttentionTarget = { panel: Target; open?: undefined } | { open: DialogKey; panel?: undefined }

export type AttentionItem = AttentionBase & AttentionTarget

/** The current Goal is done and waiting for Claim (§1.4). */
export function goalClaimable(s: PlayerState): boolean {
  const g = currentGoal(s)
  if (!g) return false
  const p = goalProgress(s, g, LAUNCH_CATALOG)
  return p.have >= p.need
}

export const MAX_ATTENTION = 5

const cap = (w: string) => w.charAt(0).toUpperCase() + w.slice(1)

export const breederName = (kind: BreederKind | undefined): string => (kind === 'grove' ? 'Breeding Grove' : 'Breeding Mountain')

function buildingLabel(s: PlayerState, b: BuildingRef): string {
  switch (b.type) {
    case 'habitat': {
      const h = s.habitats.find(x => x.id === b.id)
      return h?.element === 'aerie' ? 'Golden Aerie' : `${cap(h?.element ?? '')} habitat`.trim()
    }
    case 'farm': return `Farm plot ${b.index + 1}`
    case 'breeder': return breederName(s.breeders[b.index]?.kind)
    case 'hatchery': return 'Hatchery'
    case 'roost': return 'Dragon Roost'
  }
}

function buildingTarget(b: BuildingRef): Target {
  switch (b.type) {
    case 'habitat': return { kind: 'habitat', id: b.id }
    case 'farm': return { kind: 'farm', plot: b.index }
    case 'breeder': return { kind: 'breeder', index: b.index }
    case 'hatchery': return { kind: 'hatcheryBuilding' }
    case 'roost': return { kind: 'roost' }
  }
}

function constructionItem(s: PlayerState, c: Construction, index: number, nowMs: number): AttentionItem {
  const ready = c.readyAtMs <= nowMs
  const base = { id: `construction:${index}`, ready, readyAtMs: c.readyAtMs, ...(ready ? { action: { type: 'finishConstruction', index } as ClientAction } : {}) }
  if (c.kind === 'clear') return { ...base, label: clearingLabel(s, c.obstacleId), panel: { kind: 'obstacle', id: c.obstacleId } }
  const what = buildingLabel(s, c.building)
  return { ...base, label: c.kind === 'build' ? `Building ${what}` : `Upgrading ${what}`, panel: buildingTarget(c.building) }
}

/**
 * Shortcuts for what needs attention: constructions (Finish when ready), eggs in breeders (Collect when ready),
 * the hatchery's soonest egg, ripe crops (harvest the first), and hatchlings with no room.
 * Ready items first, then by time left; at most MAX_ATTENTION.
 */
export function attentionItems(s: PlayerState, nowMs: number): AttentionItem[] {
  const items: AttentionItem[] = s.constructions.map((c, i) => constructionItem(s, c, i, nowMs))
  s.breeders.forEach((b, i) => {
    if (!b.egg) return
    const ready = b.egg.readyAtMs <= nowMs
    if (ready && !hatcheryHasRoom(s)) {
      // Finished, but the Hatchery is full: say where the egg is stuck; Collect would fail with HATCHERY_FULL.
      items.push({ id: `breeder:${i}`, label: 'Egg waiting: Hatchery full', ready, readyAtMs: b.egg.readyAtMs, panel: { kind: 'hatcheryBuilding' } })
      return
    }
    items.push({ id: `breeder:${i}`, label: `Egg in ${breederName(b.kind)}`, ready, readyAtMs: b.egg.readyAtMs, panel: { kind: 'breeder', index: i }, ...(ready ? { action: { type: 'collectEgg', breeder: i } as ClientAction } : {}) })
  })
  if (s.hatchery.length > 0) {
    const soonest = Math.min(...s.hatchery.map(e => e.readyAtMs))
    items.push({ id: 'hatchery', label: s.hatchery.length === 1 ? 'Egg hatching' : `${s.hatchery.length} eggs hatching`, ready: soonest <= nowMs, readyAtMs: soonest, panel: { kind: 'hatcheryBuilding' } })
  }
  const ripe = s.farms.map((f, i) => ({ f, i })).filter(({ f }) => f.crop !== null && f.readyAtMs <= nowMs)
  if (ripe.length > 0) {
    items.push({ id: 'crops', label: ripe.length === 1 ? '1 crop ready' : `${ripe.length} crops ready`, ready: true, action: { type: 'harvest', plot: ripe[0]!.i }, panel: { kind: 'farm', plot: ripe[0]!.i } })
  }
  const waiting = s.dragons.filter(d => d.habitatId === null).length
  if (waiting > 0) {
    items.push({ id: 'noRoom', label: waiting === 1 ? 'Hatchling: no room' : `${waiting} hatchlings: no room`, ready: true, panel: { kind: 'hatcheryBuilding' } })
  }
  if (goalClaimable(s)) {
    items.push({ id: 'goal', label: 'Goal ready', ready: true, action: { type: 'claimGoal' }, open: { kind: 'panel', id: 'quests' } })
  }
  // Ready first, then by time; among equals the Goal goes first, so MAX_ATTENTION never cuts the one claim the player can take.
  const ordered = items.sort((p, q) => Number(q.ready) - Number(p.ready) || (p.readyAtMs ?? 0) - (q.readyAtMs ?? 0) || Number(q.id === 'goal') - Number(p.id === 'goal'))
  return ordered.slice(0, MAX_ATTENTION)
}
