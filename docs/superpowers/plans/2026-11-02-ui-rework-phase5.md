# UI Rework Phase 5 (dialogs and screens) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every dialog and full screen takes the layout of its reference (design, Phase 5 table), and Storage exists with the rules shiko approved on 2026-11-01.

**Architecture:** Storage is a rules change, so it lands first in `packages/game-core` (pure, optional state fields, no save version bump) with its two actions in the shared zod schema; the server already runs whatever the schema admits. The screens are React re-layouts of the existing panels on the Phase 2 kit (`DialogFrame`, `FullScreenFrame`, `KitCard`, `PillButton`, `PriceTag`, `ResourcePill`, `ProgressBar`, `ElementRibbon`, `RarityShield`) and the Phase 5 art already in `art/v1`. Each screen keeps its existing element ids and accessible names where the e2e specs use them; new pure models (`infoRows`, `upgradeBenefits`, `storageItems`, `goalRows`) carry the logic the tests pin.

**Tech Stack:** TypeScript, React 19, Phaser 3, Vitest + Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-01-ui-rework-design.md` (Phase 5 table, Storage section, Art list item 5).

## Global Constraints

- Same layout, our skin: never copy the references' art, logo, characters or text.
- game-core stays pure: `nowMs` is a parameter; no `Date.now()`, no `Math.random()`.
- Currency is integers. The server stays authoritative: the client sends `putInStorage` / `takeEgg` intents only.
- Storage rules (shiko, 2026-11-01): 1 storable: eggs, dragons, every building except the Hatchery, speed-up tokens. 2 storing a habitat needs it empty of dragons and collects its gold first. 3 a stored building keeps its level and earns nothing; a running build or upgrade timer pauses. 4 no size limit. 5 placing from Storage is free and uses the normal Move placement.
- Old e2e and unit tests are updated, never skipped. Every tap target stays at least 44 px.

## Rulings made here

| # | Ruling |
| --- | --- |
| S1 | A stored building keeps its array slot and `placement` and gains `stored: { atMs }`; it is off the grid (no occupancy, not drawn, not selectable), earns nothing, and every action on it but `moveBuilding` fails NOT_FOUND. Farms and breeders keep their index so constructions and plots never shift. The Roost uses a top-level `roostStored`. |
| S2 | Pause = shift. Taking a building out at `nowMs` adds `nowMs - stored.atMs` to its construction's `readyAtMs`, its farm crop's `readyAtMs` and its breeder egg's `readyAtMs`; a habitat's `lastCollectedMs` becomes `nowMs`. A paused construction does not hold a builder and `finishConstruction` on it fails NOT_FOUND. |
| S3 | `moveBuilding` on a stored building is the "place from Storage": same legality, free, clears `stored`. |
| S4 | A stored dragon has `habitatId: null` and `stored: true`; it is not "waiting in the Hatchery". `moveDragon` takes it out. A dragon in the defence team or in an active Trial cannot be stored (INVALID_ACTION). Sell from Storage is the normal `sellDragon`. |
| S5 | A stored egg is `{ speciesId, remainingMs, xpFree? }` in `storedEggs`; `takeEgg { index }` puts it in the Hatchery with `readyAtMs = nowMs + remainingMs`, or fails HATCHERY_FULL. |
| S6 | Speed-up tokens already live in `speedUps`; Storage lists them with their count and no Use button (they are used from a timer's Speed Up, as today). |
| S7 | Sell is shown only where a sell action exists: dragons (`sellDragon`) and decorations (`removeDecoration`). Buildings show Store only. |
| S8 | New dragon: after a hatch the client shows the reveal over the island; "Place in Habitat" is the Phase 4 home finder when a habitat has room, else Close (game-core already housed it, Phase 4 note A5). |

## Review Focus

1. Storing a farm with a crop half-grown, waiting an hour, placing it: the crop needs the same time it needed when stored (Task 1 test `pauses a growing crop`).
2. Storing a building whose upgrade is running, then starting another build: the builder is free (Task 1 test `a paused upgrade frees its builder`).
3. A stale client sending `harvest` / `collectGold` / `startUpgrade` on a stored building: NOT_FOUND, state unchanged (Task 1 test `stored buildings refuse every action but move`).
4. 844×390: every dialog fits without the plank or close button leaving the screen; full screens scroll inside, never the page (Task 13 screenshots, `layout.spec.ts` overflow check extended to each screen).
5. Storage with nothing in it, and Shop list with every item locked: an empty state line, never a blank frame (Tasks 8 and 7 unit tests).

---

### Task 1: Storage in game-core

**Files:** Modify `packages/game-core/src/state.ts`, `actions/types.ts`, `actions/apply.ts`, `actions/build-actions.ts`, `actions/island-actions.ts`, `habitat.ts`, `placement-rules.ts`, `island.ts` (occupancy), `farm.ts`, `breeding.ts`, `construction.ts`; create `packages/game-core/src/storage.ts`, `actions/storage-actions.ts`; test `packages/game-core/test/storage.test.ts`; modify `packages/shared/src/actions.ts`.

**Interfaces — Produces:**
- `type StoredMark = { atMs: number }`; optional `stored?: StoredMark` on `Habitat`, `Breeder`, `FarmPlot`, `Decoration`; `stored?: true` on `Dragon`; `PlayerState.roostStored?: StoredMark`; `PlayerState.storedEggs?: StoredEgg[]` with `StoredEgg = { speciesId: string; remainingMs: number; xpFree?: boolean }`.
- `type StorageRef = MovableRef | { type: 'dragon'; id: string } | { type: 'egg'; slot: number }` (Hatchery excluded).
- Actions `{ type: 'putInStorage'; target: StorageRef }` and `{ type: 'takeEgg'; index: number }`; `moveBuilding` and `moveDragon` take things out (S3, S4).
- `isStored(s, ref: MovableRef): boolean`; `storageError(s, ref, nowMs): ActionError | null`.

- [ ] Failing tests: stores an empty habitat after collecting its gold (gold rises by `storedGold`); refuses a habitat with dragons (INVALID_ACTION); refuses the Hatchery; pauses a growing crop (store at t, take at t+1h, `readyAtMs` moved 1h); a paused upgrade frees its builder; stored buildings refuse every action but move (NOT_FOUND, state unchanged); a stored building is off the grid (another building may be placed on its cells); taking out uses Move legality and costs nothing; a stored habitat earns nothing while stored; stores a dragon and moveDragon takes it out; refuses a defence-team dragon; stores an egg with its remaining time and `takeEgg` restores it; `takeEgg` with a full Hatchery fails HATCHERY_FULL; the Roost stores with `roostStored` and keeps its tier.
- [ ] Implement; add both actions to `actionSchema` in `packages/shared/src/actions.ts` with a schema test.
- [ ] `pnpm --filter @wyrmhaven/game-core test`, `pnpm -r typecheck`; commit `feat(game-core): Storage for eggs, dragons and buildings`.

### Task 2: Info dialog

**Files:** create `apps/web/src/panels/InfoDialog.tsx`, `apps/web/src/panels/infoModel.ts` (+ tests); modify `HabitatPanel.tsx`, `FarmPanel.tsx`, `HatcheryPanel.tsx`, `BreedPanel.tsx` entry, `RoostPanel.tsx`, `DecorationPanel.tsx`.

**Interfaces — Produces:** `infoRows(s, target, nowMs, preset): { title: string; art: string; rows: { icon: string; label: string; value: string }[]; description: string; canStore: boolean; sellLabel?: string }`; `<InfoLayout>` (plank `"<Building> level N"`, art left, rows right, Store/Sell under the art). Existing ids (`#collect-h1`, `#upgrade-h1`, `#skip-construction-*`) stay inside the dialog.

