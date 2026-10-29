# Base Building Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Grid-based base building for Dragon Island: place, move and turn buildings on a home island that expands, five outer islands with clearable obstacles, timed builds and upgrades with two builders, a Build shop, cosmetic decorations, and one speed-up rule for every timer.

**Architecture:** All rules live in `packages/game-core` as pure functions over `PlayerState` (time injected, no I/O): new modules for island geometry, obstacles, construction, upgrade tables and decorations, plus new actions dispatched through the existing `applyAction`. The server only gains zod schemas and a state migration. The web client replaces the fixed pixel layout with a grid camera, placement mode, an island map and new panels; the island model stays a pure, tested function.

**Tech Stack:** TypeScript, Vitest, zod (`packages/shared`), Fastify + Drizzle (`apps/server`), Phaser 3 + React + TanStack Query (`apps/web`), Playwright e2e.

**Spec:** `docs/superpowers/specs/2026-10-29-base-building-design.md` (overrides §7–9 and §15 of `docs/superpowers/specs/2026-10-28-wyrmhaven-design.md` where they differ; its §12 lists the differences).

## Global Constraints

- `packages/game-core` is pure and deterministic: no I/O, no `Date.now()`, no `Math.random()`; `nowMs` and `Rng` are parameters.
- Gold, food, XP and micro-USD are integers; no floats in currency math (percentages via `Math.floor(x * pct / 100)`).
- Server is authoritative; the client sends intents only. The client previews placement legality with the same game-core function the server runs.
- Original IP: all building, decoration, obstacle and island names come from the spec; never copy names, art, text or audio from other games.
- Conventional commits; TDD (failing test, minimal code, commit). Stage by explicit path: another thread commits to `main` in the same working tree.
- Typecheck per package while the tree is mid-migration: `pnpm --filter @wyrmhaven/game-core typecheck`, then `pnpm -r typecheck` once Task 12 lands.
- After each `git commit` on the device, move stale lock files: `mv .git/HEAD.lock .git/stale-HEAD-lock-$RANDOM; mv .git/objects/maintenance.lock .git/stale-maintenance-lock-$RANDOM` (the folder has no delete permission).

## Review Focus

1. A client sends `placement` with a non-integer, negative or huge `col`/`row`, or `facing: 4`: `isValidAction` rejects it before any rule runs (Task 5 test `rejects malformed placements`).
2. The player moves a habitat onto its own current cells, or one cell over so the footprints overlap only with itself: allowed, since the mover is ignored in the overlap check (Task 5 test `moving a building over its own footprint is allowed`).
3. A clock that steps back (`nowMs` smaller than when a construction started): `finishConstruction` returns `NOT_READY` and nothing is paid twice; the tutorial counter never decrements (Task 6 test `a clock behind readyAtMs is NOT_READY`).
4. A habitat under construction that a dragon could match: `hatch` and `moveDragon` skip it, and `storedGold` of an unfinished habitat is 0 because it has no residents (Task 5 test `unfinished habitats take no dragons`).
5. Construction skip when both builders are busy and the skipped one finishes: the slot frees in the same action, so the next `startUpgrade` in the same second succeeds (Task 8 test `a construction skip frees a builder`).

---

## File structure

**game-core (`packages/game-core/src`)**

| File | Responsibility |
|---|---|
| `state.ts` (modify) | New types: `IslandId`, `Facing`, `Placement`, `Nest`, `Decoration`, `Obstacle`, `BuildingRef`, `Construction`; new `PlayerState` fields; starting layout in `newPlayer` |
| `island.ts` (create) | Island sizes, home expansion table, outer island table, cells and footprints, occupants, `placementError` |
| `obstacles.ts` (create) | Obstacle kinds table, per-island multiplier, cost and reward |
| `data/island-layouts.ts` (create) | Fixed obstacle layout of an outer island; obstacles added by each home strip |
| `construction.ts` (create) | `MAX_BUILDERS`, new-building timers, tutorial 15 s, `startConstruction`, lookups |
| `buildings.ts` (create) | Upgrade tables for habitats (timers, gates), farm plots, hatchery, nests; `upgradeInfo` |
| `decorations.ts` (create) | Decoration table and refund |
| `habitat.ts` (modify) | `maxHabitats(level, outerIslands)`, `'any'` element, `habitatBuildCost` ignores the Nexus |
| `actions/build-actions.ts` (create) | `placeBuilding`, `moveBuilding`, `removeDecoration`, `startUpgrade`, `finishConstruction` |
| `actions/island-unlock-actions.ts` (create) | `expandIsland`, `unlockIsland`, `clearObstrate` → `clearObstacle` |
| `actions/island-actions.ts` (modify) | Remove `buildHabitat`, `upgradeHabitat`; `moveDragon` skips unfinished habitats |
| `actions/farm-actions.ts` (modify) | Remove `buyFarmPlot`; `harvest` applies plot yield |
| `actions/breed-actions.ts` (modify) | `Nest` objects; nest breed percent; hatchery slots by level; `hatch` skips unfinished habitats |
| `actions/economy-actions.ts`, `store.ts` (modify) | Skip target `construction`; nest and Hoard placement on purchase |
| `actions/types.ts`, `actions/validate.ts`, `actions/apply.ts`, `index.ts` (modify) | New actions, errors, exports |
| `legacy-layout.ts` (create) | `layoutLegacyState` for states saved before this feature |

**shared / server**

| File | Responsibility |
|---|---|
| `packages/shared/src/actions.ts` (modify) | zod schemas for the new actions and store items |
| `apps/server/src/services/stateMigration.ts` (modify) | Calls `layoutLegacyState` when `islands` is missing |

**web (`apps/web/src`)**

| File | Responsibility |
|---|---|
| `game/layout.ts` (rewrite) | Cell→pixel maths, anchors per footprint, dragon spots on a 5×5 platform, world size |
| `game/islandModel.ts` (rewrite) | Pure model of one island view: buildings, dragons, obstacles, ghost, edge sign, badges |
| `game/bridge.ts` (modify) | `view`, `placing`, new targets and `cell` event |
| `game/scenes/IslandScene.ts` (rewrite) | Camera bounds, drag pan, wheel zoom, grid, cell clicks, ghost |
| `state/placing.ts` (create) | Placement-mode state machine (what is being placed, cursor cell, facing) |
| `panels/PlacementBar.tsx` (create) | Confirm / turn / cancel while placing |
| `panels/BuildShopPanel.tsx` (create) | Five categories, locks, starts placement |
| `panels/UpgradeSection.tsx` (create) | Next level, cost, timer, gate, start, construction timer and skip; used by habitat, farm, nest and hatchery panels |
| `panels/HabitatPanel.tsx`, `NestsPanel.tsx`, `FarmPanel.tsx`, `StorePanel.tsx` (modify) | New state shapes; move and turn buttons; nest/Hoard placement |
| `panels/IslandMapPanel.tsx`, `panels/ObstaclePanel.tsx` (create) | Island switching and unlocking; obstacle clearing |
| `art/types.ts`, `art/fromManifest.ts`, `art/fallback.ts` (modify) | New slots: nexus, decorations, obstacles, locked land, sign, map icons; habitats at 80×64 |
| `api/errors.ts` (modify) | Copy for the new error codes |

---

### Task 1: State shapes, starting layout and `Nest` objects

**Files:**
- Modify: `packages/game-core/src/state.ts`
- Modify: `packages/game-core/src/actions/breed-actions.ts`, `packages/game-core/src/actions/economy-actions.ts`, `packages/game-core/src/store.ts`
- Test: `packages/game-core/test/state.test.ts` (extend), existing tests that build nests inline

**Interfaces:**
- Produces, in `state.ts`:
  ```ts
  export type IslandId = 'home' | 'isle2' | 'isle3' | 'isle4' | 'isle5' | 'dawnspire'
  export type Facing = 0 | 1 | 2 | 3
  export interface Placement { island: IslandId; col: number; row: number; facing: Facing }
  export type HabitatElement = Element | 'any'          // 'any' = the Nexus habitat
  export interface Habitat { id: string; element: HabitatElement; level: number; lastCollectedMs: number; placement: Placement }
  export interface Nest { egg: Egg | null; level: number; placement: Placement }
  export interface FarmPlot { crop: CropId | null; readyAtMs: number; level: number; placement: Placement }
  export type DecorationId = 'stonePath' | 'picketFence' | 'flowerPatch' | 'emberLantern' | 'driftwoodBench' | 'hayCart' | 'shellFountain' | 'crystalCluster' | 'eggTotem' | 'moonwell' | 'boneArch' | 'skyShrine' | 'dawnObelisk' | 'starPool' | 'dragonColossus'
  export interface Decoration { id: string; kind: DecorationId; placement: Placement }
  export type ObstacleKind = 'bush' | 'rock' | 'tree' | 'boulder' | 'ruin'
  export interface Obstacle { id: string; kind: ObstacleKind; island: IslandId; col: number; row: number }
  export type BuildingRef = { type: 'habitat'; id: string } | { type: 'farm'; index: number } | { type: 'nest'; index: number } | { type: 'hatchery' }
  export type Construction =
    | { kind: 'build' | 'upgrade'; building: BuildingRef; readyAtMs: number }
    | { kind: 'clear'; obstacleId: string; readyAtMs: number }
  ```
  `PlayerState` gains `nests: Nest[]` (replacing `(Egg | null)[]`), `hatcheryLevel: number`, `hatcheryPlacement: Placement`, `hoardPlacement: Placement | null`, `decorations: Decoration[]`, `islands: { homeStep: number; unlocked: IslandId[]; obstacles: Obstacle[] }`, `constructions: Construction[]`, and `tutorial.buildsStarted: number`.
- `newPlayer(nowMs)` starting layout (spec §2): `h1` fire at (0,0), `h2` water at (5,0), farms at (10,0) and (10,2), hatchery at (0,8), nest at (4,8); all `facing: 0`, `island: 'home'`; `hatcheryLevel: 1`, `hoardPlacement: null`, `decorations: []`, `islands: { homeStep: 0, unlocked: ['home'], obstacles: [] }`, `constructions: []`, `tutorial: { breedDone: false, hatchDone: false, buildsStarted: 0 }`.

