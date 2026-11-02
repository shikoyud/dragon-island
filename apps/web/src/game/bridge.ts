import { DEFAULT_PRESET, type BattlePreview, type Element, type Facing, type Footprint, type IslandId, type MovableRef, type Placeable, type PlayerState, type Preset } from '@wyrmhaven/game-core'
import type { GameArtSet } from '../art/types'

/** Something the player can click in a scene. */
export type Target =
  | { kind: 'habitat'; id: string }
  | { kind: 'dragon'; id: string }
  | { kind: 'breeder'; index: number }
  | { kind: 'hatchery'; slot: number }
  | { kind: 'farm'; plot: number }
  | { kind: 'hatcheryBuilding' }
  | { kind: 'roost' }
  | { kind: 'decoration'; id: string }
  | { kind: 'obstacle'; id: string }
  /** An island on the Map. */
  | { kind: 'mapIsland'; id: IslandId }
  /** The sign on an unowned plot that touches owned land. */
  | { kind: 'plot'; island: IslandId; plot: number }
  | { kind: 'cell'; col: number; row: number }
  | { kind: 'empty' }

/** The Golden Aerie: a Store purchase (§5.2) placed like a habitat; the charge is sent with its placement on OK. */
export interface AerieOffer { kind: 'goldenAerie' }

/** What the grid rules judge for a thing being placed: the Aerie is a habitat-sized building. */
export function placementSubject(what: Placing['what']): Placeable | { kind: 'move'; target: MovableRef } {
  return what.kind === 'goldenAerie' ? { kind: 'habitat', element: 'terra' } : what
}

/** A building being placed or moved: the ghost the island scene draws under the pointer. */
export interface Placing {
  what: Placeable | AerieOffer | { kind: 'move'; target: MovableRef }
  size: Footprint
  col: number
  row: number
  facing: Facing
}

export type GameEvent =
  | { type: 'select'; target: Target }
  | { type: 'hover'; target: Target | null }
  /** A tap on a habitat's gold badge; React runs the `collectGold` action. */
  | { type: 'collectGold'; habitatId: string }
  | { type: 'battle'; preview: BattlePreview | null }
  /** How many log events have played: the scene shows those, and plays the effects of the newest. */
  | { type: 'battleShown'; shown: number }
  | { type: 'state'; state: PlayerState | null }
  | { type: 'cell'; col: number; row: number }
  | { type: 'view'; view: IslandId }
  | { type: 'placing'; placing: Placing | null }
  | { type: 'insets' }
  /** The island camera's zoom or range changed (`bridge.zoom` has the new values). */
  | { type: 'zoom' }
  /** The Map opened or closed; config.ts runs the scene switch. */
  | { type: 'map'; open: boolean }
  /** The level-up screen opened: the island plays `fx.levelUp` once if the art has it. */
  | { type: 'levelUp' }
  /** The level-up screen closed: a play still waiting for the island to wake is dropped. */
  | { type: 'levelUpClosed' }
  | { type: 'ready' }

type Handler<T extends GameEvent['type']> = (e: Extract<GameEvent, { type: T }>) => void

/**
 * The only link between Phaser and React. Phaser reads `state`/`art`/`nowMs` and emits clicks;
 * React writes state and listens. Phaser never calls the API.
 */
export function createBridge() {
  const handlers = new Map<string, Set<(e: GameEvent) => void>>()
  const bridge = {
    state: null as PlayerState | null,
    art: null as GameArtSet | null,
    nowMs: 0,
    /** Soft-economy preset; stored Gold and caps depend on it (§7.2). */
    preset: DEFAULT_PRESET as Preset,
    reducedMotion: false,
    battle: null as BattlePreview | null,
    /** The log events of `battle` that have played so far; React runs the clock, the scene follows. */
    battleShown: 0,
    /** The chapter's element for the backdrop's fill; null for the Arena. */
    battleBackdrop: null as Element | null,
    selected: { kind: 'empty' } as Target,
    view: 'home' as IslandId,
    placing: null as Placing | null,
    /** True while the Map shows in place of the island (never during placement or a battle). */
    mapOpen: false,
    /** Screen pixels the HUD covers at the top and bottom; the island camera frames the island between them. */
    insets: { top: 0, bottom: 0 },
    /** The island camera's zoom and whole-number range, kept by the island scene; null until it has framed a view. */
    zoom: null as { zoom: number; min: number; max: number } | null,
    /** Set by the island scene: zooms the camera around the screen centre to a whole zoom (the zoom slider's way in). */
    zoomTo: null as ((zoom: number) => void) | null,
    /** Set by the island scene: the canvas position of a cell's centre. Playwright clicks cells through it. */
    cellToScreen: null as ((col: number, row: number) => { x: number; y: number }) | null,
    /** Set by the island scene: the cell at the centre of what the player is looking at (new buildings open near it). */
    focusCell: null as (() => { col: number; row: number }) | null,
    /** The cell a plot's sign stands on, as last drawn. For specs, like `cellToScreen`. */
    signCell: null as ((plot: number) => { col: number; row: number } | null) | null,
    /** Set by the Map scene: the canvas position of an island's plot diamond. Playwright clicks islands through it. */
    mapIslandToScreen: null as ((id: IslandId) => { x: number; y: number }) | null,
    on<T extends GameEvent['type']>(type: T, h: Handler<T>): () => void {
      const set = handlers.get(type) ?? new Set()
      handlers.set(type, set)
      set.add(h as (e: GameEvent) => void)
      return () => { set.delete(h as (e: GameEvent) => void) }
    },
    off<T extends GameEvent['type']>(type: T, h: Handler<T>): void {
      handlers.get(type)?.delete(h as (e: GameEvent) => void)
    },
    emit(e: GameEvent): void {
      if (e.type === 'select') bridge.selected = e.target
      for (const h of handlers.get(e.type) ?? []) h(e)
    },
    setState(state: PlayerState | null): void {
      bridge.state = state
      bridge.emit({ type: 'state', state })
    },
    setArt(art: GameArtSet): void { bridge.art = art },
    setClock(nowMs: number): void { bridge.nowMs = nowMs },
    setPreset(preset: Preset): void { bridge.preset = preset },
    setReducedMotion(v: boolean): void { bridge.reducedMotion = v },
    setView(id: IslandId): void {
      bridge.view = id
      bridge.emit({ type: 'view', view: id })
    },
    setPlacing(placing: Placing | null): void {
      bridge.placing = placing
      bridge.emit({ type: 'placing', placing })
    },
    setInsets(insets: { top: number; bottom: number }): void {
      bridge.insets = insets
      bridge.emit({ type: 'insets' })
    },
    /** Asks the island scene to zoom to `z` about the screen centre; nothing if no island is up. */
    setZoom(z: number): void { bridge.zoomTo?.(z) },
    setMapOpen(open: boolean): void {
      if (open === bridge.mapOpen) return
      bridge.mapOpen = open
      bridge.emit({ type: 'map', open })
    },
    setBattle(preview: BattlePreview | null, backdrop: Element | null = null): void {
      bridge.battle = preview
      bridge.battleBackdrop = backdrop
      if (!preview) bridge.battleShown = 0
      bridge.emit({ type: 'battle', preview })
    },
    setBattleShown(shown: number): void {
      if (shown === bridge.battleShown) return
      bridge.battleShown = shown
      bridge.emit({ type: 'battleShown', shown })
    },
  }
  return bridge
}

export type Bridge = ReturnType<typeof createBridge>
