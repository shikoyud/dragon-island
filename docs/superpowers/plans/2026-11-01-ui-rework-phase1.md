# UI Rework Phase 1 (island and placement) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Home Isle looks like a floating island with cliffs, river, waterfalls and sky; it offers exactly 3 locked plots with visible obstacles; obstacles are fewer and never collide; Move no longer follows the cursor; habitats, Hatchery, Ancient Tree and zoom match the design.

**Architecture:** Rules go in `packages/game-core` (offered plots, start table, spawn gap, locked-obstacle guard). The island's shape is a pure module in `apps/web/src/game/islandShape.ts`, tested without Phaser; `IslandScene` bakes it to one canvas texture per land set. Placement changes live in the scene's gesture handling, the pure `placing` reducer and `buildIslandModel`. New art loads through the manifest; every key has a drawn fallback.

**Tech Stack:** TypeScript, Phaser 3, React, Vitest, Playwright, PixelLab MCP.

**Spec:** `docs/superpowers/specs/2026-11-01-ui-rework-design.md` (Phase 1 table and Art list item 1).

## Global Constraints

- Original IP: match the references' layout only. Never copy their art, logo, names or text.
- `packages/game-core` stays pure: no I/O, no `Date.now()`, no `Math.random()`.
- Gold and XP are integers. Prices, timers, caps and unlocks stay as the GDD and rulings set them, apart from the rulings below.
- Don't touch `docs/superpowers/specs/2026-10-30-gdd-rulings.md`: another thread has uncommitted work on it. New rulings live in this plan and the report.
- Stage by explicit path only. Never `git add -A`.
- Multi-line edits: use the Edit tool (several files are CRLF). Don't `cd` in Bash; use `git -C` or the worktree as cwd.
- Reference images: `C:\Users\nnduy\Downloads\layout-reference\`. Review: `C:\Users\nnduy\Downloads\feedback\`.

## Rulings made here (for shiko's review in the report)

| # | Ruling | Why |
| --- | --- | --- |
| U1 | **Home shows exactly 3 plots for sale at any time, from a fixed order.** `HOME_PLOT_ORDER = [2, 7, 11, 1, 14, 13, 4, 8, 3, 15, 0, 12]`. Offered = the first 3 not yet owned that touch owned land. Buying one reveals the next. Only offered plots can be bought (`PLOT_NOT_OFFERED`). | The review says 3, the design says "starts with", and the design keeps Home's prices and PL gates. So the total stays 12 purchases and R45/R46 are untouched: a rolling window of 3. |
| U2 | **The first three (2, 7, 11) stand on the right of the screen,** as in building-1. | Layout match. |
| U3 | **Home's plots not yet offered are not drawn at all;** the island's outline grows as plots are offered. Other islands keep M4's fog and 8 signs in Phase 1. | "Only 3 locked plots" can't hold if 9 more show as land. The design scopes the look to Home. |
| U4 | **Offered plots already hold their obstacles.** The 3 first ones come from the fixed start table; each later one spawns (R51 table) when it becomes offered, from the `buyPlot` action's Rng. A bought plot spawns nothing new. | "Its obstacles drawn visibly on top" needs them to exist before purchase; a preview that then changed would lie. Per-plot totals stay 2–4 from the R51 table for spawned plots. |
| U5 | **An obstacle on an unowned plot can't be cleared** (`PLOT_LOCKED`); tapping it opens the plot's buy panel. | Clear after buying, as before. |
| U6 | **Starting land: 8 obstacles on 28 of 256 tiles** (was 21 on 77): no Ancient Tree or Boulder on owned land; those stand on the locked plots. | Review: too many. Replaces R50's counts. XP from clearing the start drops accordingly. |
| U7 | **`OBSTACLE_GAP = 2`: two obstacles' footprints have at least 2 empty tiles between them on one axis** (table and spawns). Spawned obstacles keep the same gap from any building. A rolled kind with no room falls back to the next smaller kind; quadrants stay one each. | Review image-3. Spawn weights stay R51's, except where the gap forces a smaller kind. |
| U8 | **No state version bump.** The shape is unchanged. An old save keeps its layout; its next offered plots simply start empty. | Pre-launch; nothing to migrate. |
| U9 | **Move: the ghost starts on the building and the original is hidden with its residents travelling on the ghost.** Hover does nothing. A tap on land moves the footprint so its centre is under the tap. A drag that starts on the footprint carries it; any other drag pans. Applies to new buildings from the Shop too. | Design's Move row, and one code path. |
| U10 | **Confirm is renamed OK;** Cancel and OK are round buttons at bottom centre. Turn and the Island buttons stay in a small row above them. | Design row; Turn is an existing rule. |
| U11 | **Habitat art rule: 64×64 sheet, its face a full 64×32 diamond on the footprint, scale 1** (was a 52×26 face). Footprint stays 4×4. Residents use wider spots and draw at `HABITAT_DRAGON_SCALE = 0.75`. | Footprints are rules; only the art can grow. At scale 1 a 48 px adult takes 75 % of the platform's width. |
| U12 | **Upgrade post shows when the habitat's next level exists and its level gate is met,** whether or not Gold covers it. | Reference shows it as a hint, not a promise. |
| U13 | **Zoom slider is vertical, as the design says,** though building-1 shows it horizontal. Flagged as a question. | The design's wording is the approved text. |
| U14 | **Castle Hatchery art: 80×96 at scale 1, walls overhanging the 64-wide footprint by up to 8 px a side.** | "Bigger" than a dome with the footprint fixed. |

Execution amended U6's positions, U7's redraw, U11's dragon scale and the arrow, sign and caption details: see `docs/superpowers/reports/2026-11-01-ui-rework-phase1-report.md`.

## Review Focus

1. A pointer that leaves the land, or the canvas, mid-drag of the ghost: the ghost stays at the last valid cell, and the next tap still works. Test in Task 4.
2. Two-finger pinch or wheel zoom during placement: must zoom, never move the ghost. Test in Task 4.
3. A tap on a sign, obstacle or building while placing: it's a cell, never a dialog. Test in Task 4.
4. Landscape phone (844×390): Cancel and OK stay on screen and don't overlap the zoom slider. Test in Task 6 and read screenshots in Task 8.
5. A lost WebGL context, or an art swap, while on Home: the bake comes back and waterfalls don't double. Test in Task 3.

---

### Task 1: Offered plots, start table, spawn gap, locked clears (game-core)

**Files:**
- Modify: `packages/game-core/src/plots.ts`, `src/data/island-start.ts`, `src/obstacles.ts`, `src/actions/island-unlock-actions.ts`, `src/actions/types.ts` or wherever failure codes live
- Test: `packages/game-core/test/plots.test.ts`, `land.test.ts`, `obstacle-spawn.test.ts`, `island-room.test.ts`, `helpers/land.ts`, `helpers/xpBots.ts`; `apps/server/test/actions.test.ts`, `apps/web/test/land.ts` and any test that buys a plot no longer offered

**Interfaces — Produces:**
- `HOME_PLOT_ORDER: readonly number[]`, `offeredPlots(s: PlayerState, island: IslandId): number[]` (Home: the window of U1. Other islands: every unowned plot touching owned land, as M4).
- `PlotError` gains `'PLOT_NOT_OFFERED'`; a clear on an unowned plot fails with `'PLOT_LOCKED'`.
- `OBSTACLE_GAP = 2`, `obstaclesApart(a, sizeA, b, sizeB): boolean`.
- `spawnPlotObstacles(island, plot, firstId, rng, occupied: readonly { col: number; row: number; size: number }[]): Obstacle[]`.

- [x] **Step 1: Write failing tests**

```ts
it('offers exactly 3 on Home, from the fixed order', () => {
  expect(offeredPlots(newPlayer(0), 'home')).toEqual([2, 7, 11])
})
it('buying an offered plot reveals the next one', () => {
  const s = ok(run({ ...newPlayer(0), level: 2, gold: 1_000 }, { type: 'buyPlot', island: 'home', plot: 7 }))
  expect(offeredPlots(s, 'home')).toEqual([2, 11, 1])
})
it('refuses a plot not offered', () => {
  expect(plotError({ ...newPlayer(0), level: 2 }, 'home', 4)).toBe('PLOT_NOT_OFFERED')
})
it('all 12 plots stay reachable at the same prices', () => { /* buy in window order to 16 owned, assert total Gold = sum of Home's list and plotPrice null after */ })
it('reveal spawns 2-4 on the new plot only, and nothing on the plot bought', () => { /* seeds 1..50 */ })
it('start table: 8 on owned land, 28 tiles, no Ancient Tree or Boulder there; plots 2, 7, 11 hold 3 each', () => {})
it('no two obstacles closer than the gap, in the table and over 200 spawn seeds on every plot', () => {})
it('spawn keeps the gap from buildings and from neighbouring plots', () => {})
it('a clear on an unowned plot fails PLOT_LOCKED, and works once bought', () => {})
it('the rolled kind drops to a smaller one when the gap leaves no room; the count stays 2..4', () => {})
```

Fix the pins these replace: 21 obstacles in `land.test.ts` (`occ` length becomes 5 + 8 + 9), M4 buying orders, `obstacle-spawn` rng order.

- [x] **Step 2: Run to verify they fail**

Run: `pnpm --filter @wyrmhaven/game-core test`
Expected: FAIL on the new tests.

- [x] **Step 3: Implement**

Plots: `offeredPlots` per U1; `plotError` checks it after `PLOT_NOT_ADJACENT`. `plotsBought` is unchanged.

Start table in `island-start.ts`, `[col, row]`; ids stay `os1..` in table order. `HOME_START` is unchanged.

```ts
// Starting land (U6)
['largeRock', [[20, 20]]], ['tree', [[12, 21], [8, 18]]], ['smallRock', [[16, 21], [8, 22]]], ['bush', [[21, 14], [18, 17], [14, 17]]],
// Plot 2
['boulder', [[16, 0]]], ['tree', [[22, 1]]], ['bush', [[18, 6]]],
// Plot 7
['ancientTree', [[27, 8]]], ['smallRock', [[24, 14]]], ['bush', [[31, 14]]],
// Plot 11
['largeRock', [[29, 18]]], ['tree', [[25, 18]]], ['bush', [[26, 23]]],
```

Keep it as one list of rows if the table's shape needs it. If the gap test finds a pair too close, move the later entry by the fewest tiles and say so in the commit.

Spawn: for each of `count` obstacles draw kind and quadrant as today, then list every in-quadrant position apart from `occupied` and from those already placed. No position: next smaller kind (same quadrant); none at any size: skip it. Pick with `rng.int(n)`. Rng order: the count, then per obstacle kind, quadrant, one position roll.

`buyPlot`: for Home, spawn on `offered after − offered before`, against `occupants(state, 'home')`. Other islands keep spawning on the plot bought, and the Bridge on its 4 plots, each against what's already placed.

- [x] **Step 4: Verify**

Run: `pnpm --filter @wyrmhaven/game-core test`, `pnpm --filter @wyrmhaven/server test`
Expected: PASS, including the M4 room tests (`island-room.test.ts`: starting land holds every unlock through PL 5; through PL 12 with no moves and 0 clears on seeds 1..50), the XP simulation's end-of-day levels and the 14 Goals. If a pacing number moves, keep the assertion if the rule behind it still holds; otherwise stop and report it, don't retune values.

- [x] **Step 5: Commit** `feat(core): Home offers 3 plots at a time, fewer obstacles with a gap (U1-U8)`

### Task 2: Locked land in the island model and camera

**Files:**
- Modify: `apps/web/src/game/islandModel.ts`, `apps/web/src/game/camera.ts`, `apps/web/src/game/scenes/IslandScene.ts`
- Test: `apps/web/test/island.test.ts`, `apps/web/test/camera.test.ts`, `apps/web/test/plots.test.tsx`; `apps/web/e2e/island.spec.ts` for the fog click at (3,3)

**Interfaces — Consumes:** `offeredPlots`. **Produces:**
- `IslandObject.caption?: string` (a white label drawn under the sprite; constant screen size like badges).
- `landPlots(state, view): number[]`: Home = owned ∪ offered; others = all 16.
- `lockedTiles` returns only tiles on `landPlots` not owned. `groundCell` returns null on a plot not in `landPlots`.

- [x] **Step 1: Failing tests**

```ts
it('Home has 3 signs, each captioned Tap to buy, on top of everything', () => {
  const m = buildIslandModel(newPlayer(0), art, cat, 0, 'home', null)
  expect(m.markers.signs.map(s => s.plot)).toEqual([2, 7, 11])
  const signs = m.objects.filter(o => o.id.startsWith('sign:'))
  expect(signs.every(s => s.caption === 'Tap to buy')).toBe(true)
  expect(m.objects.findIndex(o => o.id === 'sign:2')).toBeGreaterThan(m.objects.findIndex(o => o.id.startsWith('obstacle:')))
})
it('an obstacle on a locked plot shows and opens that plot', () => {})
it('an obstacle on owned land still opens itself', () => {})
it('isle2 keeps its 8 signs and fog', () => {})
it('no ground cell on a plot not yet offered; a cell on an offered plot exists', () => {})
it('the opening view frames owned and offered land', () => {})
it('camera bounds hold the whole landmass (see islandShape) at every zoom', () => {})
```

- [x] **Step 2: Run:** `pnpm --filter @wyrmhaven/web test -- island camera plots`. Expected: FAIL.

- [x] **Step 3: Implement.** Signs push after the depth sort and before the ghost. The scene draws `caption` as a `Text` with a white background and dark text, in the same font as badges, below the anchor; it's in `objectSignature`. Locked-plot obstacles get `target: { kind: 'plot', island, plot }`. `ownedLandBox` becomes `landBox`, over `landPlots`.

- [x] **Step 4: Run** the same command. Expected: PASS.

- [x] **Step 5: Commit** `feat(web): locked plots show obstacles and Tap to buy signs`

### Task 3: Floating island bake, sky, clouds, waterfalls

**Files:**
- Create: `apps/web/src/game/islandShape.ts`, `apps/web/test/islandShape.test.ts`
- Modify: `apps/web/src/game/scenes/IslandScene.ts`, `apps/web/src/game/camera.ts`, `apps/web/src/art/types.ts`, `fromManifest.ts`, `phaserLoader.ts`, `apps/web/test/artRobustness.test.ts` or `art.test.ts`

**Interfaces — Produces (pure, no Phaser):**

```ts
export const RIM_CELLS = 3            // grass and rock beyond the plots, in cells
export const CLIFF_DEPTH = 110        // world px, at the deepest
export interface Landmass {
  box: Box                                    // world box of the bake
  isLand(x: number, y: number): boolean       // top surface, in world px
  edge(x: number, y: number): number          // cells from the outer boundary, 0 at it
  frontY(x: number): number | null            // the lowest top-surface y in a column
  backY(x: number): number | null
  cliffBottomY(x: number): number | null      // jagged, deepest mid-island, tapering to the sides
  isRiver(x: number, y: number): boolean
  falls: { x: number; y: number }[]           // waterfall tops, on the front lip, world px
  rimRocks: { x: number; y: number; variant: number }[]
}
export function landmass(plots: readonly number[]): Landmass
```

A pixel is land when its Euclidean distance in cell space from the nearest plot rectangle is at most `RIM_CELLS + noise`, where `noise` is a smooth deterministic function of world position in about −1..+1 cell. This gives rounded, irregular edges. It must be pure: the same plots give the same shape.

The river is a band 4–18 world px above `frontY`, only on two front stretches, the left and right thirds of the front profile (so a tongue of grass reaches the lip at the centre, as in building-1); never on a plot. `falls` has one point per stretch at its lowest-lying end, at least 48 px apart.

- [x] **Step 1: Failing tests** in `islandShape.test.ts`

```ts
const start = [5, 6, 9, 10, 2, 7, 11]
it('every tile of every land plot is land', () => {})
it('tiles of plots not in the set, past the rim, are not land', () => {})
it('is not a diamond: the outer edge wanders by at least 8 px from the straight rim', () => {})
it('the same plots give the same shape', () => {})
it('adding a plot grows the land and keeps what was there', () => {})
it('the river never touches a plot tile', () => {})
it('has at least 2 waterfalls, on the front lip, at least 48 px apart, with river above them', () => {})
it('the cliff hangs below the land in every land column, deepest near the middle', () => {})
it('rim rocks stay off plot tiles', () => {})
```

Scene and art tests:

```ts
it('art set has sky, clouds, rock, rim, waterfall as nullable slots; loader skips the ones absent', () => {})
it('a state change that changes no plots does not re-bake', () => {})
it('re-baking leaves one set of waterfall sprites, also after a context restore', () => {})
```

- [x] **Step 2: Run:** `pnpm --filter @wyrmhaven/web test -- islandShape artRobustness`. Expected: FAIL.

- [x] **Step 3: Implement**

Art slots, in `GameArtSet.ground`, all from `present(...)`: `sky`, `clouds: Sprite[]` (`ground.cloud.0..2`), `rock` (`ground.rock`), `rim: Sprite[]` (`ground.rim.0..3`), `waterfall` (`ground.waterfall`).

Home only: `drawGround` branches on `view === 'home'`. Bake into a `CanvasTexture` the size of `landmass.box`, then show it as an image with depth −1. Paint in this order:
1. Cliff: per column, from `frontY` to `cliffBottomY`, sample `ground.rock` (or fallback colours), lighter left of the island's centre and darker right, with a darker lip line.
2. Top surface: for each cell touching the mask, the grass tile by `groundVariant`; offered plots' cells get the same tile darkened by multiplying 0.55 (`ground.fog` is not used on Home). Then mask per pixel with `isLand`.
3. Bank (`#c9b27c`) 2 px around the river, then the river, sampling `ground.water` frame 0 (or `#3fa6e0`).
4. Rim rocks by `y` (`ground.rim.*`, or fallback grey polygons).

