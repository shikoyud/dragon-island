# UI Rework Phase 6 (landscape combat, one island scene) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** shiko's review of 2026-11-06: "I don't see any changes in the combat screen, as well as only one island per scene. I want all island in 1 scene, remove the map." The battle becomes a landscape, side-by-side screen laid out like `combat.png`, and every island is drawn together in the island scene, with the Map scene and its button gone.

**Architecture:** Battle: the stage turns 640×360 (16:9). Both dragons stand on one ground line facing each other; React's HUD sits over the whole viewport (plates with portraits in the top corners, VS and the turn in the middle, both benches down the sides, Swap bottom-left, the four moves along the bottom). Islands: a new pure module `game/archipelago.ts` gives each island a world offset; the island scene keeps one Phaser container per island at that offset, so every per-island drawing and model stays in island-local coordinates, unchanged. `bridge.view` stays as "the island being worked on": the scene sets it from taps and from the camera, and an outside `setView` pans the camera there.

**Tech Stack:** TypeScript, React 19, Phaser 3, Vitest + Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-01-ui-rework-design.md` (combat row; island and Map rows), overridden where shiko's 2026-11-06 message says otherwise. Layout references: `/mnt/project-files/combat.png`, `/mnt/project-files/all-island-layout.png` (layout only).

## Global Constraints

- Same layout, our skin: never copy the references' art, logo, characters or text.
- game-core is untouched. Currency stays integers; the server stays authoritative.
- Old e2e and unit tests are updated or replaced, never skipped. Every tap target stays at least 44 px.
- Pixel art stays crisp: cameras zoom by whole numbers.

## Rulings made here

| # | Ruling |
| --- | --- |
| R98 | Overrides R80. The battle stage is landscape, `BATTLE = 640×360`, zoomed by the largest whole number that fits the viewport and centred; outside the stage the backdrop's sky and ground colours continue. The controls lie over the stage, not under it. |
| R99 | Overrides R60. There is no Map scene and no Map button. Islands sit at fixed world offsets (`ISLAND_AT`), Home first, the chain zig-zagging right. A locked island shows its greyed floating-island art with a caption (level and Bridge price); tapping it opens the existing island panel to buy the Bridge. |
| R100 | `bridge.view` is the island that taps, placement and new buildings use. A tap on an island's object makes it the view; panning makes the island nearest the screen centre the view (not while placing). `setView` from React (placement "Move to", the island panel's Go) pans the camera to that island at the same zoom. |
| R101 | Bench portraits down each side show every non-active dragon with level and HP bar; the player's are buttons that swap to that dragon (same rules as the Swap list). Swap and the replacement list stay as they are for keyboard and screen-reader use. |
| R102 | Until landscape backdrops (`battle.wide.<element>`, 640×360) arrive from the art thread, the portrait backdrop is drawn at the stage's width and cropped to its lower part. |

## Review Focus

1. 844×390 battle: plates, benches, Swap and four moves all on screen with no overlap of the moves over the dragons' feet (Task 2 e2e at 844×390).
2. A phone held upright (390×844) in battle: the stage is cropped at the sides, both dragons still on screen, moves in a 2×2 grid (Task 2 e2e).
3. A tap on an island that is not `bridge.view` opens what was tapped and makes that island the view (Task 4 unit test `a tap on isle2 makes it the view`).
4. Placement "Move to <island>" puts the ghost on that island and the camera follows it (Task 5 e2e).
5. Buying a Bridge from a locked island's caption turns it into land without a reload (Task 5 e2e).

---

### Task 1: Landscape stage geometry and scene

**Files:** Modify `apps/web/src/game/layout.ts`, `apps/web/src/game/scenes/BattleScene.ts`. Test `apps/web/test/layout.test.ts`, `apps/web/test/battleScene.test.ts`.

**Interfaces — Produces:** `BATTLE = { w: 640, h: 360 }`; `BATTLE_SPOT = { attacker: { x: 200, y: 292 }, defender: { x: 440, y: 292 } }`; `BATTLE_HORIZON_Y = 170`; `battleStage(vw, vh): Box & { zoom }` (zoom = `integerZoom(vw, vh)`, centred on both axes); `battleCamera` unchanged in meaning. `BATTLE_CONTROLS_H` and `BATTLE_STAGE_GAP` are removed.

- [x] Tests: `battleStage(1920,1080)` = `{zoom:3,x:0,y:0,w:1920,h:1080}`; `battleStage(844,390)` = `{zoom:1,x:102,y:15,w:640,h:360}`; `battleStage(390,844)` = `{zoom:1,x:-125,y:242,w:640,h:360}`; both spots share one y; attacker left of defender.
- [x] Scene: the ground rectangle reaches far past the stage on both sides; a `battle.wide.<element>` texture covers the stage when loaded, else the portrait backdrop at width 640 is cropped to its lower part (R102).
- [x] Commit `feat(web): landscape battle stage (R98)`.

### Task 2: Battle HUD over the stage

**Files:** Modify `apps/web/src/panels/BattlePanel.tsx`, `apps/web/src/styles/screens.css`, `apps/web/src/styles/hud.css`. Test `apps/web/test/battle.test.tsx`, `apps/web/e2e/battle.spec.ts`.

- [x] Tests: plates `Yours`/`Enemy` each hold a portrait image named after the species, the name, the level and the HP bar; groups `Your bench` and `Enemy bench` list the non-active dragons (image name `<species>: alive|hurt|ko`); a bench button `Swap to <species>` sends `{kind:'swap', to}`; it is disabled while busy, for a KO'd dragon, and during a replacement it sends `replace`.
- [x] Layout (CSS): `.battle__top` row across the viewport top: Yours plate left, VS + turn centre, Enemy plate right, Exit far right; benches are columns at the left and right edges, vertically centred; `.battle__controls` is a bar along the viewport bottom: Swap Dragon at its left, moves in one row of four (2×2 under 600 px wide); the last-move line sits under the VS.
- [x] e2e at 1920×1080, 844×390 and 390×844: every move, Swap and Exit inside the viewport and at least 44 px tall; the moves bar's top is below both dragons' feet.
- [x] Commit `feat(web): landscape battle HUD with plates, benches and a moves bar (R101)`.

### Task 3: Archipelago geometry

**Files:** Create `apps/web/src/game/archipelago.ts`. Test `apps/web/test/archipelago.test.ts`.

**Interfaces — Produces:** `ISLAND_AT: Record<IslandId, Pos>`; `islandFrame(id): Box` (the island's camera box moved to its offset); `worldBounds(): Box` (union of every frame); `islandUnder(state, x, y): IslandId | null` (the island whose shown land, else frame, holds the world point); `nearestIsland(state, x, y): IslandId` (open island whose land centre is closest); `lockedLabel(state, id): string`.

- [x] Tests: no two frames overlap; Home's offset is (0,0); `islandUnder` finds Home at its land centre and isle2 at its own; a point in open sky is null; `nearestIsland` ignores locked islands; labels read `Ember Reach · Level 12 · Bridge 40,000` for the next island and `<name> · Level N` past it.
- [x] Commit `feat(web): world offsets for every island (R99)`.

### Task 4: Every island in the island scene

**Files:** Modify `apps/web/src/game/scenes/IslandScene.ts`, `apps/web/src/game/camera.ts` (bounds take a box), `apps/web/src/game/bridge.ts`. Test `apps/web/test/islandScene.test.ts` (new, headless Phaser like `battleScene.test.ts`).

- [x] One container per island at `ISLAND_AT[id]`, holding its bake, waterfalls, footprint/selection/home-finder graphics and object layer; `buildIslandModel` runs per open island (placing only on `bridge.view`).
- [x] Locked islands: greyed `map.<id>` art at ×4 with `map.chain`, and a caption whose target is `{kind:'mapIsland', id}`.
- [x] Input: a world point resolves to its island; a tap selects in that island and sets it as view first (R100). While placing, only `bridge.view`'s land takes cells.
- [x] Camera: bounds = `worldBounds()`; opening view on `bridge.view`'s land; `setView` from outside pans there; after a pan or zoom, `nearestIsland` becomes the view when not placing.
- [x] Hooks: `cellToScreen`, `focusCell`, `signCell` work on `bridge.view` with its offset.
- [x] Tests: all open islands have containers; a tap on isle2 makes it the view; `setView('isle2')` moves the camera centre into isle2's frame.
- [x] Commit `feat(web): draw every island in one scene (R99, R100)`.

### Task 5: Remove the Map

**Files:** Delete `apps/web/src/game/scenes/MapScene.ts`, `apps/web/test/mapScene.test.ts`, `apps/web/e2e/map.spec.ts`. Modify `config.ts`, `mapModel.ts` (keep `mapPrice`), `bridge.ts` (drop `mapOpen`, `setMapOpen`, `mapIslandToScreen`, the `map` event), `Hud.tsx`, `ZoomSlider.tsx`, `App.tsx`, `PanelHost.tsx`, `MapIslandPanel.tsx`, tests `hud`, `zoomSlider`, `mapModel`, `islands`, `dialogSubject`. Create `apps/web/e2e/islands.spec.ts`; update `zz-playtest.spec.ts`.

- [x] The HUD has no Map button; the island panel's close just closes; its Go pans to the island.
- [x] e2e `islands.spec.ts`: at level 12 with 200,000 gold, Home and Ember Reach's caption are both on screen; a real click on the caption opens the panel, Bridge buys it, the panel's Go pans there and a cell click on Ember Reach lands on it; placement "Move to Ember Reach" moves the ghost there.
- [x] Commit `feat(web): remove the Map; islands open from their captions (R99)`.

### Task 6: Verify and report

- [x] `pnpm -r typecheck`, unit tests for every package, the e2e suite, the playtest at 1920×1080 and 844×390.
- [x] Report `docs/superpowers/reports/2026-11-06-ui-rework-phase6-report.md` with screenshots `docs/art/ui-p6-*-{1920,844}.png` next to the references; copy to `/mnt/project-files/ui-rework/`. Push the branch.
