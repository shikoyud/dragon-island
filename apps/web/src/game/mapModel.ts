import { ISLANDS, ISLAND_ORDER, ownedPlots, PLOTS_PER_SIDE, unlockPl, type IslandId, type PlayerState } from '@wyrmhaven/game-core'
import { textureKey } from '../art/phaserLoader'
import type { GameArtSet } from '../art/types'
import { formatGold } from '../ui/Money'
import type { View } from './camera'
import type { Box, Pos } from './layout'

/** On-screen plot diamond: 4 x 4 plots of this size make a diamond as wide as the icon (2:1, like the island's tiles). */
export const MAP_PLOT = { w: 32, h: 16 } as const
/** Width every island icon is drawn at, whatever the art's size (the width-ratio idea of R61). */
export const MAP_ICON_W = 128
const PLOTS_HALF_H = (PLOTS_PER_SIDE * MAP_PLOT.h) / 2

/**
 * One island on the Map, in world pixels from its spot, which is the middle of its plot diamond. Top to bottom: the icon
 * (128 x 96 by design, 128 x 128 with today's square art at 4x), the plots, the label (three lines at most, 80 px each way).
 */
export const MAP_CELL = {
  left: -80, right: 80,
  top: -PLOTS_HALF_H - 4 - 128,
  iconBottom: -PLOTS_HALF_H - 4,
  plotsTop: -PLOTS_HALF_H,
  plotsBottom: PLOTS_HALF_H,
  labelTop: PLOTS_HALF_H + 6,
  bottom: PLOTS_HALF_H + 6 + 50,
} as const

/** Display only (R60): the chain climbs from Home at the bottom to Warlord's Crown at the top, as §5.5's table reads. */
export const MAP_SPOTS: Record<IslandId, Pos> = {
  isle6: { x: 0, y: 200 },
  isle5: { x: -80, y: 500 },
  isle4: { x: 70, y: 800 },
  isle3: { x: -50, y: 1100 },
  isle2: { x: 80, y: 1400 },
  home: { x: 0, y: 1700 },
}

/**
 * Sea kept round the chain at the camera's edges. Wide enough that the opening window can sit its first or last island
 * (Home at the foot, Warlord's Crown at the head) clear of the HUD with a neighbour beside it, on a tall screen too.
 */
const MAP_MARGIN = 300

export type MapIslandState = 'current' | 'open' | 'next' | 'locked'

export interface MapIsland {
  id: IslandId
  name: string
  state: MapIslandState
  label: string
  owned: number
  plots: { plot: number; owned: boolean; x: number; y: number }[]
  x: number
  y: number
  /** Texture of the icon; '' until the art set has one, and the plot diamond stands alone. */
  key: string
  /** Scale that draws the icon `MAP_ICON_W` wide. */
  scale: number
}

export interface MapModel { islands: MapIsland[]; bridges: { from: IslandId; to: IslandId; built: boolean }[]; bounds: Box }

/** A label's price: 150,000, then 5M or 2.5M from a million up. Integer math. */
export function mapPrice(gold: number): string {
  if (gold < 1_000_000) return formatGold(gold)
  const whole = Math.floor(gold / 1_000_000)
  const tenth = Math.floor((gold % 1_000_000) / 100_000)
  return tenth === 0 ? `${whole}M` : `${whole}.${tenth}M`
}

/** World box of an island on the Map: its icon, plots and label. A tap in it is a tap on the island. */
export function mapBoxOf(id: IslandId): Box {
  const { x, y } = MAP_SPOTS[id]
  return { x: x + MAP_CELL.left, y: y + MAP_CELL.top, w: MAP_CELL.right - MAP_CELL.left, h: MAP_CELL.bottom - MAP_CELL.top }
}

/** World box of the whole chain, with a margin of sea. */
export function mapBounds(): Box {
  const boxes = ISLAND_ORDER.map(mapBoxOf)
  const x0 = Math.min(...boxes.map(b => b.x)) - MAP_MARGIN
  const y0 = Math.min(...boxes.map(b => b.y)) - MAP_MARGIN
  const x1 = Math.max(...boxes.map(b => b.x + b.w)) + MAP_MARGIN
  const y1 = Math.max(...boxes.map(b => b.y + b.h)) + MAP_MARGIN
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
}

/** Where a plot's diamond sits, from the island's spot: rows and columns run down the two edges, as on the island. */
function plotSpot(plot: number): Pos {
  const col = plot % PLOTS_PER_SIDE
  const row = Math.floor(plot / PLOTS_PER_SIDE)
  return { x: ((col - row) * MAP_PLOT.w) / 2, y: ((col + row - (PLOTS_PER_SIDE - 1)) * MAP_PLOT.h) / 2 }
}