Waterfalls: one sprite per `falls` point, depth −0.5, playing `ground.waterfall`, or drawn fallback. Destroyed with the bake.

Other islands keep the render-texture path. All islands get the sky in place of the sea: an image at depth −3, repositioned in `apply()` to the view centre and scaled to `cover / zoom`, so it never scrolls or pixelates unevenly. Fallback: camera background `#8fd0ee`. Three clouds at depth −2 drift 2 px/s in world space, wrapping at the bounds; still under reduced motion. Remove the sea tile sprite.

`cameraBounds()` for Home: `landmass(all 16).box` plus a margin, so it doesn't change as land grows.

- [x] **Step 4: Run** the same command, then `pnpm --filter @wyrmhaven/web test`. Expected: PASS.

- [x] **Step 5: Screenshot and read it** at 1920×1080 in the browser. Check: not a square; cliffs hang; river and falls show; no seam at plot borders; the bake takes under 60 ms at 1× CPU (log once, then remove the log). Fix what's wrong.

- [x] **Step 6: Commit** `feat(web): Home Isle is a floating island with cliff, river, waterfalls and sky`

### Task 4: Move: stays put, tap or drag, Cancel and OK

**Files:**
- Modify: `apps/web/src/game/scenes/IslandScene.ts`, `apps/web/src/game/panZoom.ts`, `apps/web/src/game/islandModel.ts`, `apps/web/src/game/layout.ts`, `apps/web/src/panels/PlacementBar.tsx`, `apps/web/src/styles/hud.css`
- Test: `apps/web/test/island.test.ts`, `placementBar.test.tsx`, `panZoom.test.ts`, `placing.test.ts`; `apps/web/e2e/island.spec.ts`, `hud.spec.ts`, `build.spec.ts`