- [ ] **Step 1: Write the failing test** in `test/state.test.ts`

```ts
it('starts on a 12×12 home island with the fixed layout', () => {
  const s = newPlayer(0)
  expect(s.habitats.map(h => h.placement)).toEqual([
    { island: 'home', col: 0, row: 0, facing: 0 }, { island: 'home', col: 5, row: 0, facing: 0 }])
  expect(s.farms.map(f => [f.level, f.placement.col, f.placement.row])).toEqual([[1, 10, 0], [1, 10, 2]])
  expect(s.nests).toEqual([{ egg: null, level: 1, placement: { island: 'home', col: 4, row: 8, facing: 0 } }])
  expect([s.hatcheryLevel, s.hatcheryPlacement, s.hoardPlacement]).toEqual([1, { island: 'home', col: 0, row: 8, facing: 0 }, null])
  expect(s.islands).toEqual({ homeStep: 0, unlocked: ['home'], obstacles: [] })
  expect([s.constructions, s.decorations, s.tutorial.buildsStarted]).toEqual([[], [], 0])
})
```

- [ ] **Step 2: Run** `pnpm --filter @wyrmhaven/game-core test -- state` — expected: FAIL (fields undefined).
- [ ] **Step 3: Add the types and fields** listed above to `state.ts`; update `newPlayer`.
- [ ] **Step 4: Replace every `nests` use with `Nest` objects**: `startBreed` finds `s.nests.findIndex(n => n.egg === null)` and writes `{ ...n, egg }`; `collectEgg` reads `nest.egg`; `skipTargetReadyAt` and `applyItem('skip','nest')` go through `.egg`; `buy('nest')` keeps pushing a nest but with `level: 1` and a placeholder placement `{ island: 'home', col: 0, row: 0, facing: 0 }` (Task 8 replaces it with the bought placement). Update existing tests that construct `nests` inline (`breed-actions`, `economy-actions`, `store`, `replay`).
- [ ] **Step 5: Run** `pnpm --filter @wyrmhaven/game-core test && pnpm --filter @wyrmhaven/game-core typecheck` — expected: all PASS. (Web and server typechecks break until Tasks 9 and 12; that is expected.)
- [ ] **Step 6: Commit** `git add packages/game-core/src packages/game-core/test && git commit -m "feat(game-core): placements, nest objects and island state"`

---

### Task 2: Island geometry and placement legality

**Files:**
- Create: `packages/game-core/src/island.ts`
- Test: `packages/game-core/test/island.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export const CELL_PX = 16
  export const ISLAND_ORDER: readonly IslandId[] = ['home', 'isle2', 'isle3', 'isle4', 'isle5', 'dawnspire']
  export const OUTER_SIZE = 16
  export const HOME_MAX_STEP = 12
  /** Index = step − 1 (spec §3). */
  export const HOME_EXPANSION: readonly { minLevel: number; cost: number }[]   // (2,1000) (4,2500) (7,5000) (10,10000) (14,20000) (18,40000) (22,75000) (27,125000) (32,200000) (37,325000) (42,500000) (47,750000)
  /** Spec §4; `mult` is the obstacle multiplier m. */
  export const OUTER_ISLANDS: Record<Exclude<IslandId, 'home'>, { minLevel: number; cost: number; mult: number }>
  export function homeSize(step: number): { w: number; h: number }      // w = 12 + 2·ceil(step/2), h = 12 + 2·floor(step/2)
  export function islandSize(s: PlayerState, island: IslandId): { w: number; h: number }
  export type Footprint = 1 | 2 | 3 | 4 | 5
  export const FOOTPRINT = { habitat: 5, hatchery: 4, hoard: 4, farm: 2, nest: 2 } as const
  export type OccupantRef = BuildingRef | { type: 'hoard' } | { type: 'decoration'; id: string } | { type: 'obstacle'; id: string }
  export interface Occupant { ref: OccupantRef; col: number; row: number; size: Footprint }
  export function occupants(s: PlayerState, island: IslandId): Occupant[]   // every placed building, decoration and remaining obstacle on that island
  export function sameRef(a: OccupantRef, b: OccupantRef): boolean
  export function overlaps(a: { col: number; row: number; size: number }, b: { col: number; row: number; size: number }): boolean
  export type PlacementError = 'ISLAND_LOCKED' | 'OUT_OF_BOUNDS' | 'OVERLAP'
  export function placementError(s: PlayerState, p: Placement, size: Footprint, ignore?: OccupantRef): PlacementError | null
  export function outerIslandsUnlocked(s: PlayerState): number   // s.islands.unlocked.length − 1
  ```
  Decoration sizes come from Task 4's `DECORATIONS[kind].size`; until then `occupants` treats decorations as size 1 and Task 4 switches it to the table.

- [ ] **Step 1: Write failing tests** in `test/island.test.ts`

```ts
it('home island grows width then height by 2', () => {
  expect([homeSize(0), homeSize(1), homeSize(2), homeSize(12)]).toEqual([{ w: 12, h: 12 }, { w: 14, h: 12 }, { w: 14, h: 14 }, { w: 24, h: 24 }])
  expect(HOME_EXPANSION).toHaveLength(12)
  expect(HOME_EXPANSION.reduce((n, e) => n + e.cost, 0)).toBe(2_053_500)
  expect(HOME_EXPANSION[11]).toEqual({ minLevel: 47, cost: 750_000 })
})
it('lists the starting occupants', () => {
  const o = occupants(newPlayer(0), 'home')
  expect(o).toHaveLength(6)
  expect(o.find(x => x.ref.type === 'hatchery')).toEqual({ ref: { type: 'hatchery' }, col: 0, row: 8, size: 4 })
})
it('rejects placements off the island, on a locked island, or over something', () => {
  const s = newPlayer(0)
  expect(placementError(s, { island: 'home', col: 8, row: 8, facing: 0 }, 5)).toBe('OUT_OF_BOUNDS')  // cols 8–12 on a 12-wide island
  expect(placementError(s, { island: 'home', col: -1, row: 0, facing: 0 }, 1)).toBe('OUT_OF_BOUNDS')
  expect(placementError(s, { island: 'isle2', col: 0, row: 0, facing: 0 }, 1)).toBe('ISLAND_LOCKED')
  expect(placementError(s, { island: 'home', col: 4, row: 4, facing: 0 }, 2)).toBe('OVERLAP')        // touches h1 at (4,4)
  expect(placementError(s, { island: 'home', col: 6, row: 8, facing: 0 }, 2)).toBeNull()
  expect(placementError(s, { island: 'home', col: 5, row: 0, facing: 0 }, 5, { type: 'habitat', id: 'h2' })).toBeNull()
})
it('OUTER_ISLANDS matches the spec', () => {
  expect(OUTER_ISLANDS.isle2).toEqual({ minLevel: 12, cost: 40_000, mult: 2 })
  expect(OUTER_ISLANDS.dawnspire).toEqual({ minLevel: 45, cost: 3_000_000, mult: 40 })
})
```