/** The Map as data (§5.5, R60): every island's state, label and plots, and the chain of Bridges. */
export function buildMapModel(s: PlayerState, art: GameArtSet, view: IslandId): MapModel {
  const isOpen = (id: IslandId) => id === 'home' || s.islands.unlocked.includes(id)
  const islands = ISLAND_ORDER.map((id, i): MapIsland => {
    const info = ISLANDS[id]
    const owned = ownedPlots(s, id)
    const open = isOpen(id)
    const state: MapIslandState = id === view ? 'current' : open ? 'open' : isOpen(ISLAND_ORDER[i - 1]!) ? 'next' : 'locked'
    const gate = id === 'home' ? '' : `Level ${unlockPl(`island:${id}`)}`
    const label = open
      ? `${info.name} · ${owned.length} / ${PLOTS_PER_SIDE * PLOTS_PER_SIDE}`
      : state === 'next' ? `${info.name} · ${gate} · Bridge ${mapPrice(info.bridgeGold!)}` : `${info.name} · ${gate}`
    const spot = MAP_SPOTS[id]
    const sprite = art.map[id]
    return {
      id, name: info.name, state, label, owned: owned.length, x: spot.x, y: spot.y,
      plots: Array.from({ length: PLOTS_PER_SIDE * PLOTS_PER_SIDE }, (_, plot) => {
        const at = plotSpot(plot)
        return { plot, owned: owned.includes(plot), x: spot.x + at.x, y: spot.y + at.y }
      }),
      key: sprite.src ? textureKey(`map.${id}`) : '',
      scale: MAP_ICON_W / sprite.w,
    }
  })
  const bridges = ISLAND_ORDER.slice(1).map((to, i) => ({ from: ISLAND_ORDER[i]!, to, built: isOpen(to) }))
  return { islands, bridges, bounds: mapBounds() }
}

/** The island under a world point, or null on open water. */
export function mapIslandAt(model: Pick<MapModel, 'islands'>, worldX: number, worldY: number): IslandId | null {
  for (const i of model.islands) {
    const b = mapBoxOf(i.id)
    if (worldX >= b.x && worldX <= b.x + b.w && worldY >= b.y && worldY <= b.y + b.h) return i.id
  }
  return null
}

/** Sea left between an island's label and the HUD strip it is kept clear of. */
const OPEN_GAP = 6

/** World box of an island's label (its name, level and price: up to three lines under the plots). */
function mapLabelBox(id: IslandId): { y: number; h: number } {
  const { y } = MAP_SPOTS[id]
  return { y: y + MAP_CELL.labelTop, h: MAP_CELL.bottom - MAP_CELL.labelTop }
}

/**
 * Where the Map opens. `bandH` is the free band CSS px tall between the HUD's top and bottom, and `insets` are the
 * heights of the strips the HUD covers over and under it, where the sea chart still shows between the pills and the menu.
 * Zoom is 1, the smallest whole number: icons are 128 px and labels are screen-sized at every zoom, so a step up only
 * costs neighbours. The window is centred on the viewed island and moved the least that keeps that island whole inside
 * the band and every label out of both HUD strips (a name half behind the resource pills is unreadable). An icon may
 * sit part-way behind the HUD: it is art, and the label under it stays whole. `cy` is the middle of the band in world px;
 * the scene shifts it for the insets.
 */
export function mapOpeningView(view: IslandId, bandH: number, insets: { top: number; bottom: number } = { top: 0, bottom: 0 }): View {
  const zoom = 1
  const h = Math.max(1, bandH) / zoom
  const b = mapBoxOf(view)
  const bounds = mapBounds()
  const lo = bounds.y
  const hi = bounds.y + bounds.h - h
  const want = b.y + b.h / 2 - h / 2
  const labels = ISLAND_ORDER.map(mapLabelBox)
  const holdsView = (top: number) => b.y >= top && b.y + b.h <= top + h
  // How much label is behind a strip: the overlap with the strip's world range [from, to], in px.
  const behind = (l: { y: number; h: number }, from: number, to: number) => Math.max(0, Math.min(l.y + l.h, to) - Math.max(l.y, from))
  const strips = (top: number) => [{ from: top - insets.top / zoom - OPEN_GAP, to: top }, { from: top + h, to: top + h + insets.bottom / zoom + OPEN_GAP }]
  // Text counts ten times an icon: a name behind the pills is lost, an icon part behind them still reads.
  const ICON_WEIGHT = 1
  const LABEL_WEIGHT = 10
  const icons = ISLAND_ORDER.map(id => ({ y: MAP_SPOTS[id].y + MAP_CELL.top, h: MAP_CELL.labelTop - MAP_CELL.top }))
  const hidden = (top: number) => strips(top).reduce(
    (n, s) => n + labels.reduce((m, l) => m + LABEL_WEIGHT * behind(l, s.from, s.to), 0) + icons.reduce((m, i) => m + ICON_WEIGHT * behind(i, s.from, s.to), 0), 0)
  // The centred window, the ones whose strips just clear a label on either side, and a sweep for the least bad one: on
  // some screens no window clears every label (islands are 300 apart, a label 50 tall, the strips 130 and 72).
  const tops = [want, ...labels.flatMap(l => [
    l.y - OPEN_GAP, l.y + l.h + insets.top / zoom + OPEN_GAP * 2,
    l.y + l.h + OPEN_GAP - h, l.y - insets.bottom / zoom - OPEN_GAP * 2 - h,
  ]), ...Array.from({ length: 61 }, (_, i) => want - 300 + i * 10)]
  const near = (p: number, q: number) => Math.abs(p - want) - Math.abs(q - want)
  const best = tops.filter(t => t >= lo && t <= hi && holdsView(t)).sort((p, q) => hidden(p) - hidden(q) || near(p, q))[0]
  const top = best ?? (hi >= lo ? Math.min(hi, Math.max(lo, want)) : want)
  return { cx: b.x + b.w / 2, cy: top + h / 2, zoom }
}

/** The scene that should be on screen: a battle over the Map, the Map over the island. */
export function wantedScene(b: { battle: unknown; mapOpen: boolean }): 'battle' | 'map' | 'island' {
  return b.battle ? 'battle' : b.mapOpen ? 'map' : 'island'
}
