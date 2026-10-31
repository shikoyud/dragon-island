# M4 Island Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 12×12 home island and its expansion steps with GDD §5.5–5.6: six named islands of 4×4 plots, Bridges, full-size footprints, the §5.6 obstacle table with drops and speed-up tokens, and a scrollable, zoomable map.

**Architecture:** `packages/game-core` holds the land rules: `data/islands.ts` has the §5.5 tables, `plots.ts` the plot geometry, and `placementError` checks that every covered tile is on an owned plot. `data/obstacles.ts` holds §5.6, and purchase handlers spawn obstacles through the action's `Rng`. The web client keeps `IslandScene` for one island at a time and adds a `MapScene` for all six, sharing pan and zoom through one extracted controller.

**Tech Stack:** TypeScript, Vitest, Fastify + Drizzle (PGlite in dev), React + Phaser, Playwright, pnpm workspace. Tests and the game run on shiko's PC.

**Spec:** `docs/dragon-island-gdd.md` (§ references below), with `docs/superpowers/specs/2026-10-30-gdd-rulings.md` (A# answers, R# rulings) and the roadmap `docs/superpowers/plans/2026-10-30-gdd-roadmap.md`.

## Questions for shiko (answered 2026-10-31)

shiko approved the plan with no changes, so the recommended options stand: Q1 (a) and Q2 (a). Recorded in the rulings file; the options stay below as the record. Everything else the GDD leaves open is ruled in the table at the end.

**Q1. Does clearing obstacles use the same two slots as building?** §5.6 says "A player can clear 2 at once". The GDD has no builder limit, but since M1 the game has allowed 2 constructions at once, builds and clears together (`MAX_BUILDERS`). On Flash-14 an Ancient Tree takes 40 minutes, so two big clears would stop all building for that long.
- (a) **Recommended.** Separate limits: 2 clears at once, and 2 builds or upgrades at once. Matches §5.6's wording and never blocks a build, while keeping today's build limit.
- (b) One shared pool of 2, as today. Simplest, and makes clears a real choice against building, but a player can be stuck behind trees.
- (c) 2 clears at once, with no limit on builds. The closest reading of the GDD, since it never limits builds. It removes a pacing tool the M1–M3 numbers were played with, and §7.4's speed-ups on builds lose value.

**Q2. Is a "3 h speed-up token" 3 real hours, or 3 classic hours?** §5's header says its values are classic and Flash-14 divides build timers by 6, so an Ancient Tree's 4 h clear is 40 minutes. §8.5 values "10 x 8 h speed-ups" in USDe at §3.6's price for real remaining hours, about $0.41 each.
- (a) **Recommended.** Real hours: the token takes 3 h off any running timer. Matches §3.6 and §8.5's pricing. On Flash-14 a 15-minute token finishes most early builds outright, and token drops replace some $DRIS skip spending (§7.7 counts on speed-ups in its burn).
- (b) Scaled by the preset: on Flash-14 a 3 h token takes 30 minutes off. Each token keeps the same share of a timer as in classic and protects burn, but it conflicts with the Pass's value in §8.5, and the label would say `30 min`.

## Global Constraints

- `packages/game-core` is pure: no I/O, no `Date.now()`, no `Math.random()`; `nowMs`, `Rng`, `catalog`, `preset` and `day` are parameters (CLAUDE.md).
- Gold, Food, XP and USD amounts are integers (USD in micro-dollars).
- Every GDD number lives in `packages/game-core/src/data/`; game logic never holds a literal from the GDD. Each data file names its GDD section in a header comment. Every task cites its GDD section.
- `data/unlocks.ts` stays the only table of Player Level gates (M3).
- Flash-14 is the default preset (A2); Flash-28 is a second preset object, never a code path (§7.2).
- Original art and names only (CLAUDE.md). Island names are the GDD's.
- Conventional commits, one commit per task, TDD: failing test first, and run it.
- Mobile-first portrait layout; every tap target at least 44 px.
- No save migration: `STATE_VERSION` bumps on each shape change on this branch, starting from 7, so a stale local save resets (R2).
- Do not touch `contracts/`. Do not start PixelLab generation; Task 9 only writes the list. Run e2e through a temporary `channel: 'chrome'` config unless Playwright's browser has been installed; don't commit that config.

## Review Focus

1. Land that isn't a rectangle: a building straddling two owned plots is legal; one tile over an unowned plot is refused, by the server and by the ghost alike, including in an L-shaped holding with a notch (§5.5). Pinned in Task 2.
2. Replays and repeats: buying the same plot or Bridge twice, or replaying one `actionId`, charges once, spawns once and leaves ids unique (§5.5, §5.6). Pinned in Tasks 2 and 3.
3. An obstacle's XP and drop pay exactly once, whether its clear finishes on time, by `$DRIS` skip or by token; a token can't go below 0 or be spent on a timer that isn't running (§5.6). Pinned in Tasks 3 and 4.
4. Room: a fresh player places every §4.4 unlock through PL 12 with no moves, and needs no plot or clear through PL 5. Across seeds, a plot's random obstacles never make this impossible. Pinned in Task 5.
5. Scale: an island is 1,024 tiles, a Shop row probes every cell, and the Map shows 96 plots. A fully owned island must not cost a frame hitch on a throttled CPU, and Shop must not recompute on every clock tick. Pinned in Task 6, measured in Task 10.

---

## File structure (end state of this plan)

```
packages/game-core/src/
  data/islands.ts         §5.5 ISLANDS: name, gate key, bridgeGold, plotPrices, obstacleMult; plot and island sizes
  data/island-start.ts    §5.5, §5.6 the fixed starting layout: buildings and obstacles
  data/obstacles.ts       §5.6 OBSTACLES table, spawn weights, MAX_CLEARS
  data/speedups.ts        + SPEED_UP_TOKENS durations
  data/unlocks.ts         home:n at §5.5's values
  plots.ts                plotOfTile, plotOrigin, ownedPlots, ownsTile, canBuyPlot, nextPlotPrice
  obstacles.ts            clearCost, spawnPlotObstacles, rollDrop
  island.ts               FOOTPRINT at GDD sizes; placementError on owned land; no homeStep
  actions/island-unlock-actions.ts   buyPlot, buyBridge, clearObstacle
  actions/economy-actions.ts         + useSpeedUp
  state.ts                islands.plots, speedUps; no homeStep
apps/web/src/
  game/panZoom.ts         pan, pinch and wheel controller shared by both scenes
  game/mapModel.ts        pure model of the Map: islands, plots, Bridges, labels
  game/scenes/MapScene.ts
  game/scenes/IslandScene.ts   ground baked per island and holding
  game/islandModel.ts     plot signs, art scales from sprite width, no BREEDER/ROOST_ART_SCALE
  game/camera.ts          bounds on 32×32; opening view on owned land
  panels/PlotPanel.tsx    buy a plot (replaces ExpandSignPanel)
  panels/MapIslandPanel.tsx  one island: gate, Bridge, plots, Go (replaces IslandMapPanel)
  panels/ObstaclePanel.tsx  cost, timer, XP, drop chance, tokens
  panels/SpeedUpButton.tsx  use a token on a running timer
docs/art/gdd-m4-art-list.md
docs/superpowers/reports/2026-10-31-m4-report.md
```

---

### Task 1: §5.5 tables and plot geometry (§5.5, R42, R43, R45, R46, R49)

**Files:**
- Create: `packages/game-core/src/data/islands.ts`, `src/plots.ts`, `test/plots.test.ts`
- Modify: `src/data/unlocks.ts`, `src/state.ts` (`IslandId`), `src/decorations.ts`, `src/index.ts`, `apps/web/src/art/*` (`map.dawnspire` read as `map.isle6`), tests naming `dawnspire`

**Interfaces:**
- Produces:
```ts
export type IslandId = 'home' | 'isle2' | 'isle3' | 'isle4' | 'isle5' | 'isle6'
export const PLOTS_PER_SIDE = 4; export const TILES_PER_PLOT = 8; export const ISLAND_TILES = 32
export const STARTING_PLOTS: readonly number[]   // the centre 2×2: [5, 6, 9, 10]
export const ISLANDS: Record<IslandId, { name: string; bridgeGold: number | null; plotPrices: readonly number[]; obstacleMult: number }>
export function plotOfTile(col: number, row: number): number | null   // index = plotRow × 4 + plotCol; null off the island
export function plotOrigin(plot: number): { col: number; row: number }
export function plotsTouch(a: number, b: number): boolean              // share an edge
export function plotPrice(island: IslandId, bought: number): number | null  // the nth purchase; null past the list
```
- Additive except the rename: `dawnspire` becomes `isle6`. `OUTER_ISLANDS`, `HOME_EXPANSION` and `homeStep` stay until Task 2. Unlock keys stay `home:0`..`home:11`; tests pinning the old gates re-pin.

- [ ] **Step 1: Write the failing tests.** Names: Home Isle, Ember Reach, Frostspire, Ironhold, Shadowmere, Warlord's Crown. `ISLANDS.home.plotPrices` equals §5.5's 12 values (100, 500, 1,500, 5,000, 8,000, 12,000, 18,000, 25,000, 35,000, 45,000, 60,000, 75,000), and the same for Islands 2, 4, 5 and 6's literal lists; Island 3 is 450,000 rising by 50,000 for 12 values to 1,000,000. Every list has 12 entries and rises. `bridgeGold` is null, 150,000, 750,000, 5M, 25M, 100M. `obstacleMult` is 1, 3, 10, 40, 150, 500. Sums with Bridge: 285,100; 3,020,000 (R49); 9,450,000; 77M; 491M; 2.15B. `plotOfTile(8, 8) === 5`, `(7, 8) === 4`, `(31, 31) === 15`, `(32, 0) === null`, `(-1, 0) === null`. `plotOrigin(5)` is `(8, 8)`. `plotsTouch(5, 6)` and `(5, 9)` true; `(5, 10)` false (corner, R44); `(3, 4)` false (row wrap). `unlockPl('home:0') === 2`, `home:1` 2, `home:2` 3, stepping by one to `home:11` 12 (R46); `island:isle6` 40.
- [ ] **Step 2: Run** `pnpm --filter @wyrmhaven/game-core test -- plots` — expected: FAIL.
- [ ] **Step 3: Implement.** `HOME_PL` becomes `[2, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]`. Rename the id across packages. Decorations keep their PL 45 gate on `isle6` (R59).
- [ ] **Step 4: Run** `pnpm -r typecheck` and every package's tests — expected: PASS.
- [ ] **Step 5: Commit** — `feat(game-core): §5.5 island tables and plot geometry`

---

### Task 2: Land replaces home steps (§5.4 footprints, §5.5, R43–R48, R50, R57)

The core change, so it carries what the game needs to stay playable: buying plots and Bridges in the UI, and fog on land not owned. Old-size art is drawn scaled until Task 6.

**Files:**
- Create: `packages/game-core/src/data/island-start.ts`, `apps/web/src/panels/PlotPanel.tsx`, `apps/web/src/panels/MapIslandPanel.tsx`, `test/land.test.ts`, `apps/web/test/plots.test.tsx`
- Modify: `src/state.ts` (`STATE_VERSION` 8), `src/island.ts`, `src/placement-rules.ts`, `src/plots.ts`, `src/data/breeding-buildings.ts`, `src/data/roost.ts`, `src/actions/types.ts`, `actions/validate.ts`, `actions/apply.ts`, `actions/island-unlock-actions.ts`, `packages/shared/src/actions.ts`, `apps/web/src/game/camera.ts`, `game/islandModel.ts`, `game/scenes/IslandScene.ts`, `game/bridge.ts`, `state/placing.ts`, `panels/PanelHost.tsx`, `panels/ShopPanel.tsx`, `hud/hudModel.ts`, `api/errors.ts`, and tests with placement literals (about 42 files: use a shared free-cell helper rather than new literals)
- Delete: `src/data/island-layouts.ts`, `apps/web/src/panels/ExpandSignPanel.tsx`, `apps/web/src/panels/IslandMapPanel.tsx`

**Interfaces:**
- Consumes: Task 1.
- Produces:
```ts
// state.ts
islands: { unlocked: IslandId[]; plots: Partial<Record<IslandId, number[]>>; obstacles: Obstacle[] }
// plots.ts
export function ownedPlots(s: PlayerState, island: IslandId): readonly number[]
export function ownsFootprint(s: PlayerState, p: Placement, size: Footprint): boolean
export function plotsBought(s: PlayerState, island: IslandId): number   // owned − 4
export type PlotError = 'ISLAND_LOCKED' | 'PLOT_OWNED' | 'PLOT_NOT_ADJACENT' | 'LEVEL_TOO_LOW' | 'MAX_PLOTS'
export function plotError(s: PlayerState, island: IslandId, plot: number): PlotError | null  // Gold left to the handler
// island.ts
export const FOOTPRINT = { habitat: 4, hatchery: 4, farm: 3, breeder: 5, roost: 4 } as const
export type PlacementError = 'ISLAND_LOCKED' | 'OUT_OF_BOUNDS' | 'NOT_OWNED' | 'OVERLAP'
// actions
| { type: 'buyPlot'; island: IslandId; plot: number }
| { type: 'buyBridge'; island: Exclude<IslandId, 'home'> }
```
- Removes: `expandIsland`, `unlockIsland`, `homeStep`, `homeSize`, `islandSize`'s step logic, `HOME_EXPANSION`, `HOME_MAX_STEP`, `OUTER_ISLANDS`, `OUTER_SIZE`, `NO_LEGENDARY`, `MAX_EXPANSION`, `MAX_ISLAND`, `outerIslandsUnlocked` if unused.
- Starting layout, each `(col, row)`: Terra habitat (8, 8), Flame habitat (12, 8), Hatchery (16, 8), Farm (20, 8), Mountain (8, 12). Obstacles start here, on §5.6's new kinds, in Task 3; until then this task leaves `obstacles: []` and Task 3 adds the table's rows.

- [ ] **Step 1: Write the failing tests.**
  - `newPlayer(0).islands.plots.home` equals `[5, 6, 9, 10]`; buildings at the positions above; none overlap; all stand on owned land.
  - Footprints: `FOOTPRINT` equals `{ habitat: 4, hatchery: 4, farm: 3, breeder: 5, roost: 4 }`. Decoration sizes unchanged.
  - Placement: a habitat at `(20, 12)` is legal once obstacles allow; at `(21, 12)` it covers column 24, an unowned plot: `NOT_OWNED`. At `(-1, 8)` or `(29, 8)`: `OUT_OF_BOUNDS`. After buying plot 7, `(21, 12)`, which straddles plots 6 and 7, is legal. L-shape: owning 5, 6, 9, 10, 7 and not 11, a 5×5 at `(22, 15)` is refused (`NOT_OWNED`) and the same result comes from the client's `placingAction`, which returns null.
  - `buyPlot`: at PL 2 plot 4 costs 100, pays `buildXp(100)`, and adds plot 4. Then plot 8 costs 500 (touches 4 and 9). A third at PL 2 is `LEVEL_TOO_LOW` with nothing charged. Plot 0 before plot 1 or 4 is `PLOT_NOT_ADJACENT`. An owned plot is `PLOT_OWNED`. Too little Gold is `INSUFFICIENT_GOLD`, nothing changed. Plot 16, plot -1 and plot 1.5 are `INVALID_ACTION`. Price reads the count, not the position: plot 7 bought first costs 100 as well.
  - `buyBridge('isle2')` at PL 11: `LEVEL_TOO_LOW`. At PL 12 with 150,000 Gold: unlocked, plots `[5, 6, 9, 10]`, build XP paid, and its first plot costs 100,000. `buyBridge('isle3')` before `isle2` at PL 18: `ISLAND_LOCKED`. Again on an owned Bridge: `PLOT_OWNED`. A Legendary isn't needed for `isle6` (R42).
  - A plot on a locked island: `ISLAND_LOCKED`. Plots on Island 2 have no PL gate beyond the Bridge (R47).
  - Shared schema accepts both actions and refuses `plot: 16`, `island: 'atlantis'`, `buyBridge` on `home`.
  - Server, on the real path: replaying a `buyPlot` `actionId` charges once.
  - Web: `lockedTiles` lists every tile not on an owned plot. `groundCell` returns tiles anywhere on 32×32, so a red ghost can go over fog. Each unowned plot touching owned land yields one sign, target `{ kind: 'plot', island, plot }`, at the plot's centre. `PlotPanel` shows `Buy plot · 100 gold`, disabled with `Needs player level 3`, then `Not enough gold`, in the handler's order. `MapIslandPanel` shows name, `Level 12`, `Bridge · 150,000 gold`, and `Go` when unlocked. `messageFor` has copy for `NOT_OWNED`, `PLOT_OWNED`, `PLOT_NOT_ADJACENT`. The level-up list shows `Home Isle plot` for `home:n` keys (once at PL 2) and `Bridge to Ember Reach` for island keys, with no raw keys.
- [ ] **Step 2: Run** `pnpm --filter @wyrmhaven/game-core test -- land` — expected: FAIL.
- [ ] **Step 3: Implement.** `placementError`: `ISLAND_LOCKED`, then `OUT_OF_BOUNDS` against `ISLAND_TILES`, then `NOT_OWNED`, then `OVERLAP`. `buyPlot` checks in the order the panel shows. A plot's gate is `home:${plotsBought}` on Home only. `shownSize` is always 32×32. The old sign target goes away. `HABITAT_ART_SCALE` is not added: habitats and farms draw at `footprint width ÷ sprite.w` (R61), so new art needs no code change. `MapIslandPanel` runs from the `map` panel as a plain list until Task 8. In `IslandScene.drawGround`, the ground key becomes `view:owned plots`.
- [ ] **Step 4: Run** `pnpm -r typecheck` and every package's tests, one at a time — expected: PASS. Run e2e via the temporary config; re-aim `build.spec.ts` and `island.spec.ts` cells at the new land.
- [ ] **Step 5: Commit** — `feat: plot grid replaces home steps, with GDD footprints (§5.4, §5.5)`

---

### Task 3: The §5.6 obstacle table (§5.6, §7.2, R48, R50–R54)

**Files:**
- Create: `packages/game-core/src/data/obstacles.ts`, `test/obstacle-spawn.test.ts`
- Modify: `src/obstacles.ts`, `src/state.ts` (`ObstacleKind`, `speedUps`, `STATE_VERSION` 9), `src/data/island-start.ts`, `src/construction.ts`, `src/actions/island-unlock-actions.ts`, `src/actions/build-actions.ts` (`completeConstruction` gains `rng`), `src/actions/economy-actions.ts` (the skip passes it), `test/obstacles.test.ts`, `apps/web/src/panels/ObstaclePanel.tsx`, `hud/hudModel.ts`, `art/types.ts`, `art/fromManifest.ts`, `art/fallback.ts`

**Interfaces:**
- Consumes: Task 2's `buyPlot`, `buyBridge`.
- Produces:
```ts
export type ObstacleKind = 'ancientTree' | 'boulder' | 'largeRock' | 'tree' | 'smallRock' | 'bush'
export const OBSTACLES: Record<ObstacleKind, { size: Footprint; gold: number; classicMs: number; xp: number; drop: ObstacleDrop | null }>
export type ObstacleDrop =
  | { percent: number; token: SpeedUpToken } | { percent: number; gold: [number, number] } | { percent: number; food: [number, number] }
export const OBSTACLE_SPAWN: { min: 2; max: 4; weights: Record<ObstacleKind, number> }
export const MAX_CLEARS = 2  // §5.6; see Q1
export type SpeedUpToken = '15m' | '1h' | '3h'
export function clearCost(o: Obstacle): number                 // gold × island mult
export function clearTimerMs(kind: ObstacleKind, preset: Preset): number
export function spawnPlotObstacles(island: IslandId, plot: number, firstId: number, rng: Rng): Obstacle[]
export function rollDrop(kind: ObstacleKind, rng: Rng): { gold?: number; food?: number; token?: SpeedUpToken }
// state: speedUps: Record<SpeedUpToken, number>, starts all 0
```
- Starting obstacles (R50), `(col, row)`: Ancient Tree (20, 20); Boulder (8, 20); Large Rock (20, 16); Tree (13, 21), (17, 20), (8, 18); Small Rock (15, 22), (10, 18), (18, 22); Bush (23, 9), (23, 11), (21, 11), (12, 18), (12, 21), (14, 20), (16, 21), (13, 23), (17, 23), (19, 20), (23, 16), (20, 19). I checked these with a script: no overlaps, no clash with buildings, 77 of 256 tiles, 30.1 %.
- Spawn (R51): count is `rng` 2..4. Each obstacle takes a different quadrant of the plot, at a random offset inside it, so it always fits. Ids `o${nextId}` from `nextId`.

- [ ] **Step 1: Write the failing tests.**
  - Table, literal: Ancient Tree and Boulder 4×4, 25,000 Gold, 4 h, 1,250 XP, 10 %: 3 h token. Large Rock 3×3, 5,000, 1 h, 250, 5 %: 1 h token. Tree 2×2, 1,000, 15 min, 50, 5 %: 15 min token. Small Rock 2×2, 500, 5 min, 25, 10 %: 100–300 Gold. Bush 1×1, 100, 30 s, 5, 10 %: 10–25 Food.
  - Cost: a Bush on Island 6 costs 50,000; an Ancient Tree on Island 2 costs 75,000. XP does not scale with the island: a Bush on Island 6 pays 5 × `xpMult` (R52).
  - Timers: `clearTimerMs('ancientTree', FLASH_14)` is 40 minutes, Flash-28 is 60 minutes, Bush 5 s under Flash-14 (R53).
  - Starting layout: tiles covered between 25 % and 35 % of the starting plots, no overlaps with buildings; a `newPlayer` has exactly these rows.
  - Spawn: over seeds 1..200, 2–4 obstacles a plot, each inside its plot, none overlapping; ids unique across plots; same seed, same result. `buyBridge` spawns on all 4 plots (R48).
  - Replay: same seed and action gives the same obstacles.
  - Limits, per Q1 (a): 2 clears run at once; a third is `CLEARS_BUSY`, nothing charged; a build can still start with 2 clears running; a third build is `BUILDERS_BUSY`. A clear already running: `UNDER_CONSTRUCTION`. Too little Gold: nothing changes.
  - Completion: XP and the obstacle's removal happen once, by `finishConstruction` and by a `$DRIS` skip. Drop: find a seed for each outcome and pin each: a token adds 1 to `speedUps`, Gold in 100..300, Food in 10..25, and no drop leaves all three unchanged. Rates over 10,000 rolls within 1 percentage point of §5.6.
  - Goal stats and XP limit unaffected: XP above the day's limit banks (R40).
  - Web: `ObstaclePanel` shows `Clear · 25,000 gold · 40m`, `+15,000 XP`, and `10 % chance: 3 h speed-up`; with 2 clears running it says `Two clears are running`, and a build's reason says nothing about clears.
- [ ] **Step 2: Run** `pnpm --filter @wyrmhaven/game-core test -- obstacle` — expected: FAIL.
- [ ] **Step 3: Implement.** `startConstruction` counts builds and upgrades against `MAX_BUILDERS`, and clears against `MAX_CLEARS`, returning which is busy. Drops roll inside `completeConstruction`. Art keys `obstacle.<kind>` fall back to the nearest old sprite by size until art lands: `boulder` for 4×4, `ruin` for 3×3, `rock` for the small 2×2.
- [ ] **Step 4: Run** `pnpm -r typecheck` and every package's tests — expected: PASS.
- [ ] **Step 5: Commit** — `feat: §5.6 obstacles with spawns, drops and two clears at once`

---

### Task 4: Speed-up tokens (§3.6, §5.6, Q2, R55)

**Files:**
- Create: `apps/web/src/panels/SpeedUpButton.tsx`, `packages/game-core/test/speed-up-tokens.test.ts`, `apps/web/test/speedup.test.tsx`
- Modify: `packages/game-core/src/data/speedups.ts`, `src/actions/types.ts`, `actions/validate.ts`, `actions/apply.ts`, `actions/economy-actions.ts`, `packages/shared/src/actions.ts`, `apps/web/src/panels/ConstructionStatus.tsx`, `panels/BreedPanel.tsx`, `panels/HatcheryPanel.tsx`, `panels/FarmPanel.tsx`, `hud/Hud.tsx` or the settings panel for a token count, `api/errors.ts`

**Interfaces:**
- Consumes: `speedUps`, `SpeedUpToken` from Task 3; `SkipTarget`, `skipTargetReadyAt` from `store.ts`.
- Produces:
```ts
export const SPEED_UP_TOKEN_MS: Record<SpeedUpToken, number>   // per Q2 (a): 900_000, 3_600_000, 10_800_000
| { type: 'useSpeedUp'; token: SpeedUpToken; target: SkipTarget; index: number }
// ActionError + 'NO_TOKEN'
```

- [ ] **Step 1: Write the failing tests.** A `1h` token on a 3 h breed leaves 2 h and `speedUps['1h']` one lower. A `3h` token on a 40-minute clear: `readyAtMs` is `nowMs`, the surplus is lost, the clear finishes by `finishConstruction` and pays once (Review Focus 3). Nothing running on that slot: `NOTHING_TO_SKIP`, token kept. No tokens: `NO_TOKEN`. Bad index: `NOT_FOUND`. Replay of one `actionId` spends one token. Works on `breeder`, `hatchery`, `farm`, `construction`. Web: the button shows the largest token not longer than the time left, else the smallest, labelled `Use 1 h · 2 left`; hidden with none; fires the action; after a clear hits zero the existing auto-finish completes it.
- [ ] **Step 2: Run** `pnpm --filter @wyrmhaven/game-core test -- speed-up` — expected: FAIL.
- [ ] **Step 3: Implement.** Reduce `readyAtMs` by the token, floored at `nowMs`. Don't complete anything inside this action: the same finish paths run as after any timer.
- [ ] **Step 4: Run** `pnpm -r typecheck` and every package's tests — expected: PASS.
- [ ] **Step 5: Commit** — `feat: speed-up token inventory and use on any timer`

---

### Task 5: Room through PL 12, pinned by real play (§4.4, §5.5, Review Focus 4)

**Files:**
- Create: `packages/game-core/test/island-room.test.ts`
- Modify: `packages/game-core/test/helpers/xpBots.ts`, `test/xp-simulation.test.ts`, `test/goals.test.ts` if bots move

**Interfaces:**
- Consumes: `buyPlot`, `clearObstacle`, `placeBuilding`.
- Produces: nothing for later tasks. If the room test fails, change `island-start.ts`, not the test.

- [ ] **Step 1: Write the failing test, on real `applyAction` only, Flash-14, with Gold granted and the level set at each step.**
```ts
const ROOM_SCHEDULE = [
  [3, ['habitat:sea', 'habitat:nature', 'farm']], [4, ['farm']], [5, ['roost']], [6, ['habitat:electric']], [7, ['farm']],
  [8, ['habitat:ice']], [10, ['habitat:metal', 'farm']], [12, ['grove']],
] as const
```
  - `the starting land alone holds every unlock through PL 5`: no plot bought, no obstacle cleared, no move; each first legal cell found by scanning.
  - `every unlock through PL 12 fits with no moves` for seeds 1..50: at each PL buy every plot its gate opens (lowest legal index first), then place. If a building has no legal cell, clear the fewest obstacles needed and retry. Assert: all placed, `moveBuilding` never called, and the most clears any seed needed, as a measured literal.
- [ ] **Step 2: Run** `pnpm --filter @wyrmhaven/game-core test -- island-room` — expected: FAIL until the bot's placement scan exists. To prove the test can fail, move the starting Mountain to `(13, 12)`, see `the starting land alone` fail, and revert.
- [ ] **Step 3: Update `xpBots.ts`:** spots scan 32×32 on owned land; expansions call `buyPlot`, then `buyBridge`; bots clear obstacles when blocked. Bot tests keep `BOT_TIMEOUT_MS`.
- [ ] **Step 4: Run** the XP simulation. Expected: `endOfDay` still `[12, 18, 25, 30, 32, 33, 34, 36, 37, 38, 39, 40]`, since the limit paces. If it changes, stop and report rather than re-pin. All 14 Goals finish with no grants on both presets.
- [ ] **Step 5: Commit** — `test(game-core): room through PL 12 with no moves, bots on the plot grid`

---

### Task 6: Full-size buildings on the big island (§5.4, §5.5, R58, R61, Review Focus 5)

**Files:**
- Modify: `apps/web/src/game/islandModel.ts`, `game/layout.ts`, `game/camera.ts`, `game/scenes/IslandScene.ts`, `state/placing.ts`, `panels/ShopPanel.tsx`, `apps/web/test/island.test.ts`, `test/camera.test.ts`, `test/placing-room.test.ts`, `test/shop.test.tsx`

**Interfaces:**
- Consumes: `FOOTPRINT`, `lockedTiles`, `ownedPlots`.
- Produces: `openingView(state, view, viewportW, viewportH): View`, centred on owned land; `ownedLandBox(state, view): Box`. Removes `BREEDER_ART_SCALE`, `ROOST_ART_SCALE`.

- [ ] **Step 1: Write the failing tests.** Mountain, Grove, Hatchery and Roost draw at scale 1. A habitat with an 80×64 sheet draws at 0.8, with a 64-wide sheet at 1; a Farm with a 32-wide sheet at 1.5, with a 48-wide sheet at 1. Dragon spots stay inside a 4×4 diamond for slots 0..5: each spot's feet within the footprint's diamond. Hatchery niches unchanged. The opening view centres on owned land at a fresh start and after buying an outer corner plot. `cameraBounds` covers 32×32 at both sizes, and zoom min stays 1. A new Roost, Farm or Grove on a fresh island opens on a legal cell that leaves a legal 4×4 free. A habitat on a fresh island opens on a legal cell. A Shop row reason for no room reads `No room: buy a plot`. Shop computes `hasLegalCell` once per state, not per clock tick: count calls across two renders with a new `nowMs`.
- [ ] **Step 2: Run** `pnpm --filter @wyrmhaven/web test -- island camera placing shop` — expected: FAIL.
- [ ] **Step 3: Implement.** `drawGround` bakes all ground, fog and cliff tiles into one render texture for the current island and holding, rather than 1,024 images. Water stays. `DRAGON_SPOTS` is rewritten for the 64-wide diamond. `Shop` memoises room checks on `state`. `placementStart`'s default `mid` is the centre of owned land.
- [ ] **Step 4: Run** `pnpm -r typecheck`, web tests, e2e via the temporary config — expected: PASS. Open at 390×844 and 1440×900 with a 16-plot holding and Read the screenshots: buildings stand on their diamonds, signs tap, and nothing clips.
- [ ] **Step 5: Commit** — `feat(web): GDD footprints at full size, baked ground, opening view on owned land`

---

### Task 7: Moving buildings between plots and islands (§5.5, R57)

**Files:**
- Modify: `apps/web/src/panels/PlacementBar.tsx`, `panels/MoveTurn.tsx`, `state/usePlacing.ts`, `state/placing.ts`, `packages/game-core/test/placement-rules.test.ts`, `apps/server/test/actions.test.ts`, `apps/web/test/placing.test.ts`, `apps/web/e2e/island.spec.ts`

**Interfaces:**
- Consumes: `moveBuilding`, `placementRuleError`.
- Produces: `PlacementBar` gets `Island` buttons (`aria-label="Move to Ember Reach"`) when the mover may leave its island and more than one is unlocked.

- [ ] **Step 1: Write the failing tests.** A habitat moves from one plot to another, across a plot border, for free, keeping `lastCollectedMs`, dragons and Gold. A move onto unowned land is `NOT_OWNED`; onto itself offset by one tile is legal (it ignores itself). A 5×5 Mountain moving from `(8, 12)` to a straddling spot works. A habitat with stored Gold, moved to Island 2: legal, and its Gold is unchanged. The Hatchery stays on Home: `WRONG_ISLAND`; the bar shows no Island buttons for it. A `isle6` decoration stays on `isle6` (R59). A building under construction can move and its timer keeps running. Web: during a move the ghost starts on the current spot, and tapping `Move to Ember Reach` switches the view, opens on the nearest legal cell there, and Confirm sends that island. Cancel returns the view. e2e: a real drag across a plot border on the canvas.
- [ ] **Step 2: Run** `pnpm --filter @wyrmhaven/web test -- placing` — expected: FAIL.
- [ ] **Step 3: Implement.** Game-core likely needs nothing beyond its tests; the UI is new.
- [ ] **Step 4: Run** `pnpm -r typecheck`, each affected package's tests, and e2e via the temporary config — expected: PASS.
- [ ] **Step 5: Commit** — `feat: move buildings between plots and islands`

---

### Task 8: The Map screen (§5.5, R60)

**Files:**
- Create: `apps/web/src/game/panZoom.ts`, `game/mapModel.ts`, `game/scenes/MapScene.ts`, `apps/web/test/mapModel.test.ts`, `apps/web/test/panZoom.test.ts`, `apps/web/e2e/map.spec.ts`
- Modify: `game/scenes/IslandScene.ts` (uses `panZoom`), `game/config.ts`, `game/bridge.ts`, `panels/PanelHost.tsx`, `panels/MapIslandPanel.tsx`, `hud/Hud.tsx`, `styles/hud.css`

**Interfaces:**
- Consumes: `ISLANDS`, `plotPrice`, `ownedPlots`, `unlockPl`, camera helpers.
- Produces:
```ts
export const MAP_SPOTS: Record<IslandId, { x: number; y: number }>   // display only, in world pixels
export interface MapIsland { id: IslandId; name: string; state: 'current' | 'open' | 'next' | 'locked'; label: string; owned: number; plots: { plot: number; owned: boolean; x: number; y: number }[]; x: number; y: number; key: string }
export function buildMapModel(s: PlayerState, art: GameArtSet, view: IslandId): { islands: MapIsland[]; bridges: { from: IslandId; to: IslandId; built: boolean }[]; bounds: Box }
export type Target = /* existing */ | { kind: 'mapIsland'; id: IslandId } | { kind: 'plot'; island: IslandId; plot: number }
```

- [ ] **Step 1: Write the failing tests.** `buildMapModel` on a fresh state: 6 islands, 96 plots in all, 4 owned, each plot in a diamond around its island. `home` is `current`, labelled `Home Isle · 4 / 16`. Isle 2 is `next`, labelled `Ember Reach · Level 12 · Bridge 150,000`. Isle 3 and on are `locked`, labelled with level only. After `buyBridge('isle2')`, its state is `open`, its bridge `built`, and Isle 3 is `next`. Labels format large prices `100M`. Bounds contain all islands. `panZoom` keeps today's island gestures: a tap under 4 px of movement is a click, wheel and pinch zoom whole numbers, and drag pans (moved from `IslandScene`, existing tests stay). Panel: `MapIslandPanel` for `next` at PL 11 shows `Needs player level 12`; at PL 12 without Gold, `Not enough gold`; else the Bridge buys and the panel turns to `Go`. `Go` closes the Map and shows that island. A list of buttons named for each island sits in the DOM for keyboard and screen readers. e2e `map.spec.ts`: open Map, a real drag pans, wheel zooms, a real click on Isle 2's cell opens its panel, buy the Bridge with Gold granted, Go, and see the island with fog and plot signs.
- [ ] **Step 2: Run** `pnpm --filter @wyrmhaven/web test -- mapModel panZoom` — expected: FAIL.
- [ ] **Step 3: Implement.** `MapScene` runs in place of `IslandScene` while the `map` panel is open: scene switch, no second canvas. It draws `map.backdrop` tiled, each island's `map.<id>` icon, plots as a diamond grid (owned bright, others dim) by `Graphics` so it works before art lands, Bridges from `map.bridge` or a drawn line, locks as a dim tint, and labels as text. It opens centred on the viewed island. HUD stays above. `Map` button toggles back.
- [ ] **Step 4: Run** `pnpm -r typecheck`, web tests, e2e via the temporary config — expected: PASS. Read screenshots at 390×844 and 1440×900.
- [ ] **Step 5: Commit** — `feat(web): scrollable, zoomable Map of all six islands`

---

### Task 9: Art list and plumbing (§5.4–5.6)

**Files:**
- Create: `docs/art/gdd-m4-art-list.md`
- Modify: `apps/web/src/art/types.ts`, `art/fromManifest.ts`, `art/fallback.ts`, `game/scenes/IslandScene.ts`, `game/islandModel.ts`, `apps/web/test/art.test.ts`

**Interfaces:**
- Consumes: art keys from Tasks 3, 6 and 8.
- Produces: the list, and code reading each key with a fallback.

- [ ] **Step 1: Write the failing tests.** Each new key has a fallback and is read when the manifest has it. A manifest with none of them still renders every island: habitats scaled, plots drawn by `Graphics`.
- [ ] **Step 2: Run** `pnpm --filter @wyrmhaven/web test -- art` — expected: FAIL.
- [ ] **Step 3: Implement plumbing, and write the list** in the M3 list's format (style line, projection, budget table, priority order, a table for each group with key, frame size, frames, fps and description):
  - **Buildings at final size.** `habitat.<element>` × 10 and `building.goldenAerie`: 64×56, 4 frames, 4 fps, keeping each element's look; bottom-centre on the 4×4 diamond's bottom vertex. `building.farmPlot`: 48×40. Crops: `crop.<id>` × 6 sized for a 3×3 Farm. Listed as already final, not to regenerate: Mountain and Grove (80×80, 5×5), Hatchery levels and Roost tiers (64×64, 4×4); the thread should check them at scale 1 in the running game and report.
  - **Obstacles.** `obstacle.ancientTree` 64×64, `obstacle.boulder` 64×48, `obstacle.largeRock` 48×40, `obstacle.tree` 32×40, `obstacle.smallRock` 32×24, `obstacle.bush` 16×16. Stills. Original designs.
  - **Island tiles.** `ground.<island>.<0..2>` for Ember Reach, Frostspire, Ironhold, Shadowmere, Warlord's Crown (16×8, seamless, the technique in the HUD art round). Home keeps today's grass. `ground.cliff.<island>.sw`, `.se`. `ground.fog` stays. A plot-border mark `ground.plotEdge`, optional.
  - **Plots.** `island.sign` stays, and is checked on fog.
  - **Map.** `map.home` … `map.isle6`: 128×96 each, the island seen whole and distinct by theme. `map.bridge`: 64×32, reads in either isometric direction with a flip. `map.backdrop`: seamless sea, 256×256.
  - Budget table with counts; priority order: habitats, Farm, obstacles, Map, tiles.
- [ ] **Step 4: Run** web tests — expected: PASS.
- [ ] **Step 5: Commit** — `docs(art): M4 art list; every key read with a fallback`

---

### Task 10: M4 verification and report

- [ ] **Step 1: `pnpm -r typecheck`, each package's tests, and e2e** — expected: green; record counts.
- [ ] **Step 2: Playtest** with `pnpm playtest` through the real UI, with a throwaway Playwright spec (deleted after), at 390×844 and 1440×900:
  - Fresh account: the starting land shows, about 30 % obstacles, buildings at final sizes; PL 2 buys a 100 Gold plot, a sign moves on, obstacles appear, a Goal still reads right.
  - Through PL 12 by real play with Food granted if needed: every §4.4 unlock placed, no moves. Say how many plots and clears it took.
  - Clear a Bush, a Small Rock and an Ancient Tree: cost, timer (40 min, finished by clock), XP. Two clears run together, a third refused. Force a drop by seed in a unit test, then use a granted token on a running breed.
  - Bridge to Ember Reach at PL 12 with 150,000 Gold: Map, panel, buy, Go. Costs ×3 there. Place a habitat there, and move a habitat there from Home.
  - Map: drag, wheel, pinch where possible, tap each of 6 islands; locks and prices right.
  - A full Home holding of 16 plots: frame time on the island at 4× CPU throttle, with and without the Shop open. Record numbers.
  - Reload on each interesting state: `/me` agrees with the next action. No page errors or unexpected 4xx.
- [ ] **Step 3: Take** `docs/art/m4-island.png` (fresh), `m4-grown.png` (many plots), `m4-map.png`, `m4-plot.png` at 390×844, and `m4-desktop.png` at 1440×900; read each to check it shows what its name says.
- [ ] **Step 4: Write `docs/superpowers/reports/2026-10-31-m4-report.md`**: what works, what doesn't, what couldn't be verified, test counts, the room test's measured clears, frame times, rulings made, deferred items.
- [ ] **Step 5: Commit** — `docs: M4 report and playtest screenshots`

---

## Carried to later milestones

- **M5:** tokens from PvE Bosses (§6.3).
- **M6:** Bronze's tokens (§6.5).
- **M7:** Warlord's Crown decorations gate at PL 45, while the island opens at PL 40 (R59); decorations become a $DRIS sink (A9); Pass and Chest tokens (§8.2, §8.5).

## New rulings

Also recorded in `docs/superpowers/specs/2026-10-30-gdd-rulings.md`.

| # | Ruling | Why |
| --- | --- | --- |
| R42 | **Island ids are `home`, `isle2`..`isle6`, with names in `ISLANDS`.** `dawnspire` becomes `isle6`, Warlord's Crown. Its Legendary requirement goes. | §5.5 names the six and gives each only a PL gate; the old rule came from a superseded spec. |
| R43 | **An island is 32×32 tiles, and plot index = plotRow × 4 + plotCol. A building may straddle owned plots;** every tile it covers must be owned. | §5.5 says 4×4 plots of 8×8 tiles; a 5×5 on an 8×8 plot would be needlessly boxed in. |
| R44 | **"Touch" means sharing an edge,** not a corner. | Keeps holdings connected for buildings that straddle. |
| R45 | **A plot's price is by how many have been bought on that island,** not by where it is. | §5.5 lists prices in order, with no positions. |
| R46 | **Home's 12 plots open at PL 2, 2, 3, 4, … 12.** | §5.5 fits 12 plots into PL 2–12, 11 levels; the early doubling helps where room is tightest. |
| R47 | **Bridges go in order, and need only their PL and Gold; outer plots have no PL gate beyond the Bridge.** An island needn't be full first. | §5.5 lists one PL gate per island; requiring a full island would cost 285k–2B before moving on. |
| R48 | **A Bridge's 4 plots each spawn 2–4 obstacles,** like purchased plots. Only Home's start uses the fixed layout. | §5.6 calls out "starting plots" and "purchased" plots; a Bridge is a purchase. |
| R49 | **Island 2's real total is 3,020,000 Gold with its Bridge, not the table's 2.9M,** which leaves the Bridge out. Price lists govern. | Every other row includes it. The table's cumulative figures are rounded, and nothing reads them. |
| R50 | **Home's start is a fixed table, 77 of 256 tiles.** Obstacles lie to the south and east, leaving a clear block next to the buildings. | `newPlayer` has no `Rng`, and it pins room for the first sessions. |
| R51 | **"Ancient Tree / Boulder" is two kinds with one row of values.** Spawn: 2–4 uniform, weights Ancient Tree 1, Boulder 1, Large Rock 2, Tree 4, Small Rock 4, Bush 8; one per quadrant. | The GDD gives no weights; these average 3,340 Gold and 167 XP per obstacle, so clearing a whole Home plot costs about 10k Gold. Clearing is optional, so early plots stay cheap to own. |
| R52 | **`IslandMult` applies to Gold cost only.** XP is §5.6's value × `xpMult`. Drops are flat and not preset-multiplied. | §5.6's formula names only cost; §7.2 lists no drop multiplier. |
| R53 | **Clear timers divide by the preset's build divisor.** | §5's header: "divides build timers", and clearing is construction. |
| R54 | **Drops roll on completion with that action's `Rng`,** on any completion path. | One place to pay once, and the skip path already runs it. |
| R55 | **A token takes its time off any timer a `$DRIS` skip can target; the surplus is lost;** it doesn't finish anything itself. | §3.6 and §5.6 say "speed-up"; reusing the targets and finish paths adds no new rules. |
| R56 | **Plots and Bridges pay build XP (R31); clears pay §5.6's XP and no build XP.** | R31 names expansions and islands, and says obstacles keep §5.6's XP. |
| R57 | **Moves stay free, between plots and between unlocked islands.** The Hatchery stays on Home. Timers keep running. | The GDD doesn't price moves, and they already cost nothing since Phase 6b. |
| R58 | **An island always shows whole, with unowned land as fog, and the camera opens on owned land.** Zoom stays whole numbers from 1. | 32×32 is 512 px wide at zoom 1, wider than a phone; opening on owned land keeps it readable. |
| R59 | **Warlord's Crown decorations keep their PL 45 gate until M7,** when A9 reprices them. | M7 owns them; the gap is noted, and harmless until PL 45. |
| R60 | **The Map is a Phaser scene with a matching DOM list of buttons.** Positions are display only. | Reuses the island's gestures; the list keeps keyboard and screen-reader access. |
| R61 | **Habitat and Farm sprites draw at footprint width ÷ sheet width,** until art lands at final size. | The game runs before the art does, and art needs no code change. |
