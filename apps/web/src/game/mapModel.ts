import { ISLANDS, ISLAND_ORDER, ownedPlots, PLOTS_PER_SIDE, unlockPl, type IslandId, type PlayerState } from '@wyrmhaven/game-core'
import { textureKey } from '../art/phaserLoader'
import type { GameArtSet } from '../art/types'
import { formatGold } from '../ui/Money'
import type { View } from './camera'
import type { Box, Pos } from './layout'

/** On-screen plot diamond: 4 x 4 plots of this size make a diamond as wide as the icon (2:1, like the island's tiles). */
export const MAP_PLOT = { w: 32, h: 16 } as const
const PLOTS_HALF_H = (PLOTS_PER_SIDE * MAP_PLOT.h) / 2

/**
 * One island on the Map, in world pixels from its spot, which is the middle of its plot diamond. Top to bottom: the icon
 * (128 x 96 by design, 128 x 128 with today's square art at 4x), the plots, the label (three lines at most, 80 px each way).
 */
export const MAP_CELL = {
  left: -128, right: 128,
  top: -PLOTS_HALF_H - 4 - 128,
  iconBottom: -PLOTS_HALF_H - 4,
  plotsTop: -PLOTS_HALF_H,
  plotsBottom: PLOTS_HALF_H,
  labelTop: PLOTS_HALF_H + 6,
  bottom: PLOTS_HALF_H + 6 + 50,
} as const

/** Room for a floating island: the cell's full width, and from its top to the bottom of where the plots go. */
export const MAP_FLOAT = { w: MAP_CELL.right - MAP_CELL.left, h: MAP_CELL.plotsBottom - MAP_CELL.top } as const

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
 * Sea kept round the chain at the camera's edges. Wide enough that the opening window can hold its first or last island
 * (Home at the foot, Warlord's Crown at the head) with its neighbour, centred in the band, on a tall screen too.
 */
const MAP_MARGIN_Y = 300
/** Sides keep a narrow margin: only the chain's height needs room for the opening window. */
const MAP_MARGIN_X = 24

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
  /**
   * Whole-number scale that draws the floating island as big as fits the cell above the label (`MAP_FLOAT`), standing where
   * the icon and the plots used to: the floating look (UI rework Phase 3) shows no plot grid when the art exists.
   */
  scale: number
  /** Not open yet (the next island or a locked one): the icon is greyed and a chain hangs over it. */
  chained: boolean
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
  const x0 = Math.min(...boxes.map(b => b.x)) - MAP_MARGIN_X
  const y0 = Math.min(...boxes.map(b => b.y)) - MAP_MARGIN_Y
  const x1 = Math.max(...boxes.map(b => b.x + b.w)) + MAP_MARGIN_X
  const y1 = Math.max(...boxes.map(b => b.y + b.h)) + MAP_MARGIN_Y
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
      scale: Math.max(1, Math.floor(Math.min(MAP_FLOAT.w / sprite.w, MAP_FLOAT.h / sprite.h))),
      chained: !open,
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

/** The island the Map opens beside the viewed one: the next in the chain; for the last island, the one before. */
function nextDoor(id: IslandId): IslandId {
  const i = ISLAND_ORDER.indexOf(id)
  return ISLAND_ORDER[i + 1] ?? ISLAND_ORDER[i - 1]!
}

/**
 * Where the Map opens. `bandH` is the free band CSS px tall between the HUD's top and bottom, and `screenW` the screen's
 * width. Zoom is 1, the smallest whole number: icons are 128 px and labels are screen-sized at every zoom, so a step up only
 * costs neighbours. The midpoint of the viewed island and its next-door island is centred in the band when both fit whole
 * with their labels; otherwise the viewed island is. An island further along may sit part-way behind the HUD. `cy` is the
 * middle of the band in world px; the scene shifts it for the insets.
 */
export function mapOpeningView(view: IslandId, bandH: number, screenW = Number.POSITIVE_INFINITY): View {
  const zoom = 1
  const h = Math.max(1, bandH) / zoom
  const a = mapBoxOf(view)
  const b = mapBoxOf(nextDoor(view))
  const x0 = Math.min(a.x, b.x)
  const x1 = Math.max(a.x + a.w, b.x + b.w)
  const y0 = Math.min(a.y, b.y)
  const y1 = Math.max(a.y + a.h, b.y + b.h)
  const bothFit = y1 - y0 <= h && x1 - x0 <= screenW / zoom
  const cx = bothFit ? (x0 + x1) / 2 : a.x + a.w / 2
  const cy = bothFit ? (y0 + y1) / 2 : a.y + a.h / 2
  // Inside the chain's bounds, so the scene's clamp leaves it alone; a band taller than the bounds centres what it wants.
  const bounds = mapBounds()
  const lo = bounds.y + h / 2
  const hi = bounds.y + bounds.h - h / 2
  return { cx, cy: hi >= lo ? Math.min(hi, Math.max(lo, cy)) : cy, zoom }
}

/** The scene that should be on screen: a battle over the Map, the Map over the island. */
export function wantedScene(b: { battle: unknown; mapOpen: boolean }): 'battle' | 'map' | 'island' {
  return b.battle ? 'battle' : b.mapOpen ? 'map' : 'island'
}