**Interfaces — Produces:**
- `footprintContains(cell, placing): boolean` in `layout.ts`.
- `createPanZoom` option `grab?: (p: { x: number; y: number }) => boolean`: true claims the press, so moves go to `onGrabMove` and don't pan. Two fingers always mean pinch and release the grab.
- `PlacementBar` buttons: accessible names `Cancel` and `OK`.
- `IslandObject` id `arrow` while placing: above the ghost's top, bobbing by tween (still under reduced motion).

- [x] **Step 1: Failing tests**

```ts
it('while placing, the model hides the moved building and carries its residents on the ghost', () => {
  const p = { what: { kind: 'move', target: { type: 'habitat', id: 'h1' } }, size: 4, col: 14, row: 13, facing: 0 } as Placing
  const m = buildIslandModel(withResident, art, cat, 0, 'home', p)
  expect(m.objects.some(o => o.id === 'habitat:h1')).toBe(false)
  expect(m.objects.find(o => o.id === 'ghost')).toMatchObject(anchor(14, 13, 4))
  expect(m.objects.find(o => o.id === 'dragon:d1')!.y).toBeLessThan(anchor(14, 13, 4).y)
})
it('a legal ghost has no tint, an illegal one is red; the footprint marker says which', () => {})
it('the arrow stands over the ghost', () => {})
```

