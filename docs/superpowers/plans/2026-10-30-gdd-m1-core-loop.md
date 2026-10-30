# M0 Teardown + M1 Core Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove every system the GDD overrides (seasons, SP, Hoard, gold sell-back, referrals, non-GDD store items), then make the core loop (§1.3) run on GDD data: 10 elements, 5 rarities, Flash presets, habitat income and caps, farms and crops, 4-feed levelling with evolution stages, and the genre HUD with a Terminal countdown.

**Architecture:** `packages/game-core` stays the pure rules engine; every GDD number moves into `packages/game-core/src/data/*.ts` tables that game logic reads through small typed functions, and the active Flash preset is a parameter (`ActionCtx.preset`). The server adds a game clock (`LAUNCH_AT`, preset) in place of seasons. The web client keeps its island/HUD skeleton and re-points panels at the new data and actions.

**Tech Stack:** TypeScript, Vitest, Fastify + Drizzle (PGlite in dev), React + Phaser, Playwright, pnpm workspace. Tests and the game run only on shiko's PC (Remote Control).

**Spec:** `docs/dragon-island-gdd.md` (§ references below), with `docs/superpowers/specs/2026-10-30-gdd-rulings.md` (A# answers, R# rulings) and the roadmap `docs/superpowers/plans/2026-10-30-gdd-roadmap.md`.

## Global Constraints

- `packages/game-core` is pure: no I/O, no `Date.now()`, no `Math.random()`; `nowMs`, `Rng`, `catalog` and `preset` are parameters (CLAUDE.md).
- Gold, Food and USD amounts are integers (USD in micro-dollars). The only float in currency code is the speed-up exponent (R8); gold per minute is kept in twentieths (R7).
- Every GDD number lives in `packages/game-core/src/data/`; game logic never holds a literal from the GDD. Each data file names its GDD section in a header comment.
- Flash-14 is the default preset (A2); Flash-28 is a second preset object, never a code path (§7.2).
- Element ids are `terra flame sea nature electric ice metal dark light war` in that order (A3, §2.1). Old ids `fire water earth` disappear everywhere, including art manifest keys and file names.
- Original art and names only; Dragon City material is reference, not content (CLAUDE.md, shiko's UI direction).
- Conventional commits, one commit per task, TDD: failing test first.
- Mobile-first portrait layout; every tap target at least 44 px (UI direction).
- No save migration: `PlayerState.version` (R2).

## Review Focus

1. A habitat that is already at its Gold Cap must stop accruing: collecting after 10 hours yields exactly the cap, and the HUD shows FULL (§5.2). Pinned in Task B6.
2. Feeding with exactly the Food cost must succeed and leave 0 Food; feeding at the level cap (7 without a Roost) must fail with `MAX_LEVEL` and the button must read "Upgrade Roost" (§4.1–4.2). Pinned in Task B5 and B11.
3. A state saved before this plan (no `version`) must not crash `/me`; it is replaced by a fresh player and logged (R2). Pinned in Task A4.
4. The Flash-28 preset must divide breed/build timers by 4 and multiply crop yield by 8 without any code branch: swapping the preset in the test harness must change only numbers (§7.2). Pinned in Task B1 and B7.
5. Collecting Gold must award 0 XP (§4.3 "prevents tap-farming"), and harvesting after the preset halves the timer must be ready at exactly `plantedAt + classicMs / 2` (§5.3). Pinned in Task B7 and B9.

---

## File structure (end state of this plan)

```
packages/game-core/src/
  data/presets.ts          §7.2 Flash presets + phase tables (§1.5)
  data/elements.ts         §2.1 strong lists, opposite pairs (§3.3), element tiers (§3.5)
  data/stats.ts            §2.4 HP/ATK at Lv 40 per rarity, stat curve
  data/breeding-timers.ts  §3.5 classic breed/hatch timers by rarity × tier
  data/xp.ts               §4.3 hatch XP per rarity (curve and other sources: M3)
  data/dragon-levels.ts    §4.1 food per feed, feeds per level, §4.2 Roost level caps, evolution stages
  data/habitats.ts         §5.1 income, §5.2 habitat table, caps, costs, A5 timers, Golden Aerie (R3)
  data/farms.ts            §5.3 crops, farm levels, farm unlock PLs, farm build cost
  data/speedups.ts         §3.6 skip price
  elements.ts              re-exports data + elementMultiplier (0 | 0.5 | 1 | 2) + DAMAGE_MATRIX (derived)
  rarity.ts                5 rarities + GPM multipliers (§5.1)
  game-clock.ts            gameDay, phaseOf, finalsLockAtMs (§1.5)
  dragon.ts                goldPerMinuteX20, stageOf, levelCap wrappers
  habitat.ts               storedGold, habitatCap, capacity, canLiveIn, residents
  farm.ts                  cropGrowMs, cropFood, farmBuildGold
  buildings.ts             upgradeInfo for habitat/farm/breeding/hatchery (hatchery/breeding tables: M2)
  store.ts                 StoreItem = skip | foodPack | habitatL5 | farmL5 | goldenAerie
  state.ts                 PlayerState v2 (no hoard/sell/ledger/oddsBoosts/earningUnlocked; + version, roostTier, Dragon.feeds)
  actions/*                handlers updated; sellGold removed
packages/shared/src/       schemas and API types without seasons/SP/referral/hoard; + GameInfo
apps/server/src/
  config.ts                + LAUNCH_AT, PRESET; − referral/season bits
  db/schema.ts             + game (secret, launch); − seasons, vault_inflows, season_prizes, sp_ledger, referral_payouts
  drizzle/0007_gdd_teardown.sql
  services/game.ts         ensureGame (secret + commit), gameInfo
  routes/game.ts           GET /game
  services/actions.ts      seeds from the game secret; no SP; no referral
apps/web/src/
  hud/Hud.tsx              pills, Terminal clock, bottom bar Shop/Breed/Dragon Book/Battle/Wings/Quests/Inbox
  hud/TerminalClock.tsx    countdown to Finals Lock / shutdown
  panels/HabitatPanel.tsx  residents, Gold/min, cap, FULL, collect
  panels/FarmPanel.tsx     crop picker (crop, time, cost, yield), timer, ready, harvest
  panels/DragonPanel.tsx   element icons, level, 4-pip feed, Gold/min, HP/ATK, Move
  panels/ShopPanel.tsx     Build (habitats/farms/decorations) + Store (skips, food pack, L5 upgrades, Golden Aerie) tabs
  game/islandModel.ts      FULL/gold badges, stage sprites
docs/art/gdd-m1-art-list.md  art for the PixelLab thread
```

---

# Part A: M0 teardown (A1, A1b, GDD overrides)

### Task A1: Commit the GDD, rulings and plans; point CLAUDE.md at the GDD

**Files:**
- Add: `docs/dragon-island-gdd.md` (already on disk, untracked)
- Create: `docs/superpowers/specs/2026-10-30-gdd-rulings.md`, `docs/superpowers/plans/2026-10-30-gdd-roadmap.md`, `docs/superpowers/plans/2026-10-30-gdd-m1-core-loop.md` (copied from the project Library `gdd/` folder)
- Modify: `CLAUDE.md` line 4 ("Design source of truth")

- [ ] **Step 1: Copy the three documents into the repo paths above**
- [ ] **Step 2: Edit `CLAUDE.md`**: replace the "Design source of truth" line with `Design source of truth: docs/dragon-island-gdd.md (the GDD) + docs/superpowers/specs/2026-10-30-gdd-rulings.md. Older specs in docs/superpowers/specs/ are history.`
- [ ] **Step 3: Commit**

```bash
git add docs/dragon-island-gdd.md docs/superpowers CLAUDE.md
git commit -m "docs: adopt the Dragon Island GDD as the source of truth; rulings, roadmap and M0/M1 plan"
```

### Task A2: game-core teardown (Hoard, sell-back, prizes, season reset, legacy layout, non-GDD store items)

**Files:**
- Delete: `src/sell.ts`, `src/prizes.ts`, `src/legacy-layout.ts`, `test/sell.test.ts`, `test/prizes.test.ts`, `test/legacy-layout.test.ts`
- Modify: `src/state.ts`, `src/wallet.ts`, `src/store.ts`, `src/trophy.ts`, `src/index.ts`, `src/actions/types.ts`, `src/actions/apply.ts`, `src/actions/validate.ts`, `src/actions/economy-actions.ts`, `src/actions/breed-actions.ts`, `src/actions/island-actions.ts`, `src/actions/build-actions.ts`, `src/island.ts`, `src/placement-rules.ts`, `src/breeding.ts`
- Tests to update: `test/wallet.test.ts`, `test/store.test.ts`, `test/economy-actions.test.ts`, `test/state.test.ts`, `test/placement-rules.test.ts`, `test/build-actions.test.ts`, `test/island-actions.test.ts`, `test/trophy.test.ts`, `test/breed-actions.test.ts`, `test/breeding.test.ts`, `test/review-fixes.test.ts`

**Interfaces:**
- Produces: `PlayerState` without `eligibleGold`, `hoardLevel`, `hoardPlacement`, `sell`, `ledger`, `earningUnlocked`, `oddsBoosts`; with `version: 2` (`STATE_VERSION = 2` exported from `state.ts`). `earnGold(s, amount)` (no `eligible` flag), `spendGold(s, amount)`. `StoreItem = { kind: 'skip'; target: SkipTarget; index: number } | { kind: 'foodPack' }`. `BreedContext = { pity }` (boost gone). `Action` without `sellGold`; `Effect` without `payout`. `OccupantRef`/`MovableRef` without `hoard`; `PlacementSubject` without `hoard` and `nest` purchase (nests are no longer bought: `MAX_NESTS` stays for M2 to replace).

- [ ] **Step 1: Write the failing tests** in `test/state.test.ts`:

```ts
it('new players carry the state version and no removed fields', () => {
  const s = newPlayer(0)
  expect(s.version).toBe(STATE_VERSION)
  expect(s).not.toHaveProperty('hoardLevel')
  expect(s).not.toHaveProperty('eligibleGold')
  expect(s).not.toHaveProperty('ledger')
  expect(s).not.toHaveProperty('oddsBoosts')
})
```
and in `test/economy-actions.test.ts`: `applyAction(s, { type: 'sellGold', gold: 1 } as never, ...)` returns `{ ok: false, error: 'INVALID_ACTION' }`; `buy` of `{ kind: 'oddsBoost' }`, `{ kind: 'levelUp', dragonId: 'd1' }`, `{ kind: 'nest', placement }`, `{ kind: 'hoard' }` each return `INVALID_ACTION`; `buy { kind: 'foodPack' }` still adds `FOOD_PACK` food with a `charge` effect of 500,000.

- [ ] **Step 2: Run `pnpm --filter @wyrmhaven/game-core test`** — expected: the new tests fail; many old tests still pass.
- [ ] **Step 3: Delete the files listed and remove every reference**: `sell`, `HOARD*`, `MICRO_USD_PER_GOLD`, `eligibleGold`, `earnGold(..., eligible)` third argument, `hoard` placement subject, `nest`/`levelUp`/`oddsBoost`/`hoard` store items and their `priceMicroUsd` cases, `seasonResetTrophies`, `prizes` exports, `layoutLegacyState`, `BreedContext.boost` and `tierWeights(scoreSum, boost)` → `tierWeights(scoreSum)`, `ActionError` values `EARNING_LOCKED | NO_HOARD | SELL_LIMIT_REACHED | MAX_NESTS`. Add `version: STATE_VERSION` to `newPlayer`.
- [ ] **Step 4: Delete or trim the tests that covered removed behaviour** (sell-back, hoard placement, nest purchase, legacy layout, odds boost, prizes, season reset). Keep every other assertion.
- [ ] **Step 5: Run the suite and typecheck**: `pnpm --filter @wyrmhaven/game-core test && pnpm --filter @wyrmhaven/game-core typecheck` — expected: PASS.
- [ ] **Step 6: Commit** — `refactor(game-core): remove Hoard, gold sell-back, prizes, season reset and non-GDD store items (GDD overrides, A1)`

### Task A3: shared package teardown

**Files:**
- Modify: `packages/shared/src/actions.ts`, `packages/shared/src/api.ts`, `packages/shared/test/actions.test.ts`

**Interfaces:**
- Produces: `clientActionSchema` without `sellGold`; `storeItemSchema` = skip | foodPack; `movableRefSchema` without `hoard`; `MeResponse` without `season` (a `game: GameInfo` field is added in Task B2); `ActionResponse` without `sp`; `SeasonInfo`, `SpResponse`, `LeaderboardRow`, `LeaderboardResponse`, `ReferralMeResponse`, `ReferralClaimRequest`, `PrizeInfo`, `PrizeResponse` deleted.

- [ ] **Step 1: Write the failing test** in `test/actions.test.ts`: `clientActionSchema.safeParse({ type: 'sellGold', gold: 1 }).success === false`; `storeItemSchema.safeParse({ kind: 'oddsBoost' }).success === false`; `storeItemSchema.safeParse({ kind: 'foodPack' }).success === true`.
- [ ] **Step 2: Run `pnpm --filter @wyrmhaven/shared test`** — expected: FAIL.
- [ ] **Step 3: Apply the schema and type removals above.**
- [ ] **Step 4: Run tests and `pnpm --filter @wyrmhaven/shared typecheck`** — expected: PASS.
- [ ] **Step 5: Commit** — `refactor(shared): drop season, SP, referral and hoard wire types`

### Task A4: server teardown (seasons, SP, prizes, referrals, inflows) and the game secret

**Files:**
- Delete: `src/services/season.ts`, `src/services/seasonBackfill.ts`, `src/services/standings.ts`, `src/services/inflows.ts`, `src/services/sp.ts`, `src/services/referrals.ts`, `src/jobs/seasonClose.ts`, `src/routes/season.ts`, `src/routes/referral.ts`, `src/scripts/backfillSeasons.ts`, and their tests (`season`, `seasonBackfill`, `seasonClose`, `standings`, `inflows`, `sp`, `referrals`, `review-fixes-live` parts, `admin-live` parts)
- Create: `src/services/game.ts`, `drizzle/0007_gdd_teardown.sql`, `test/game.test.ts`
- Modify: `src/db/schema.ts`, `src/app.ts`, `src/services/actions.ts`, `src/services/ledger.ts`, `src/services/battles.ts`, `src/services/auth.ts` (referral code on sign-in), `src/services/bans.ts`, `src/services/stateMigration.ts`, `src/routes/admin.ts`, `src/routes/e2e.ts`, `src/jobs/scheduler.ts`, `src/config.ts`, `src/plugins/geo.ts` (route list), tests `actions`, `admin-busy`, `bans`, `battles`, `prune`, `smoke`, `stateMigration`, `review-fixes`

**Interfaces:**
- Produces: table `game` (`id integer primary key` = 1, `secret_hex text`, `commit_hash text`, `revealed boolean default false`, `created_at`). `ensureGame(db, clock): Promise<Game>` creates row 1 with `newSecret()`/`commitHash()` from `services/seed.ts`. `actionLog.seasonId` dropped. `runAction` derives seeds from `game.secretHex` (labels unchanged). `charge()` books `spendBatches` only (no referral, no inflow). `migrateState(raw, nowMs)` returns `newPlayer(nowMs)` and calls the injected `onReset?: () => void` when `raw.version !== STATE_VERSION`. `/me` returns no `season`, no `earningUnlocked` use in state (column stays for M7). Admin routes keep bans, jobs, price, beta allowlist; drop seasons, standings, referrals.

- [ ] **Step 1: Write the failing tests**: `test/game.test.ts` — `ensureGame` returns the same row on two calls and `commitHash(secret)` matches; `test/stateMigration.test.ts` — a state without `version` becomes `newPlayer(now)` and `onReset` is called once; `test/actions.test.ts` — a `startBreed` action succeeds without a `seasons` table and its log row has no `season_id`.
- [ ] **Step 2: Run `pnpm --filter @wyrmhaven/server test`** — expected: the new tests fail.
- [ ] **Step 3: Write `drizzle/0007_gdd_teardown.sql`**: `create table game (...)`; `alter table action_log drop column season_id`; `drop table season_prizes, vault_inflows, sp_ledger, referral_payouts, seasons`; `alter table players drop column referrer_id`. Mirror it in `schema.ts`.
- [ ] **Step 4: Implement `services/game.ts`** (`ensureGame`, `getGame`) and switch `services/actions.ts` and `services/battles.ts` to it; delete the files listed; strip SP from `runAction` (`awardSp` dep and `sp` in the body), referral from `charge` and sign-in, season jobs from `app.ts`/`scheduler.ts`, `sp` from `e2e/grant`.
- [ ] **Step 5: Delete the tests of removed services; fix the remaining tests' helpers** (`testApp.ts` no longer seeds a season).
- [ ] **Step 6: Run tests and typecheck** — expected: PASS.
- [ ] **Step 7: Commit** — `refactor(server): replace seasons with one game secret; remove SP, prizes, inflows and referrals (A1, A1b)`

### Task A5: web teardown

**Files:**
- Delete: `src/panels/HoardPanel.tsx`, `src/panels/SeasonPanel.tsx`, `src/panels/ReferralPanel.tsx`, `src/pages/Verify.tsx`, `e2e/season.spec.ts`, tests `live.test.tsx`, hoard/season/referral cases in `panels.test.tsx`, `hud.test.tsx`, `review-fixes.test.tsx`, `final-fixes.test.tsx`, `build-shop.test.tsx`, `admin.test.tsx`
- Modify: `src/App.tsx`, `src/hud/Hud.tsx`, `src/hud/hudModel.ts`, `src/panels/PanelHost.tsx`, `src/panels/StorePanel.tsx`, `src/panels/BuildShopPanel.tsx`, `src/panels/BreedPanel.tsx` (no boost/pity copy), `src/pages/Admin.tsx`, `src/api/client.ts`, `src/api/admin.ts`, `src/state/actions.ts` (`lastSp`), `src/state/placing.ts`, `src/game/buildingInfo.ts`, `src/game/islandModel.ts`, `src/game/scenes/IslandScene.ts`, `src/game/bridge.ts` (`hoard` target), `src/art/types.ts`, `src/art/fromManifest.ts`, `src/art/fallback.ts` (hoard sprite), `e2e/helpers.ts`, `e2e/hud.spec.ts`

**Interfaces:**
- Produces: HUD right column = Map, Settings only; bottom bar unchanged for now except Hoard removed (relabelled in Task B12); `PanelId` without `hoard | season | ranks | referral`; `Target` without `hoard`.

- [ ] **Step 1: Write the failing tests** in `test/hud.test.tsx`: the HUD renders no button named Hoard, Season, Ranks or Referral; the gold pill has no "sell … today" sub-label.
- [ ] **Step 2: Run `pnpm --filter @wyrmhaven/web test`** — expected: FAIL.
- [ ] **Step 3: Remove the panels, pages, routes, HUD buttons, hoard placement/rendering and `lastSp`; delete the obsolete tests and e2e spec.**
- [ ] **Step 4: Run tests and typecheck** — expected: PASS.
- [ ] **Step 5: Commit** — `refactor(web): remove Hoard, season, ranks, referral and verify screens`

### Task A6: M0 verification

- [ ] **Step 1: `pnpm -r typecheck && pnpm test`** — expected: every package green. Record counts.
- [ ] **Step 2: `pnpm playtest`**, sign in with the test wallet, collect gold, plant and harvest, breed and hatch** — expected: no console errors; state resets once (R2).
- [ ] **Step 3: Commit nothing; note the counts in the final report.**

---

# Part B: M1 core loop (§1, §4.1, §5.1–5.3, §7.2)

### Task B1: Flash presets and the game clock (§7.2, §1.5, A2)

**Files:**
- Create: `src/data/presets.ts`, `src/game-clock.ts`, `test/presets.test.ts`, `test/game-clock.test.ts`
- Modify: `src/actions/types.ts` (`ActionCtx.preset`), `src/actions/apply.ts` (`applyAction(s, a, nowMs, rng, catalog = LAUNCH_CATALOG, preset = DEFAULT_PRESET)`), `src/index.ts`

**Interfaces:**
- Produces:
```ts
export type PresetId = 'flash14' | 'flash28'
export interface Preset {
  id: PresetId
  days: number                       // 14 | 28
  goldMult: number                   // dragon Gold/min and habitat caps: 10 | 6
  cropYieldMult: number              // 12 | 8
  cropTimerDiv: number               // 2 | 1.5
  timerDiv: number                   // breed, hatch, build: 6 | 4
  xpMult: number                     // 12 | 8
  healPctPerMin: number              // 6 | 4
  arenaEnergyRegenMs: number         // 3_600_000 | 5_400_000
  phases: { rush: [number, number]; endgame: [number, number]; finals: [number, number]; settlement: [number, number] } // §1.5 day ranges
}
export const FLASH_14: Preset, FLASH_28: Preset, PRESETS: Record<PresetId, Preset>, DEFAULT_PRESET = FLASH_14
export type Phase = 'prelaunch' | 'rush' | 'endgame' | 'finals' | 'settlement' | 'closed'
export function gameDay(launchAtMs: number, nowMs: number): number        // 1 on launch day, 0 before launch
export function phaseOf(day: number, preset: Preset): Phase
export function finalsLockAtMs(launchAtMs: number, preset: Preset): number // end of the last finals day
export function shutdownAtMs(launchAtMs: number, preset: Preset): number   // end of settlement
```
- [ ] **Step 1: Write the failing tests**: `FLASH_14` equals the §7.2 column (`goldMult 10, cropYieldMult 12, cropTimerDiv 2, timerDiv 6, xpMult 12, healPctPerMin 6, arenaEnergyRegenMs 3_600_000`), `FLASH_28` the other column; phases: flash14 rush `[1,4]`, endgame `[5,12]`, finals `[13,14]`, settlement `[15,21]`; flash28 `[1,7]`, `[8,25]`, `[26,28]`, `[29,35]`; `gameDay(0, 0) === 1`, `gameDay(0, 86_400_000) === 2`, `gameDay(10, 0) === 0`; `phaseOf(13, FLASH_14) === 'finals'`, `phaseOf(22, FLASH_14) === 'closed'`; `finalsLockAtMs(0, FLASH_14) === 14 * 86_400_000`.
- [ ] **Step 2: Run** `pnpm --filter @wyrmhaven/game-core test -- presets game-clock` — expected: FAIL (module not found).
- [ ] **Step 3: Implement the two files and thread `preset` through `ActionCtx` and `applyAction`** (handlers get it; nothing reads it yet).
- [ ] **Step 4: Run tests** — expected: PASS.
- [ ] **Step 5: Commit** — `feat(game-core): Flash-14/28 presets and the game clock (GDD §7.2, §1.5)`

### Task B2: server game clock and `/game` (§1.5, A12)

**Files:**
- Modify: `apps/server/src/config.ts` (`LAUNCH_AT: z.string().datetime().optional()`, `PRESET: z.enum(['flash14','flash28']).default('flash14')`), `src/services/game.ts` (`gameInfo`), `src/app.ts` (`/me` adds `game`), `src/services/actions.ts` (passes `PRESETS[config.PRESET]` to `applyAction`)
- Create: `src/routes/game.ts`, `test/game-routes.test.ts`
- Modify: `packages/shared/src/api.ts` (`GameInfo`, `MeResponse.game`)

**Interfaces:**
- Produces: `GameInfo { launchAtMs: number; preset: PresetId; day: number; phase: Phase; commitHash: \`0x${string}\`; revealedSecret: \`0x${string}\` | null }`. `GET /game` returns it. When `LAUNCH_AT` is unset the launch time is the `game` row's `created_at` (dev default) and the row stores `launch_at` (add the column in `0007`).

- [ ] **Step 1: Write the failing test**: with the test clock at `launchAt + 5 days`, `GET /game` returns `day 6`, `phase 'endgame'`, `preset 'flash14'`; `/me` carries the same `game`.
- [ ] **Step 2: Run** — expected: FAIL (404).
- [ ] **Step 3: Implement** the route, `gameInfo(db, clock, config)`, and the preset pass-through.
- [ ] **Step 4: Run tests + typecheck** — expected: PASS.
- [ ] **Step 5: Commit** — `feat(server): game clock, preset config and GET /game (GDD §1.5, A12)`

### Task B3: ten elements, the damage matrix and the rename (§2.1–2.3, §3.3, §3.5, A3)

**Files:**
- Create: `src/data/elements.ts`, `test/elements-matrix.test.ts`
- Modify: `src/elements.ts`, `src/data/launch-catalog.ts` (10 Basics, ids = element ids, placeholder names `Terra Basic` … `War Basic`), `src/state.ts` (`newPlayer` species/habitat ids), `src/battle/stats.ts` (`BattleMove.element: MoveElement`, `STRIKE.element = 'physical'`), `src/battle/sim.ts`, `test/fixtures.ts`, every test using `fire/water/earth`, `packages/shared/src/actions.ts` (`elementSchema`), `apps/server` tests, `apps/web/src/art/*`, `apps/web/public/art/v1/manifest.json` + file renames (`*-fire.png → *-flame.png`, `*-water.png → *-sea.png`, `*-earth.png → *-terra.png`, same for `icon.*` keys), `apps/web/e2e/*`, `apps/web/src/art/fallback.ts` (colours for the 10 elements), `apps/waitlist/src/domain/elements.ts` (its own 9-element list: add `war` and rename ids; its manifest keys likewise)

**Interfaces:**
- Produces:
```ts
export type Element = 'terra'|'flame'|'sea'|'nature'|'electric'|'ice'|'metal'|'dark'|'light'|'war'
export const ELEMENTS: readonly Element[]                         // GDD order
export type MoveElement = Element | 'physical'
export const STRONG_AGAINST: Record<Element, readonly [Element, Element]>  // §2.1 "Strong against"
export const OPPOSITE_PAIRS: readonly (readonly [Element, Element])[]     // §3.3: flame-ice, nature-electric, terra-dark, sea-war
export type ElementTier = 'A' | 'B' | 'C'
export const ELEMENT_TIER: Record<Element, ElementTier>           // §3.5
export function isOpposite(a: Element, b: Element): boolean
export function highestTier(elements: readonly Element[]): ElementTier
export type Mult = 0 | 0.5 | 1 | 2
export function elementMultiplier(move: MoveElement, defenderPrimary: Element): Mult
export const DAMAGE_MATRIX: Record<Element, Record<Element, Mult>>   // derived from STRONG_AGAINST
```
Rules in `elementMultiplier`: `physical` → 1; same element → 0; move strong against defender → 2; defender strong against move → 0.5, **except** dark/light both ways → 2 (§2.1); else 1.

- [ ] **Step 1: Write the failing test** `elements-matrix.test.ts` holding the **literal §2.2 table** (10 rows × 10 columns plus the Physical row) and asserting `DAMAGE_MATRIX[atk][def]` equals every cell, `elementMultiplier('physical', e) === 1` for all `e`, `elementMultiplier(e, e) === 0`, `isOpposite('flame','ice') && isOpposite('ice','flame')`, `OPPOSITE_PAIRS.length === 4`, `highestTier(['terra','war']) === 'C'`, each element has exactly 2 strengths and exactly 2 weaknesses (count of 2s per row and per column, excluding dark/light which have 2 strengths and 2 weaknesses too but only one 0.5).
- [ ] **Step 2: Run** — expected: FAIL.
- [ ] **Step 3: Implement `data/elements.ts` and `elements.ts`; rename ids everywhere; rename art files and manifest keys with a script run once (`node -e` or PowerShell), not by hand; regenerate `fallback.ts` colours for 10 elements (War: dark red).**
- [ ] **Step 4: `pnpm -r test && pnpm -r typecheck`** — expected: PASS (battle tests update their expected multipliers: 0× now exists).
- [ ] **Step 5: Commit** — `feat: ten GDD elements with the §2.2 damage matrix; rename fire/water/earth to flame/sea/terra (A3)`

### Task B4: five rarities, stat curve, breed timers, hatch XP, sell Gold (§2.4, §3.5, §4.3, §5.1, A9)

**Files:**
- Create: `src/data/stats.ts`, `src/data/breeding-timers.ts`, `src/data/xp.ts`, `src/data/sell.ts`, tests `stats.test.ts`, `breeding-timers.test.ts`
- Modify: `src/rarity.ts`, `src/battle/stats.ts` (`combatStats` → `{ hp, atk }`, no `spd`; `turnOrder` in `sim.ts` falls back to slot order until M5), `src/catalog.ts` (drop `baseSpeed`; `validateCatalog` allows 1–3 elements), `src/actions/breed-actions.ts` (timers via `breedTimerMs`, XP via `HATCH_XP`), `src/actions/island-actions.ts` (`sellDragon` via `SELL_GOLD`), `src/buildings.ts` (`nestBreedMs` unchanged), `src/matchmaking.ts`, `src/pve.ts` (`BOT_RARITIES`), tests touching `RARITY.*`

**Interfaces:**
- Produces:
```ts
export type Rarity = 'common'|'uncommon'|'rare'|'epic'|'legendary'
export const RARITIES: readonly Rarity[]
export const GPM_RARITY_MULT_TENTHS: Record<Rarity, number>   // 10,12,15,20,25 (§5.1)
export const HP_AT_40: Record<Rarity, number>                 // 8000, 9000, 10000, 12000, 14000 (§2.4)
export const ATK_AT_40: Record<Rarity, number>                // 0.40 × HP_AT_40
export function statAt(stat40: number, level: number): number // round(stat40 × (780 + 80(L−1)) / 3900), R6
export function hpAt(r: Rarity, level: number): number; export function atkAt(r: Rarity, level: number): number
export const BREED_TIMER_CLASSIC_MS: Record<Rarity, Record<ElementTier, number>>  // §3.5 classic column
export function breedTimerMs(r: Rarity, elements: readonly Element[], preset: Preset): number  // floor(classic / timerDiv)
export const HATCH_XP: Record<Rarity, number>                 // 10, 30, 80, 200, 500 (§4.3)
export const SELL_GOLD: Record<Rarity, number | null>         // 100, 500, 2500, 10000, null (A9)
```
`RARITY` (the old record) is deleted.

- [ ] **Step 1: Write the failing tests**: `hpAt('legendary', 1) === 2800`, `hpAt('legendary', 20) === 8256`, `hpAt('common', 10) === 3077`, `hpAt('rare', 40) === 10000`, `atkAt('legendary', 20) === 3303`, `atkAt('common', 40) === 3200`, `atkAt('uncommon', 1) === 720`; `breedTimerMs('common', ['terra'], FLASH_14) === 5_000`, `breedTimerMs('common', ['dark'], FLASH_14) === 600_000`, `breedTimerMs('uncommon', ['terra','ice'], FLASH_14) === 600_000`, `breedTimerMs('rare', ['war'], FLASH_14) === 4_800_000`, `breedTimerMs('epic', ['electric'], FLASH_14) === 10_800_000`, `breedTimerMs('legendary', ['terra'], FLASH_14) === 28_800_000`, `breedTimerMs('epic', ['electric'], FLASH_28) === 16_200_000`.
- [ ] **Step 2: Run** — expected: FAIL.
- [ ] **Step 3: Implement the data files; delete `RARITY`; update callers** (hatch time = breed time: `collectEgg` uses `breedTimerMs` too, §3.5).
- [ ] **Step 4: Run all game-core tests + typecheck** — expected: PASS (battle tests re-pin numbers from the new stats).
- [ ] **Step 5: Commit** — `feat(game-core): five rarities, §2.4 stat curve, §3.5 breed timers, hatch XP and sell values`

### Task B5: feeding, level caps and evolution stages (§4.1, §4.2 caps, §4.3 feed XP)

**Files:**
- Create: `src/data/dragon-levels.ts`, `test/dragon-levels.test.ts`
- Modify: `src/dragon.ts`, `src/state.ts` (`Dragon.feeds: number`, `PlayerState.roostTier: number` = 0), `src/actions/island-actions.ts` (`feed`), `src/actions/breed-actions.ts` (`hatch` sets `feeds: 0`), `src/actions/types.ts` (`ActionError` + `LEVEL_CAP`), tests `island-actions.test.ts`, `dragon.test.ts`

**Interfaces:**
- Produces:
```ts
export const MAX_DRAGON_LEVEL = 40
export const FEEDS_PER_LEVEL = 4
export const BREED_MIN_LEVEL = 4               // moved here from breed-actions (re-exported)
export function foodPerFeed(level: number): number       // ⌈5 × 1.2^(L−1)⌉ via integers (R5)
export function foodForLevel(level: number): number      // 4 × foodPerFeed
export function totalFoodTo(level: number): number       // Σ foodForLevel(1 … level−1)
export const ROOST_LEVEL_CAPS: readonly number[]         // [7, 10, 15, 20, 30, 40] index = roostTier (§4.2)
export function levelCap(roostTier: number): number
export type Stage = 'baby' | 'juvenile' | 'adult'
export function stageOf(level: number): Stage            // 1–3, 4–6, 7+ (§4.1)
export function feedXp(food: number): number             // max(1, floor(food / 10)) (§4.3)
```
`feed` handler: fails `LEVEL_CAP` when `d.level >= levelCap(s.roostTier)`, `INSUFFICIENT_FOOD` when `s.food < foodPerFeed(d.level)`; otherwise spends the food, `feeds + 1`; at `FEEDS_PER_LEVEL` the dragon gains a level and `feeds` resets to 0; awards `feedXp(cost)` (collect-before-change still applies).

- [ ] **Step 1: Write the failing tests**: `foodPerFeed(1) === 5`, `foodPerFeed(3) === 8` (the §4.1 row "3 to 4"), `foodPerFeed(6) === 13`, `foodPerFeed(9) === 22`, `foodPerFeed(14) === 54`, `foodPerFeed(19) === 134`, `foodPerFeed(24) === 332`, `foodPerFeed(29) === 825`, `foodPerFeed(39) === 5104`, `foodForLevel(39) === 20416`, `totalFoodTo(40) === 122460` and `Math.abs(totalFoodTo(40) - 122382) / 122382 < 0.001`; `stageOf(3) === 'baby'`, `stageOf(4) === 'juvenile'`, `stageOf(7) === 'adult'`; `levelCap(0) === 7`, `levelCap(5) === 40`; feed action: four feeds at Lv 1 cost 20 Food total and reach Lv 2 with `feeds 0`; the third feed leaves `feeds 3`; a Lv 7 dragon with `roostTier 0` → `LEVEL_CAP`; feeding with exactly `foodPerFeed` Food leaves 0 Food; XP after one Lv 1 feed is +1.
- [ ] **Step 2: Run** — expected: FAIL.
- [ ] **Step 3: Implement**; delete `foodToNextLevel`, `effLevel` (replaced in B6).
- [ ] **Step 4: Run tests + typecheck** — expected: PASS.
- [ ] **Step 5: Commit** — `feat(game-core): 4 feeds per level, §4.1 food curve, Roost level caps and evolution stages`

### Task B6: habitats on GDD data (§5.1, §5.2, A5, R3, R4, R7)

**Files:**
- Create: `src/data/habitats.ts`, `test/habitats-data.test.ts`
- Modify: `src/habitat.ts`, `src/dragon.ts` (`goldPerMinuteX20`), `src/buildings.ts` (`HABITAT_UPGRADES` from data), `src/construction.ts` (`newHabitatTimerMs` removed), `src/state.ts` (`Habitat.element: Element | 'aerie'`), `src/actions/build-actions.ts` (`placeBuilding` habitat cost/unlock/timer; `nexus` → `goldenAerie` via store), `src/store.ts` (`habitatL5`, `goldenAerie` items), `src/actions/economy-actions.ts`, `src/actions/validate.ts`, `packages/shared/src/actions.ts`, tests `habitat.test.ts`, `build-actions.test.ts`, `store.test.ts`, `island-actions.test.ts`

**Interfaces:**
- Produces:
```ts
export interface HabitatSpec { archetype: 'sprinter'|'standard'|'steady'|'vault'; base: number; inc: number; capL1: number; capL2: number; buildGold: number; upgradeL2Gold: number; unlockPl: number }
export const HABITATS: Record<Element, HabitatSpec>                  // §5.2 table, classic values
export const HABITAT_CAPACITY: readonly number[]                     // [2,3,4,5,6] index = level−1
export const HABITAT_L5_USD_MICRO: Record<ElementTier, number>       // 1_500_000 | 2_500_000 | 4_000_000
export const HABITAT_BUILD_CLASSIC_MS: Record<ElementTier, number>   // 600_000 | 3_600_000 | 14_400_000 (A5)
export const HABITAT_UPGRADE_CLASSIC_MS: readonly number[]           // [3_600_000, 14_400_000, 43_200_000, 0] to L2..L5 (A5)
export const GOLDEN_AERIE = { usdMicro: 5_000_000, capacity: 6, capMult: 3, capOf: 'war' as Element }  // §5.2, R3
export function habitatCapClassic(element: Element | 'aerie', level: number): number  // L1/L2 literal; L3 floor(L1×49/4); L4 floor(L1×429/10); L5 L1×150; aerie = 3 × War L1 (R3)
export function habitatCap(element: Element | 'aerie', level: number, preset: Preset): number   // classic × goldMult
export function habitatUpgradeGold(element: Element, toLevel: 2|3|4): number   // L2 literal, L3 = L2×4, L4 = L2×16
export function habitatBuildMs(element: Element, preset: Preset): number
export function habitatUpgradeMs(toLevel: number, preset: Preset): number
export function goldPerMinuteX20(element: Element, rarity: Rarity, level: number, preset: Preset): number
  // = GPM_RARITY_MULT_TENTHS[r] × (2·base + 2·inc·min(L−1, 9) + inc·max(L−10, 0)) × goldMult  (R7; ÷20 = gold/min)
export function storedGold(h: Habitat, residents: readonly Dragon[], c: Catalog, nowMs: number, preset: Preset): number
  // min(habitatCap, floor(minutes × Σ goldPerMinuteX20(primary element of the species, rarity, level) / 20))
export function habitatCapacity(level: number): number
```
A hybrid's income element is its primary (`species.elements[0]`, §5.1); it may live in any habitat of its elements (`canLiveIn`). `StoreItem` adds `{ kind: 'habitatL5'; habitatId }` priced `HABITAT_L5_USD_MICRO[tier]` (requires level 4, instant) and `{ kind: 'goldenAerie'; placement }` priced `GOLDEN_AERIE.usdMicro` (creates a level-5 habitat with `element: 'aerie'`, instant). `placeBuilding` for a habitat charges `HABITATS[el].buildGold`, requires `s.level >= unlockPl` (`LEVEL_TOO_LOW`), and starts a build of `habitatBuildMs`. `maxHabitats`, `habitatBuildCost`, `HABITAT_LEVELS`, `NEXUS_*` are deleted (§5: land is the only cap).

- [ ] **Step 1: Write the failing tests**: `HABITATS.terra` equals `{ base 18, inc 12, capL1 8000, capL2 28000, buildGold 500, upgradeL2Gold 10000, unlockPl 1 }` and `HABITATS.war` `{ base 7, inc 4, capL1 33000, capL2 115000, buildGold 250000, upgradeL2Gold 750000, unlockPl 18 }`; `habitatCapClassic('terra', 3) === 98000`, `habitatCapClassic('terra', 4) === 343200`, `habitatCapClassic('terra', 5) === 1_200_000`, `habitatCap('terra', 1, FLASH_14) === 80_000`, `habitatCapClassic('aerie', 5) === 99_000`; `habitatUpgradeGold('terra', 3) === 40_000`, `habitatUpgradeGold('terra', 4) === 160_000`; `goldPerMinuteX20('terra','common',1,FLASH_14) === 3600` (18 gold/min × 10 × 20); `goldPerMinuteX20('terra','common',5,FLASH_14) === 13200` (66/min ×10); `goldPerMinuteX20('terra','common',15,FLASH_14) === 31200` (18+108+30 = 156 × 10 × 20); `goldPerMinuteX20('flame','legendary',40,FLASH_28)` equals `25 × (14 + 90 + 150) × 6 = 38100`; `storedGold` of two Lv 5 Commons in a Terra L1 after 60 min in Flash-14 = `min(80000, 60 × 2 × 13200 / 20) = 79200`, after 600 min = 80000 (Review Focus 1); `habitatBuildMs('dark', FLASH_14) === 2_400_000`; `habitatUpgradeMs(2, FLASH_14) === 600_000`; buying `habitatL5` on a Tier C habitat charges 4,000,000 micro-USD and sets level 5; `goldenAerie` creates `{ element: 'aerie', level: 5 }` holding 6 dragons of any element.
- [ ] **Step 2: Run** — expected: FAIL.
- [ ] **Step 3: Implement**; the §5.2 "Sprinter vs Vault" claim (two Lv 5 Commons in Terra ≈ 136k/day with hourly check-ins) becomes a sanity test: `24 × storedGold(...60 min...)` in classic terms is between 130k and 140k.
- [ ] **Step 4: Run tests + typecheck across the workspace** — expected: PASS.
- [ ] **Step 5: Commit** — `feat(game-core): §5.2 habitat table, §5.1 income, caps, costs, A5 timers, Golden Aerie`

### Task B7: farms and crops on GDD data (§5.3, §7.2)

**Files:**
- Create: `src/data/farms.ts`, `test/farms-data.test.ts`
- Modify: `src/farm.ts`, `src/state.ts` (`CropId`), `src/buildings.ts` (`FARM_LEVELS` from data), `src/actions/farm-actions.ts`, `src/actions/build-actions.ts` (farm count gate and cost), `src/store.ts` (`farmL5`), `src/actions/validate.ts`, `packages/shared/src/actions.ts` (`cropSchema`), tests `farm.test.ts`, `farm-actions.test.ts`, `build-actions.test.ts`

**Interfaces:**
- Produces:
```ts
export type CropId = 'dragonBush'|'emberWheat'|'seaMelon'|'thunderPumpkin'|'frostBerries'|'warlordPepper'
export const CROPS: Record<CropId, { tier: 1|2|3|4|5|6; name: string; unlockPl: number; growClassicMs: number; gold: number; food: number }>
export const FARM_LEVELS: readonly { yieldPct: number; upgradeGold: number | null; upgradeUsdMicro: number | null; classicMs: number }[]
  // [{100, —}, {125, 15_000, 3_600_000}, {150, 75_000, 14_400_000}, {175, 400_000, 43_200_000}, {200, usd 2_000_000, 0}]
export const FARM_UNLOCK_PL: readonly number[]      // [1, 3, 4, 7, 10, 15, 20, 25] (§5.3, §4.4)
export const MAX_FARMS = 8
export const FIRST_FARM_GOLD = 1_000; export const FIRST_FARM_CLASSIC_MS = 60_000
export function farmBuildGold(n: number): number    // 1000 × 3^(n−1) for farm n (1-based)
export function cropGrowMs(crop: CropId, preset: Preset): number          // floor(classic / cropTimerDiv)
export function cropFood(crop: CropId, farmLevel: number, preset: Preset): number  // floor(food × cropYieldMult × yieldPct / 100)
export function cropUnlocked(crop: CropId, playerLevel: number): boolean
```
`plant` fails `LEVEL_TOO_LOW` for a locked crop. `placeBuilding { kind: 'farm' }` requires `s.farms.length < MAX_FARMS` and `s.level >= FARM_UNLOCK_PL[s.farms.length]`, charges `farmBuildGold(n)`, builds for `FIRST_FARM_CLASSIC_MS / timerDiv`. Harvest XP stays as today until M3 (Review Focus 5 pins readiness time, not XP).

- [ ] **Step 1: Write the failing tests**: `CROPS.warlordPepper` = `{ tier 6, unlockPl 15, growClassicMs 86_400_000, gold 20_000, food 2_600 }`; `CROPS.dragonBush` = `{ tier 1, unlockPl 1, growClassicMs 30_000, gold 50, food 5 }`; `cropGrowMs('dragonBush', FLASH_14) === 15_000`, `cropGrowMs('emberWheat', FLASH_28) === 200_000`; `cropFood('seaMelon', 1, FLASH_14) === 1440`, `cropFood('seaMelon', 5, FLASH_14) === 2880`, `cropFood('seaMelon', 2, FLASH_28) === 1200`; `farmBuildGold(1) === 1000`, `farmBuildGold(4) === 27_000`; a PL 2 player cannot plant `emberWheat` (`LEVEL_TOO_LOW`); a PL 3 player with 1 farm can place the 2nd farm, a PL 3 player with 2 farms cannot (`LEVEL_TOO_LOW`); harvest of `dragonBush` planted at `t` is `NOT_READY` at `t + 14_999` and ready at `t + 15_000` (Review Focus 5).
- [ ] **Step 2: Run** — expected: FAIL.
- [ ] **Step 3: Implement**; delete the old `CROPS`, `MAX_PLOTS`, `plotCost`, `FARM_PLOT_BUILD_MS`.
- [ ] **Step 4: Run tests + typecheck** — expected: PASS.
- [ ] **Step 5: Commit** — `feat(game-core): §5.3 crops, farm levels, farm unlocks and costs`

### Task B8: speed-up price, start state, state version (§3.6, R1, R2, R12)

**Files:**
- Create: `src/data/speedups.ts`, `test/speedups.test.ts`
- Modify: `src/store.ts` (`priceMicroUsd` skip case → `skipPriceMicroUsd`), `src/state.ts` (`newPlayer` per R1), `src/construction.ts` (tutorial timers removed; `TUTORIAL_TIMER_MS` deleted), `src/actions/breed-actions.ts` (no tutorial timers), `src/time.ts`, tests `store.test.ts`, `state.test.ts`, `construction.test.ts`, `breed-actions.test.ts`

**Interfaces:**
- Produces: `skipPriceMicroUsd(remainingMs: number): number` = `Math.round(100_000 × (remainingMs / 3_600_000) ** 0.68)`, minimum 1 when `remainingMs > 0`. `newPlayer(nowMs)`: gold 1000, food 50, level 1, `roostTier 0`, dragons `d1` (`terra`, Lv 1, feeds 0, in `h1`) and `d2` (`flame`, in `h2`), habitats `h1 terra L1` and `h2 flame L1`, one farm L1, hatchery L1, one nest L1 (M2 renames it), `version: STATE_VERSION`, `tutorial` reduced to `{ breedDone: false, hatchDone: false }` (M3 Goals replace it).

- [ ] **Step 1: Write the failing tests**: `skipPriceMicroUsd(600_000)` rounds to $0.03 (`Math.round(x / 10_000) === 3`), 1 h → 100_000, 3 h → $0.21, 8 h → $0.41, 24 h → $0.87 (same rounding to cents); `skipPriceMicroUsd(0) === 0`; `newPlayer(0)` has the R1 contents; a `startBreed` by two Lv 4 Basics takes `breedTimerMs(...)` and not 15 s.
- [ ] **Step 2: Run** — expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run tests + typecheck** — expected: PASS.
- [ ] **Step 5: Commit** — `feat(game-core): §3.6 speed-up curve, GDD start state (R1), tutorial timers removed`

### Task B9: habitat panel, Gold badges and coin burst (§1.3, §5.2, UI direction)

**Files:**
- Modify: `apps/web/src/panels/HabitatPanel.tsx`, `apps/web/src/game/islandModel.ts` (badge `gold` when `storedGold > 0`, `full` when at cap), `apps/web/src/game/scenes/IslandScene.ts` (tap a gold badge → `collectGold`; coin-burst via `fx.coins` when the manifest has it, else a tween of the badge), `apps/web/src/hud/hudModel.ts` (attention item "Gold ready" removed: badges cover it), tests `panels.test.tsx`, `island.test.ts`

**Interfaces:**
- Consumes: `storedGold`, `habitatCap`, `habitatCapacity`, `goldPerMinuteX20`, `stageOf` from game-core; `preset` from `/me.game.preset` via a `usePreset()` hook in `apps/web/src/state/preset.ts` (`PRESETS[me.data.game.preset]`).
- Produces: `IslandObject.badge?: 'gold' | 'full' | { timer: number }`; `HabitatPanel` shows: element icon, `Level n · x/y dragons`, `Gold/min` (sum ÷ 20, one decimal), `stored / cap`, a `Collect` button (disabled "Nothing to collect yet"), FULL label at cap, resident list (name, level, stage) each opening the dragon panel, `Upgrade` via `UpgradeSection`, `Move a dragon here` list.

- [ ] **Step 1: Write the failing tests**: `buildIslandModel` marks a habitat with stored gold `badge: 'gold'` and one at cap `badge: 'full'`; `HabitatPanel` renders "FULL" and "80,000 / 80,000" for a capped Terra L1 under Flash-14 and "1,320 gold/min" for two Lv 5 Commons (each `13200 / 20` = 660 gold/min in Flash-14).
- [ ] **Step 2: Run `pnpm --filter @wyrmhaven/web test`** — expected: FAIL.
- [ ] **Step 3: Implement**; 44 px badge hit area.
- [ ] **Step 4: Run tests + typecheck** — expected: PASS.
- [ ] **Step 5: Commit** — `feat(web): habitat panel with Gold/min, cap and FULL; tap-to-collect gold badges`

### Task B10: farm crop picker and timers (§5.3, UI direction)

**Files:**
- Modify: `apps/web/src/panels/FarmPanel.tsx` (one farm per panel: `FarmPanel({ index })`), `apps/web/src/panels/PanelHost.tsx`, `apps/web/src/game/islandModel.ts` (ripe badge), tests `panels.test.tsx`

**Interfaces:**
- Produces: tapping an empty farm opens a crop list: rows `name · grow time · cost Gold · yield Food` using `cropGrowMs`/`cropFood` for the active preset; locked crops greyed with `Level n`; a planted farm shows the growing timer and a `Harvest · n food` button when ready; `Skip · $x` from `skipPriceMicroUsd`.

- [ ] **Step 1: Write the failing test**: the picker lists six crops in tier order with `Dragon Bush · 15s · 50 gold → 60 food` for Flash-14 farm L1 and `Ember Wheat` disabled with reason `Level 3` for a PL 1 player.
- [ ] **Step 2: Run** — expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run tests + typecheck** — expected: PASS.
- [ ] **Step 5: Commit** — `feat(web): farm crop picker with time, cost and yield; growing and ready states`

### Task B11: dragon panel with 4-pip feeding and stages (§4.1, §2.4, UI direction)

**Files:**
- Modify: `apps/web/src/panels/DragonPanel.tsx`, `apps/web/src/game/islandModel.ts` (`dragonKey` picks `hatchling.*` for baby, `juvenile.*` when present for juvenile, `dragon.*` for adult, R11), `apps/web/src/art/types.ts`/`fromManifest.ts` (`juvenile: Record<string, Sprite>`), tests `panels.test.tsx`, `island.test.ts`

**Interfaces:**
- Produces: panel shows element icons (primary first), rarity, `Level n · Baby/Juvenile/Adult`, `Gold/min`, `HP x · ATK y` from `hpAt`/`atkAt`, a Feed button `Feed · n food` with a 4-pip progress row (`feeds`/4), which reads `Upgrade Roost` and is disabled when `level >= levelCap(roostTier)` (Review Focus 2), a `Move` button opening a habitat picker limited to habitats the dragon can live in with a free slot (`moveDragon`), and `Sell · n gold` (hidden for Legendary).

- [ ] **Step 1: Write the failing tests**: a Lv 1 dragon with `feeds 2` renders two filled pips and `Feed · 5 food`; a Lv 7 dragon with `roostTier 0` renders a disabled `Upgrade Roost` button; a Lv 5 dragon renders "Juvenile"; `dragonKey` returns the hatchling key for Lv 2 and the dragon key for Lv 8.
- [ ] **Step 2: Run** — expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run tests + typecheck** — expected: PASS.
- [ ] **Step 5: Commit** — `feat(web): dragon panel with element icons, 4-pip feeding, stats, stage and Move`

### Task B12: HUD bottom bar, Shop tabs and the Terminal clock (UI direction, §1.5)

**Files:**
- Create: `apps/web/src/hud/TerminalClock.tsx`, `apps/web/src/panels/ShopPanel.tsx` (tabs `Build` = today's BuildShopPanel content for habitats/farms/decorations, `Store` = skips, food pack, `habitatL5`, `farmL5`, Golden Aerie)
- Delete: `apps/web/src/panels/StorePanel.tsx`, `apps/web/src/panels/BuildShopPanel.tsx` (folded into ShopPanel)
- Modify: `apps/web/src/hud/Hud.tsx` (bottom bar: Shop, Breed, Dragon Book, Battle, Wings, Quests, Inbox; the last three disabled with "Coming in a later milestone"; pills' "+" open the Shop's Store tab; level badge + XP bar unchanged), `apps/web/src/panels/PanelHost.tsx` (`PanelId` = `shop | breed | book | battle | wings | quests | inbox | map | settings`; `book` renders today's `DragonsPanel` until M2), `apps/web/src/hud/Icon.tsx` (icon names), tests `hud.test.tsx`, `build-shop.test.tsx` → `shop.test.tsx`, `e2e/hud.spec.ts`, `e2e/build.spec.ts`

**Interfaces:**
- Consumes: `GameInfo` from `/me.game`; `finalsLockAtMs`, `shutdownAtMs`, `phaseOf`.
- Produces: `TerminalClock({ game, nowMs })` renders `Finals lock in 3d 04:12:55` during rush/endgame, `Finals end in …` during finals, `Redemption ends in …` during settlement, `Launch in …` before launch, always visible at the top centre under the pills.

- [ ] **Step 1: Write the failing tests**: bottom bar has exactly the seven names in order; Wings/Quests/Inbox are disabled; `TerminalClock` with `launchAtMs 0`, `nowMs 86_400_000 × 10 + 3_600_000` and Flash-14 renders `Finals lock in 3d 23:00:00`; the Food pill's "+" opens the Shop with the Store tab selected.
- [ ] **Step 2: Run** — expected: FAIL.
- [ ] **Step 3: Implement**; every bar button ≥ 44 px (CSS, existing `hud-round` size).
- [ ] **Step 4: Run tests + typecheck + `pnpm --filter @wyrmhaven/web test:e2e`** — expected: PASS.
- [ ] **Step 5: Commit** — `feat(web): genre bottom bar, Shop with Build/Store tabs, Terminal countdown`

### Task B13: art list for the PixelLab thread

**Files:**
- Create: `docs/art/gdd-m1-art-list.md`
- Modify: `apps/web/src/art/fromManifest.ts` (keys `habitat.war`, `dragon.war`, `hatchling.war`, `egg.war`, `icon.war.16/32`, `juvenile.<species>`, `building.goldenAerie`, `crop.<cropId>` for the six crops, `fx.coins`)

- [ ] **Step 1: Write the list** with the same table format as `docs/art/hud-art-list.md`: key, size, frames/fps, prompt notes (War = crimson/iron, Golden Aerie = gold re-skin of the Nexus at the same size, juvenile = 40×40 between hatchling 32 and adult 48, six crops at 16×16 with 3 growth frames + sway loop, `fx.coins` 32×32 8 frames 12 fps one-shot).
- [ ] **Step 2: Add the manifest keys to `fromManifest.ts` with drawn fallbacks**; run `pnpm --filter @wyrmhaven/web test` — expected: PASS (art tests allow missing keys).
- [ ] **Step 3: Commit** — `docs(art): M1 art list (War element, juveniles, Golden Aerie, GDD crops, coin burst)`

Then message the art thread (standing permission) with the file path; art lands on `main` as a manifest commit.

### Task B14: M1 verification and report

- [ ] **Step 1: `pnpm -r typecheck && pnpm test && pnpm --filter @wyrmhaven/web test:e2e`** — expected: green; record counts.
- [ ] **Step 2: `pnpm playtest`** and play the loop: collect until FULL, plant Dragon Bush, harvest, feed four times to Lv 2, build a Sea habitat at PL 3 (use `/e2e/grant` to set level), buy a Golden Aerie with granted DRIS, check the Terminal clock; take `docs/art/m1-island.png`, `m1-habitat.png`, `m1-farm.png`, `m1-dragon.png`, `m1-shop.png` at 390×844 (phone) and one desktop shot.
- [ ] **Step 3: Write `/mnt/project-files/gdd/2026-10-30-m1-report.md`**: what works, what does not, what could not be verified (art pending), test counts, deferred items for M2.
- [ ] **Step 4: Commit screenshots** — `docs: M1 playtest screenshots`

---

## Self-review notes

- Spec coverage for M1 scope (§1.3 steps House/Feed/Earn/Reinvest, §4.1, §5.1–5.3, §7.2): B5–B7, B9–B12. §1.3 Breed/Hatch keep today's mechanics until M2 but already use GDD timers (B4). §4.3 only the feed XP and hatch XP tables (B4, B5); curve and the rest in M3. §5.2 "Hybrid arbitrage" flag waits for hybrids (M2).
- Names used across tasks: `Preset`, `FLASH_14`, `DEFAULT_PRESET`, `goldPerMinuteX20`, `habitatCap`, `habitatCapacity`, `storedGold(h, residents, c, nowMs, preset)`, `cropGrowMs`, `cropFood`, `skipPriceMicroUsd`, `levelCap`, `stageOf`, `hpAt`/`atkAt`, `GameInfo`, `STATE_VERSION`. Any task that finds a mismatch fixes the later task to the earlier name.
- Review Focus 3 is pinned in A4 (unversioned state reset); 1 in B6 and B9; 2 in B5 and B11; 4 in B1, B4 (`FLASH_28` timer) and B7 (`FLASH_28` yield); 5 in B7 (readiness) and B9 (collect awards no XP: add `expect(after.xp).toBe(before.xp)` to the collect test in `island-actions.test.ts` during B6).