- [ ] **Step 2: Run** `pnpm --filter @wyrmhaven/game-core test -- island.test` — expected: FAIL (module missing).
- [ ] **Step 3: Implement `island.ts`** with the signatures above. `occupants` reads habitats, farms, nests, hatchery (`hatcheryPlacement`), Hoard (`hoardPlacement` when `hoardLevel > 0`), decorations and `islands.obstacles` filtered by island (obstacle size from Task 3's table; until Task 3, bush/rock 1, tree/boulder 2, ruin 3 inline). `placementError` checks the order locked → bounds → overlap.
- [ ] **Step 4: Run** the test file — expected: PASS. Export `island.ts` from `index.ts`.
- [ ] **Step 5: Commit** `git commit -m "feat(game-core): island geometry, expansion table and placement checks"`

---

### Task 3: Obstacle tables and fixed layouts

**Files:**
- Create: `packages/game-core/src/obstacles.ts`, `packages/game-core/src/data/island-layouts.ts`
- Test: `packages/game-core/test/obstacles.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // obstacles.ts
  export const OBSTACLES: Record<ObstacleKind, { size: 1 | 2 | 3; cost: number; timerMs: number; xp: number; food: number }>
  //  bush {1, 100, 60_000, 20, 10}  rock {1, 250, 300_000, 40, 0}  tree {2, 800, 1_800_000, 100, 60}
  //  boulder {2, 2_000, 7_200_000, 250, 0}  ruin {3, 6_000, 28_800_000, 700, 300}
  export function obstacleMult(island: IslandId): number          // home 1, else OUTER_ISLANDS[island].mult
  export function clearCost(o: Obstacle): number                   // cost × mult
  export function clearReward(o: Obstacle): { xp: number; food: number }
  // data/island-layouts.ts
  export const OUTER_LAYOUT: readonly { kind: ObstacleKind; col: number; row: number }[]   // 30 entries: 10 bush, 8 rock, 6 tree, 4 boulder, 2 ruin; in a 16×16; no overlaps
  export function outerObstacles(island: Exclude<IslandId, 'home'>): Obstacle[]           // ids `${island}-${i}`
  export function homeStripObstacles(step: number): Obstacle[]   // one bush, one rock inside the strip step adds; ids `home-s${step}-bush`, `home-s${step}-rock`
  ```
  Strip positions: for an odd step (width strip, new cols `w−2..w−1` of `homeSize(step)`), bush at `(w−2, 1)`, rock at `(w−1, h−2)`; for an even step (height strip), bush at `(1, h−2)`, rock at `(w−2, h−1)`.

- [ ] **Step 1: Write failing tests**

```ts
it('an outer island layout has the spec counts, fits, and never overlaps', () => {
  const counts = Object.fromEntries(OUTER_LAYOUT.map(o => o.kind).reduce((m, k) => m.set(k, (m.get(k) ?? 0) + 1), new Map()))
  expect(counts).toEqual({ bush: 10, rock: 8, tree: 6, boulder: 4, ruin: 2 })
  for (const o of OUTER_LAYOUT) expect(o.col + OBSTACLES[o.kind].size <= 16 && o.row + OBSTACLES[o.kind].size <= 16 && o.col >= 0 && o.row >= 0).toBe(true)
  const boxes = OUTER_LAYOUT.map(o => ({ ...o, size: OBSTACLES[o.kind].size }))
  boxes.forEach((a, i) => boxes.slice(i + 1).forEach(b => expect(overlaps(a, b)).toBe(false)))
  expect(OUTER_LAYOUT.reduce((n, o) => n + OBSTACLES[o.kind].size ** 2, 0)).toBe(76)
})
it('costs and rewards scale by island', () => {
  const isle2 = outerObstacles('isle2')
  expect(isle2.reduce((n, o) => n + clearCost(o), 0)).toBe(55_600)
  expect(isle2.reduce((n, o) => n + clearReward(o).xp, 0)).toBe(7_040)
  expect(outerObstacles('dawnspire').reduce((n, o) => n + clearCost(o), 0)).toBe(1_112_000)
  expect(isle2[0]!.id).toBe('isle2-0')
})
it('each home strip carries a bush and a rock inside the new strip', () => {
  const s1 = homeStripObstacles(1)
  expect(s1.map(o => [o.kind, o.col, o.row])).toEqual([['bush', 12, 1], ['rock', 13, 10]])
  const s2 = homeStripObstacles(2)
  expect(s2.map(o => [o.kind, o.col, o.row])).toEqual([['bush', 1, 12], ['rock', 12, 13]])
  expect(s1.reduce((n, o) => n + clearReward(o).xp, 0)).toBe(60)
})
```

- [ ] **Step 2: Run** `pnpm --filter @wyrmhaven/game-core test -- obstacles` — expected: FAIL.
- [ ] **Step 3: Implement** both files. Choose the 30 layout positions yourself so the test holds; keep a 5×5 clear block near the island centre so the first habitat always fits.
- [ ] **Step 4: Make `occupants` (Task 2) use `OBSTACLES[kind].size`**; run `pnpm --filter @wyrmhaven/game-core test` — expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "feat(game-core): obstacle tables and fixed island layouts"`

---

### Task 4: Construction, upgrade and decoration tables

**Files:**
- Create: `packages/game-core/src/construction.ts`, `packages/game-core/src/buildings.ts`, `packages/game-core/src/decorations.ts`
- Modify: `packages/game-core/src/habitat.ts`, `packages/game-core/src/island.ts` (decoration sizes)
- Test: `packages/game-core/test/construction.test.ts`, `packages/game-core/test/buildings.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // construction.ts
  export const MAX_BUILDERS = 2
  export const TUTORIAL_BUILDS = 2
  export const NEXUS_COST = 250_000
  export const NEXUS_BUILD_MS = 43_200_000
  export const FARM_PLOT_BUILD_MS: readonly number[] = [120_000, 600_000, 1_800_000, 3_600_000]   // plots 3..6
  export function newHabitatTimerMs(habitatsOwned: number): number   // 600_000 × 2^(owned−2), min 600_000, max 28_800_000; `owned` excludes the Nexus
  export function constructionFor(s: PlayerState, ref: BuildingRef): Construction | undefined
  export function isUnderConstruction(s: PlayerState, ref: BuildingRef): boolean
  export function sameBuilding(a: BuildingRef, b: BuildingRef): boolean
  /** Appends a construction; the first TUTORIAL_BUILDS a player starts take TUTORIAL_TIMER_MS. `null` when both builders are busy. */
  export function startConstruction(s: PlayerState, c: Omit<Construction, 'readyAtMs'>, timerMs: number, nowMs: number): PlayerState | null
  // buildings.ts
  export interface UpgradeStep { cost: number; timerMs: number; minLevel: number }
  export const HABITAT_UPGRADES: readonly { timerMs: number; minLevel: number }[]   // to level 2..5: (600_000,1) (3_600_000,5) (14_400_000,10) (36_000_000,18); cost stays HABITAT_LEVELS[].upgradeCost
  export const FARM_LEVELS: readonly { foodPct: number; up: UpgradeStep | null }[]   // L1 {100, {1500, 900_000, 4}} L2 {115, {8000, 3_600_000, 10}} L3 {130, {30_000, 14_400_000, 18}} L4 {150, null}
  export const HATCHERY_LEVELS: readonly { slots: number; up: UpgradeStep | null }[]  // {3,{12_000,7_200_000,8}} {4,{75_000,28_800_000,20}} {5,null}
  export const NEST_LEVELS: readonly { breedPct: number; up: UpgradeStep | null }[]   // {100,{15_000,7_200_000,12}} {90,{90_000,28_800_000,24}} {80,null}
  export function hatcherySlots(level: number): number
  export function nestBreedMs(baseMs: number, nestLevel: number): number    // floor(base × pct / 100)
  export function farmFood(cropFood: number, plotLevel: number): number     // floor(food × pct / 100)
  /** Next upgrade of a building, or null at max level. Habitats: cost from HABITAT_LEVELS, timer and gate from HABITAT_UPGRADES. */
  export function upgradeInfo(s: PlayerState, ref: BuildingRef): UpgradeStep | null
  // decorations.ts
  export const DECORATIONS: Record<DecorationId, { size: 1 | 2 | 3; cost: number; minLevel: number; island?: 'dawnspire' }>   // spec §7 table
  export const DECORATION_REFUND_PCT = 25
  export function decorationRefund(kind: DecorationId): number   // floor(cost × 25 / 100)
  // habitat.ts
  export function maxHabitats(playerLevel: number, outerIslands: number): number   // 2 + floor(L/5) + 3·outerIslands
  export function canLiveIn(sp: Species, h: Habitat): boolean   // true when h.element === 'any'
  export function habitatBuildCost(s: PlayerState, e: Element): number   // counts habitats of element e only (never 'any')
  ```
  `hatcheryUsed` stays; `HATCHERY_SLOTS` constant is replaced by `hatcherySlots(s.hatcheryLevel)` everywhere (`collectEgg`, web model).

- [ ] **Step 1: Write failing tests**

```ts
// construction.test.ts
it('new habitat timers double from 10 min and cap at 8 h', () => {
  expect([2, 3, 4, 8, 9, 20].map(newHabitatTimerMs)).toEqual([600_000, 1_200_000, 2_400_000, 28_800_000, 28_800_000, 28_800_000])
})
it('two builders, then BUILDERS_BUSY; the first two builds take 15 s', () => {
  const s = newPlayer(0)
  const a = startConstruction(s, { kind: 'upgrade', building: { type: 'habitat', id: 'h1' } }, 600_000, 1_000)!
  expect(a.constructions[0]).toEqual({ kind: 'upgrade', building: { type: 'habitat', id: 'h1' }, readyAtMs: 16_000 })
  const b = startConstruction(a, { kind: 'upgrade', building: { type: 'habitat', id: 'h2' } }, 600_000, 1_000)!
  expect(b.constructions[1]!.readyAtMs).toBe(16_000)
  expect(b.tutorial.buildsStarted).toBe(2)
  expect(startConstruction(b, { kind: 'upgrade', building: { type: 'farm', index: 0 } }, 1, 1_000)).toBeNull()
  const c = startConstruction({ ...b, constructions: [] }, { kind: 'upgrade', building: { type: 'farm', index: 0 } }, 600_000, 1_000)!
  expect(c.constructions[0]!.readyAtMs).toBe(601_000)
})
// buildings.test.ts
it('upgrade tables match the spec', () => {
  expect(upgradeInfo(newPlayer(0), { type: 'habitat', id: 'h1' })).toEqual({ cost: 1_000, timerMs: 600_000, minLevel: 1 })
  expect(upgradeInfo({ ...newPlayer(0), habitats: newPlayer(0).habitats.map(h => ({ ...h, level: 5 })) }, { type: 'habitat', id: 'h1' })).toBeNull()
  expect(upgradeInfo(newPlayer(0), { type: 'farm', index: 0 })).toEqual({ cost: 1_500, timerMs: 900_000, minLevel: 4 })
  expect(upgradeInfo(newPlayer(0), { type: 'nest', index: 0 })).toEqual({ cost: 15_000, timerMs: 7_200_000, minLevel: 12 })
  expect(upgradeInfo(newPlayer(0), { type: 'hatchery' })).toEqual({ cost: 12_000, timerMs: 7_200_000, minLevel: 8 })
  expect([hatcherySlots(1), hatcherySlots(3)]).toEqual([3, 5])
  expect(nestBreedMs(43_200_000, 3)).toBe(34_560_000)
  expect(farmFood(3_000, 4)).toBe(4_500)
  expect(farmFood(10, 2)).toBe(11)
})
it('habitat limit counts outer islands and the Nexus is free', () => {
  expect([maxHabitats(1, 0), maxHabitats(50, 0), maxHabitats(50, 5)]).toEqual([2, 12, 27])
  expect(canLiveIn(FIXTURE_CATALOG.species.get('fire')!, { id: 'x', element: 'any', level: 5, lastCollectedMs: 0, placement: P })).toBe(true)
})
it('decorations table and refund', () => {
  expect(DECORATIONS.stonePath).toEqual({ size: 1, cost: 10, minLevel: 1 })
  expect(DECORATIONS.dragonColossus).toEqual({ size: 3, cost: 1_000_000, minLevel: 45, island: 'dawnspire' })
  expect(Object.keys(DECORATIONS)).toHaveLength(15)
  expect(decorationRefund('hayCart')).toBe(250)
})
```

- [ ] **Step 2: Run** both test files — expected: FAIL.
- [ ] **Step 3: Implement** the three modules and the `habitat.ts` changes; switch `island.ts` `occupants` to `DECORATIONS[kind].size`; update `maxHabitats` callers (`buildHabitat` for now, web later) and export from `index.ts`.
- [ ] **Step 4: Run** `pnpm --filter @wyrmhaven/game-core test` — expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "feat(game-core): construction, upgrade and decoration tables"`

---

### Task 5: `placeBuilding`, `moveBuilding`, `removeDecoration`; unfinished habitats

**Files:**
- Create: `packages/game-core/src/actions/build-actions.ts`
- Modify: `packages/game-core/src/actions/types.ts`, `validate.ts`, `apply.ts`, `island-actions.ts` (delete `buildHabitat`; `moveDragon` skips unfinished), `breed-actions.ts` (`hatch` skips unfinished), `farm-actions.ts` (delete `buyFarmPlot`)
- Test: `packages/game-core/test/build-actions.test.ts`; update `island-actions.test.ts`, `farm-actions.test.ts`, `validate` cases

**Interfaces:**
- Produces, in `types.ts`:
  ```ts
  export type Placeable =
    | { kind: 'habitat'; element: Element } | { kind: 'nexus' } | { kind: 'farm' } | { kind: 'decoration'; decoration: DecorationId }
  export type MovableRef = BuildingRef | { type: 'hoard' } | { type: 'decoration'; id: string }
  // Action gains:
  | { type: 'placeBuilding'; building: Placeable; placement: Placement }
  | { type: 'moveBuilding'; target: MovableRef; placement: Placement }
  | { type: 'removeDecoration'; id: string }
  // Action loses: buildHabitat, upgradeHabitat (Task 6 deletes it), buyFarmPlot
  // ActionError gains: 'OUT_OF_BOUNDS' | 'OVERLAP' | 'BUILDERS_BUSY' | 'ISLAND_LOCKED' | 'MAX_ISLAND' | 'WRONG_ISLAND' | 'UNDER_CONSTRUCTION' | 'NO_LEGENDARY' | 'NEXUS_EXISTS' | 'MAX_EXPANSION'
  ```
- Rules for `placeBuilding` (in this order): `placementError` → `LEVEL_TOO_LOW` for decorations below `minLevel` → `WRONG_ISLAND` for a Dawnspire-only decoration or the Nexus off `dawnspire` → `NEXUS_EXISTS` → `HABITAT_LIMIT` (habitats, counting unfinished ones, excluding the Nexus) → `MAX_PLOTS` → gold (`spendGold`, else `INSUFFICIENT_GOLD`) → builders (`startConstruction`, else `BUILDERS_BUSY`; decorations have no construction). Habitat and farm plot are appended immediately with `id: h${nextId}` / next index, level 1, and a `build` construction with `newHabitatTimerMs(habitatsOwnedBefore)` or `FARM_PLOT_BUILD_MS[plots − 2]`; the Nexus is `{ element: 'any', level: 5 }` with `NEXUS_BUILD_MS`. Decorations get `id: c${nextId}`.
- `moveBuilding`: `NOT_FOUND` → `WRONG_ISLAND` when hatchery or Hoard leaves `home` → `placementError` with `ignore` = the mover → write the placement. Allowed during construction. Facing-only changes go through the same action.
- `removeDecoration`: `NOT_FOUND` → remove and `earnGold(refund, false)`.
- `hatch` and `moveDragon` consider only habitats with `!isUnderConstruction(s, { type: 'habitat', id })`; a `moveDragon` into an unfinished habitat returns `UNDER_CONSTRUCTION`.

- [ ] **Step 1: Write failing tests** (helpers as in `island-actions.test.ts`; `P = (col,row) => ({ island: 'home', col, row, facing: 0 })`)

```ts
it('places a habitat under construction and charges gold', () => {
  const a = ok(run({ ...s, level: 5, gold: 5_000 }, { type: 'placeBuilding', building: { kind: 'habitat', element: 'earth' }, placement: P(6, 7) }, 1_000))
  expect(a.habitats[2]).toEqual({ id: 'h3', element: 'earth', level: 1, lastCollectedMs: 1_000, placement: P(6, 7) })
  expect(a.gold).toBe(4_500)
  expect(a.constructions).toEqual([{ kind: 'build', building: { type: 'habitat', id: 'h3' }, readyAtMs: 16_000 }])   // tutorial 15 s
})
it('rejects overlap, bounds, limit and gold', () => {
  err(run({ ...s, level: 5 }, { type: 'placeBuilding', building: { kind: 'habitat', element: 'earth' }, placement: P(0, 0) }, 0), 'OVERLAP')
  err(run({ ...s, level: 5 }, { type: 'placeBuilding', building: { kind: 'habitat', element: 'earth' }, placement: P(8, 8) }, 0), 'OUT_OF_BOUNDS')
  err(run(s, { type: 'placeBuilding', building: { kind: 'habitat', element: 'earth' }, placement: P(6, 7) }, 0), 'HABITAT_LIMIT')
  err(run({ ...s, level: 5, gold: 10 }, { type: 'placeBuilding', building: { kind: 'habitat', element: 'earth' }, placement: P(6, 7) }, 0), 'INSUFFICIENT_GOLD')
})
it('a third plot costs 500 and takes 2 min after the tutorial builds', () => {
  const t = { ...s, tutorial: { ...s.tutorial, buildsStarted: 2 } }
  const a = ok(run(t, { type: 'placeBuilding', building: { kind: 'farm' }, placement: P(6, 7) }, 0))
  expect(a.farms[2]).toEqual({ crop: null, readyAtMs: 0, level: 1, placement: P(6, 7) })
  expect([a.gold, a.constructions[0]!.readyAtMs]).toEqual([500, 120_000])
})
it('unfinished habitats take no dragons', () => {
  const a = ok(run({ ...s, level: 5 }, { type: 'placeBuilding', building: { kind: 'habitat', element: 'fire' }, placement: P(6, 7) }, 0))
  err(run(a, { type: 'moveDragon', dragonId: 'd1', habitatId: 'h3' }, 0), 'UNDER_CONSTRUCTION')
  const full = { ...a, dragons: [...a.dragons, ...['d3', 'd4'].map(id => ({ id, speciesId: 'fire', level: 1, habitatId: 'h1' }))], hatchery: [{ speciesId: 'fire', readyAtMs: 0 }] }
  expect(ok(run(full, { type: 'hatch', slot: 0 }, 0)).dragons.at(-1)!.habitatId).toBeNull()
})
it('decorations are instant, level-gated, refundable at 25% ineligible', () => {
  err(run(s, { type: 'placeBuilding', building: { kind: 'decoration', decoration: 'hayCart' }, placement: P(6, 7) }, 0), 'LEVEL_TOO_LOW')
  err(run({ ...s, level: 45 }, { type: 'placeBuilding', building: { kind: 'decoration', decoration: 'starPool' }, placement: P(6, 7) }, 0), 'WRONG_ISLAND')
  const a = ok(run({ ...s, level: 6, gold: 1_000, eligibleGold: 1_000 }, { type: 'placeBuilding', building: { kind: 'decoration', decoration: 'hayCart' }, placement: P(6, 7) }, 0))
  expect([a.gold, a.constructions.length, a.decorations[0]!.id]).toEqual([0, 0, 'c3'])
  const b = ok(run(a, { type: 'removeDecoration', id: 'c3' }, 0))
  expect([b.gold, b.eligibleGold, b.decorations]).toEqual([250, 0, []])
})
it('moving a building over its own footprint is allowed; hatchery stays home', () => {
  const a = ok(run(s, { type: 'moveBuilding', target: { type: 'habitat', id: 'h1' }, placement: P(1, 0) }, 0))
  expect(a.habitats[0]!.placement).toEqual(P(1, 0))
  expect(ok(run(s, { type: 'moveBuilding', target: { type: 'habitat', id: 'h1' }, placement: { ...P(0, 0), facing: 3 } }, 0)).habitats[0]!.placement.facing).toBe(3)
  err(run({ ...s, islands: { ...s.islands, unlocked: ['home', 'isle2'] } }, { type: 'moveBuilding', target: { type: 'hatchery' }, placement: { island: 'isle2', col: 0, row: 0, facing: 0 } }, 0), 'WRONG_ISLAND')
})
it('rejects malformed placements', () => {
  for (const placement of [{ island: 'home', col: 1.5, row: 0, facing: 0 }, { island: 'home', col: -1, row: 0, facing: 0 }, { island: 'home', col: 0, row: 0, facing: 4 }, { island: 'moon', col: 0, row: 0, facing: 0 }, { island: 'home', col: 1e9, row: 0, facing: 0 }])
    expect(isValidAction({ type: 'moveBuilding', target: { type: 'hatchery' }, placement })).toBe(false)
})
```
  `isValidAction` bounds: `col`/`row` integers in `[0, 64)`, `facing` in `{0,1,2,3}`, `island` in `ISLAND_ORDER`, `decoration` a key of `DECORATIONS`.

- [ ] **Step 2: Run** `pnpm --filter @wyrmhaven/game-core test -- build-actions` — expected: FAIL.
- [ ] **Step 3: Implement** `build-actions.ts`, the type/validate/apply changes, the `hatch`/`moveDragon` filter; delete `buildHabitat` and `buyFarmPlot` and their tests (`maxHabitats` now takes `outerIslandsUnlocked(s)`).
- [ ] **Step 4: Run** `pnpm --filter @wyrmhaven/game-core test` — expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "feat(game-core): place, move and remove buildings on the grid"`

---

### Task 6: `startUpgrade`, `finishConstruction`, and the upgrade effects

**Files:**
- Modify: `packages/game-core/src/actions/build-actions.ts`, `types.ts`, `validate.ts`, `apply.ts`, `island-actions.ts` (delete `upgradeHabitat`), `farm-actions.ts` (`harvest` yield), `breed-actions.ts` (`startBreed` nest percent, `collectEgg` hatchery slots)
- Test: `packages/game-core/test/build-actions.test.ts` (extend), `farm-actions.test.ts`, `breed-actions.test.ts`

**Interfaces:**
- Produces:
  ```ts
  | { type: 'startUpgrade'; building: BuildingRef }
  | { type: 'finishConstruction'; index: number }
  /** Shared by finishConstruction and the construction skip (Task 8): applies construction `index`, which must be ready. */
  export function completeConstruction(s: PlayerState, index: number, c: Catalog, nowMs: number): PlayerState
  ```
- `startUpgrade` order: `NOT_FOUND` → `UNDER_CONSTRUCTION` (any construction on this building) → `MAX_LEVEL` (`upgradeInfo` null) → `LEVEL_TOO_LOW` → `INSUFFICIENT_GOLD` → `BUILDERS_BUSY`.
- `finishConstruction`: `NOT_FOUND` for a bad index → `NOT_READY` when `nowMs < readyAtMs` → `completeConstruction`. Effects: `build` removes the construction only; `upgrade` of a habitat collects it first (`collectHabitat`) then `level + 1`; farm/nest/hatchery `level + 1`; `clear` (Task 7) removes the obstacle and pays `addXp` + food.
- `harvest` adds `farmFood(CROPS[crop].food, plot.level)`; `startBreed` uses `nestBreedMs(RARITY[r].breedMs, nest.level)` after the tutorial breed; `collectEgg` checks `hatcheryUsed(s) >= hatcherySlots(s.hatcheryLevel)`.

- [ ] **Step 1: Write failing tests**

```ts
it('upgrades a habitat on a timer and applies it at finish, collecting first', () => {
  const t = { ...s, gold: 2_000, tutorial: { ...s.tutorial, buildsStarted: 2 } }
  const a = ok(run(t, { type: 'startUpgrade', building: { type: 'habitat', id: 'h1' } }, 0))
  expect([a.gold, a.habitats[0]!.level, a.constructions[0]]).toEqual([1_000, 1, { kind: 'upgrade', building: { type: 'habitat', id: 'h1' }, readyAtMs: 600_000 }])
  err(run(a, { type: 'startUpgrade', building: { type: 'habitat', id: 'h1' } }, 0), 'UNDER_CONSTRUCTION')
  err(run(a, { type: 'finishConstruction', index: 0 }, 599_999), 'NOT_READY')
  const b = ok(run(a, { type: 'finishConstruction', index: 0 }, 600_000))
  expect([b.habitats[0]!.level, b.constructions, b.gold, b.eligibleGold]).toEqual([2, [], 1_020, 20])   // 10 min × 2 gold/min collected
})
it('gates habitat level 3 at player level 5', () => {
  const l2 = { ...s, gold: 10_000, habitats: s.habitats.map(h => ({ ...h, level: 2 })) }
  err(run(l2, { type: 'startUpgrade', building: { type: 'habitat', id: 'h1' } }, 0), 'LEVEL_TOO_LOW')
  expect(ok(run({ ...l2, level: 5 }, { type: 'startUpgrade', building: { type: 'habitat', id: 'h1' } }, 0)).gold).toBe(5_000)
})
it('a clock behind readyAtMs is NOT_READY and finishing is idempotent by index', () => {
  const a = ok(run({ ...s, gold: 2_000 }, { type: 'startUpgrade', building: { type: 'habitat', id: 'h1' } }, 50_000))
  err(run(a, { type: 'finishConstruction', index: 0 }, 10_000), 'NOT_READY')
  const b = ok(run(a, { type: 'finishConstruction', index: 0 }, 65_000))
  err(run(b, { type: 'finishConstruction', index: 0 }, 65_000), 'NOT_FOUND')
})
it('farm, nest and hatchery levels change yields, breed time and slots', () => {
  const t = { ...s, level: 30, gold: 200_000, tutorial: { breedDone: true, hatchDone: true, buildsStarted: 2 } }
  const f = ok(run(ok(run(t, { type: 'startUpgrade', building: { type: 'farm', index: 0 } }, 0)), { type: 'finishConstruction', index: 0 }, 900_000))
  const planted = ok(run({ ...f, farms: f.farms.map((p, i) => i === 0 ? { ...p, crop: 'bounty' as const, readyAtMs: 0 } : p) }, { type: 'harvest', plot: 0 }, 900_000))
  expect(planted.food - f.food).toBe(3_450)
  const n = ok(run(ok(run(t, { type: 'startUpgrade', building: { type: 'nest', index: 0 } }, 0)), { type: 'finishConstruction', index: 0 }, 7_200_000))
  const parents = n.dragons.map(d => ({ ...d, level: 4 }))
  const bred = ok(run({ ...n, dragons: parents }, { type: 'startBreed', parentA: 'd1', parentB: 'd2' }, 7_200_000))
  expect(bred.nests[0]!.egg!.readyAtMs - 7_200_000).toBe(nestBreedMs(RARITY[getSpecies(FIXTURE_CATALOG, bred.nests[0]!.egg!.speciesId).rarity].breedMs, 2))
  const h = ok(run(ok(run(t, { type: 'startUpgrade', building: { type: 'hatchery' } }, 0)), { type: 'finishConstruction', index: 0 }, 7_200_000))
  expect(hatcherySlots(h.hatcheryLevel)).toBe(4)
})
```

- [ ] **Step 2: Run** the test file — expected: FAIL.
- [ ] **Step 3: Implement**; delete `upgradeHabitat` and its tests; update `store.ts`/`economy-actions.ts` `hoard` and `levelUp` paths only if they touched removed code.
- [ ] **Step 4: Run** `pnpm --filter @wyrmhaven/game-core test` — expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "feat(game-core): timed upgrades for habitats, farms, nests and the hatchery"`

---

### Task 7: `expandIsland`, `unlockIsland`, `clearObstacle`

**Files:**
- Create: `packages/game-core/src/actions/island-unlock-actions.ts`
- Modify: `types.ts`, `validate.ts`, `apply.ts`, `build-actions.ts` (`completeConstruction` handles `clear`)
- Test: `packages/game-core/test/island-unlock-actions.test.ts`

**Interfaces:**
- Produces:
  ```ts
  | { type: 'expandIsland' }
  | { type: 'unlockIsland' }
  | { type: 'clearObstacle'; obstacleId: string }
  ```
- `expandIsland`: `MAX_EXPANSION` at step 12 → `LEVEL_TOO_LOW` → `INSUFFICIENT_GOLD` → `homeStep + 1`, append `homeStripObstacles(newStep)` to `islands.obstacles`.
- `unlockIsland`: next of `ISLAND_ORDER` after the last unlocked; `MAX_ISLAND` when none → `LEVEL_TOO_LOW` → `NO_LEGENDARY` for `dawnspire` when no owned dragon's species is `legendary` → `INSUFFICIENT_GOLD` → push the island and `outerObstacles(island)`.
- `clearObstacle`: `NOT_FOUND` → `UNDER_CONSTRUCTION` when a `clear` construction already targets it → `INSUFFICIENT_GOLD` (`clearCost`) → `BUILDERS_BUSY` (`startConstruction` with `OBSTACLES[kind].timerMs`). On completion: remove from `islands.obstacles`, `food += reward.food`, `addXp(reward.xp)`.

- [ ] **Step 1: Write failing tests**

```ts
it('expands the home island in order with gates, costs and strip obstacles', () => {
  err(run(s, { type: 'expandIsland' }, 0), 'LEVEL_TOO_LOW')
  err(run({ ...s, level: 2, gold: 999 }, { type: 'expandIsland' }, 0), 'INSUFFICIENT_GOLD')
  const a = ok(run({ ...s, level: 2 }, { type: 'expandIsland' }, 0))
  expect([a.gold, a.islands.homeStep, islandSize(a, 'home')]).toEqual([0, 1, { w: 14, h: 12 }])
  expect(a.islands.obstacles.map(o => o.id)).toEqual(['home-s1-bush', 'home-s1-rock'])
  err(run({ ...a, level: 50, gold: 10_000_000, islands: { ...a.islands, homeStep: 12 } }, { type: 'expandIsland' }, 0), 'MAX_EXPANSION')
})
it('unlocks islands in order; Dawnspire needs a legendary', () => {
  err(run({ ...s, level: 11, gold: 40_000 }, { type: 'unlockIsland' }, 0), 'LEVEL_TOO_LOW')
  const a = ok(run({ ...s, level: 12, gold: 40_000 }, { type: 'unlockIsland' }, 0))
  expect([a.gold, a.islands.unlocked, a.islands.obstacles.length]).toEqual([0, ['home', 'isle2'], 30])
  expect(placementError(a, { island: 'isle2', col: a.islands.obstacles[0]!.col, row: a.islands.obstacles[0]!.row, facing: 0 }, 1)).toBe('OVERLAP')
  const five = { ...s, level: 45, gold: 3_000_000, islands: { homeStep: 0, unlocked: ['home', 'isle2', 'isle3', 'isle4', 'isle5'] as IslandId[], obstacles: [] } }
  err(run(five, { type: 'unlockIsland' }, 0), 'NO_LEGENDARY')
  const withLegend = withDragon(five, { id: 'd9', speciesId: 'wall', level: 1, habitatId: null })
  const b = ok(run(withLegend, { type: 'unlockIsland' }, 0))
  expect(b.islands.unlocked.at(-1)).toBe('dawnspire')
  err(run(b, { type: 'unlockIsland' }, 0), 'MAX_ISLAND')
  expect(maxHabitats(b.level, outerIslandsUnlocked(b))).toBe(2 + 9 + 15)
})
it('clears an obstacle for gold on a timer and pays XP and food on finish', () => {
  const a = ok(run({ ...s, level: 2, tutorial: { ...s.tutorial, buildsStarted: 2 } }, { type: 'expandIsland' }, 0))
  err(run({ ...a, gold: 99 }, { type: 'clearObstacle', obstacleId: 'home-s1-bush' }, 0), 'INSUFFICIENT_GOLD')
  const b = ok(run({ ...a, gold: 100 }, { type: 'clearObstacle', obstacleId: 'home-s1-bush' }, 0))
  expect([b.gold, b.constructions[0]]).toEqual([0, { kind: 'clear', obstacleId: 'home-s1-bush', readyAtMs: 60_000 }])
  err(run(b, { type: 'clearObstacle', obstacleId: 'home-s1-bush' }, 0), 'UNDER_CONSTRUCTION')
  const c = ok(run(b, { type: 'finishConstruction', index: 0 }, 60_000))
  expect([c.islands.obstacles.map(o => o.id), c.xp, c.food - b.food]).toEqual([['home-s1-rock'], 20, 10])
})
```

- [ ] **Step 2: Run** — expected: FAIL.
- [ ] **Step 3: Implement** and wire into `apply.ts` / `validate.ts` (`obstacleId` is a non-empty string).
- [ ] **Step 4: Run** `pnpm --filter @wyrmhaven/game-core test` — expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "feat(game-core): home expansion, outer islands and obstacle clearing"`

---

### Task 8: Store: construction skip, nest and Hoard placement, replay determinism

**Files:**
- Modify: `packages/game-core/src/store.ts`, `packages/game-core/src/actions/economy-actions.ts`, `validate.ts`
- Test: `packages/game-core/test/store.test.ts`, `economy-actions.test.ts`, `replay.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type StoreItem =
    | { kind: 'skip'; target: 'nest' | 'hatchery' | 'farm' | 'construction'; index: number }
    | { kind: 'nest'; placement: Placement }
    | { kind: 'hoard'; placement?: Placement }   // required and validated when hoardLevel === 0
    | ... unchanged
  ```
- `skip` with `target: 'construction'` prices `constructions[index].readyAtMs` with the same `SKIP_STEP_MS` formula and, in `applyItem`, calls `completeConstruction(s, index, catalog, nowMs)` after setting `readyAtMs = nowMs`.
- `nest`: `MAX_NESTS` → `placementError(placement, FOOTPRINT.nest)` (mapped to its error) → push `{ egg: null, level: 1, placement }`.
- `hoard` first purchase: `placement` missing → `INVALID_ACTION`; `WRONG_ISLAND` off home; `placementError`; sets `hoardPlacement`. Later levels ignore `placement`.
- `skipTargetReadyAt` for `nest` reads `.egg?.readyAtMs`.

- [ ] **Step 1: Write failing tests**

```ts
it('prices and applies a construction skip, which finishes the build', () => {
  const a = ok(run({ ...s, gold: 2_000, tutorial: { ...s.tutorial, buildsStarted: 2 } }, { type: 'startUpgrade', building: { type: 'habitat', id: 'h1' } }, 0))
  expect(priceMicroUsd({ kind: 'skip', target: 'construction', index: 0 }, a, 0)).toBe(100_000)         // 10 min → 1 started half hour
  expect(priceMicroUsd({ kind: 'skip', target: 'construction', index: 0 }, a, 600_000)).toBeNull()
  const r = run(a, { type: 'buy', item: { kind: 'skip', target: 'construction', index: 0 } }, 1_000)
  expect(r.ok && r.effects).toEqual([{ type: 'charge', microUsd: 100_000 }])
  expect([ok(r).habitats[0]!.level, ok(r).constructions]).toEqual([2, []])
})
it('a construction skip frees a builder', () => {
  const t = { ...s, gold: 50_000, level: 10, tutorial: { ...s.tutorial, buildsStarted: 2 } }
  const two = ok(run(ok(run(t, { type: 'startUpgrade', building: { type: 'habitat', id: 'h1' } }, 0)), { type: 'startUpgrade', building: { type: 'habitat', id: 'h2' } }, 0))
  err(run(two, { type: 'startUpgrade', building: { type: 'farm', index: 0 } }, 0), 'BUILDERS_BUSY')
  const freed = ok(run(two, { type: 'buy', item: { kind: 'skip', target: 'construction', index: 0 } }, 0))
  expect(ok(run(freed, { type: 'startUpgrade', building: { type: 'farm', index: 0 } }, 0)).constructions).toHaveLength(2)
})
it('a bought nest and the first Hoard are placed', () => {
  const a = ok(run(s, { type: 'buy', item: { kind: 'nest', placement: P(6, 8) } }, 0))
  expect(a.nests[1]).toEqual({ egg: null, level: 1, placement: P(6, 8) })
  err(run(s, { type: 'buy', item: { kind: 'nest', placement: P(0, 0) } }, 0), 'OVERLAP')
  err(run({ ...s, level: 5 }, { type: 'buy', item: { kind: 'hoard', placement: { island: 'isle2', col: 0, row: 0, facing: 0 } } }, 0), 'ISLAND_LOCKED')
  const h = ok(run({ ...s, level: 5 }, { type: 'buy', item: { kind: 'hoard', placement: P(7, 6) } }, 0))
  expect([h.hoardLevel, h.hoardPlacement]).toEqual([1, P(7, 6)])
  expect(ok(run(h, { type: 'buy', item: { kind: 'hoard' } }, 0)).hoardLevel).toBe(2)
  expect(isValidAction({ type: 'buy', item: { kind: 'nest' } })).toBe(false)
})
```
  Replay test: extend the existing determinism scenario in `replay.test.ts` with `placeBuilding`, `startUpgrade`, `expandIsland`, `clearObstacle`, `finishConstruction` and a construction skip; assert identical final state for two runs with the same seed.

- [ ] **Step 2: Run** — expected: FAIL.
- [ ] **Step 3: Implement**; the web `StorePanel` and `NestsPanel` compile breaks are fixed in Task 12.
- [ ] **Step 4: Run** `pnpm --filter @wyrmhaven/game-core test && pnpm --filter @wyrmhaven/game-core typecheck` — expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "feat(game-core): construction skips and placed store buildings"`

---

### Task 9: Legacy state layout, server migration and shared schemas

**Files:**
- Create: `packages/game-core/src/legacy-layout.ts`
- Modify: `apps/server/src/services/stateMigration.ts`, `packages/shared/src/actions.ts`
- Test: `packages/game-core/test/legacy-layout.test.ts`, `apps/server/test/actions.test.ts` (extend), `apps/server/test/review-fixes.test.ts` (migration case)

**Interfaces:**
- Produces:
  ```ts
  /** Adds island state and placements to a state saved before base building. Starting buildings take the spec layout; extra habitats, plots and nests take the first free spot scanning row-major; the home step rises (free) until everything fits. Current states come back unchanged. */
  export function layoutLegacyState(raw: Record<string, unknown>): PlayerState
  ```
- `migrateState` calls `layoutLegacyState` when `'islands' in out` is false. It also converts `nests: (Egg | null)[]` to `Nest[]` and adds `hatcheryLevel: 1`, `hoardPlacement` (placed at the first free 4×4 when `hoardLevel > 0`), `decorations: []`, `constructions: []`, `tutorial.buildsStarted: 2` (legacy players skip the tutorial timers), `level` on farms.
- zod: `placementSchema = z.object({ island: z.enum([...ISLAND_ORDER]), col: z.number().int().min(0).max(63), row: ..., facing: z.number().int().min(0).max(3) })`; schemas for `placeBuilding`, `moveBuilding`, `removeDecoration`, `startUpgrade`, `finishConstruction`, `expandIsland`, `unlockIsland`, `clearObstacle`; `storeItemSchema` gains `construction` skip target, `nest.placement`, `hoard.placement?`; remove `buildHabitat`, `upgradeHabitat`, `buyFarmPlot`.

- [ ] **Step 1: Write failing tests**

```ts
// legacy-layout.test.ts
it('lays out a Phase 6 state without islands', () => {
  const old = { ...newPlayer(0), nests: [null, { speciesId: 'fire', readyAtMs: 5 }], habitats: [...newPlayer(0).habitats, { id: 'h3', element: 'earth', level: 2, lastCollectedMs: 0 }], hoardLevel: 1 } as unknown as Record<string, unknown>
  delete old['islands']
  const s = layoutLegacyState(old)
  expect(s.islands.unlocked).toEqual(['home'])
  expect(s.nests.map(n => n.egg)).toEqual([null, { speciesId: 'fire', readyAtMs: 5 }])
  expect(s.hoardPlacement).not.toBeNull()
  for (const o of occupants(s, 'home')) expect(placementError({ ...s, habitats: [], farms: [], nests: [], decorations: [], hoardPlacement: null, hatcheryPlacement: { island: 'home', col: 60, row: 60, facing: 0 } }, { island: 'home', col: o.col, row: o.row, facing: 0 }, o.size)).not.toBe('OUT_OF_BOUNDS')
  const boxes = occupants(s, 'home'); boxes.forEach((a, i) => boxes.slice(i + 1).forEach(b => expect(overlaps(a, b)).toBe(false)))
  expect(layoutLegacyState(s as unknown as Record<string, unknown>)).toEqual(s)
})
// apps/server/test/actions.test.ts
it('runs placeBuilding and finishConstruction through /actions and charges a construction skip', ...)   // 3 requests: placeBuilding farm at (6,7) → 200 with constructions[0]; buy skip construction 0 → effects charge 100_000 and farms[2] present with no construction; finishConstruction 0 afterwards → 4xx NOT_FOUND
```

- [ ] **Step 2: Run** `pnpm --filter @wyrmhaven/game-core test -- legacy && pnpm --filter @wyrmhaven/server test -- actions` — expected: FAIL.
- [ ] **Step 3: Implement** `legacy-layout.ts`, the migration, the zod changes; update `apps/server/README.md` error list with the new codes.
- [ ] **Step 4: Run** `pnpm --filter @wyrmhaven/game-core test && pnpm --filter @wyrmhaven/shared typecheck && pnpm --filter @wyrmhaven/server test` — expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "feat(server): migrate saved states onto the grid; schemas for building actions"`

---

### Task 10: Web grid layout and island model

**Files:**
- Rewrite: `apps/web/src/game/layout.ts`, `apps/web/src/game/islandModel.ts`
- Modify: `apps/web/src/game/bridge.ts`
- Test: `apps/web/test/layout.test.ts`, `apps/web/test/island.test.ts` (rewrite)

**Interfaces:**
- Produces:
  ```ts
  // layout.ts
  export const BASE = { w: 480, h: 270 }   // viewport base; unchanged
  export const CELL = 16
  export function worldSize(w: number, h: number): { w: number; h: number }                  // cells × CELL
  export function anchor(col: number, row: number, size: number): Pos                        // bottom-centre: x = col·16 + size·8, y = (row + size)·16
  export function dragonSpot(a: Pos, slot: number): Pos                                      // 4 + 3 on the 5×5 platform top face, whole pixels, unique per slot
  export function pointerToCell(worldX: number, worldY: number): { col: number; row: number } // floor division
  export function integerZoom(viewportW, viewportH): number   // unchanged
  // bridge.ts
  export type Target = ... | { kind: 'hatcheryBuilding' } | { kind: 'decoration'; id: string } | { kind: 'obstacle'; id: string } | { kind: 'expandSign' } | { kind: 'cell'; col: number; row: number }
  export interface Placing { what: Placeable | { kind: 'move'; target: MovableRef } | { kind: 'nest' } | { kind: 'hoard' }; size: Footprint; col: number; row: number; facing: Facing }
  bridge.view: IslandId; bridge.placing: Placing | null; setView(id); setPlacing(p); event { type: 'cell'; col; row }
  // islandModel.ts
  export interface IslandObject { ...; flipX?: boolean; tint?: 'ok' | 'bad' | 'building' }
  export interface IslandMarkers { ...existing..., obstacles: string[]; decorations: string[]; constructions: number; ghost: { legal: boolean } | null; sign: { cost: number; minLevel: number } | null }
  export function buildIslandModel(state, art, catalog, nowMs, view: IslandId, placing: Placing | null): IslandModel
  ```
- Model rules: draw only objects whose `placement.island === view`; order by anchor `y`; facings 1 and 3 set `flipX`; unfinished buildings get `tint: 'building'` and a `timerLabel` badge; obstacles use `obstacle.<kind>`; the ghost uses the item's sprite with `tint` from `placementError(..., ignore)`; the home island shows `sign` at the next locked strip when `homeStep < 12`; `markers.ghost.legal` mirrors the tint.

- [ ] **Step 1: Write failing tests**

```ts
it('anchors a 5×5 at its bottom centre and keeps dragon spots unique', () => {
  expect(anchor(5, 0, 5)).toEqual({ x: 120, y: 80 })
  expect(pointerToCell(121, 79)).toEqual({ col: 7, row: 4 })
  const spots = [0, 1, 2, 3, 4, 5, 6].map(i => dragonSpot(anchor(0, 0, 5), i))
  expect(new Set(spots.map(p => `${p.x},${p.y}`)).size).toBe(7)
  for (const p of spots) expect(p.x >= 0 && p.x <= 80 && p.y <= 80).toBe(true)
})
it('draws the home view from placements, with a sign and no other islands', () => {
  const s = { ...newPlayer(0), islands: { homeStep: 0, unlocked: ['home', 'isle2'] as const, obstacles: outerObstacles('isle2') } }
  const home = buildIslandModel(s, FALLBACK_ART, C, 0, 'home', null)
  expect(home.objects.find(o => o.id === 'habitat:h2')).toMatchObject({ x: 120, y: 80, key: textureKey('habitat.water') })
  expect(home.markers.obstacles).toEqual([])
  expect(home.markers.sign).toEqual({ cost: 1_000, minLevel: 2 })
  const isle = buildIslandModel(s, FALLBACK_ART, C, 0, 'isle2', null)
  expect(isle.markers.habitats).toEqual([])
  expect(isle.markers.obstacles).toHaveLength(30)
})
it('shows a ghost with legality and flips mirrored facings', () => {
  const s = newPlayer(0)
  const bad = buildIslandModel(s, FALLBACK_ART, C, 0, 'home', { what: { kind: 'farm' }, size: 2, col: 0, row: 0, facing: 0 })
  expect(bad.markers.ghost).toEqual({ legal: false })
  const good = buildIslandModel(s, FALLBACK_ART, C, 0, 'home', { what: { kind: 'farm' }, size: 2, col: 6, row: 8, facing: 1 })
  expect(good.objects.find(o => o.id === 'ghost')).toMatchObject({ tint: 'ok', flipX: true })
})
it('badges constructions with their timer', () => {
  const s = { ...newPlayer(0), constructions: [{ kind: 'upgrade' as const, building: { type: 'habitat' as const, id: 'h1' }, readyAtMs: 90_000 }] }
  expect(buildIslandModel(s, FALLBACK_ART, C, 0, 'home', null).objects.find(o => o.id === 'habitat:h1')).toMatchObject({ badge: '2m', tint: 'building' })
})
```

- [ ] **Step 2: Run** `pnpm --filter @wyrmhaven/web test -- layout island` — expected: FAIL.
- [ ] **Step 3: Implement** the three files (art keys for obstacles/decorations fall back to empty sprites until Task 14 adds slots; use `art.obstacle?.[kind] ?? art.building.farmPlot` is **not** acceptable: add the optional slots to `GameArtSet` now with fallback sizes `obstacle 16/32/48`, `decoration 16/32/48`, `nexus 80×64`, `sign 32×32`, `locked 16×16`, `map 32×32` and fill the manifest in Task 14).
- [ ] **Step 4: Run** `pnpm --filter @wyrmhaven/web test -- layout island` — expected: PASS (other web tests may still fail to compile until Task 12).
- [ ] **Step 5: Commit** `git commit -m "feat(web): grid layout and island model with ghosts, obstacles and signs"`

---

### Task 11: Island scene camera, cell clicks and placement mode

**Files:**
- Rewrite: `apps/web/src/game/scenes/IslandScene.ts`
- Create: `apps/web/src/state/placing.ts`, `apps/web/src/panels/PlacementBar.tsx`
- Modify: `apps/web/src/App.tsx` (placing state, bar), `apps/web/src/game/config.ts` (world bounds)
- Test: `apps/web/test/placing.test.ts`, `apps/web/test/bridge.test.ts` (extend)

**Interfaces:**
- Produces:
  ```ts
  // state/placing.ts — pure reducer, no React
  export type PlacingEvent = { type: 'start'; what: Placing['what']; size: Footprint; island: IslandId } | { type: 'cell'; col: number; row: number } | { type: 'turn' } | { type: 'cancel' } | { type: 'confirm' }
  export function placingReducer(p: Placing | null, e: PlacingEvent): Placing | null
  /** The action to send on confirm, or null when the ghost is illegal. */
  export function placingAction(s: PlayerState, view: IslandId, p: Placing): ClientAction | null
  ```
  `placingAction` maps: `Placeable` → `placeBuilding`; `move` → `moveBuilding`; `nest` → `buy { kind: 'nest', placement }`; `hoard` → `buy { kind: 'hoard', placement }`. `turn` cycles `facing` `(f + 1) % 4`. A `start` for a move pre-fills the building's current cell and facing.
- Scene: camera bounds = `worldSize(islandSize(state, view))`; pointer drag pans (ignored when a drag started on a pointerdown that ended within 4 px, which counts as a click); mouse wheel steps zoom between `integerZoom` and `integerZoom + 2`; a faint grid of unlocked cells and darker `island.locked` tiles outside them on the home island; a click on empty ground emits `{ type: 'cell', col, row }`; while `bridge.placing` is set, pointer moves emit `cell` too (the reducer tracks the cursor). The scene re-syncs on `view` and `placing` changes. The bar shows Turn, Confirm (disabled when `markers.ghost.legal` is false) and Cancel.

- [ ] **Step 1: Write failing tests**

```ts
it('placing reducer tracks the cursor, turns and cancels', () => {
  const p = placingReducer(null, { type: 'start', what: { kind: 'farm' }, size: 2, island: 'home' })!
  expect(placingReducer(p, { type: 'cell', col: 6, row: 8 })).toMatchObject({ col: 6, row: 8 })
  expect(placingReducer(placingReducer(p, { type: 'turn' })!, { type: 'turn' })!.facing).toBe(2)
  expect(placingReducer(p, { type: 'cancel' })).toBeNull()
})
it('placingAction builds the right action and refuses illegal spots', () => {
  const s = newPlayer(0)
  expect(placingAction(s, 'home', { what: { kind: 'farm' }, size: 2, col: 6, row: 8, facing: 1 })).toEqual({ type: 'placeBuilding', building: { kind: 'farm' }, placement: { island: 'home', col: 6, row: 8, facing: 1 } })
  expect(placingAction(s, 'home', { what: { kind: 'farm' }, size: 2, col: 0, row: 0, facing: 0 })).toBeNull()
  expect(placingAction(s, 'home', { what: { kind: 'move', target: { type: 'habitat', id: 'h1' } }, size: 5, col: 1, row: 0, facing: 0 })).toEqual({ type: 'moveBuilding', target: { type: 'habitat', id: 'h1' }, placement: { island: 'home', col: 1, row: 0, facing: 0 } })
  expect(placingAction(s, 'home', { what: { kind: 'nest' }, size: 2, col: 6, row: 8, facing: 0 })).toEqual({ type: 'buy', item: { kind: 'nest', placement: { island: 'home', col: 6, row: 8, facing: 0 } } })
})
```
  Scene tests (headless Phaser, as `bridge.test.ts` does today): after `setView('isle2')` on an unlocked state the camera bounds are 256×256; a `select` on a cell emits `cell`.

- [ ] **Step 2: Run** — expected: FAIL.
- [ ] **Step 3: Implement** the reducer, the bar, the scene and the App wiring (`run(placingAction(...))` on confirm, then `cancel`).
- [ ] **Step 4: Run** `pnpm --filter @wyrmhaven/web test -- placing bridge` — expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "feat(web): scrolling grid island with placement mode"`

---

### Task 12: Build shop, upgrade section and panel updates

**Files:**
- Create: `apps/web/src/panels/BuildShopPanel.tsx`, `apps/web/src/panels/UpgradeSection.tsx`
- Modify: `apps/web/src/panels/HabitatPanel.tsx`, `NestsPanel.tsx`, `FarmPanel.tsx`, `StorePanel.tsx`, `PanelHost.tsx`, `apps/web/src/App.tsx` (toolbar "Build" button), `apps/web/src/api/errors.ts`
- Test: `apps/web/test/panels.test.tsx` (extend), `apps/web/test/build-shop.test.tsx`

**Interfaces:**
- `UpgradeSection({ building: BuildingRef, nowMs })`: shows `Level n`; if `constructionFor` exists → timer + `Skip · $x` (`buy skip construction index`) + auto-sends `finishConstruction` once ready (one attempt per readyAtMs, via `useEffect`); else if `upgradeInfo` → `Upgrade to n+1 · cost · timer` with reasons `Needs player level L` / `Not enough gold` / `Both builders are busy`; else `Max level`. Also `Move` (starts placing `{ kind: 'move', target }`) and `Turn` (sends `moveBuilding` with facing + 1).
- `BuildShopPanel({ onPlace })`: five sections (Habitats, Farming, Breeding, Hoard, Decorations) from spec §8 with `data-testid="shop-<category>"`; each card calls `onPlace(what, size)`; locked cards disabled with `Level N`; habitat cards disabled at the limit with `Reach level N for another habitat` where N is the next multiple of 5 above the player's level; Dawnspire decorations shown only when `view === 'dawnspire'`.
- `HabitatPanel` drops its build fieldset (shop owns it) and uses `UpgradeSection`; `NestsPanel`/`FarmPanel` read the new shapes and add `UpgradeSection` per nest/plot and one for the hatchery; `StorePanel` nest and Hoard rows start placing instead of buying directly; `PanelHost` maps the new targets (`hatcheryBuilding` → Nests panel, `decoration` → a small panel with Move/Turn/Remove).
- `errors.ts` copy: `OUT_OF_BOUNDS: 'That spot is off the island.'`, `OVERLAP: 'Something is already there.'`, `BUILDERS_BUSY: 'Both builders are busy. Finish or skip a build first.'`, `ISLAND_LOCKED: 'Unlock that island first.'`, `MAX_ISLAND: 'Every island is unlocked.'`, `WRONG_ISLAND: 'That can only go on its own island.'`, `UNDER_CONSTRUCTION: 'That building is still being built.'`, `NO_LEGENDARY: 'Own a legendary dragon to unlock Dawnspire.'`, `NEXUS_EXISTS: 'You already have the Nexus habitat.'`, `MAX_EXPANSION: 'The home island is at its full size.'`.

- [ ] **Step 1: Write failing tests** (render with the test API provider used in `panels.test.tsx`)

```ts
it('build shop lists categories, locks by level and starts placement', async () => {
  const onPlace = vi.fn()
  render(<BuildShopPanel onPlace={onPlace} view="home" />, { wrapper: wrapperWithState({ ...newPlayer(0), level: 3 }) })
  for (const c of ['habitats', 'farming', 'breeding', 'hoard', 'decorations']) expect(screen.getByTestId(`shop-${c}`)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Hay cart/ })).toBeDisabled()
  expect(screen.getByRole('button', { name: /fire habitat/i })).toBeDisabled()   // limit 2 at level 3
  await user.click(screen.getByRole('button', { name: /Flower patch/ }))
  expect(onPlace).toHaveBeenCalledWith({ kind: 'decoration', decoration: 'flowerPatch' }, 1)
})
it('upgrade section shows the next level, then the timer and skip, then auto-finishes', async () => {
  const run = vi.fn().mockResolvedValue(null)
  render(<UpgradeSection building={{ type: 'habitat', id: 'h1' }} nowMs={0} />, { wrapper: wrapperWithState({ ...newPlayer(0), gold: 5_000 }, run) })
  expect(screen.getByRole('button', { name: /Upgrade to 2 · 1,000 gold · 10m/ })).toBeEnabled()
  rerender with constructions: [{ kind: 'upgrade', building: { type: 'habitat', id: 'h1' }, readyAtMs: 600_000 }], nowMs 0
  expect(screen.getByRole('button', { name: /Skip · \$0\.10/ })).toBeInTheDocument()
  rerender with nowMs 600_000
  await waitFor(() => expect(run).toHaveBeenCalledWith({ type: 'finishConstruction', index: 0 }))
})
```

- [ ] **Step 2: Run** — expected: FAIL.
- [ ] **Step 3: Implement** the panels and copy; delete the old build fieldset test cases.
- [ ] **Step 4: Run** `pnpm --filter @wyrmhaven/web test && pnpm -r typecheck` — expected: PASS (whole tree compiles again).
- [ ] **Step 5: Commit** `git commit -m "feat(web): build shop, upgrade timers and skips in panels"`

---

### Task 13: Island map, expansion sign and obstacle panel

**Files:**
- Create: `apps/web/src/panels/IslandMapPanel.tsx`, `apps/web/src/panels/ObstaclePanel.tsx`
- Modify: `apps/web/src/panels/PanelHost.tsx`, `apps/web/src/App.tsx` (toolbar "Map" button, `view` state → `bridge.setView`)
- Test: `apps/web/test/islands.test.tsx`

**Interfaces:**
- `IslandMapPanel({ view, onView })`: one row per `ISLAND_ORDER` entry: unlocked → `Go` button (`onView(id)`); the next locked → `Unlock · cost gold` with reasons `Needs player level N` / `Not enough gold` / `Own a legendary dragon first`, sending `unlockIsland`; later ones `Locked · level N`.
- `ObstaclePanel({ obstacleId, nowMs })`: kind, `Clear · cost gold · timer`, rewards `+xp XP, +food food`, sends `clearObstacle`; when a `clear` construction exists, shows the timer, `Skip`, and auto-finishes like `UpgradeSection` (reuse a shared `useAutoFinish(constructionIndex)` hook extracted from Task 12).
- Expansion sign target (`expandSign`): a panel with `Expand to w×h · cost gold` and the level reason, sending `expandIsland`.

- [ ] **Step 1: Write failing tests**

```ts
it('map unlocks the next island in order and switches view', async () => {
  const onView = vi.fn(); const run = vi.fn().mockResolvedValue(null)
  render(<IslandMapPanel view="home" onView={onView} />, { wrapper: wrapperWithState({ ...newPlayer(0), level: 12, gold: 40_000 }, run) })
  await user.click(screen.getByRole('button', { name: /Unlock · 40,000 gold/ }))
  expect(run).toHaveBeenCalledWith({ type: 'unlockIsland' })
  expect(screen.getByText(/Locked · level 20/)).toBeInTheDocument()
})
it('obstacle panel clears for gold and shows rewards', async () => {
  const s = { ...newPlayer(0), gold: 1_000, islands: { homeStep: 1, unlocked: ['home'], obstacles: homeStripObstacles(1) } }
  render(<ObstaclePanel obstacleId="home-s1-rock" nowMs={0} />, { wrapper: wrapperWithState(s, run) })
  expect(screen.getByText(/\+40 XP/)).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: /Clear · 250 gold · 5m/ }))
  expect(run).toHaveBeenCalledWith({ type: 'clearObstacle', obstacleId: 'home-s1-rock' })
})
```

- [ ] **Step 2: Run** — expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `pnpm --filter @wyrmhaven/web test` — expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "feat(web): island map, expansion sign and obstacle clearing"`

---

### Task 14: Art slots, e2e flow and docs

**Files:**
- Modify: `apps/web/src/art/types.ts`, `apps/web/src/art/fromManifest.ts`, `apps/web/src/art/fallback.ts`, `apps/web/public/art/v1/manifest.json` (keys only where files exist)
- Create: `apps/web/e2e/build.spec.ts`, `docs/art/base-building-art-list.md`
- Modify: `apps/web/README.md` (gap list), `docs/superpowers/specs/2026-10-28-wyrmhaven-design.md` (one line under §7 pointing at the base-building spec; coordinate with the rename thread before staging this file)
- Test: `apps/web/test/art.test.ts` (extend), the e2e spec

**Interfaces:**
- `GameArtSet` gains `building.nexus: Sprite`, `decoration: Record<DecorationId, Sprite>`, `obstacle: Record<ObstacleKind, Sprite>`, `island.locked: Sprite`, `island.sign: Sprite`, `map: Record<IslandId, Sprite>`; `SLOT_SIZES.habitat` becomes `{ w: 80, h: 64 }`; manifest keys `building.nexus`, `decoration.<id>`, `obstacle.<kind>`, `island.locked`, `island.sign`, `map.<island>`.
- Fallbacks draw coloured boxes sized by footprint so the game is playable before PixelLab art lands.
- `docs/art/base-building-art-list.md`: the ~60 generations with key, size and a one-line description each (9 habitats re-cut at 80×64, nexus, hatchery 64×64, Hoard 64×64, nest 32×32, farm plot 32×32, 15 decorations, 5 obstacles, locked tile, sign, 6 map icons), for the art thread to generate with PixelLab.
- e2e `build.spec.ts` (test wallet, playtest mode): open Build → place a farm plot at a free cell → see the construction badge → skip it through the store charge path → upgrade `h1` → move `h1` one cell right → turn it → open Map and confirm `isle2` shows `Locked`.

- [ ] **Step 1: Write failing tests**: `art.test.ts` asserts the new keys resolve from a manifest and fall back to the footprint sizes; the e2e spec as above.
- [ ] **Step 2: Run** `pnpm --filter @wyrmhaven/web test -- art` — expected: FAIL.
- [ ] **Step 3: Implement** slots, fallbacks, docs, e2e.
- [ ] **Step 4: Run** `pnpm --filter @wyrmhaven/web test && pnpm -r typecheck && pnpm --filter @wyrmhaven/web e2e` (or the repo's e2e script) — expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "feat(web): art slots for base building, e2e build flow, art list"`

---

## Self-review notes

- Spec coverage: §2 grid/footprints/start (Tasks 1, 2, 10), §3 expansion (7), §4 islands/Nexus/habitat limit (4, 5, 7), §5 obstacles (3, 7), §6 construction/tutorial/finish (4, 6, 8), §7 tables (4, 6), decorations (4, 5), §8 shop (12), §9 speed-ups (8, 12, 13), §10 economy (asserted by tests on refund eligibility and no gold rewards), §11 state/actions/migration/web/art (1, 9, 10–14), §13 tests (every task).
- Out of scope: PixelLab generation itself (art thread), Phase 7 launch work.
