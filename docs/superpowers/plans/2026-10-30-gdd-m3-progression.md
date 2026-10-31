# M3 Progression Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make progression run on GDD §4.2–4.4: the Dragon Roost and Ascension, the real XP curve and §4.3 source table, one unlock table behind every gate, Goals through the Quests button, a level-up screen, and a fix for XP farming.

**Architecture:** `packages/game-core` keeps the rules: `data/xp.ts` gets the curve as literal integers, `data/unlocks.ts` becomes the only source of Player Level gates, and `data/goals.ts` and `data/roost.ts` hold their tables. `applyAction` settles level-ups in one place, so a day limit applies to every action. The web client adds `RoostPanel`, `QuestsPanel` and a level-up overlay.

**Tech Stack:** TypeScript, Vitest, Fastify + Drizzle (PGlite in dev), React + Phaser, Playwright, pnpm workspace. Tests and the game run on shiko's PC.

**Spec:** `docs/dragon-island-gdd.md` (§ references below), with `docs/superpowers/specs/2026-10-30-gdd-rulings.md` (A# answers, R# rulings) and the roadmap `docs/superpowers/plans/2026-10-30-gdd-roadmap.md`.

## Questions for shiko (answered 2026-10-30)

shiko approved the plan with no changes, so the recommended options stand: Q1 (c) and Q2 (a). Recorded in the rulings file; the options stay below as the record.

Both come from arithmetic on the GDD's own numbers. I measured them against the §4.3 curve at Flash-14.

**Q1. XP farming: the proposed fix alone can't hold the level targets.** §4.3 targets PL 20 on Day 2–3 and PL 30 on Day 4. XP per hour for one building or farm, played without stopping:

| Loop | XP/h | PL 20 (73,067 XP) |
| --- | --- | --- |
| Terra × Terra, Common, 5 s | 129,600 | 0.6 h |
| Uncommon Tier A, 5 min | 5,040 | 14.5 h |
| Common Tier B, 2.5 min | 4,320 | 16.9 h |
| Rare Tier A, 40 min | 1,530 | 47.8 h |
| Dragon Bush, 1 farm, 15 s | 5,760 | 12.7 h |
| Dragon Bush, 4 farms | 23,040 | 3.2 h |
| Dragon Bush, 8 farms | 46,080 | 1.6 h |

Each Dragon Bush also yields 60 Food, worth up to 72 more XP when fed. Removing XP from Common breeds stops only the first row. Harvesting is a §4.3 value and is faster than every remaining breed loop, so a test pinning PL 20 at Day 2–3 can't pass under (a) alone.
- (a) No XP when two Common parents produce a Common egg (no start-breed or hatch XP). A real hybrid from Commons still pays. PL 20 for a non-stop bot is then about 14.5 h breeding, or 3.2 h harvesting. Departs from §4.3's table for one case.
- (b) A level limit per game day taken from §7.2's table: Flash-14 Day 1 PL 12, Day 2 PL 18, Day 3 PL 25, Day 4 PL 30; Flash-28 Days 1–2 PL 12, Day 3 PL 18, Days 4–5 PL 25, Days 6–7 PL 30; none after Rush. XP above the limit is banked, not lost, and pays out when the day turns. It holds every loop to the GDD's schedule and is the only option that passes the Day 2–3 test. A bot sprints to the limit each day, then waits.
- (c) **Recommended.** Both. (b) holds the schedule for every loop, and (a) removes the free 5-second loop, so hitting the limit takes some play. Normal players should rarely see the limit.

**Q2. Build XP as written would pass every level target on Day 1.** §4.3 gives 1 XP per 20 Gold, and §7.2 multiplies XP by 12 while Gold costs stay classic. Day 1's roughly 750k Gold (§7.2), about 65 % on building (§5.7), gives about 292,000 XP: PL 33 on Day 1, against PL 12. One War habitat (250,000 Gold) pays 150,000 XP; Ascension (10M Gold) pays 6,000,000 XP, eleven times the XP to PL 40.
- (a) **Recommended.** Build XP isn't multiplied by `xpMult` and pays at most one level per build. War habitat at PL 18: 12,500 XP capped at that level's 9,088, so one level. Gold stays meaningful, and big builds feel rewarding without skipping tiers.
- (b) Not multiplied, no per-build limit. Ascension still pays 500,000 XP, about PL 30 to PL 40 at once.
- (c) As written, ×12, with Q1 (b)'s limit doing the holding back. Every builder sits at the day's limit, and the limit becomes the game's only pacing until Day 4, then jumps to PL 40+ at Ascension.

## Global Constraints

- `packages/game-core` is pure: no I/O, no `Date.now()`, no `Math.random()`; `nowMs`, `Rng`, `catalog`, `preset` and `day` are parameters (CLAUDE.md).
- Gold, Food, XP and USD amounts are integers (USD in micro-dollars).
- Every GDD number lives in `packages/game-core/src/data/`; game logic never holds a literal from the GDD. Each data file names its GDD section in a header comment. Every task cites its GDD section.
- Flash-14 is the default preset (A2); Flash-28 is a second preset object, never a code path (§7.2).
- Original art and names only (CLAUDE.md). Goal text is ours; shiko may edit it.
- Conventional commits, one commit per task, TDD: failing test first, and run it.
- Mobile-first portrait layout; every tap target at least 44 px.
- No save migration: `STATE_VERSION` becomes 4 and old saves reset (R2).
- Do not touch `contracts/`. Do not start PixelLab generation; Task 9 only writes the list. Run e2e through a temporary `channel: 'chrome'` config unless Playwright's browser has been installed; don't commit that config.

## Review Focus

1. A Roost upgrade in progress must not raise the level cap: feeding at the old cap still fails `LEVEL_CAP` until the build finishes, and then the Feed button returns (§4.1, §4.2). Pinned in Task 4.
2. Ascension with too little $DRIS must leave Gold, tier and constructions untouched; with too little Gold it must charge nothing (§4.2, §7.4). Pinned in Task 4, on the real server path.
3. A Goal already satisfied when it becomes current can be claimed at once, can't be claimed twice, and its reward pays exactly once under replay (§1.4). Pinned in Task 5.
4. At every PL boundary in the §4.4 table the client's reason agrees with the server's refusal: one level below is refused with `Level n` and the level itself is allowed. Pinned in Task 3.
5. XP banked above a day limit pays out on the first action of the next day, across several levels, with one level-up screen and no lost XP (Q1). Pinned in Tasks 7 and 8.

---

## File structure (end state of this plan)

```
packages/game-core/src/
  data/xp.ts          §4.3 XP_TO_NEXT literal curve, source table, XP_LEVEL_LIMITS, build XP
  data/unlocks.ts     §4.4 UNLOCKS: the only Player Level gate table
  data/roost.ts       §4.2 tier table, footprint until M4
  data/goals.ts       §1.4 ordered Goal rows
  progression.ts      xpToNext, addXp, settleLevels, buildXp, isNewEntry XP
  goals.ts            goalProgress, canClaim
  actions/goal-actions.ts   claimGoal
  actions/build-actions.ts  Roost placement and upgrades
  store.ts            + ascension
  state.ts            version 4: + roostPlacement, goalIndex, goalStats; - tutorial
apps/web/src/
  panels/RoostPanel.tsx     tier, cap, next tier, upgrade or Ascension
  panels/QuestsPanel.tsx    current Goal, progress, Claim
  hud/LevelUp.tsx           level-up overlay
  hud/Hud.tsx               Quests enabled with a badge; XP bar on the real curve
docs/art/gdd-m3-art-list.md
docs/superpowers/reports/2026-10-30-m3-report.md
```

---

### Task 1: The §4.3 XP curve (§4.3, §7.2, R28, R29)

**Files:**
- Modify: `packages/game-core/src/data/xp.ts`, `src/progression.ts`, `src/state.ts` (`STATE_VERSION = 4`), `src/actions/apply.ts`, `test/progression.test.ts`, `test/xp-mult.test.ts`, `apps/web/src/hud/hudModel.ts`, tests that pin levels

**Interfaces:**
- Produces:
```ts
export const XP_TO_NEXT: readonly number[]    // index = PL − 1, ⌈50 × PL^1.8⌉ for PL 1..49, literal integers
export const MAX_PLAYER_LEVEL = 50
export function xpToNext(level: number): number   // reads the table; Infinity at max
export function cumulativeXp(level: number): number  // XP from PL 1 to reach `level`
export function addXp(s: PlayerState, classicXp: number, preset: Preset, day: number): PlayerState  // adds classicXp × xpMult, then settles
export function settleLevels(s: PlayerState, preset: Preset, day: number): PlayerState  // the only place levels rise
```
- The curve is not multiplied by the preset: §4.3 multiplies awards (R29). `addXp` gains `day` so Task 8 has it; until Task 8 `day` is unused beyond being passed.

- [ ] **Step 1: Write the failing tests**: `xpToNext(1) === 50`, `xpToNext(2) === 175`, `xpToNext(10) === 3155`. `cumulativeXp(5) === 1194`, `(10) === 9741`, `(15) === 31864`, `(20) === 73067`, `(30) === 232934`, each within 0.1 % of §4.3's table (9,742, 31,862, 73,062, 232,892). Every entry of `XP_TO_NEXT` equals `Math.ceil(50 * pl ** 1.8)`. Several level-ups from one large award keep the remainder.
- [ ] **Step 2: Run** `pnpm --filter @wyrmhaven/game-core test -- progression` — expected: FAIL.
- [ ] **Step 3: Implement**; generate the literal table once with a throwaway script. Re-pin tests that assumed `50 × L²`; the R27 PL 2 test still holds at 50 XP.
- [ ] **Step 4: Run** every package's tests and `pnpm -r typecheck` — expected: PASS.
- [ ] **Step 5: Commit** — `feat(game-core): §4.3 XP curve as a literal table`

### Task 2: The §4.3 source table (§4.3, Q2)

**Files:**
- Modify: `src/data/xp.ts`, `src/progression.ts`, `src/actions/breed-actions.ts`, `src/actions/build-actions.ts`, `src/actions/island-unlock-actions.ts`, `test/xp-sources.test.ts` (create), `apps/web/src/panels/ObstaclePanel.tsx` (only if its shown XP changes)

**Interfaces:**
- Produces: `BUILD_XP_GOLD_PER_XP = 20`, `BUILD_XP_MIN = 5` in `data/xp.ts`; `buildXp(goldSpent: number, s: PlayerState): number` = `max(BUILD_XP_MIN, floor(goldSpent / 20))`, capped at `xpToNext(s.level)` and awarded with no `xpMult` (Q2 a). `addRawXp(s, xp, preset, day)` awards without the multiplier.
- Sources after this task: harvest tier × 2; feed 1 per 10 Food, min 1; start a breed 5; hatch by rarity, doubled when the species isn't yet in `discovered`; build, upgrade or expand per R31; Goal rewards (Task 5); collect 0. PvE and obstacle XP stay as they are until M5 and M4.

- [ ] **Step 1: Write the failing tests** under Flash-14: hatching a first Rare awards 80 × 2 × 12 = 1,920; a second one 960. A Common already discovered: 120. `buyBasic` awards 0 XP. Building a Sea habitat (5,000 Gold) at PL 3 awards 250 XP (not 3,000). War habitat (250,000 Gold) at PL 18: 12,500 capped at `xpToNext(18)` = 9,088. Farm 2 (3,000 Gold) awards 150. An expansion for 1,000 Gold awards 50. A decoration awards 0 (R31). A premium item (`farmL5`, `goldenAerie`) awards 0. Collect Gold awards 0.
- [ ] **Step 2: Run** — expected: FAIL.
- [ ] **Step 3: Implement**; award at the moment Gold is spent (R31).
- [ ] **Step 4: Run tests + typecheck** — expected: PASS.
- [ ] **Step 5: Commit** — `feat(game-core): §4.3 XP sources: first-time hatch, build XP`

### Task 3: One unlock table behind every gate (§4.4, §5.3, §5.4, §5.5, R32)

**Files:**
- Create: `src/data/unlocks.ts`, `test/unlocks.test.ts`
- Modify: `src/data/habitats.ts`, `src/data/farms.ts`, `src/data/breeding-buildings.ts`, `src/island.ts`, `src/pve.ts`, `src/buildings.ts`, `src/farm.ts`, `src/store.ts`, every action that returns `LEVEL_TOO_LOW`, `apps/web/src/panels/*` (reasons), `apps/web/test/*`

**Interfaces:**
- Produces:
```ts
export type UnlockKey =
  | `habitat:${Element}` | `basic:${Element}` | `crop:${CropId}` | `farm:${1|2|3|4|5|6|7|8}`
  | `mountain:${1|2|3}` | `grove:${1|2|3}` | `hatchery:${1|2|3|4}` | 'hatcheryFifthSlot'
  | `roost:${1|2|3|4|5}` | 'pve' | 'wings' | `home:${number}` | `island:${Exclude<IslandId, 'home'>}`
export const UNLOCKS: Readonly<Record<UnlockKey, number>>
export function unlockPl(key: UnlockKey): number
export function isUnlocked(key: UnlockKey, level: number): boolean
export function unlocksAt(level: number): readonly UnlockKey[]   // for the level-up screen
```
- Removes `HABITATS[e].unlockPl`, `CROPS[c].unlockPl`, `FARM_UNLOCK_PL`, every `minPl`, `HOME_EXPANSION[].minLevel`, `OUTER_ISLANDS[].minLevel`, `PVE_MIN_PLAYER_LEVEL`. Values per §4.4, §5.4 and §5.5: PvE 4 (today 5); `island:isle2` 12; `island:isle3` 18 (today 20); `island:isle4` 25 (today 30); `island:isle5` 32 (today 40); `island:dawnspire` 40 (today 45); `home:n` keep today's values until M4 (R32). `roost:n` 5, 10, 15, 22, 30. PvP and decorations keep their own gates until M6 and M7.

- [ ] **Step 1: Write the failing tests**: the literal §4.4 table row by row against `unlocksAt(pl)` for PL 1–30, plus farms (§5.3) and Hatchery, Mountain and Grove levels (§5.4). A source-text test: no file in `packages/game-core/src` outside `data/unlocks.ts` and `decorations.ts` contains `minPl`, `unlockPl:` or `minLevel:`. Review Focus 4: for each key, the action is refused with `LEVEL_TOO_LOW` at `pl − 1`, and allowed at `pl` given the Gold and room; the Shop's reason reads `Level n` at `pl − 1` and is gone at `pl`, for one key of each kind.
- [ ] **Step 2: Run** — expected: FAIL.
- [ ] **Step 3: Implement.** Web reasons read `unlockPl`; `bookHints.ts` too.
- [ ] **Step 4: Run tests + typecheck + e2e** — expected: PASS.
- [ ] **Step 5: Commit** — `refactor(game-core): §4.4 unlock table is the only level gate`

### Task 4: Dragon Roost and Ascension (§4.1, §4.2, §7.4, R33, R34, R35)

**Files:**
- Create: `src/data/roost.ts`, `test/roost.test.ts`, `apps/web/src/panels/RoostPanel.tsx`
- Modify: `src/state.ts`, `src/island.ts`, `src/placement-rules.ts`, `src/construction.ts`, `src/buildings.ts`, `src/store.ts`, `src/actions/build-actions.ts`, `src/actions/economy-actions.ts`, `src/actions/validate.ts`, `packages/shared/src/actions.ts`, `apps/web/src/panels/DragonPanel.tsx`, `apps/web/src/panels/ShopPanel.tsx`, `apps/web/src/panels/PanelHost.tsx`, `apps/web/src/game/islandModel.ts`, `apps/web/src/game/bridge.ts`, `apps/server/test/actions.test.ts`

**Interfaces:**
- Produces:
```ts
export const ROOST_TIERS: readonly { tier: number; levelCap: number; gold: number; usdMicro: number | null; classicMs: number }[]
  // T1 cap 10, 5,000, 30 min; T2 15, 75,000, 4 h; T3 20, 400,000, 12 h; T4 30, 2,500,000, 24 h; T5 40, 10,000,000 + $2.00, 48 h
export const ROOST_FOOTPRINT = 2    // until M4 (R33)
// PlayerState + roostPlacement: Placement | null; Placeable + { kind:'roost' } builds Tier 1
// BuildingRef + { type:'roost' }; startUpgrade goes to Tiers 2–4; StoreItem + { kind:'ascension' } starts Tier 5
```
- `roostTier` rises when the construction completes. `ROOST_LEVEL_CAPS` becomes derived from `ROOST_TIERS`. Timers divide by `timerDiv`.

- [ ] **Step 1: Write the failing tests**: every §4.2 row literally, and `levelCap` at each tier. Placing the Roost: PL 4 → `LEVEL_TOO_LOW`; PL 5 with 5,000 Gold builds for 300,000 ms under Flash-14; a second Roost → `MAX_LEVEL`. Review Focus 1: during the Tier 1 build a Lv 7 feed fails `LEVEL_CAP`, after completion it succeeds. Tier 5 under Flash-14: 28,800,000 ms. Review Focus 2: `buy ascension` at PL 30, Tier 4, 10M Gold charges 2,000,000 micro-USD, spends 10M Gold, starts the build; below Tier 4, below PL 30, or with too little Gold fails with no charge; through `/actions` with too little $DRIS the state is unchanged. A second Ascension while building fails. Panel: `Upgrade Roost` on a capped dragon is enabled and opens the Roost (or the Shop before it's built); `RoostPanel` shows `Tier 2 · cap 15`, next tier's cost, and for Tier 5 `10,000,000 gold + $2.00`.
- [ ] **Step 2: Run** — expected: FAIL.
- [ ] **Step 3: Implement.** Art falls back to `building.nest`-style drawn placeholder until Task 9.
- [ ] **Step 4: Run tests + typecheck + e2e** — expected: PASS.
- [ ] **Step 5: Commit** — `feat: Dragon Roost tiers and Ascension (§4.2)`

### Task 5: Goals (§1.4, §4.3, §5.7, R36, R37)

**Files:**
- Create: `src/data/goals.ts`, `src/goals.ts`, `src/actions/goal-actions.ts`, `test/goals.test.ts`
- Modify: `src/state.ts` (`goalIndex`, `goalStats`; removes `tutorial`), `src/actions/apply.ts`, `src/actions/types.ts`, `src/actions/validate.ts`, every action that bumps a stat, `packages/shared/src/actions.ts`

**Interfaces:**
- Produces:
```ts
export interface GoalRow { id: string; text: string; xp: number; gold: number; done: GoalCheck }
export const GOALS: readonly GoalRow[]
export interface GoalStats { collects: number; harvests: number; feeds: number; breeds: number; hatches: number }
export function currentGoal(s: PlayerState): GoalRow | null
export function goalProgress(s: PlayerState, g: GoalRow, c: Catalog): { have: number; need: number }
// Action { type:'claimGoal' }; ActionError + 'GOAL_NOT_DONE' | 'NO_GOAL'
```
- `GoalCheck` is a small data union (`{ kind:'stat', stat, need }`, `{ kind:'dragonLevel', need, count }`, `{ kind:'discovered', need }`, `{ kind:'habitatsOf', elements }`, `{ kind:'dragonOf', elements }`, `{ kind:'farms', need }`, `{ kind:'hatchery', need }`, `{ kind:'roost', need }`, `{ kind:'level', need }`).
- Rows (R36; XP in §4.3's 25–500 range, classic):

| # | Text | Done when | XP | Gold |
| --- | --- | --- | --- | --- |
| 1 | Collect Gold from a habitat | 1 collect | 25 | 200 |
| 2 | Plant and harvest a Dragon Bush | 1 harvest | 25 | 100 |
| 3 | Feed a dragon | 1 feed | 25 | 100 |
| 4 | Raise two dragons to level 4 | 2 dragons Lv 4 | 50 | 500 |
| 5 | Breed your first hybrid | `firstHybridDone` | 75 | 500 |
| 6 | Hatch an egg | 1 hatch | 75 | 1,000 |
| 7 | Build a Sea or Nature habitat | either exists, finished | 100 | 2,000 |
| 8 | Buy a Sea or Nature Basic | owns one | 100 | 2,000 |
| 9 | Build a second farm | 2 farms | 100 | 2,000 |
| 10 | Upgrade the Hatchery | Hatchery L2 | 100 | 2,000 |
| 11 | Build the Dragon Roost | Tier 1 | 200 | 5,000 |
| 12 | Raise a dragon to level 10 | 1 dragon Lv 10 | 200 | 10,000 |
| 13 | Find 10 species in the Dragon Book | 10 discovered | 300 | 20,000 |
| 14 | Upgrade the Roost to Tier 2 | Tier 2 | 500 | 40,000 |

- [ ] **Step 1: Write the failing tests**: the rows literally. `claimGoal` on an unmet Goal fails `GOAL_NOT_DONE`. Goal 1 after a collect pays 25 × 12 XP and 200 Gold and advances. Review Focus 3: with Goal 2 already satisfied when Goal 1 is claimed, Goal 2 is claimable at once; a stored replay pays once; after Goal 14, `NO_GOAL`. `goalProgress` reads `1 / 2` part way. Every row's `done` has a state that satisfies it. A fresh Flash-14 player can finish Goals 1–6 through real actions with no grants.
- [ ] **Step 2: Run** — expected: FAIL.
- [ ] **Step 3: Implement.** Remove `tutorial`, `breedDone`, `hatchDone`.
- [ ] **Step 4: Run tests + typecheck** — expected: PASS.
- [ ] **Step 5: Commit** — `feat(game-core): sequential Goals replace the tutorial flags (§1.4)`

### Task 6: Quests screen (§1.4)

**Files:**
- Create: `apps/web/src/panels/QuestsPanel.tsx`
- Modify: `apps/web/src/hud/Hud.tsx`, `apps/web/src/hud/hudModel.ts`, `apps/web/src/panels/PanelHost.tsx`, `apps/web/test/hud.test.tsx`, `apps/web/test/panels.test.tsx`, `apps/web/e2e/hud.spec.ts`

**Interfaces:**
- Produces: the Quests button is enabled and shows a dot when the current Goal is claimable. `QuestsPanel`: `Goal 4 of 14`, the text, a progress line, rewards as `+50 XP · +500 gold` with XP shown after the multiplier, and `Claim` when done. After Goal 14: `All goals done`. The attention list gains `Goal ready`.

- [ ] **Step 1: Write the failing tests**: bar order unchanged and Quests no longer disabled; a claimable Goal shows the dot and `Claim`; an unmet one shows `0 / 1` with no `Claim`; reward text shows 300 XP for Goal 1 under Flash-14 and 200 under Flash-28; Claim sends `claimGoal`.
- [ ] **Step 2: Run** — expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run tests + typecheck + e2e** — expected: PASS.
- [ ] **Step 5: Commit** — `feat(web): Quests screen for Goals`

### Task 7: Level-up screen and the XP bar (§4.3, §4.4, R38)

**Files:**
- Create: `apps/web/src/hud/LevelUp.tsx`, `apps/web/test/levelup.test.tsx`
- Modify: `apps/web/src/App.tsx`, `apps/web/src/hud/Hud.tsx`, `apps/web/src/hud/hudModel.ts`, `apps/web/src/panels/ResourcesBar.tsx`

**Interfaces:**
- Consumes: `unlocksAt`, `xpToNext`.
- Produces: `LevelUp({ from, to, onClose })`: `Level 7`, or `Level 7 → 9` for a jump, then a list of what opened, one line per `unlocksAt` key in plain words (`Electric Habitat`, `Farm 4`, `Crop: Thunder Pumpkin`, `Roost Tier 2`). Shown when `/me` or an action reply raises `state.level`, not on the first load, and not during placement or a battle. `xpFraction` clamps at 1, and the XP bar text stays `x / y XP`.

- [ ] **Step 1: Write the failing tests**: an action raising PL 5 to 6 shows `Level 6` and `Electric Habitat`, `Electric Basic`; PL 7 to 9 shows both levels' unlocks once; the first load at PL 9 shows nothing; closing it leaves the HUD intact; during placement it waits until placement ends. The XP bar reads `50 / 175 XP` at PL 2 with 50 XP.
- [ ] **Step 2: Run** — expected: FAIL.
- [ ] **Step 3: Implement.** Plays `fx.levelUp` when the manifest has it.
- [ ] **Step 4: Run tests + typecheck + e2e** — expected: PASS.
- [ ] **Step 5: Commit** — `feat(web): level-up screen listing what opened`

### Task 8: XP farming fix and the simulation (§4.3, §7.2, Q1)

**Files:**
- Modify: `src/data/xp.ts`, `src/progression.ts`, `src/actions/breed-actions.ts`, `src/actions/apply.ts`, `apps/web/src/hud/Hud.tsx`
- Create: `packages/game-core/test/xp-simulation.test.ts`, `packages/game-core/test/helpers/xpBots.ts`

**Interfaces:** built per shiko's Q1 answer. The tests below name which option they belong to.
- (a) `breedXpApplies(a: Species, b: Species, child: Species): boolean`, false when both parents and the child are Common. Start-breed and hatch XP both follow it. The egg records it (`BreederEgg.xpFree: boolean`) so hatch needs no parents.
- (b) `XP_LEVEL_LIMITS: Record<PresetId, readonly (readonly [number, number])[]>`, `[lastDay, maxLevel]` rows from §7.2: flash14 `[1,12],[2,18],[3,25],[4,30]`; flash28 `[2,12],[3,18],[5,25],[7,30]`. `levelLimit(day, preset): number | null`. `settleLevels` stops at the limit and keeps the XP; `applyAction` calls it after every successful action, so banked XP pays on the next day's first action. HUD: when banked, the XP bar's text reads `Daily level limit · more tomorrow`.

- [ ] **Step 1: Write the failing tests**:
  - (a) Terra × Terra after the first hybrid: 0 XP on start and hatch. Terra × Flame rolling a hybrid: 60 on start, hatch XP as usual. Terra × Flame rolling Common: 0. Terra × Sea-Nature giving a Common: normal XP.
  - (b) At Flash-14 Day 1 a player with XP for PL 15 stays PL 12 with the XP kept; the first action of Day 2 raises them to PL 15. Day 5 has no limit. Flash-28 limits by row. Review Focus 5: banked XP across three levels, all paid, none lost.
  - Simulation: `xpBots.ts` drives real `applyAction` calls on a fake clock with `gameDay`, starting from `newPlayer`, granting only Gold and Food. Bots: `breedLoop` (repeats the best breed it can, one building, then two), `harvestLoop` (Dragon Bush on every farm), `harvestAndFeed`. Under (b) or (c), at Flash-14: **each bot reaches PL 20 no earlier than Day 3** and PL 30 no earlier than Day 4 (§4.3). Flash-28: PL 20 no earlier than Day 4. Under (a) alone: pin the measured hours instead, and say in the report that the Day 2–3 target is not met.
  - A casual bot (30 minutes of play, 6 sessions a day) reaches PL 12 by Day 2 and PL 30 by Day 8 at the latest under Flash-14, so the fix doesn't slow normal play past §7.2 by much. Report its real numbers.
- [ ] **Step 2: Run** — expected: FAIL.
- [ ] **Step 3: Implement.** Keep the simulation under 30 s; use a coarser step where the result doesn't depend on it.
- [ ] **Step 4: Run tests + typecheck** — expected: PASS.
- [ ] **Step 5: Commit** — `feat(game-core): XP farming fix per Q1, pinned by bots playing the real rules`

### Task 8b: Level limits through Endgame (§7.2, R41)

Built from `.superpowers/sdd/2026-10-30-gdd-m3-progression/task-8b-brief.md`; commit `feat(game-core): level limits through Endgame from §7.2 (R41)`.

### Task 9: Art list for the PixelLab thread

**Files:**
- Create: `docs/art/gdd-m3-art-list.md`
- Modify: `apps/web/src/art/fromManifest.ts`, `apps/web/src/art/types.ts`, `apps/web/src/art/phaserLoader.ts`, `apps/web/src/game/islandModel.ts`, `apps/web/test/art.test.ts`

**Interfaces:**
- Produces: keys read when present: `building.roost.<1..5>` at 64×64 (final 4×4 footprint), drawn at a named scale on 2 cells until M4; `fx.levelUp` 64×64, 8 frames, one-shot; `icon.quests.16/32` if the current glyph is replaced; `ui.goal` check mark. Fallbacks: lower tier, then a drawn placeholder. Tier 5 looks visibly ascended.

- [ ] **Step 1: Write the failing test**: Roost at Tier 3 uses `building.roost.3` when present, then `.2`, `.1`, then the placeholder; no request for an absent key.
- [ ] **Step 2: Run** — expected: FAIL.
- [ ] **Step 3: Implement; write the list** in the table format of `docs/art/gdd-m2-art-list.md`, with the generation count.
- [ ] **Step 4: Run tests + typecheck** — expected: PASS.
- [ ] **Step 5: Commit** — `docs(art): M3 art list; Roost tiers read their sheets`

Then send the list's path to the coordinator for the art thread.

### Task 10: M3 verification and report

- [ ] **Step 1: `pnpm -r typecheck`, each package's tests, and e2e** — expected: green; record counts.
- [ ] **Step 2: `pnpm playtest`** and a throwaway Playwright spec with console and network listeners: fresh sign-in with no grants through Goals 1–6, watching the level-up screen and the XP bar; Terra × Terra after the first hybrid per Q1; build the Roost at PL 5 from a capped dragon's `Upgrade Roost`, feed past Lv 7 after it finishes; Goals to 14 with grants; Ascension with and without $DRIS; shift `/e2e/clock` across a day limit and see banked XP pay out; check one gate of each kind at its PL boundary. Delete the spec.
- [ ] **Step 3: Take** `docs/art/m3-quests.png`, `m3-roost.png`, `m3-levelup.png`, `m3-island.png` at 390×844 and `m3-desktop.png` at 1440×900; read each to check it shows what its name says.
- [ ] **Step 4: Write `docs/superpowers/reports/2026-10-30-m3-report.md`**: what works, what doesn't, what couldn't be verified, test counts, the simulation's numbers, rulings made, deferred items for M4.
- [ ] **Step 5: Commit** — `docs: M3 report and playtest screenshots`

---

## New rulings

Also recorded in `docs/superpowers/specs/2026-10-30-gdd-rulings.md`.

| # | Ruling | Why |
| --- | --- | --- |
| R28 | **The XP curve is a literal integer table** of ⌈50 × PL^1.8⌉. Totals are exact: 9,741, 31,864, 73,067, 232,934, each within 0.1 % of §4.3's rounded 9,742, 31,862, 73,062, 232,892. | Same treatment as R5; `Math.pow` isn't guaranteed identical across engines. |
| R29 | **`xpMult` multiplies awards, not the curve.** The roadmap's "curve × preset" is read this way. | §4.3: "Flash-14 multiplies all XP by 12", and its PL 30 Day 4 target only fits with an unmultiplied curve. |
| R30 | **First-time double XP** is on hatching only, when the species isn't yet in `discovered`. Buying a Basic adds it to the Book with no hatch XP. | §4.3 says "First-time hatch". |
| R31 | **Build XP** counts Gold spent on habitats, farms, Grove, Roost, upgrades, expansions and islands, paid when the Gold is spent. Decorations and $DRIS-priced items pay none. Obstacles keep §5.6's XP. | The 5 XP minimum on a 10 Gold decoration would be a farm; there's no Gold in a premium price. |
| R32 | **`UNLOCKS` uses §4.4 and §5.5 where they speak**, moving PvE to PL 4 and Islands 3–6 to PL 18, 25, 32, 40. Home expansions keep today's PLs until M4. PvP and decorations keep their own gates until M6 and M7. | §4.4 lists these; M4, M6 and M7 own the rest. |
| R33 | **The Roost is one building on 2 cells until M4**, with art at its final size drawn scaled down. Its tier rises when the build finishes. | R9, and R15's measured lesson about room. |
| R34 | **"Tier 1 is unlocked by a tutorial goal at PL 5"** means PL 5 is the gate and Goal 11 leads the player there. | §4.4 lists PL 5; a Goal gate could block a player who skips Goals. |
| R35 | **Ascension** spends its Gold and $2.00 when it starts, is skippable like any timer, and books its 100 % burn in M7. | §4.2, §7.4; the ledger split arrives in M7. |
| R36 | **The 14 Goals in Task 5** are ours, in §4.3's 25–500 XP range, with modest Gold rewards. | §1.4 and §4.2 name Goals but list none. |
| R37 | **Goals need a Claim tap**, are checked from state and simple counters, and count progress from the start of the game, so one already met can be claimed at once. | Keeps them pure and forgiving. |
| R38 | **The level-up screen pays nothing**: it reports new levels and what opened, and combines a jump into one screen. | §4.3 and §4.4 list no level rewards. |
| R39 | **The maximum Player Level stays 50**, with the curve through PL 49. | §7.2 says "40+"; §5.5's last gate is PL 40. |
| R40 | **If Q1 (b) or (c):** XP above the day's limit is banked and pays on the first action of the next day. Limits run per R41. | Nobody loses play; §7.2's Endgame row says only "30+". |
| R41 | **Level limits run through Endgame** from §7.2's table, replacing R40's "limits end with Rush"; banking stays; no limit from Finals on. | Without it a casual player (6 × 30 min a day) reaches PL 30 at 20 h and PL 40 at 48 h, and banked XP jumped PL 30 to PL 45 on Day 5, against §7.2's PL 32–40 across Days 6–12. |

## Self-review notes

- Spec coverage: §4.1 Upgrade Roost button Task 4; §4.2 Task 4; §4.3 Tasks 1, 2, 8; §4.4 Task 3; §1.4 Goals Tasks 5, 6; §7.2 XP and level targets Tasks 1, 8; §7.4 Ascension Task 4. Not here: PvE XP values and PvP's day gate (M5, M6), obstacle table (M4), the burn ledger (M7), Goal bounties beyond Gold and XP.
- Names used across tasks: `XP_TO_NEXT`, `xpToNext`, `cumulativeXp`, `addXp(s, classicXp, preset, day)`, `settleLevels`, `buildXp`, `UNLOCKS`, `unlockPl`, `isUnlocked`, `unlocksAt`, `ROOST_TIERS`, `roostPlacement`, `GOALS`, `currentGoal`, `goalProgress`, `goalIndex`, `goalStats`, `claimGoal`, `breedXpApplies`, `XP_LEVEL_LIMITS`, `levelLimit`.
- The curve's XP-from-feeding note in Q1: feed XP stays as §4.3 writes it. 360k Food a day (§7.2) is up to 432,000 XP a day, so past Rush a heavy feeder can pass §7.2's PL 32–40 pace. Only Islands 5 and 6 gate on those levels. It's left alone and watched in Task 8's numbers.