- [ ] Tests: habitat rows are max dragons, elements, max gold, description; Store runs `putInStorage` and closes; a habitat with residents has Store disabled with "Move its dragons out first"; Sell shown only for decorations (S7).
- [ ] Implement, run web tests, commit `feat(web): Info dialog layout`.

### Task 3: Upgrade dialog

**Files:** create `apps/web/src/panels/UpgradeDialog.tsx`, `upgradeModel.ts` (+ tests); modify `UpgradeSection.tsx` callers; `actionRow.ts` Upgrade intent opens `{ kind: 'upgrade', target }`.

**Interfaces — Produces:** `upgradeBenefits(s, ref, preset): { label: string; now: string; plus: string }[]`; `DialogKey` gains `{ kind: 'upgrade'; target: Target }`.

- [ ] Tests: habitat benefits show max gold now and the green increase; the price button runs `startUpgrade`; below the level the button is a lock with "Requires level N" (reference food-farm-level-up-not-enough-level); XP bubble shows the upgrade's XP.
- [ ] Implement; commit `feat(web): Upgrade dialog with benefits`.

### Task 4: Farm board

- [ ] `FarmPanel` idle state becomes a parchment board (`bg.parchment`) of crop cards in two columns: name plank, crop art, food and XP, ready time, price; ids `#plant-<plot>-<crop>` kept. Test: one card per crop, a locked crop shows its level. Commit `feat(web): Farm board of crop cards`.