`panZoom.test.ts`: a press inside a claimed grab never pans; a second finger cancels the grab and pinches; a wheel during a grab zooms and leaves the ghost's cell alone.

e2e `island.spec.ts`, replacing the sweep test:

```ts
test('Move: hover does nothing, a tap moves it, and OK is reachable', async ({ page }) => {
  // Press Move on h1. Sweep the mouse over the island with no button: placing stays {13, 8}.
  // Move the mouse onto OK and click: still {13, 8} until then; the action sends and the bar goes.
})
test('Move: a tap on land carries the footprint there', ...)        // (15,14) -> top-left (14,13)
test('Move: a drag from the footprint carries it; a drag elsewhere pans', ...)
test('Move: a tap on a sign or an obstacle while placing is a cell, not a dialog', ...)
test('Move: a drag that leaves the land keeps the last good cell', ...)
test('Move: Cancel leaves the building where it was', ...)
```

Update `Confirm` to `OK` everywhere it's named in tests.

- [x] **Step 2: Run:** `pnpm --filter @wyrmhaven/web test -- island placementBar panZoom placing`. Expected: FAIL.

- [x] **Step 3: Implement**

Scene: delete the hover `emitCell` in `onMove`. While placing, `grab` returns true when the pressed cell is inside the ghost's footprint. It keeps the offset from the footprint's top-left and emits `cell` only when the pointer's cell is on land. `onUp` with a click emits a centred cell as today. `reveal` runs only on placing start and island change, not on every cell, so a tap doesn't scroll the view away. The drawn footprint stays over everything.

