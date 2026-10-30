import { xpToNext, type BreederKind, type BuildingRef, type Construction, type PlayerState } from '@wyrmhaven/game-core'
import type { ClientAction } from '@wyrmhaven/shared'
import type { Target } from '../game/bridge'
import { hatcheryHasRoom } from '../game/islandModel'

/** Pure numbers and lists the HUD shows; no React, so they are tested directly. */

/** How far the player is towards the next level, 0..1. */
export function xpFraction(s: PlayerState): number {
  const need = xpToNext(s.level)
  return Number.isFinite(need) ? Math.min(1, Math.max(0, s.xp / need)) : 1
}

/** Something waiting for the player, shown as a shortcut in the HUD's left column. */
export interface AttentionItem {
  id: string
  label: string
  /** Ready now (the timer has run out, or there is nothing to wait for). */
  ready: boolean
  readyAtMs?: number
  /** Sent by the shortcut's button when ready. */
  action?: ClientAction
  /** What the shortcut opens otherwise: the same panel a click on the island would. */
  panel: Target
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
  if (c.kind === 'clear') return { ...base, label: 'Clearing', panel: { kind: 'obstacle', id: c.obstacleId } }
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
  const ordered = items.sort((p, q) => Number(q.ready) - Number(p.ready) || (p.readyAtMs ?? 0) - (q.readyAtMs ?? 0))
  return ordered.slice(0, MAX_ATTENTION)
}
