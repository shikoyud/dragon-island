import type { PlayerState } from '@wyrmhaven/game-core'
import type { GameArtSet } from '../art/types'

/** Something the player can click in a scene. */
export type Target =
  | { kind: 'habitat'; id: string }
  | { kind: 'dragon'; id: string }
  | { kind: 'nest'; index: number }
  | { kind: 'hatchery'; slot: number }
  | { kind: 'farm'; plot: number }
  | { kind: 'hoard' }
  | { kind: 'empty' }

export type GameEvent =
  | { type: 'select'; target: Target }
  | { type: 'hover'; target: Target | null }
  | { type: 'battleTarget'; slot: number }
  | { type: 'state'; state: PlayerState | null }
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
    reducedMotion: false,
    selected: { kind: 'empty' } as Target,
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
    setReducedMotion(v: boolean): void { bridge.reducedMotion = v },
  }
  return bridge
}

export type Bridge = ReturnType<typeof createBridge>