Model: filter the moved target's group out of the sort; the ghost plus shifted residents go last. Ghost tint is only `'bad'`. Remove the ghost's alpha.

Bar: round red (X) and green (tick) buttons at bottom centre, 64 px on desktop and 56 px on a phone, labels `CANCEL` and `OK` beneath. Tick and X are inline SVG-free block glyphs in CSS until Phase 2 art; use `hud.icons` keys if present. Turn and Island buttons are small, in a row above. `Can't build here` above them. Only buttons take pointer events.

- [x] **Step 4: Run** unit tests and `pnpm --filter @wyrmhaven/web exec playwright test island hud build` through a temp config using system Chrome (`channel: 'chrome'`, not committed). Expected: PASS.

- [x] **Step 5: Commit** `fix(web): Move stays put until a tap or a drag; Cancel and OK at bottom centre`

### Task 5: Habitats, upgrade post, castle Hatchery with nest, grounded tree

**Files:**
- Modify: `apps/web/src/game/layout.ts`, `apps/web/src/game/islandModel.ts`, `apps/web/src/game/scenes/IslandScene.ts`, `apps/web/src/art/fallback.ts`, `apps/web/src/art/fromManifest.ts`
- Test: `apps/web/test/island.test.ts`, `layout.test.ts`, `art.test.ts`

