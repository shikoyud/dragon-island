# M2 Breeding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make breeding run on GDD §3 and §5.4: the full 100-species catalog from the §3.4 grid plus curated rows, the §3.2 pool algorithm, Breeding Mountain, Grove and Hatchery tables, the scripted first hybrid, a way to get Basics, the Dragon Book, and the breeding and hatchery screens.

**Architecture:** `packages/game-core` keeps the rules: species rows and building tables live in `src/data/`, `breeding.ts` becomes one pool function that odds and the roll both read, and game day reaches actions through `ActionCtx.day`. The server only passes the day. The web client replaces `NestsPanel` with `BreedPanel` and `HatcheryPanel` and fills the `book` panel.

**Tech Stack:** TypeScript, Vitest, Fastify + Drizzle (PGlite in dev), React + Phaser, Playwright, pnpm workspace. Tests and the game run on shiko's PC.

**Spec:** `docs/dragon-island-gdd.md` (§ references below), with `docs/superpowers/specs/2026-10-30-gdd-rulings.md` (A# answers, R# rulings) and the roadmap `docs/superpowers/plans/2026-10-30-gdd-roadmap.md`.

## Questions for shiko (answered 2026-10-30)

shiko approved the plan with no changes, so every recommended option (a) stands: Q1 (a), Q2 (a), Q3 (a), Q4 (a), Q5 (a). Recorded in the rulings file. The options stay below as the record.

**Q1. The scripted first hybrid can't be an Uncommon from the starters.** §3.5 says "a guaranteed Uncommon with a 1-minute timer" and §4.4 places it at PL 2. At PL 2 the only Basics are Terra and Flame (R1, §4.4), and Terra × Flame is a counter pair: the §3.4 grid makes both hybrids Rare, and §3.2 rule 3 allows nothing else.
- (a) **Recommended.** Keep it at PL 2 from the parents' own pool: the first breed whose pool holds a hybrid gives one of those hybrids (Terra-Flame or Flame-Terra, both Rare) with a 1-minute breed and hatch. The grid and pool rules hold and the first hybrid arrives quickly (§10.1 wants it within 15 minutes). It gives away a Rare early, which §7.2 already expects on Day 1.
- (b) Keep it Uncommon, outside the pool: the first breed of two different Basics gives a fixed Uncommon such as Terra-Nature. This breaks §3.2 rule 3 once and shows Nature before PL 3.
- (c) Keep it Uncommon and inside the pool: the script waits for the first neutral pair, for example Terra × Sea at PL 3 or later. Terra × Flame rolls normally until then. The first hybrid comes later, and "PL 2" no longer holds.

**Q2. No calendar says when a Legendary's breeding event runs.** §3.2 and §3.4 refer to "its event", but §9 was skipped, and Rites are gone (A7).
- (a) **Recommended.** Use the §8.4 banner windows for the three Featured Legendaries: Magma Sovereign Days 1–4, Glacier Warlord Days 5–8, Radiant Aegis Days 9–12 (Flash-28: 1–7, 8–15, 16–24). Simplest, and it matches "a Legendary is in reach while it is featured", but a Legendary can be bred during Rush.
- (b) Same three, but only from Day 5 (§1.5 places Rites in Endgame): Magma Sovereign moves to a later window or is left out of breeding.
- (c) Shiko supplies a separate breeding calendar. The plan ships an empty table until then, so no Legendary can be bred in M2.

**Q3. The GDD has no way to get a new Basic and no price.** §4.4 unlocks Sea and Nature Basics at PL 3 and so on, and §5.7 lists "Basic dragon purchases" as a Gold sink, but no table prices them. Breeding can never produce an element neither parent has, so the game stalls at Terra and Flame without this. It is not in the roadmap's M2 line; the plan adds it (Task 5).
- (a) **Recommended.** A Basic costs the same as its habitat's Build price in §5.2 (Terra 500 … War 250,000) and unlocks at the same PL.
- (b) A flat price by element tier: Tier A 1,000, Tier B 25,000, Tier C 150,000.
- (c) Shiko supplies a price table.

**Q4. Which tri-hybrids?** §3.4 promises "20–30 curated tri-hybrids", the GDD's open decisions list them as unconfirmed, and A4 says shiko supplies them. Only Flame/Ice/Sea is named (§3.3).
- (a) **Recommended.** Ship Flame/Ice/Sea only. The row format is ready, and a test checks any row shiko adds. It adds no invented design or art now.
- (b) I draft 24 for shiko to edit. The draft must keep §3.3's worked odds, which forbid any other tri-hybrid with a Flame or Ice primary built only from Flame, Terra, Ice and Sea.

**Q5. Hatchery L5 ($3.00, PL 15) sits below L4 (2,000,000 Gold, PL 21) in the §5.4 table.**
- (a) **Recommended.** A premium fifth slot, purchasable once at PL 15 at any Hatchery level, adding one slot on top of the level's slots.
- (b) Sequential: L5 needs L4, so PL 15 is PL 21 in practice.
- (c) Move L5's PL to 21 and keep it sequential.

## Global Constraints

- `packages/game-core` is pure: no I/O, no `Date.now()`, no `Math.random()`; `nowMs`, `Rng`, `catalog`, `preset` and `day` are parameters (CLAUDE.md).
- Gold, Food and USD amounts are integers (USD in micro-dollars). Breeding weights are integers and the roll uses `rng.int(total)`. Odds are floats for display only.
- Every GDD number lives in `packages/game-core/src/data/`; game logic never holds a literal from the GDD. Each data file names its GDD section in a header comment. Every task cites its GDD section.
- Flash-14 is the default preset (A2); Flash-28 is a second preset object, never a code path (§7.2).
- No breed-time fees (A7). No pity (§3.2 has none).
- Species names are placeholders from elements until shiko fills the `name` column (A4). Original art and names only (CLAUDE.md).
- Conventional commits, one commit per task, TDD: failing test first.
- Mobile-first portrait layout; every tap target at least 44 px.
- No save migration: `STATE_VERSION` becomes 3 and old saves reset (R2).
- Do not touch `contracts/`. Do not start PixelLab generation; Task 11 only writes the list.

## Review Focus

1. A Hatchery that is full, including one held by a hatched dragon with no habitat, must leave the finished egg in its building and block that building from breeding; once a slot frees, the same egg moves and its hatch timer starts then (§5.4). Pinned in Task 3.
2. Two opposite Basics are refused in both orders with a clear reason in the UI, while a hybrid carrying the same elements breeds normally (§3.2, §3.3). Pinned in Tasks 2 and 8.
3. A Grove still under construction must not take an egg, and with every building busy the breed fails with no charge and no RNG use (§5.4). Pinned in Task 3.
4. A Legendary appears only on event days at both ends of the window under both presets, and an egg bred on the last day still hatches after the event ends (§3.2, §8.4). Pinned in Task 2.
5. A save from before this plan (version 2, with `nests` and `pity`) must not crash `/me` or `/actions`: it is replaced and logged once (R2). Pinned in Task 2.

---

## File structure (end state of this plan)

```
packages/game-core/src/
  data/species-rows.ts        §3.4 rows: id, name, elements, rarity (the file shiko edits)
  data/launch-catalog.ts      builds LAUNCH_CATALOG from the rows
  data/breeding.ts            §3.2 weights, §3.5 FIRST_HYBRID_MS, §8.4 LEGENDARY_EVENTS, Q3 basicPriceGold
  data/breeding-buildings.ts  §5.4 Hatchery, Mountain and Grove tables, footprints
  catalog.ts                  Species without recipeOnly, makeCatalog(species), isBasic, validateCatalog
  breeding.ts                 breedingPool, breedingOdds, rollOffspring, breedValidity, activeLegendaries
  buildings.ts                hatcherySlots, breederBreedMs, upgradeInfo from data
  state.ts                    version 3: breeders replaces nests, no pity, + discovered, firstHybridDone
  store.ts                    skip target 'breeder', + hatcheryL5, groveL3
  actions/breed-actions.ts    startBreed, collectEgg, hatch, buyBasic
apps/server/src/services/actions.ts   passes day to applyAction
apps/web/src/
  panels/BreedPanel.tsx       buildings' status, parents, outcome list with odds and timers
  panels/HatcheryPanel.tsx    slots, hatch, skip, upgrade
  panels/DragonBookPanel.tsx  My dragons + catalog with silhouettes and hints
  panels/bookHints.ts         hint text per species
docs/art/gdd-m2-art-list.md
docs/superpowers/reports/2026-10-30-m2-report.md
```

---

### Task 0: M1 follow-ups (GOLD badge, Golden Aerie limit, waitlist copy)

**Files:**
- Modify: `apps/web/src/game/islandModel.ts`, `apps/web/test/island.test.ts`, `packages/game-core/src/store.ts`, `packages/game-core/src/actions/economy-actions.ts`, `packages/game-core/src/actions/types.ts`, `packages/game-core/test/store.test.ts`, `packages/game-core/test/economy-actions.test.ts`, `apps/web/src/api/errors.ts`, `apps/web/src/panels/ShopPanel.tsx`, `apps/web/test/shop.test.tsx`, `apps/waitlist/src/components/Faq.tsx`, `Pillars.tsx`, `Hero.tsx`, `CardView.tsx`, `apps/waitlist/src/components/waitlist/Joined.tsx`, `apps/waitlist/src/app/layout.tsx`, `apps/waitlist/src/wallet/config.ts`, waitlist tests that pin that copy

**Interfaces:**
- Produces: a habitat's `gold` badge shows only when stored Gold ≥ `min(gold per minute of its residents, 5 % of its cap)`, floored; below that it has no badge and no collect hit box. `full` at the cap is unchanged. The panel's Collect button still works from 1 Gold. `ActionError` gains `AERIE_EXISTS`; `priceMicroUsd({ kind:'goldenAerie' })` returns null when the player owns one.

- [ ] **Step 1: Write the failing tests**: Terra L1, two Lv 5 Commons, Flash-14 (1,320 gold/min, cap 80,000): threshold 1,320, no badge at 1,319, `gold` at 1,320. War L1 with one Lv 40 Legendary where 5 % of the cap is smaller: the badge uses 5 % of the cap. A capped habitat is `full`. A second `buy goldenAerie` fails `AERIE_EXISTS` with no charge; Store hides the Aerie row when owned. Waitlist: no page contains `Season Points`, `14-day season` or `Battle for the season`.
- [ ] **Step 2: Run** — expected: FAIL.
- [ ] **Step 3: Implement.** Waitlist wording: a game that runs once for 14 days and then shuts down, `Dragon Points` are not introduced; where a sentence only promised Season Points, describe ranked battles and $DRIS rewards per GDD §1, §6.4 and §7.5, without amounts. Keep every sentence honest about legal review (GDD sign-off). Client only for the badge threshold.
- [ ] **Step 4: Run** `pnpm -r test && pnpm -r typecheck` — expected: PASS.
- [ ] **Step 5: Commit** — `fix: GOLD badge threshold, one Golden Aerie per player, waitlist copy without seasons`

### Task 1: The species catalog from the §3.4 grid (§3.3, §3.4, A4)

**Files:**
- Create: `packages/game-core/src/data/species-rows.ts`, `packages/game-core/test/species-rows.test.ts`
- Modify: `src/data/launch-catalog.ts`, `src/catalog.ts`, `src/pve.ts`, `src/matchmaking.ts`, `test/catalog.test.ts`, `test/fixtures.ts`, tests pinned to the old catalog (battle preview, matchmaking, pve)

**Interfaces:**
- Produces:
```ts
export interface SpeciesRow { id: string; name: string; elements: readonly Element[]; rarity: Rarity }
export const SPECIES_ROWS: readonly SpeciesRow[]
export interface Species extends SpeciesRow {}       // recipeOnly and Recipe are gone
export interface Catalog { species: ReadonlyMap<string, Species> }
export function makeCatalog(species: readonly Species[]): Catalog
export function isBasic(s: Species): boolean         // elements.length === 1
export function validateCatalog(c: Catalog): string[] // codes below; [] when valid
```
- Ids are element ids joined by `-` in order: `terra`, `terra-flame`, `flame-ice-sea` (R19). Placeholder names: `Terra-Flame`, `Flame-Ice-Sea`; Basics stay `Terra Basic`. Legendaries use their GDD names and ids `magma-sovereign [terra, flame]`, `glacier-warlord [ice, war]`, `radiant-aegis [light, metal]`, `last-light [light, war]`, `final-dawn [light, terra]`.
- Tri-hybrid rows: `flame-ice-sea` only (Q4).
- `SPECIES_ROWS` is a literal table, one row per line, written once by a throwaway script, so shiko can edit `name` without touching code.

- [ ] **Step 1: Write the failing test** `species-rows.test.ts`. It holds the **literal §3.4 grid** (10 × 10 of C/U/R/E) and asserts: for each ordered pair of different elements, `LAUNCH_CATALOG` has exactly one species with those `elements` and the grid's rarity; counts are common 10, uncommon 48, rare 34, epic 8 + the tri-hybrid rows, legendary 5; every id equals `elements.join('-')` except Legendaries; every tri-hybrid is epic with 3 distinct elements; `validateCatalog(LAUNCH_CATALOG)` is `[]`; `validateCatalog` flags `BAD_ELEMENTS:x` for 0, 4 or repeated elements, `DUPLICATE_ELEMENTS:a-b` for two rows with the same ordered elements, `MISSING_BASIC:e` for an absent Basic, `HYBRID_RARITY:id` for a hybrid disagreeing with the grid rule (opposite pair = epic, counter pair = rare, else uncommon, from `OPPOSITE_PAIRS` and `STRONG_AGAINST`).
- [ ] **Step 2: Run** `pnpm --filter @wyrmhaven/game-core test -- species-rows` — expected: FAIL.
- [ ] **Step 3: Implement.** Delete `recipeOnly`, `Recipe`, `Catalog.recipes`, `speciesPairKey`, the `DUPLICATE_TIER` rule. `pve.ts` and `matchmaking.ts` filter `rarity !== 'legendary'` instead of `!recipeOnly`; `stageRarity` and `BOT_RARITIES` keep their values until M5, so stage and bot teams now draw hybrids (R24); re-pin those tests. `movesFor` is unchanged.
- [ ] **Step 4: Run** `pnpm -r test && pnpm -r typecheck` — expected: PASS once callers compile. `breeding.ts` still uses `recipes`: delete `recipeFor` and its tests here so the build stays green; the old tier odds stay for Task 2 to replace.
- [ ] **Step 5: Commit** — `feat(game-core): 100-species catalog from the §3.4 grid, with a name column (A4)`

### Task 2: The §3.2 breeding algorithm, Legendary events, no pity (§3.2–3.4, §8.4, A7)

**Files:**
- Create: `src/data/breeding.ts`
- Modify: `src/breeding.ts` (rewrite), `src/actions/breed-actions.ts`, `src/actions/types.ts`, `src/actions/apply.ts`, `src/state.ts`, `src/index.ts`, `apps/server/src/services/actions.ts`, `apps/server/src/services/stateMigration.ts` tests, `apps/web/src/panels/BreedPanel.tsx` (call only), `test/breeding.test.ts`, `test/breed-actions.test.ts`, `test/replay.test.ts`

**Interfaces:**
- Produces:
```ts
export const BREED_WEIGHT: Record<Rarity, number>   // 1000, 500, 200, 60, 40
export const LEGENDARY_EVENTS: readonly { speciesId: string; days: Record<PresetId, readonly [number, number]> }[]
  // magma-sovereign {flash14:[1,4], flash28:[1,7]}, glacier-warlord {[5,8],[8,15]}, radiant-aegis {[9,12],[16,24]} (§8.4, Q2)
export function activeLegendaries(day: number, preset: Preset): readonly string[]
export interface BreedContext { activeLegendaries: readonly string[] }
export interface PoolEntry { species: Species; weight: number }
export function breedingPool(a: Species, b: Species, ctx: BreedContext, c: Catalog): PoolEntry[]  // stable id order
export function breedingOdds(a: Species, b: Species, ctx: BreedContext, c: Catalog): Record<string, number>
export function rollOffspring(a: Species, b: Species, ctx: BreedContext, c: Catalog, rng: Rng): Species  // one rng.int(total)
export function breedValidity(a: Species, b: Species): 'OPPOSITE_BASICS' | null
// ActionCtx gains day: number; applyAction(s, a, nowMs, rng, catalog, preset, day = 1)
// ActionError gains 'OPPOSITE_BASICS'; STATE_VERSION = 3; PlayerState loses pity
```
- Pool: U = all elements of both parents; P = both primaries. S qualifies if `S.elements[0]` ∈ P, every element ∈ U, it is a Basic only when a parent is a Basic, and it is a Legendary only when in `ctx.activeLegendaries`. If no Common or Uncommon qualifies, add each parent's primary Basic (dedupe). Weight = `BREED_WEIGHT[rarity]`.

- [ ] **Step 1: Write the failing tests** in `breeding.test.ts`, on `LAUNCH_CATALOG`, `activeLegendaries: []` unless stated:
  - Terra × Nature: `terra` 1000/3000, `nature` 1000/3000, `terra-nature` 500/3000, `nature-terra` 500/3000; hybrid total 33.3 % (§3.4).
  - Terra × Flame: hybrid total 400/2400 = 16.7 % (§3.4).
  - Terra × Terra: `terra` 100 %.
  - Flame-Terra × Ice-Sea (§3.3): total 1580; `ice-sea` and `ice-terra` 500/1580; `flame-terra` and `flame-sea` 200/1580; `flame-ice`, `ice-flame`, `flame-ice-sea` 60/1580; `flame-ice` + `ice-flame` = 7.6 %; no Basics.
  - Flame × Ice-Sea: total 2880; includes `flame` and `ice` at 1000; `flame-ice` 60/2880.
  - Floor guard: Flame-Sea × Flame-Sea: `flame` 1000/1200, `flame-sea` 200/1200. Flame-Ice × Ice-Flame: `flame`, `ice` 1000, `flame-ice`, `ice-flame` 60, total 2120. An Uncommon clones without a floor: Terra-Sea × Terra-Sea: `terra-sea` 100 %.
  - `breedValidity` returns `OPPOSITE_BASICS` for flame×ice, ice×flame, nature×electric, terra×dark, sea×war, and null for flame×ice-sea and terra×flame.
  - Legendary: `activeLegendaries(4, FLASH_14)` has `magma-sovereign`, `activeLegendaries(5, FLASH_14)` does not and has `glacier-warlord`; `activeLegendaries(7, FLASH_28)` has `magma-sovereign`, `(8, FLASH_28)` has `glacier-warlord`, `(13, FLASH_14)` is empty. Odds: Terra × Flame with Magma active 40/2440 (1.64 %); Ice × War with Glacier active 40/2440; Light × Metal with Radiant active 40/3040 (1.3 %); Terra × Nature with Magma active has no Legendary. A fixture Legendary [flame, ice] on the §3.3 pool: 40/1620 (2.5 %, §3.4).
  - Roll: for a seeded `Rng`, `rollOffspring` returns the species at the cumulative position of `rng.int(total)` in `breedingPool` order, and calls the RNG once.
  - `breed-actions.test.ts`: `startBreed` on Flame × Ice Basics fails `OPPOSITE_BASICS`; an egg bred on day 4 with Magma active hatches on day 6 (Review Focus 4); `applyAction(..., FLASH_14, 4)` can yield `magma-sovereign` with a forced RNG and `applyAction(..., FLASH_14, 5)` cannot. Timer comes from the offspring: `breedTimerMs(child.rarity, child.elements, preset)`.
  - Server: `/actions` passes `gameDay(launchAtMs, nowMs)` (a test at launch + 4 days with a forced seed, or by asserting the argument through a stub `deps`).
  - `stateMigration.test.ts` and `actions.test.ts`: a version 2 state with `nests` and `pity` becomes `newPlayer` on `/me` and `/actions`, logged once (Review Focus 5).
- [ ] **Step 2: Run** — expected: FAIL.
- [ ] **Step 3: Implement.** Delete `tierWeights`, `poolFor`, `RECIPE_*`, `PITY_*`, `RARITY_SCORE`, `pairKey` use, and `PlayerState.pity`. `BREED_MIN_LEVEL` stays. The web client calls `breedingOdds` with `activeLegendaries(gameDay(me.game.launchAtMs, nowMs), preset)`.
- [ ] **Step 4: Run** `pnpm -r test && pnpm -r typecheck` — expected: PASS.
- [ ] **Step 5: Commit** — `feat(game-core): §3.2 breeding pool, floor guard, Legendary events; pity removed`

### Task 3: Breeding Mountain, Grove and the Hatchery table (§5.4, §4.4)

**Files:**
- Create: `src/data/breeding-buildings.ts`, `test/breeding-buildings.test.ts`
- Modify: `src/state.ts`, `src/buildings.ts`, `src/island.ts`, `src/placement-rules.ts`, `src/construction.ts`, `src/store.ts`, `src/actions/breed-actions.ts`, `src/actions/build-actions.ts`, `src/actions/economy-actions.ts`, `src/actions/validate.ts`, `src/actions/types.ts`, `packages/shared/src/actions.ts`, `apps/web/src/game/*` (target and art rename only), `apps/web/src/panels/*` (rename only, screens are Tasks 8–9), `apps/web/src/api/errors.ts`, `apps/web/e2e/*`, tests

**Interfaces:**
- Produces:
```ts
export type BreederKind = 'mountain' | 'grove'
export interface BreederEgg { speciesId: string; readyAtMs: number; hatchMs: number }
export interface Breeder { kind: BreederKind; egg: BreederEgg | null; level: number; placement: Placement }
// PlayerState.nests → breeders: Breeder[]; newPlayer: one mountain L1 at home(4, 7) (R15)
// BuildingRef { type:'nest', index } → { type:'breeder', index }; Action collectEgg { breeder: number }
// Placeable + { kind:'grove' }; ActionError NO_FREE_NEST → NO_FREE_BREEDER, NEST_EMPTY → BREEDER_EMPTY
// StoreItem + { kind:'hatcheryL5' } | { kind:'groveL3'; index: number }; SkipTarget 'nest' → 'breeder'
export interface BuildingLevel { gold: number | null; usdMicro: number | null; minPl: number; classicMs: number }
export const HATCHERY_LEVELS: readonly (BuildingLevel & { slots: number })[]
export const BREEDER_LEVELS: Record<BreederKind, readonly (BuildingLevel & { reductionPct: number })[]>
export const BREEDER_FOOTPRINT = 5
export const HATCHERY_FIFTH_SLOT: { usdMicro: number; minPl: number }  // 3,000,000 and 15 (§5.4, Q5 a)
// PlayerState gains hatcheryFifthSlot: boolean (false in newPlayer)
export function hatcherySlots(level: number, fifthSlot: boolean): number  // level's slots + 1 when bought
export function breederBreedMs(baseMs: number, b: Pick<Breeder, 'kind' | 'level'>): number  // floor(base × (100 − pct) / 100)
```
- Tables (§5.4; timers R16, classic, ÷`timerDiv`): Hatchery L1 1 slot free PL 1; L2 2 slots 2,000 Gold PL 4 1 h; L3 3 slots 250,000 PL 13 4 h; L4 4 slots 2,000,000 PL 21 12 h. The fifth slot is `HATCHERY_FIFTH_SLOT`, not a level (Q5 a). Mountain L1 free PL 2; L2 −10 % 150,000 PL 10 1 h; L3 −20 % 1,500,000 PL 20 4 h. Grove L1 400,000 PL 12 build 4 h; L2 −10 % 1,500,000 PL 20 1 h; L3 −20 % $3.50 PL 25 instant.

- [ ] **Step 1: Write the failing tests**:
  - Every row above, literally; `hatcherySlots(1, false) === 1`, `hatcherySlots(4, false) === 4`, `hatcherySlots(1, true) === 2`, `hatcherySlots(4, true) === 5`.
  - `breederBreedMs(2_400_000, mountain L1) === 2_400_000`, `L2 === 2_160_000`, `L3 === 1_920_000`; grove L1 no reduction.
  - Mountain L3 breeding a Rare Tier A egg under Flash-14: `readyAtMs` now + 1,920,000 and `hatchMs` 2,400,000: reductions don't apply to hatching (§5.4).
  - `startBreed` at PL 1 fails `LEVEL_TOO_LOW`, at PL 2 succeeds with two Lv 4 dragons (§5.4).
  - Review Focus 3: one Mountain busy and an unfinished Grove: `NO_FREE_BREEDER`, Gold and RNG untouched; with a finished Grove the egg goes in the Grove.
  - Grove: `placeBuilding { kind:'grove' }` at PL 11 fails `LEVEL_TOO_LOW`; PL 12 charges 400,000 and builds for 2,400,000 ms under Flash-14; a second Grove fails `MAX_LEVEL`.
  - Review Focus 1: Hatchery L1 with one egg: a finished egg in the Mountain fails `collectEgg` with `HATCHERY_FULL`, stays there, and `startBreed` fails `NO_FREE_BREEDER`. After `hatch`, `collectEgg` succeeds and the hatch `readyAtMs` is now + `hatchMs`. The same holds with the slot held by a dragon with `habitatId: null`.
  - Store: `hatcheryL5` costs 3,000,000 from PL 15 at any Hatchery level and only once: below PL 15 and after buying, its price is null (Q5 a); `groveL3` 3,500,000 only at Grove L2 with PL ≥ 25; `upgradeInfo` returns null for Hatchery L4 and Grove L2, and its timers divide by `timerDiv`: Hatchery to L2 under Flash-14 is 600,000 ms.
  - `newPlayer` placements still pass `placementError` and don't overlap.
- [ ] **Step 2: Run** — expected: FAIL.
- [ ] **Step 3: Implement.** Delete `NEST_LEVELS`, `nestBreedMs`, `MAX_NESTS`, `HATCHERY_SLOTS`, `FOOTPRINT.nest`, the old `HATCHERY_LEVELS`. `startBreed` picks the first breeder with no egg that is not `isUnfinished`. `collectEgg` uses `egg.hatchMs`. Web: `Target` `{kind:'nest'}` → `{kind:'breeder', index}`, art falls back to `building.nest` until Task 11. E2E helpers and specs follow; `breed.spec.ts` grants PL 2.
- [ ] **Step 4: Run** `pnpm -r test && pnpm -r typecheck && pnpm --filter @wyrmhaven/web test:e2e` — expected: PASS.
- [ ] **Step 5: Commit** — `feat(game-core): Breeding Mountain, Grove and Hatchery on the §5.4 tables`

### Task 4: The scripted first hybrid (§3.5, §4.4, Q1)

**Files:**
- Modify: `src/data/breeding.ts` (`FIRST_HYBRID_MS = 60_000`), `src/breeding.ts`, `src/state.ts`, `src/actions/breed-actions.ts`, `test/breed-actions.test.ts`, `test/breeding.test.ts`

**Interfaces:**
- Consumes: `BreederEgg.hatchMs`, `breedingPool`.
- Produces: `PlayerState.firstHybridDone: boolean` (false in `newPlayer`); `BreedContext.firstHybridPending: boolean`. While pending, a pool holding a hybrid (2 or more elements, not Legendary) is restricted to those hybrids; Basics and Legendaries drop out. A pool with no hybrid is untouched and the script stays pending.

- [ ] **Step 1: Write the failing tests**: Terra × Flame, pending: odds are `terra-flame` 50 %, `flame-terra` 50 %; `startBreed` sets `readyAtMs` now + 60,000 under both presets and any Mountain level, `hatchMs` 60,000, `firstHybridDone` true. The next breed uses normal odds and timers. Terra × Terra while pending gives `terra` and leaves `firstHybridDone` false. With Magma active, the scripted roll cannot be `magma-sovereign`.
- [ ] **Step 2: Run** — expected: FAIL.
- [ ] **Step 3: Implement.** One branch in `breedingPool` plus the timer choice in `startBreed` (R25).
- [ ] **Step 4: Run tests + typecheck** — expected: PASS.
- [ ] **Step 5: Commit** — `feat(game-core): scripted first hybrid with a 1-minute timer (§3.5)`

### Task 5: Buying Basics (§4.4, §5.7, Q3)

**Files:**
- Modify: `src/data/breeding.ts` (`basicPriceGold`), `src/actions/breed-actions.ts`, `src/actions/apply.ts`, `src/actions/validate.ts`, `src/actions/types.ts`, `packages/shared/src/actions.ts`, `packages/shared/test/actions.test.ts`, `apps/web/src/panels/ShopPanel.tsx`, `test/breed-actions.test.ts`, `apps/web/test/shop.test.tsx`

**Interfaces:**
- Produces: `Action { type:'buyBasic'; element: Element }`; `basicPriceGold(e: Element): number` = `HABITATS[e].buildGold`. Unlock = `HABITATS[e].unlockPl` (§4.4 lists the same PLs). The dragon goes to the first finished habitat it can live in with room, at Lv 1, `feeds: 0`, after `collectHabitat`.

- [ ] **Step 1: Write the failing tests**: at PL 3 with 5,000 Gold and a Sea habitat with room, `buyBasic sea` leaves 0 Gold and a Lv 1 `sea` dragon in it; at PL 2 → `LEVEL_TOO_LOW`; with 4,999 Gold → `INSUFFICIENT_GOLD`; with no Sea habitat or a full one → `NO_HABITAT_SLOT` (R26); an unfinished habitat doesn't count; schema parity for a valid and an invalid element. Shop's Build tab lists `Sea Basic · 5,000 gold`, disabled with reason `Level 3` at PL 1 and `Build a Sea habitat first` with no room.
- [ ] **Step 2: Run** — expected: FAIL.
- [ ] **Step 3: Implement**; add a `Dragons` section to the Build tab above Habitats.
- [ ] **Step 4: Run tests + typecheck** — expected: PASS.
- [ ] **Step 5: Commit** — `feat: buy Basics for Gold, gated by Player Level (§4.4, §5.7)`

### Task 5b: XP multiplier and harvest XP (R27), plus Task 4 clean-up

See `.superpowers/sdd/2026-10-30-gdd-m2-breeding/task-5b-brief.md`.

### Task 6: Dragon Book state and the hybrid arbitrage flag (§1.4, §5.2, A13)

**Files:**
- Modify: `src/state.ts`, `src/actions/breed-actions.ts`, `src/data/presets.ts`, `src/dragon.ts`, `src/habitat.ts`, `apps/web/src/panels/HabitatPanel.tsx`, `apps/web/src/panels/DragonPanel.tsx`, tests `state`, `breed-actions`, `habitat`, `presets`

**Interfaces:**
- Produces: `PlayerState.discovered: string[]` (`['terra', 'flame']` in `newPlayer`; `hatch` and `buyBasic` add the species once). `Preset.habitatRateCap: number | null` in percent, `null` in both presets (A13; 125 is the only other allowed value, R21). `dragonRateX20(sp: Species, level: number, h: Habitat, preset: Preset): number`, used by `storedGold` and both panels.

- [ ] **Step 1: Write the failing tests**: with `habitatRateCap: null`, a Lv 5 Terra-War Rare in a War habitat earns its full Terra rate: `goldPerMinuteX20('terra', 'rare', 5, FLASH_14)` = 19,800. With `{ ...FLASH_14, habitatRateCap: 125 }` it earns `floor(goldPerMinuteX20('war', 'rare', 5, preset) × 125 / 100)` = 8,625; a War Basic in War and any dragon in a Golden Aerie are uncapped; a Terra-War in a Terra habitat is uncapped since its rate is below the cap. `discovered` dedupes on a second hatch.
- [ ] **Step 2: Run** — expected: FAIL.
- [ ] **Step 3: Implement.** Integer math; "native rate" = the same rarity and level at the habitat's element (R21).
- [ ] **Step 4: Run tests + typecheck** — expected: PASS.
- [ ] **Step 5: Commit** — `feat(game-core): Dragon Book discovery and the habitatRateCap flag (§5.2, A13)`

### Task 7: Island badges for waiting eggs (§3.1, §5.4)

**Files:**
- Modify: `apps/web/src/game/islandModel.ts`, `apps/web/src/hud/hudModel.ts`, `apps/web/test/island.test.ts`

**Interfaces:**
- Produces: badges: a finished breeder egg shows `ready` when a Hatchery slot is free and `hatchery full` when not; an egg in a breeder or the Hatchery draws `egg.<primary element>`; the species name is never shown before hatching (R20).

- [ ] **Step 1: Write the failing tests** in `island.test.ts`: finished egg with a free slot → `badge: 'ready'`; with a full Hatchery → `badge: 'hatchery full'`; hud attention item for the same state names the Hatchery.
- [ ] **Step 2: Run** — expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run tests + typecheck** — expected: PASS.
- [ ] **Step 5: Commit** — `feat(web): island shows a finished egg waiting on the Hatchery`

### Task 8: Breeding screen (§3.1–3.5, UI direction)

**Files:**
- Modify: `apps/web/src/panels/BreedPanel.tsx`, `apps/web/src/panels/PanelHost.tsx`, `apps/web/test/panels.test.tsx`, `apps/web/e2e/breed.spec.ts`
- Delete: `apps/web/src/panels/NestsPanel.tsx`

**Interfaces:**
- Consumes: `breedingPool`, `breedValidity`, `breederBreedMs`, `breedTimerMs`, `activeLegendaries`, `formatDuration`, `formatSkipPrice`.
- Produces: `BreedPanel`, opened by the bar's Breed button and by tapping a breeder. Top: one row per breeder (`Breeding Mountain` / `Breeding Grove`): `idle`, `Egg · <timer>` with `Skip · $x`, or `Egg ready` with `Move to Hatchery` (disabled with reason `Hatchery is full` when full), plus `UpgradeSection`. Below: two parent pickers, then an outcome table sorted by chance. A row reads `Terra-Flame · Rare · 8.33% · 40m`; the timer uses the free building's reduction.

- [ ] **Step 1: Write the failing tests**: after the first hybrid, Terra × Flame lists four rows: `Terra Basic · Common · 41.67% · 5s`, `Flame Basic · Common · 41.67% · 5s`, `Terra-Flame · Rare · 8.33% · 40m`, `Flame-Terra · Rare · 8.33% · 40m`; with Mountain L2, `36m`. Before the first hybrid, both hybrids at 50.00% and `1m`. Flame × Ice Basics: no table, button disabled, reason `Opposite Basics can't breed. Use a hybrid that carries one of them.` (Review Focus 2). A Lv 3 parent: reason `Both parents must be level 4`. PL 1: reason `Unlocks at level 2`. All busy: reason `Every breeding building is busy`. Legendary row appears only on event days. An undiscovered result still shows its name and odds (§3.2's outcome list is public). A finished egg with a full Hatchery shows the disabled button and reason.
- [ ] **Step 2: Run** — expected: FAIL.
- [ ] **Step 3: Implement.** Every tap target at least 44 px.
- [ ] **Step 4: Run tests + typecheck + e2e** — expected: PASS.
- [ ] **Step 5: Commit** — `feat(web): breeding screen with buildings, outcome list, odds and timers`

### Task 9: Hatchery screen (§3.1, §5.4)

**Files:**
- Create: `apps/web/src/panels/HatcheryPanel.tsx`
- Modify: `apps/web/src/panels/PanelHost.tsx`, `apps/web/src/panels/ShopPanel.tsx` (L5 rows), `apps/web/test/panels.test.tsx`, `apps/web/test/shop.test.tsx`, `apps/web/e2e/*`

**Interfaces:**
- Produces: `HatcheryPanel`, opened by tapping the Hatchery. Title `Hatchery · used/slots`. One row per slot: `Egg · <timer>` (no species name, R20), `Skip · $x`, `Hatch` when ready; a waiting dragon shows its name and `Needs a habitat`, opening its dragon panel; empty slots show `Empty`. Then `UpgradeSection`. Store lists `Hatchery · 5th slot · $3.00` and `Grove · Level 3 · $3.50` under `Level 5 upgrades` when eligible.

- [ ] **Step 1: Write the failing tests**: a level 2 Hatchery with one egg and one waiting dragon renders `Hatchery · 2/2`; the egg row has no species name; after hatching, a toast or row names the species; the panel points to the Store (`Fifth slot in the Store`) from PL 15 until it is bought (Q5 a), and a Hatchery L1 with it reads `Hatchery · 1/2` with one egg; Store lists the items only when priced.
- [ ] **Step 2: Run** — expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run tests + typecheck + e2e** — expected: PASS.
- [ ] **Step 5: Commit** — `feat(web): hatchery screen and premium slot items`

### Task 10: Dragon Book (§1.4, §3.4, §4.4)

**Files:**
- Create: `apps/web/src/panels/DragonBookPanel.tsx`, `apps/web/src/panels/bookHints.ts`, `apps/web/test/book.test.tsx`
- Modify: `apps/web/src/panels/PanelHost.tsx`, `apps/web/src/panels/DragonsPanel.tsx` (its list becomes the `My dragons` tab)

**Interfaces:**
- Consumes: `PlayerState.discovered`, `LAUNCH_CATALOG`, `LEGENDARY_EVENTS`, `HABITATS`, `isOpposite`.
- Produces: `bookHint(sp: Species, preset: Preset, c: Catalog): string`. Tabs `Book` (default) and `My dragons`. Book: `n / total` found, groups by rarity, a tile per species: its sprite and name when discovered; its sprite with CSS `filter: brightness(0)` and `???` when not (R22). Tapping a tile shows elements, rarity and the hint.

- [ ] **Step 1: Write the failing tests**: `bookHint`: `terra` → `Buy in the Shop at level 1`; `sea` → `Buy in the Shop at level 3`; `terra-flame` → `Breed a Terra parent with a Flame parent`; `flame-ice` → `Two Basics can't make this. Breed a hybrid carrying Flame with one carrying Ice`; `flame-ice-sea` → `Breed parents carrying Flame, Ice and Sea, one with a Flame primary`; `magma-sovereign` → `Breeding event, days 1–4: Terra and Flame parents`; `last-light` → `Not bred`. Panel: a fresh player shows `2 / <catalog size>`; an undiscovered tile shows `???` and no species name in its accessible name; a discovered one shows its name; the hint is visible for both.
- [ ] **Step 2: Run** — expected: FAIL.
- [ ] **Step 3: Implement.** Tiles lazy-render (the list is over 100 sprites): sprites only for the open group.
- [ ] **Step 4: Run tests + typecheck** — expected: PASS.
- [ ] **Step 5: Commit** — `feat(web): Dragon Book with silhouettes and breeding hints`

### Task 11: Art keys and the art list for the PixelLab thread

**Files:**
- Create: `docs/art/gdd-m2-art-list.md`
- Modify: `apps/web/src/art/fromManifest.ts`, `apps/web/src/art/types.ts`, `apps/web/src/art/phaserLoader.ts`, `apps/web/src/game/islandModel.ts`, `apps/web/test/art.test.ts`, `apps/web/test/island.test.ts`

**Interfaces:**
- Produces: `art.dragon` holds only ids with a manifest key (plus Basics' drawn fallback). `dragonLook` falls back to the primary element's Basic sheet for a species with no art (R23). Keys read when present: `building.mountain.<1..3>`, `building.grove.<1..3>`, `building.hatchery.<1..4>`, else `building.nest` and `building.hatchery`.

- [ ] **Step 1: Write the failing tests**: `flame-sea` with no art draws `dragon.flame`; with `dragon.flame-sea` present draws it; `sea-flame` draws `dragon.sea`; a Mountain L2 uses `building.mountain.2` when present and falls back to `.1`, then `building.nest`; no request goes out for an absent key.
- [ ] **Step 2: Run** — expected: FAIL.
- [ ] **Step 3: Implement; write the list** in the table format of `docs/art/hud-art-list.md`: `dragon.<species>` 48×48 and `juvenile.<species>` 40×40 for 91 hybrids (48 Uncommon, 34 Rare, 8 Epic, `flame-ice-sea`) and the 5 Legendaries, same frames and fps as the M1 War set; `building.mountain.<1..3>` and `building.grove.<1..3>` at 80×80 (5×5 footprint), `building.hatchery.<1..4>` at 64×64; `book.unknown` for an undiscovered species that has no sprite yet; the waitlist's War set (`apps/waitlist/public/art/v1`: egg, hatchling and icon matching its other nine elements). Order of priority: Epics and tri-hybrid, Rares, Uncommons, Legendaries. State the generation count so the art thread can check its budget. Silhouettes need no art (R22). Flame/Sea and Sea/Flame are different dragons: primary element sets body and palette, secondary sets accents (§2.3).
- [ ] **Step 4: Run tests + typecheck** — expected: PASS.
- [ ] **Step 5: Commit** — `docs(art): M2 art list; hybrid sprites fall back to the primary Basic`

Then send the list's path to the coordinator for the art thread.

### Task 12: M2 verification and report

- [ ] **Step 1: `pnpm -r typecheck && pnpm test && pnpm --filter @wyrmhaven/web test:e2e`** — expected: green; record counts.
- [ ] **Step 2: `pnpm playtest`** and a throwaway Playwright spec with console and network listeners: sign in; feed both starters to Lv 4 (use `/e2e/grant` for Food and PL 2); Terra × Flame shows the scripted rows; breed, `Move to Hatchery`, hatch: a Terra-Flame or Flame-Terra after 2 minutes, and the Book shows `3 / total`; fill the Hatchery and see a finished egg blocked; buy a Sea Basic at PL 3; breed Terra × Sea and read 33.3 % hybrid odds; refused Flame × Ice with a reason; build a Grove at PL 12 and run two eggs at once; upgrade Hatchery and Mountain; shift `/e2e/clock` to Day 5 and see the Legendary rows change. Delete the spec.
- [ ] **Step 3: Take** `docs/art/m2-breed.png`, `m2-hatchery.png`, `m2-book.png`, `m2-island.png` at 390×844 and `m2-desktop.png` at 1440×900; read each to check it shows what its name says.
- [ ] **Step 4: Write `docs/superpowers/reports/2026-10-30-m2-report.md`**: what works, what does not, what could not be verified, test counts, rulings made, deferred items for M3.
- [ ] **Step 5: Commit** — `docs: M2 report and playtest screenshots`

---

## New rulings

Also recorded in `docs/superpowers/specs/2026-10-30-gdd-rulings.md`.

| # | Ruling | Why |
| --- | --- | --- |
| R15 | **Mountain and Grove take their GDD 5×5 footprint in M2**; the Hatchery stays 4×4 (already the GDD size). Other footprints wait for M4 (R9). | Their art is new, so drawing it once at final size avoids regenerating it. |
| R16 | **Hatchery, Mountain and Grove upgrade timers** (GDD silent): to L2 1 h, L3 4 h, L4 12 h, $DRIS levels instant; Grove build 4 h. Classic, ÷ `timerDiv`. | Same ladder as A5 for habitats. |
| R17 | Withdrawn; replaced by M2 plan Q5. | The §5.4 table's L5 and L4 order is a question for shiko. |
| R18 | **A finished egg moves to the Hatchery on a tap**, not by itself; its building stays blocked until then. | §5.4 says only that the egg waits; a tap is the genre's collect moment and already exists. |
| R19 | **Species ids** join elements in order (`flame-sea`); placeholder names `Flame-Sea`. Legendaries keep the names the GDD gives them. | Ordered ids match §2.3; names per A4. |
| R20 | **Eggs hide their species until hatching**: the player sees the timer and the primary element's egg. | §3.1: "a long timer reveals a rare result early" only means something if the egg doesn't say. |
| R21 | **`habitatRateCap`** is a preset field in percent, `null` or 125. "Native rate" is the same rarity and level at the habitat's element. The Golden Aerie is uncapped. | A13 and §5.2; percent keeps currency math integer. |
| R22 | **Dragon Book**: a species is discovered on hatching or purchase; starters begin discovered. Silhouettes are the species' sprite with CSS `brightness(0)`. Hint text is ours. | §1.4 gives no rules; silhouettes need no extra art. |
| R23 | **A hybrid with no art draws its primary Basic's sprite** until its art lands. | Keeps the game playable while 91 species of art arrive. |
| R24 | **PvE stages and bots draw from the full catalog until M5**, with today's rarity rules, so stages 11+ meet real Rares and Epics. | M5 rewrites both from §6; not worth a stopgap. |
| R25 | **The first hybrid's 1 minute** is real time under both presets, for breed and hatch, with no building reduction. Applies whichever answer to Q1 of the M2 plan. | §3.5 states a time, not a classic value. |
| R26 | **Buying a Basic needs room**: a finished habitat that can house it (its element, or a Golden Aerie) with a free slot, otherwise `NO_HABITAT_SLOT`. | The Hatchery should not fill with bought dragons. |
| R27 | **`xpMult` applies to all XP and harvest gives crop tier × 2 XP from M2** (§4.3, §7.2). M3 keeps the rest of the XP table. | M2 is unplayable to PL 2 without it; no GDD number changes. |

## Self-review notes

- Spec coverage: §3.1 Tasks 2, 3, 7; §3.2 Task 2; §3.3 Tasks 1, 2; §3.4 Tasks 1, 2; §3.5 Tasks 2, 3, 4; §3.6 is done (M1); §5.4 Tasks 3, 8, 9; §4.4 unlocks for Mountain, Grove, Hatchery slots and Basics Tasks 3, 5; A7 Task 2; A13 Task 6; §5.7 Basic purchases Task 5. Not here: Roost and the unlock table (M3), first-time XP (M3, reads `discovered`), Soulbound and Smelting (M7, M8), Trial Champion and Finals Legendary rows (M5, M6; the GDD gives no elements).
- Names used across tasks: `Breeder`, `BreederKind`, `BreederEgg`, `breeders`, `breederBreedMs`, `hatcherySlots`, `breedingPool`, `breedingOdds`, `breedValidity`, `activeLegendaries`, `BreedContext`, `firstHybridDone`, `firstHybridPending`, `discovered`, `habitatRateCap`, `dragonRateX20`, `basicPriceGold`, `FIRST_HYBRID_MS`, `SPECIES_ROWS`.
- Non-blocking GDD note: §5.2 says a Terra/War Rare in a War Vault fills "about 3x faster than War Commons". The formula gives about 4.3x against Commons and about 2.9x against War Rares. No test pins the sentence, and no number changes.