### Task 5: New dragon reveal

- [ ] `NewDragon.tsx` shown after a successful `hatch` (client keeps the hatched dragon id from the result): `fx.glow` over the island, dragon bottom left with `fx.newBurst` "New", card with XP, rarity, elements, skills, income/min; Sell for N (`sellDragon`) and Place in Habitat (S8). Test both buttons. Commit `feat(web): new dragon reveal`.

### Task 6: Expand

- [ ] `PlotPanel` becomes three cards: plot for gold (`ui.expand.gold`), plot for premium (`ui.expand.dris`), unlock next island (`ui.expand.island`, "Unavailable" with reason when gated); resource footer. Test each card's action and the gated state. Commit `feat(web): Expand cards`.

### Task 7: Shop home and lists

- [ ] `ShopPanel` home: 3×2 category cards (`shop.category.*`) with yellow headers, a locked card shows lock + level. List: plank with owned/limit badge, horizontal card row, wooden footer with resource pills, filter pills, Category button opening the element strip. Ids `#shop-<item>` kept. Tests: six categories, a locked category, element filter narrows the dragon list, empty filter shows "Nothing here yet". Commit `feat(web): Shop home and lists`.

### Task 8: Storage screen

**Files:** create `apps/web/src/panels/StoragePanel.tsx`, `storageModel.ts` (+ tests); HUD Storage button (hidden since Phase 3) shown; `actionRow` buildings gain Store only in Info (rule unchanged).

**Interfaces — Produces:** `storageItems(s, nowMs, catalog): { key: string; kind: 'egg' | 'dragon' | 'building' | 'token'; name: string; filter: 'dragons' | 'eggs' | 'buildings' | 'items'; use?: StorageUse; sell?: ClientAction }[]` where `StorageUse = { kind: 'place'; target: MovableRef; size: Footprint } | { kind: 'run'; action: ClientAction }`.

- [x] Tests: plank count equals item count; search filters by name; filter panel left narrows by kind; Use on a building starts Move placement and closes; Use on an egg runs `takeEgg`; Use on a dragon opens the home finder; empty Storage says "Storage is empty" with Go to shop. Commit `feat(web): Storage screen`.

### Task 9: Goals

- [x] Goals dialog: tabs Recommended / All; rows with icon, title, hint, reward pills, Claim (`claimGoal`) or Go (opens the goal's place). `goalRows(s)` model test. Commit `feat(web): Goals tabs and rows`.

### Task 10: Dragon detail

- [x] `DragonPanel`: plank with type + rarity; name; dragon on a backdrop; level and stars left; Feed N; stats card with bars (`icon.health/damage/speed`); side tabs (Stats, Moves); Move (home finder). Ids `#feed-*`, `#sell-*` kept. Commit `feat(web): Dragon detail layout`.

### Task 11: Breeding and Dragon Book

- [x] `BreedPanel` full screen on `bg.breeding`: Parent 1 / Parent 2 lists each side with search and element filter, heart in the middle. `DragonBookPanel` in `ui.book.frame` with `ui.book.ribbon` tabs left (element), search and sort, numbered card grid, silhouettes for undiscovered. Commit `feat(web): Breeding screen and Dragon Book`.

### Task 12: Quests, lineup and battle

- [x] `TrialsPanel` quests: sideways tall cards (`ui.quest.card`) with XP badge, title ribbon, boss art, "Completed n/m", Battle or lock. Lineup: plank with cup badge, three slots with Select Dragon, Go to Battle, opponents strip. `BattlePanel`: portraits, stars, HP bars top corners, `ui.battle.vs` with round number, bench down each side, Swap, move buttons along the bottom. Commit `feat(web): Quests, lineup and battle layouts`.

### Task 13: Verify and report

- [ ] `pnpm -r typecheck`, web + game-core + server unit tests, full e2e, playtest (store a habitat and place it back, every dialog), screenshots 1920×1080 and 844×390 next to each reference, font check; report `docs/superpowers/reports/2026-11-02-ui-rework-phase5-report.md`.