**Interfaces — Produces:**
- `HABITAT_DRAGON_SCALE = 0.75`; `DRAGON_SPOTS` reworked for a 64×32 face, with the first four at the middle, left, right and back: `{0,-16} {-18,-15} {18,-15} {0,-25}`, then `{-10,-8} {10,-8} {-26,-16}`.
- `IslandObject.progress?: number` (0..1): a small bar the scene draws under the sprite.
- `hatcheryNestSpot(a, slot)`, `NEST_EGG_HATCHERY_SCALE = 0.5`: eggs in a row in the nest at `{-12,-14} {0,-11} {12,-14} {-6,-18} {6,-18}` from the anchor. Tune these to the final art, in Task 7's integration step.
- `upgradeReady(s, h, preset): boolean` (U12), object id `post:<habitatId>`, key `ui.island.upgradePost`, at `{x: a.x - 26, y: a.y - 12}`, targeting the habitat, hidden while placing.
- Fallbacks drawn for `ui.island.upgradePost` and `ui.island.arrow`, and a stone castle fallback for `hatchery` (towers and ring wall with a straw-coloured ellipse).

- [x] **Step 1: Failing tests**

```ts
it('feet of the first 4 residents stay on the 64x32 face, at least 16 px apart', () => {})
it('residents draw at the habitat scale', () => {})
it('a habitat with a next level open shows the post; at max level or under the gate it does not', () => {})
it('tapping the post opens the habitat', () => {})
it('an egg sits in the nest at half size with its progress', () => {
  // readyAtMs halfway: progress 0.5; hatchery object's own badge still reads the soonest timer
})
it('five eggs stay inside the nest box', () => {})
```

