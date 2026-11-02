# UI Rework Phase 3 (main HUD) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The island HUD matches the reference layout (all-island-layout): level star and avatar top left with the Dragon Book counter, $DRIS / Gold / Food pills top centre, settings top right, Goals on the left edge, zoom on the right, Battle bottom left, Shop bottom right, an empty bottom centre; Settings holds wallet and account; the Map and every island float in the sky.

**Architecture:** `Hud.tsx` is recomposed from the Phase 2 kit (`ResourcePill`, `RoundAction`, `Bubble`, `PillButton`); its pure parts (Book counter, Goals bubble text) live in `hudModel.ts` with unit tests. Settings becomes a tabbed `FullScreenFrame`-free dialog. `IslandScene` bakes every island with the Home landmass painter; `MapScene` draws floating island icons (art key or drawn fallback) with a chain on locked ones.

**Tech Stack:** React, Phaser 3, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-01-ui-rework-design.md` (Phase 3 table and Art list item 3); Phase 1 report question 5 (other islands float, default yes).

## Global Constraints

- Same layout, our skin; never copy the references' art, logo or text.
- Hide what isn't built: Social, News, Offers, chat, Decor, Orbs, Packs, Empower, Rank Up, Book Mastery, Collections, and (ruling Q2) Storage and search until Phase 5 builds them.
- Currencies: $DRIS slot first (plus opens deposit), then Gold, then Food.
- Game rules unchanged. No game-core change.
- Landscape layout; phones keep their current portrait handling (the rotate screen is not in this phase's table).

## Rulings made here

| # | Ruling | Why |
| --- | --- | --- |
| Q1 | The attention column (the left "dark side panel" of shortcuts) stays until Phase 4 replaces it with bubbles over buildings; it moves down under the Goals button and loses its dark panels (kit bubbles/pills instead). | Removing it before the bubbles exist would take away finishing builds and collecting eggs. |
| Q2 | Storage and search are hidden until Phase 5 (Storage rules and the Book's search are built there). Bottom left holds Battle only for now. | "Hide what isn't built." |
| Q3 | Breed leaves the HUD: the Breeding building opens it (already true on tap; Phase 4 adds its action row). Wings and Inbox go (hidden). Quests becomes the Goals button. | The reference has no Breed button. |
| Q4 | The Dragon Book's red badge counts species discovered since the Book was last opened, kept per player in localStorage (a convenience, reset safe). | No server field; losing it only hides a badge. |
| Q5 | The XP bar stays as a thin bar under the level star and avatar (the "Experience" progressbar and its day-limit text are kept). | Players need XP progress; the reference ring is too small for our limit text. |
| Q6 | The Finals countdown leaves the HUD and shows in Settings' Account tab (review image-5). | Design. |
| Q7 | The Map button sits under Settings at the top right. | Design says "a HUD button"; that corner is empty in the reference. |

## Review Focus

1. 844×390 landscape phone: no two HUD controls overlap, and the bottom centre stays clear for the Move/placement bar. Test in Task 1's e2e.
2. A player with a goal claimable and the day's XP limit reached: Goals bubble says Claim!, XP bar shows the short limit label; both tappable. Test in Task 1.
3. Settings with no wallet connected (test wallet) and with tokens: every tab renders and Escape closes. Test in Task 2.
4. Map with every island locked but Home, and with all unlocked: locked ones grey with a chain and still open their panel. Test in Task 3.
5. Switching to another island after buying a Bridge: the floating bake replaces the old diamonds, waterfalls don't double, and a lost WebGL context rebakes it. Test in Task 4.

---

### Task 1: HUD layout

**Files:** Modify `apps/web/src/hud/Hud.tsx`, `apps/web/src/hud/hudModel.ts`, `apps/web/src/styles/hud.css`; Test `apps/web/test/hud.test.tsx`, `apps/web/test/hudModel.test.ts`, `apps/web/e2e/hud.spec.ts` and every spec that clicked the old bottom bar (`openPanel` in `e2e/helpers.ts`).

**Interfaces — Produces:** `bookCount(s): { found: number; total: number }`; `newBookEntries(s, seen: readonly string[]): number`; `goalsBubble(s): 'Claim!' | 'Start!' | null` (Claim! when claimable, Start! when the current goal has no progress, else null); HUD regions with accessible names "Player", "Resources", "Goals", "Main menu" (Battle, Shop), "Island menu" (Settings, Map).

- [x] Step 1: failing unit tests for the three functions and for the HUD: pills in order DRIS, Gold, Food; Book button named "Dragon Book" showing "found/total"; no Breed, Wings, Inbox, Storage or search button; no "Finals" text.
- [x] Step 2: run, FAIL. Step 3: implement. Step 4: update `openPanel` and old specs to the new buttons (Quests → Goals; Breed → select the breeder). Step 5: e2e at 1920×1080 and 844×390 checks non-overlap of HUD controls and an empty bottom centre band. Commit `feat(web): main HUD in the reference layout`.

### Task 2: Settings tabs

**Files:** Create `apps/web/src/panels/SettingsPanel.tsx`; modify `PanelHost.tsx`; test `apps/web/test/settings.test.tsx`, `e2e/deposit-withdraw.spec.ts`.

**Interfaces — Produces:** `SettingsPanel({ onClose, nowMs })` with tabs Account (address, sign out, Finals countdown, speed-ups) and Wallet (the existing WalletPanel's deposit/withdraw).

- [x] Steps: failing test (tabs, wallet content under Wallet, sign-out under Account, countdown under Account); implement; deposit e2e still green; commit `feat(web): settings tabs hold wallet and account`.

### Task 3: Floating Map

**Files:** Modify `apps/web/src/game/mapModel.ts`, `apps/web/src/game/scenes/MapScene.ts`; test `apps/web/test/mapModel.test.ts`, `apps/web/test/mapScene.test.ts`, `e2e/map.spec.ts`.

**Interfaces — Produces:** map model island gains `look: { key: 'map.island.<id>'; locked: boolean; chained: boolean }`; MapScene draws the art or a drawn floating island (grass top in the island's colour, rock underside, a drip of waterfall on Home), sky backdrop instead of the sea, locked islands desaturated with `map.chain` (drawn lock fallback).

- [x] Steps: failing model tests; implement; map e2e still opens each island's panel; commit `feat(web): the Map shows floating islands, locked ones chained`.

### Task 4: Every island floats

**Files:** Modify `apps/web/src/game/scenes/IslandScene.ts`, `apps/web/src/game/islandBake.ts` (a per-island grass tint), `apps/web/src/game/islandShape.ts` if it assumes Home; test `apps/web/test/islandBake.test.ts`, `apps/web/test/island.test.ts`, `e2e/island.spec.ts`, `e2e/context-restore.spec.ts`.

**Interfaces — Produces:** `bakeIsland(state, island)` replacing `bakeHome`; `landPlots(state, island)` for non-Home islands = owned plus offered (M4's offer rule), so their outline grows the same way; signs on offered plots only.

- [x] Steps: failing tests (non-Home view bakes a landmass, no fog diamonds; waterfalls count stable across rebake); implement; commit `feat(web): every island is a floating island`.

### Task 5: Verify and report

- [ ] Full unit and e2e suites, `pnpm -r typecheck`; `pnpm playtest` with real input over HUD, Settings, Map and a second island; screenshots `docs/art/ui-p3-*-{1920,844}.png`; report `docs/superpowers/reports/2026-11-02-ui-rework-phase3-report.md`; push.