Update `art.test.ts` pins when the art lands in Task 7, not here.

- [x] **Step 2: Run:** `pnpm --filter @wyrmhaven/web test -- island layout`. Expected: FAIL.

- [x] **Step 3: Implement.** The scene draws `progress` as a 16×3 world-px bar (dark frame, green fill) under the sprite and keeps it through `reconcile` under id `bar:<id>`. Fallback habitat art fills the whole diamond.

- [x] **Step 4: Run** the same. Expected: PASS.

- [x] **Step 5: Commit** `feat(web): larger habitat spots, upgrade post, nest eggs with progress`

### Task 6: Zoom slider

**Files:**
- Create: `apps/web/src/hud/ZoomSlider.tsx`, `apps/web/test/zoomSlider.test.tsx`
- Modify: `apps/web/src/game/bridge.ts`, `apps/web/src/game/scenes/IslandScene.ts`, `apps/web/src/hud/Hud.tsx`, `apps/web/src/styles/hud.css`

**Interfaces — Produces:**
- Bridge: `zoom: { zoom: number; min: number; max: number } | null`, event `{ type: 'zoom' }`, method `setZoom(z: number)`, which asks the scene to zoom around the screen centre through `zoomAt`.
- `<ZoomSlider bridge={bridge} />`: right edge, vertically centred; plus on top, minus below; a `<input type="range" orient="vertical">` with `aria-label="Zoom"`, integer steps. Hidden when the Map or a battle shows. Plus and minus are 44 px; on a phone the track shrinks so the whole control fits the height between the top and bottom HUD.

- [x] **Step 1: Failing tests**

```ts
it('reflects the scene zoom and range', () => {})
it('plus and minus step by one and stop at the ends (disabled)', () => {})
it('dragging the track sets a whole zoom', () => {})
it('is hidden while the Map shows', () => {})
```

And e2e in `hud.spec.ts`: at 844×390 the slider's box stays inside the window and doesn't intersect the Move bar's buttons; plus changes the camera zoom.

- [x] **Step 2: Run:** `pnpm --filter @wyrmhaven/web test -- zoomSlider`. Expected: FAIL.

- [x] **Step 3: Implement.** The scene sets `bridge.zoom` from `apply()` when it changes. Move the Map button out of the slider's way if they collide. Art `ui.zoom.minus`, `ui.zoom.plus`, `ui.zoom.thumb` through `ArtMark`, with CSS fallback.

- [x] **Step 4: Run** the same and the e2e. Expected: PASS.

- [x] **Step 5: Commit** `feat(web): zoom slider at the right edge`

### Task 7: Phase 1 art through PixelLab

**Files:** `apps/web/public/art/v1/*`, `manifest.json`, `apps/web/art/prompts.md` ("UI rework Phase 1 set"), `docs/art/ui-rework-p1-art-list.md`, `apps/web/test/art.test.ts`, and the art constants in `layout.ts`.

| Key | Size | Frames | Notes |
| --- | --- | --- | --- |
| `ground.sky` | 480×272 | 1 | Teal-to-cream sky with soft clouds, far hills at the bottom. No land mass in the middle. |
| `ground.cloud.0..2` | about 96×40 | 1 | Transparent. Cream clouds. |
| `ground.rock` | 64×64 | 1 | Seamless grey stone cliff with vertical facets. |
| `ground.rim.0..3` | 32×24 to 48×32 | 1 | Transparent. Grey rim boulders. |
| `ground.waterfall` | 32×96 | 4 @ 8 fps | Bright water, foam at top, fading to transparent mist at bottom. Frame 0 from PixelLab; the loop in code (scroll rows). |
| `island.sign` | 48×48 | 1 | Wooden sign on a post. "FOR SALE" composited in code from pixel letters; AI lettering isn't reliable. |
| `obstacle.ancientTree` | 64×72 | 1 | Same tree. Roots flare onto the tile, soft shadow, no flat cut (review image-2). |
| `building.hatchery`, `.2`, `.3`, `.4` | 80×96 | 1 | Stone castle, ring wall, straw nest in the open courtyard at the front. More towers and banners per level. |
| `habitat.<10 elements>` | 64×64 | 4 @ 4 fps | Face fills the 64×32 diamond (U11). Keep each element's identity. Frame 0 by `edit_image_pixen` from a 1.25× nearest-neighbour start of the old sheet; the loop by the M4 method (frame 0 fixed, effect pixels only). |
| `building.goldenAerie` | 64×64 | 4 @ 4 fps | Same rule. |
| `ui.island.upgradePost` | 24×32 | 1 | Wooden post, green up-arrow. |
| `ui.island.arrow` | 32×40 | 1 | Bold orange down-arrow. |
| `ui.zoom.minus`, `.plus`, `.thumb` | 32×32 | 1 | Light round buttons, dark glyph; a light rounded thumb. |

Rules: the game's existing pixel style and palette; nothing from the reference game's art; no text in generated art; `top` on every manifest entry; about 60 generations budget (989 left on 2026-11-02); no art for the other 5 islands.

- [x] **Step 1:** Generate into the scratchpad. View every asset.
- [x] **Step 2:** Integrate: copy, add manifest entries, update `art.test.ts` size pins, tune nest spots to the castle art, record prompts and seeds.
- [x] **Step 3:** `pnpm --filter @wyrmhaven/web test`. Expected: PASS.
- [x] **Step 4: Commit** `art: UI rework Phase 1 set` with explicit paths.

### Task 8: Verify and report

**Files:** Create `docs/superpowers/reports/2026-11-01-ui-rework-phase1-report.md`, `docs/art/ui-p1-*.png`.

- [x] **Step 1:** `pnpm -r typecheck`, `pnpm -r test`. Expected: all clean. Record counts.
- [x] **Step 2:** Full e2e through a temp config on system Chrome (not committed). Expected: all pass, except the on-chain deposit skip.
- [x] **Step 3:** `pnpm playtest`, and drive it: place, move by tap and by drag, collect, hatch, grow, buy a plot, clear an obstacle. No page errors or unexpected 4xx.
- [x] **Step 4:** Frame time on Home: 844×390 at 4× CPU, 8 s; compare with M4's numbers. The bake's cost on buying a plot.
- [x] **Step 5:** Screenshots at 1920×1080 and 844×390. Side-by-side images with building-1, locked-land, choose-habitat-to-place-after-hatch, hatchery-selected-1egg-pending and -ready, plus review image-2 and image-3's areas. Read each one and fix what doesn't match.
- [x] **Step 6:** Write the report: what changed, test counts, screenshots, rulings, what's unverified or rough, questions for shiko. Commit it with explicit paths.
