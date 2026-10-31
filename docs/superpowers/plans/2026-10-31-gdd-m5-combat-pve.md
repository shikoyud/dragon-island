# M5 Combat and PvE Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the simultaneous-rounds battle and the 30-stage campaign with GDD §2 and §6.1–6.3: alternating 3v3 with Swap and KO replacement, the four-move kit, the §6.2 damage formula, the ten-chapter Elemental Trials with fatigue, stars, replays and rewards, and a portrait battle screen.

**Architecture:** `packages/game-core/src/battle/` gets one state machine that the server's re-simulation, the client's turn-by-turn play and the bots all drive, so they can't disagree. `data/moves.ts`, `data/trials.ts` and `data/battle.ts` hold every GDD number. A Trial is frozen in `state.pve.active` when it starts, and only then is its seed revealed (A8); `finishTrial` re-simulates the submitted moves from that snapshot.

**Tech Stack:** TypeScript, Vitest, Fastify + Drizzle (PGlite in dev), React + Phaser, Playwright, pnpm workspace. Tests and the game run on shiko's PC.

**Spec:** `docs/dragon-island-gdd.md` (§ references below), with `docs/superpowers/specs/2026-10-30-gdd-rulings.md` (A# answers, R# rulings) and the roadmap `docs/superpowers/plans/2026-10-30-gdd-roadmap.md`.

**Unchanged inputs:** the two open M4 economy questions (Gold income against §7.2, clear XP) stay on GDD values. This plan neither depends on them nor changes them. Trials' Gold is reported against §5.7's 3 % in Task 6.

## Questions for shiko (answered 2026-10-31)

shiko answered (a) to all five: Q1 (a), Q2 (a), Q3 (a), Q4 (a), Q5 (a). Recorded in the rulings file; the options stay below as the record. Q3, Q4 and Q5 were real GDD conflicts, so these answers settle them.

**Q1. Which elements do a hybrid's three element moves use?** §6.1 says the slots "come from the dragon's element pool" and §2.3 says "a dragon's elements only decide which moves it can learn". Neither says how a two-element dragon splits three slots.
- (a) **Recommended.** A fixed kit. Basic: all three in its element. Two elements: Tier 1 primary, Tier 2 secondary, Tier 3 primary. Three elements: Tier 1 primary, Tier 2 secondary, Tier 3 third. Element order is identity (§2.3), so Flame/Sea and Sea/Flame differ in attack as well as defence, and every battle is readable with no extra screen.
- (b) A free choice per dragon, from any of its elements. Deeper, but needs a loadout screen and saved state, and PvP defence teams need it too.
- (c) A fixed kit where Tier 3 is the secondary element. Hybrids get more reach at their strongest, but a Rare's top hit no longer matches its identity.

**Q2. Is "8 turns or fewer" for 3 stars counted across both sides, or as your own turns?** §6.1's limit is "30 total turns" and §6.2's "a full 3v3 runs 10–16 turns" uses the same unit, but §6.3 only says "turns". Two-sided 8 means 4 of your actions to KO 3 enemies, and below Lv 20 without Tier 3 that takes over-levelling. A whole chapter on 3 stars pays a Dragon Chest pull, worth $1.00 (§8.2).
- (a) **Recommended.** Total turns, both sides, the same as everywhere else in §6. 3 stars means mastery, and Task 6 measures how often a counter team reaches it.
- (b) Your own turns: 15 total at most. With a counter team most normal wins would then reach 3 stars.

**Q3. GDD conflict: PvE XP.** §4.3 says "Win a PvE battle: 10–50". §6.3 says XP = 20 × ch, Boss × 3, which is 20–200 for a node and 60–600 for a Boss. On Flash-14 the §6.3 total for all ten chapters is 13,200 × 12 = 158,400 XP, about two-thirds of the XP to PL 30 (232,934), and the daily limit (R41) holds it.
- (a) **Recommended.** §6.3 governs, as the specific formula. §4.3's row is treated as outdated.
- (b) Clamp §6.3 to 10–50: everything from Chapter 3 on pays 50, Bosses included. It matches §4.3, but the top chapters then pay almost nothing against their levels.
- (c) Rescale to 10–50 by chapter, Boss × 3 on top. It matches §4.3 for normal nodes only.

**Q4. GDD conflict: Chapter 9 has no enemies to use.** §6.3's Light Sanctum lists Epic enemies, but §3.4's grid has no Light-primary Epic: Light and Metal are free agents, and the catalog's Epics are the opposite pairs and one tri-hybrid.
- (a) **Recommended.** On-element slots are Light-primary Rares (3 exist) at the chapter's levels, wildcards are Epics, and the Boss is a Light Rare at L34. It departs from §6.3's rarity for this chapter only, and keeps the catalog as §3.4 has it.
- (b) Use Light-primary Legendaries (3 exist) for on-element slots. A big difficulty spike: a Legendary is 3.06× a Common, and one chapter later Chapter 10 has only a Legendary Boss.
- (c) Add Light Epics to the catalog. It contradicts §3.4's grid and needs art.

**Q5. GDD conflict: the Chapter 10 Boss doesn't exist.** §6.3 names a "Legendary Boss" for the War chapter, with counters Sea and Ice, and a "Trial Champion Legendary" reward, but the catalog has no War-primary Legendary and no such species anywhere in the GDD.
- (a) **Recommended.** Add one row: `trial-champion`, name `Trial Champion` (yours to rename, A4), War/Metal, not breedable. The Boss fights with it, and beating the Boss gives you one, once. The catalog rises from 106 to 107 species, and its art goes on the Task 9 list.
- (b) The same, with elements you choose. Tell me which second element.
- (c) Use the existing Glacier Warlord (Ice/War) as both Boss and reward. No new art, but it's Ice-primary, so §6.3's counters (Sea, Ice) don't hold: Ice is immune to Ice moves.

## Global Constraints

- `packages/game-core` is pure: no I/O, no `Date.now()`, no `Math.random()`; `nowMs`, `Rng`, `catalog`, `preset` and `day` are parameters (CLAUDE.md).
- Gold, Food, XP, HP, damage and USD amounts are integers (USD in micro-dollars). No floats in damage math, so client and server can't diverge.
- Every GDD number lives in `packages/game-core/src/data/`, pinned by a test; game logic never holds a literal from the GDD. Each data file names its GDD section in a header comment. Every task cites its GDD section.
- `data/unlocks.ts` stays the only table of Player Level gates (M3).
- Flash-14 is the default preset (A2); Flash-28 is a second preset object, never a code path (§7.2).
- Server is authoritative: the client sends move lists, and the server re-simulates (A8).
- Original art and names only (CLAUDE.md). §6.1 cites another game's base damage for its ratios; no name from it is used. Move names are ours (R67).
- Conventional commits, one commit per task, TDD: failing test first, and run it.
- Mobile-first portrait layout; every tap target at least 44 px.
- No save migration: `STATE_VERSION` bumps on each shape change on this branch, starting from 9, so a stale local save resets (R2).
- Do not touch `contracts/`. Do not start PixelLab generation; Task 9 only writes the list. Run e2e through a temporary `channel: 'chrome'` config unless Playwright's browser has been installed; don't commit that config.

## Review Focus

1. Client and server disagreeing: the same seed and moves must give an identical outcome and log from the client's step-by-step play, `simulateBattle` and the bots, across hundreds of seeds with swaps, KOs and immune hits. Pinned in Task 2.
2. Rerolling a seed: start a Trial, read the seed, dislike it, abandon, start again. Abandoning must cost something, a second start must be refused, the seed route must reveal only the active battle's seed, and replaying an `actionId` must not pay or spend twice. Pinned in Task 4.
3. Fatigue edges: exactly 25 %, a level-up while tired (max HP rises, HP doesn't), a clock stepping back, a dragon sold or fed in the middle of a Trial, Flash-28's rate, a team with fewer than 3 usable dragons with a clear reason. Pinned in Task 4.
4. Stalemates and immunity: a mirror Basic with only Physical to hurt with, crit and variance never lifting 0×, minimum 1 on a resisted hit, the AI never choosing 0× when another move exists, swap loops reaching the 30-turn limit and the defender winning. Pinned in Tasks 1 and 2.
5. Rewards paying once: first clear, Boss tokens, a Boss egg with a full Hatchery, Trial Champion and the chest pull, on replays and on star improvements; XP above the day's limit banks. Pinned in Tasks 4, 5 and 6.

---

## File structure (end state of this plan)

```
packages/game-core/src/
  data/moves.ts        §6.1 move multipliers, level gates, move names; kit rule
  data/battle.ts       §6.1, §6.2 team size, turn limit, crit, variance
  data/trials.ts       §6.3 chapter table, rewards, stars, fatigue, boss tokens and eggs
  elements.ts          unchanged rule; §2.2 pinned by a 10×10 test
  battle/moves.ts      movesFor(species, level)
  battle/damage.ts     rollDamage, baseDamage
  battle/machine.ts    the state machine: initBattle, needs, stepPlayer, runEnemy
  battle/ai.ts         §6.4 move choice, replacement choice
  battle/sim.ts        simulateBattle over the machine
  battle/preview.ts    battlePreview over the machine
  trials.ts            nodeTeam, nodeRewards, starsFor, nodeLocked
  fatigue.ts           currentHp, canFight, afterBattle
  actions/trial-actions.ts  startTrial, finishTrial, abandonTrial
  actions/battle-actions.ts pvpBattle, setDefenceTeam (pveBattle removed)
  store.ts             + healAll
  state.ts             Dragon.fatigue; pve: stars, replays, active, battles, chestPulls
apps/server/src/
  routes/pve.ts        GET /pve/seed
  services/actions.ts  finishTrial seed
apps/web/src/
  panels/TrialsPanel.tsx      chapters, nodes, team with HP, heal-all (replaces PvePanel)
  panels/BattlePanel.tsx      portrait battle controls
  panels/BattleResult.tsx     stars, rewards, drops
  game/scenes/BattleScene.ts  portrait stage: backdrop, dragons, fx
  state/battle.ts             turn-by-turn play on the revealed seed
docs/art/gdd-m5-art-list.md
docs/superpowers/reports/2026-10-31-m5-report.md
```

---

### Task 1: §2.2 matrix, move kit and damage (§2.1–2.3, §2.4, §6.1, §6.2, Q1, R62, R67)

**Files:**
- Create: `packages/game-core/src/data/moves.ts`, `src/data/battle.ts`, `src/battle/moves.ts`, `src/battle/damage.ts`, `test/matrix.test.ts`, `test/moves.test.ts`, `test/damage.test.ts`
- Modify: `src/battle/stats.ts`, `src/index.ts`

**Interfaces:**
- Produces:
```ts
// data/moves.ts
export type MoveTier = 'physical' | 1 | 2 | 3
export const MOVE_MULT_PCT: Record<MoveTier, number>     // physical 52, 1: 85, 2: 100, 3: 162
export const MOVE_MIN_LEVEL: Record<MoveTier, number>    // physical 1, 1: 1, 2: 10, 3: 20
export const MOVE_NAMES: Record<Element, { 1: string; 2: string; 3: string }>
// data/battle.ts
export const TEAM_SIZE = 3; export const TURN_LIMIT = 30
export const CRIT_PERCENT = 10; export const VARIANCE_MIN = 900; export const VARIANCE_MAX = 1100  // thousandths
// battle/moves.ts: always 4 entries, in slot order Physical, T1, T2, T3
export interface BattleMove { name: string; element: MoveElement; tier: MoveTier; multPct: number; minLevel: number }
export function movesFor(sp: Species): readonly BattleMove[]
export function moveUnlocked(m: BattleMove, level: number): boolean
// battle/damage.ts
export function baseDamage(atk: number, m: BattleMove, defPrimary: Element, crit: boolean, varianceThousandths: number): number
export function rollDamage(atk: number, m: BattleMove, defPrimary: Element, rng: Rng): { amount: number; multiplier: Mult; crit: boolean; immune: boolean }
```
- `rollDamage` always draws exactly twice, even when immune: `rng.int(100)` for crit, then `rng.int(201)` for variance.

- [ ] **Step 1: Write the failing tests.**
  - `matrix.test.ts`: the whole §2.2 table as a literal 10×10 array in GDD order, plus the Physical row, compared with `DAMAGE_MATRIX` and `elementMultiplier`. `(I checked: 0 differences today.)` Rules from §2.1: every element 0× to itself; if X deals 2× to Y then Y deals 0.5× to X, except Dark and Light, which deal 2× to each other. Primary only: a Flame/Sea defender takes 2× from a Sea move.
  - `moves.test.ts`: `MOVE_MULT_PCT` and `MOVE_MIN_LEVEL` literal. Per Q1 (a): Terra's kit is Physical, three Terra; `flame-sea` T1 Flame, T2 Sea, T3 Flame; `sea-flame` T1 Sea, T2 Flame, T3 Sea; `flame-ice-sea` T1 Flame, T2 Ice, T3 Sea. Every species in `LAUNCH_CATALOG` has 4 moves, slot 0 Physical. At Lv 9, T2 and T3 are locked; Lv 10 opens T2; Lv 19 keeps T3 locked; Lv 20 opens it. All 31 names unique; `MOVE_NAMES` per R67.
  - `damage.test.ts`, §6.2's table at ATK 3,200, no crit, variance 1000: T3 2× 10,368; T3 1× 5,184; T2 2× 6,400; T2 1× 3,200; Physical 1,664; T2 0.5× 1,600; any 0× 0. Crit: T2 1× 4,800. Variance 900 and 1100: T2 1× 2,880 and 3,520. Immune with crit and variance 1100 is 0, `immune: true`. Minimum 1: ATK 1, T1, 0.5×. Physical against the same primary is 1×. Stats: `flame` attacking `terra` with Physical at any level is 1×. §2.4's finding: Common Lv 40 2× T2 on a Legendary 14,000 HP takes 3 hits with average 6,400 (2.19 rounds up), and a Legendary 0.5× T2 on a Common at 2,800 takes 3 hits (2.86). §6.2's "add 5 % average": over 100,000 seeded rolls the mean is within 1 % of base × 1.05, crit rate within 0.5 points of 10 %, and variance stays in 900..1100. Exactly two draws per call, pinned with a counting `Rng`.
- [ ] **Step 2: Run** `pnpm --filter @wyrmhaven/game-core test -- matrix moves damage` — expected: FAIL.
- [ ] **Step 3: Implement.** All integer: `floor(atk × multPct × em2 × critNum × var / (100 × 2 × 2 × 1000))`, with `em2` = ElementMult × 2 and `critNum` 3 or 2. Max product about 1.2e10, so safe in a double. Names per R67. The old `STRIKE`, `powerPct` and `damage` go when Task 2 replaces their callers; keep them exported until then.
- [ ] **Step 4: Run** `pnpm -r typecheck` and game-core tests — expected: PASS.
- [ ] **Step 5: Commit** — `feat(game-core): §2.2 matrix pinned, §6.1 move kit, §6.2 damage in integers`

---

### Task 2: The alternating 3v3 machine (§6.1, §6.4 AI, A8, R63–R66)

**Files:**
- Create: `packages/game-core/src/battle/machine.ts`, `src/battle/ai.ts`, `test/battle-machine.test.ts`, `test/battle-ai.test.ts`
- Modify: `src/battle/sim.ts`, `src/battle/preview.ts`, `src/battle/stats.ts`, `src/actions/battle-actions.ts`, `src/actions/validate.ts`, `packages/shared/src/actions.ts`, `apps/web/src/state/battle.ts`, `apps/web/src/panels/BattlePanel.tsx`, `apps/web/src/game/scenes/BattleScene.ts`, `apps/web/e2e/battle.spec.ts`
- Delete: `test/battle-ai-fallback.test.ts`; rewrite `test/battle-sim.test.ts`, `test/battle-preview.test.ts`, `test/battle-replay.test.ts`

**Interfaces:**
- Consumes: Task 1.
- Produces:
```ts
export interface BattleDragonSpec { speciesId: string; level: number; /** Starting HP; full if absent. */ hp?: number }
export type PlayerMove = { kind: 'attack'; move: number } | { kind: 'swap'; to: number } | { kind: 'replace'; to: number }
export interface Fighter { spec: BattleDragonSpec; species: Species; stats: CombatStats; hp: number; moves: readonly BattleMove[]; /** Used Tier 3 on this dragon's last action. */ t3Cooling: boolean }
export interface BattleState { sides: Record<Side, { team: Fighter[]; active: number }>; turn: number; toAct: Side; awaiting: 'action' | 'replace'; log: BattleEvent[]; winner: Side | null }
export type BattleEvent =
  | { kind: 'attack'; turn: number; side: Side; slot: number; move: number; target: number; damage: number; multiplier: Mult; crit: boolean; immune: boolean; ko: boolean }
  | { kind: 'swap' | 'replace'; turn: number; side: Side; from: number; to: number }
export function initBattle(attacker: readonly BattleDragonSpec[], defender: readonly BattleDragonSpec[], c: Catalog): BattleState
export function legalMoves(b: BattleState, side: Side): PlayerMove[]
export function step(b: BattleState, side: Side, m: PlayerMove, rng: Rng): BattleState | null  // null = illegal
export function runDefender(b: BattleState, rng: Rng): BattleState   // AI turns and replacements until the attacker must act or the battle ends
export function aiChoice(b: BattleState, side: Side, rng: Rng): PlayerMove
export type BattleOutcome =
  | { ok: true; winner: Side; turns: number; log: BattleEvent[]; attacker: number[]; defender: number[]; attackerKos: number }
  | { ok: false; error: 'ILLEGAL_MOVE' | 'MISSING_MOVES'; at: number }
export function simulateBattle(attacker, defender, moves: readonly PlayerMove[], rng: Rng, c: Catalog): BattleOutcome
export function battlePreview(attacker, defender, moves, rng, c): { state: BattleState; done: BattleOutcome | null }
```
- PvP keeps full HP and its offers. Bastion, energy and the rest are M6. `aiFallback` and `attackerAi` go.

- [ ] **Step 1: Write the failing tests.**
  - Turns: attacker moves first; turns alternate; an attack or a swap is one turn; a KO replacement isn't (R63). After turn 30 with both sides alive, the defender wins with `turns: 30`. A KO'd active's owner replaces before anything else, including when it's about to be their turn; the attacker's replacement arrives as `{ kind: 'replace' }`. `replace` to a KO'd or active slot is illegal. `swap` when no bench is alive is illegal. Battle ends when a side has none alive.
  - Tier 3 (R64): using T3 makes it illegal on that dragon's next action; another move clears it; swapping out clears it; a fresh entrant can use it. Level-locked moves are illegal.
  - Immune: a Terra Basic against a Terra Basic can only hurt with Physical; a battle of two mirror L1 teams still ends. Swap loops by both sides reach turn 30 and the defender wins (Review Focus 4).
  - Start HP: `hp: 100` starts at 100; `hp` above max is capped; `attackerKos` counts the attacker's fallen.
  - AI per §6.4 and R66: never a 0× move when another exists; with a seeded `Rng` picks highest expected damage 80 % ± 2 of 10,000 trials, respecting the T3 cooldown; swaps only if every element move is 0.5× or worse and a bench dragon has a 2× move, Physical not counting; replaces with the bench dragon that has the best multiplier against the opponent's active, ties lowest slot (R65).
  - Review Focus 1: for 300 seeds and a random legal player, `simulateBattle` and step-by-step `battlePreview` give deep-equal outcomes and logs. A short list: `MISSING_MOVES`. An illegal move: `ILLEGAL_MOVE` with its index. Trailing moves after the end are ignored.
  - PvP: a forfeit stays a loss with its trophy change (existing tests re-aimed). Shared zod refuses `{ kind: 'attack', move: 4 }`, `{ kind: 'swap', to: 3 }`, `{ kind: 'nope' }`, and lists over 45 moves.
- [ ] **Step 2: Run** `pnpm --filter @wyrmhaven/game-core test -- battle` — expected: FAIL.
- [ ] **Step 3: Implement.** `step` is pure and returns a new state. `simulateBattle` and `battlePreview` both only call `step` and `runDefender`. `apps/web/src/state/battle.ts` and `BattlePanel` move to the new moves with plain buttons: a full battle screen comes in Task 8. PvE still runs through the old `pveBattle` handler with the new simulator until Task 4, with `aiFallback` replaced by: the AI's `aiChoice` plays for a missing attacker move, in that handler only.
- [ ] **Step 4: Run** `pnpm -r typecheck`, every package's tests, and e2e via the temporary config — expected: PASS.
- [ ] **Step 5: Commit** — `feat: alternating 3v3 battle machine with Swap, KO replacement and §6.4 AI`

---

### Task 3: Elemental Trials data (§6.3, §4.4, Q3, Q4, Q5, R71, R72)

**Files:**
- Create: `packages/game-core/src/data/trials.ts`, `src/trials.ts`, `test/trials.test.ts`
- Modify: `src/data/unlocks.ts`, `src/data/species-rows.ts`, `src/index.ts`, `test/species-rows.test.ts` (count), `apps/web/src/hud/hudModel.ts`

**Interfaces:**
- Produces:
```ts
export interface TrialChapter { chapter: number; element: Element; theme: string; minLevel: number; maxLevel: number; rarities: readonly [Rarity, Rarity?]; boss: Rarity; counters: readonly [Element, Element] }
export const TRIAL_CHAPTERS: readonly TrialChapter[]   // index = chapter − 1
export const NODES_PER_CHAPTER = 10; export const BOSS_NODE = 10
export const REPLAYS_PER_NODE_PER_DAY = 5; export const REPLAY_PCT = 50; export const BOSS_REWARD_MULT = 3
export const THREE_STAR_TURNS = 8
export const TRIAL_REWARD = { goldPerChSq: 1000, foodPerChSq: 50, xpPerCh: 20 }
export type UnlockKey = /* existing */ | `trial:${1|2|3|4|5|6|7|8|9|10}`
export type NodeKey = `${number}:${number}`
export function nodeTeam(chapter: number, node: number, c: Catalog): BattleDragonSpec[]  // pure, fixed per node
export function nodeLevel(chapter: number, node: number): number
export function nodeRewards(chapter: number, node: number, kind: 'first' | 'replay'): { gold: number; food: number; xp: number }
export function nodeLocked(s: PlayerState, chapter: number, node: number): 'LEVEL' | 'PREVIOUS' | null
export function starsFor(won: boolean, attackerKos: number, turns: number): 0 | 1 | 2 | 3
```

- [ ] **Step 1: Write the failing tests.**
  - The §6.3 table literal, all 10 rows: Terra Wilds L1–4 Common, PL 4, counters Metal and War; Flame Peaks 3–7 Common, PL 5, Terra, Sea; Sea Depths 6–10 Common/Uncommon, PL 6, Nature, Electric; Nature Grove 9–13 Common/Uncommon, PL 8, Flame, Ice; Electric Storm 12–16 Uncommon/Rare, PL 10, Terra, Light; Ice Wastes 15–20 Uncommon/Rare, PL 13, Flame, Metal; Metal Forge 19–24 Rare, PL 16, Electric, Dark; Dark Hollow 23–29 Rare/Epic, PL 19, Light, War; Light Sanctum 28–34 Epic, PL 23, Nature, Dark; War Citadel 33–40 Epic, Legendary Boss, PL 28, Sea, Ice. Each row's `counters` equals that element's weaknesses in §2.1. `unlockPl('trial:n')` matches; `trial:1` equals `unlockPl('pve')`.
  - `nodeLevel`: `min + floor((max − min) × (node − 1) / 9)`: Ch 1 node 1 L1, node 10 L4; Ch 10 node 10 L40.
  - `nodeTeam` for every node of every chapter: 3 specs of known species, the same on repeat; level is `nodeLevel`; slots 0 and 1 have the chapter's primary; slot 2 is a wildcard with another primary, so exactly 10 of 30 per chapter are off-element; a wildcard's primary deals 2× to one of the chapter's counters, so one counter can't sweep; rarity per R72 (two rarities: nodes 1–5 lower, 6–10 upper). Boss node's slot 0 has the Boss rarity. Per Q4 (a): Ch 9's slots 0 and 1 are Light Rares and its wildcards Epics. Per Q5 (a): Ch 10's Boss is `trial-champion` (War/Metal, rarity legendary, not a breed result: not in any pool). Catalog count 107.
  - `nodeRewards`: first Ch 1 node 1 is 1,000 Gold, 50 Food, 20 XP; first Ch 10 Boss 300,000, 15,000, 600 (per Q3 (a)); replay Ch 3 node 2 is 4,500, 225, 0; replay Ch 3 Boss is 13,500, 675, 0.
  - `starsFor`: loss 0; win with a KO 1; no KOs at 9 turns 2; no KOs at 8 turns 3; a KO at 5 turns 1 (per Q2 (a)).
  - `nodeLocked`: Ch 2 at PL 4 `LEVEL`; Ch 2 at PL 5 with Ch 1's Boss unbeaten `PREVIOUS`; node 2 before node 1 `PREVIOUS`; replaying a cleared node `null` (R71).
  - The level-up list reads `Elemental Trials: Flame Peaks` for `trial:n`; no raw keys.
- [ ] **Step 2: Run** `pnpm --filter @wyrmhaven/game-core test -- trials` — expected: FAIL.
- [ ] **Step 3: Implement.** Wildcards rotate by node through the elements strong against either counter, excluding the chapter's, and only those with a species at that node's rarity. A chapter whose top rarity has one on-element species uses it twice (Dark-Terra, War-Sea). Pick species by sorted id from a seeded `createRng(chapter × 100 + node)`, and never a Legendary except a Boss. `nodeTeam` is pure data: it doesn't touch the action's `Rng`.
- [ ] **Step 4: Run** `pnpm -r typecheck` and game-core and web tests — expected: PASS.
- [ ] **Step 5: Commit** — `feat(game-core): §6.3 Trials: chapters, enemies, rewards and stars`

---

### Task 4: Fatigue, Trials actions and the revealed seed (§6.3, §6.1, A8, Review Focus 2 and 3, R68–R70, R73, R78)

**Files:**
- Create: `packages/game-core/src/fatigue.ts`, `src/actions/trial-actions.ts`, `test/fatigue.test.ts`, `test/trial-actions.test.ts`, `apps/server/src/routes/pve.ts`, `apps/server/test/trials.test.ts`, `apps/web/src/panels/TrialsPanel.tsx`
- Modify: `src/state.ts` (`STATE_VERSION` 10), `src/actions/types.ts`, `actions/validate.ts`, `actions/apply.ts`, `actions/battle-actions.ts`, `actions/island-actions.ts` (`sellDragon`), `src/store.ts`, `actions/economy-actions.ts`, `src/data/trials.ts`, `packages/shared/src/actions.ts`, `packages/shared/src/api.ts`, `apps/server/src/app.ts`, `apps/server/src/services/actions.ts`, `apps/web/src/state/battle.ts`, `apps/web/src/panels/BattleHub.tsx`, `panels/PanelHost.tsx`, `api/errors.ts`, `apps/web/e2e/battle.spec.ts`
- Delete: `src/pve.ts` (PvP constants move to `src/data/pvp.ts`), `apps/web/src/panels/PvePanel.tsx`, `test/pve.test.ts`

**Interfaces:**
- Consumes: Tasks 1–3.
- Produces:
```ts
// state.ts
Dragon.fatigue?: { hp: number; atMs: number }   // absent = full
pve: {
  stars: Record<NodeKey, 1 | 2 | 3>
  replays: { day: number; counts: Record<NodeKey, number> }
  active: ActiveTrial | null
  /** Trials settled so far; names the next seed. */
  battles: number
  chestPulls: number
  starredChapters: number[]
}
export interface ActiveTrial { chapter: number; node: number; team: TeamIds; specs: BattleDragonSpec[]; index: number; startedAtMs: number; replay: boolean }
// fatigue.ts
export const MIN_FIGHT_PCT = 25   // in data/trials.ts
export function maxHp(d: Dragon, c: Catalog): number
export function currentHp(d: Dragon, c: Catalog, nowMs: number, preset: Preset): number
export function canFight(d: Dragon, c: Catalog, nowMs: number, preset: Preset): boolean
export function afterBattle(d: Dragon, hp: number, c: Catalog, nowMs: number): Dragon
// actions
| { type: 'startTrial'; chapter: number; node: number; team: TeamIds }
| { type: 'finishTrial'; moves: PlayerMove[] }
| { type: 'abandonTrial' }
// store: | { kind: 'healAll' }  // HEAL_ALL_MICRO_USD = 50_000 in data/trials.ts
// ActionError + 'DRAGON_TIRED' | 'TRIAL_ACTIVE' | 'NO_ACTIVE_TRIAL' | 'IN_TRIAL' | 'NOTHING_TO_HEAL'
// server: GET /pve/seed -> { seedHex }, 409 NO_ACTIVE_TRIAL; battleSeed(secret, `pve:${playerId}:${active.index}`)
```
- `finishTrial`'s RNG is seeded by that same label, in `services/actions.ts`, as `pvpBattle` is from its offer.

- [ ] **Step 1: Write the failing tests.**
  - Fatigue on a Common Lv 40, 8,000 HP. `hp: 1`, Flash-14: 481 after 1 minute; full after 17 minutes; Flash-28: 321 after 1 minute. 2,000 HP fights (25 %); 1,999 is `DRAGON_TIRED`. `atMs` in the future reads no more than `hp`, and never less (clock back). Level-up while tired: HP is unchanged, max rises (R68). `afterBattle`: 0 becomes 1 HP; max clears `fatigue`.
  - `startTrial`: `LEVEL_TOO_LOW`, `STAGE_LOCKED` for a locked node, `INVALID_TEAM` for fewer than 3 or duplicates, `DRAGON_TIRED`, `TRIAL_ACTIVE` when one is running, `DAILY_CAP_REACHED` at 6th replay of a node in a game day. A refusal changes nothing. Success stores `active` with specs including HP and level at that moment, and counts a replay now. The replay counter rolls on a new game day (`ctx.day`). 5 replays of node A don't touch node B's count.
  - `finishTrial`: re-simulates from `active`, ignoring later level or HP changes. Win: rewards per `nodeRewards`, first clear on first ever win, stars kept at best, `active: null`, `battles` + 1, HP written back. Replays: 50 %, no XP. A loss pays nothing but carries HP. A short or illegal list is a loss with the whole team on 1 HP (R70). `NO_ACTIVE_TRIAL` with none. XP goes through `addXp` with `xpMult` (Flash-14 Ch 1 node 1: 240), and above the day's limit banks. Gold and Food are flat (R73).
  - `abandonTrial`: `active: null`, `battles` + 1, team at 1 HP. Selling a dragon on the active team: `IN_TRIAL`. A team dragon fed mid-Trial: the battle uses its old level, and it keeps the new one after.
  - Enemy HP is always full; PvP ignores fatigue, and `pvpBattle` doesn't change it (§6.4).
  - `healAll`: 50,000 micro-USD charge effect, all `fatigue` cleared. `NOTHING_TO_HEAL` when nobody is hurt, with nothing charged. `IN_TRIAL` while a Trial is active, because its snapshot would go stale.
  - Server, real path (`trials.test.ts`): `GET /pve/seed` 409 with no active Trial; after `startTrial` it returns a seed that changes with `battles` and never for another player; `finishTrial` on the revealed seed gives exactly the client-side `simulateBattle` outcome; replaying a `finishTrial` `actionId` pays once; replaying `abandonTrial` once; a second start refused (Review Focus 2).
  - Shared zod: `chapter` 1..10, `node` 1..10, integer; refuses 11, 0, 1.5.
  - Web: `TrialsPanel` lists the 10 chapters with theme, PL and stars; nodes with level, reward and lock reason; team picker shows HP %; `Resting: 12 %` is disabled; `Heal all · $0.05`; `Need 3 dragons`. `messageFor` covers the new errors.
- [ ] **Step 2: Run** `pnpm --filter @wyrmhaven/game-core test -- fatigue trial-actions` — expected: FAIL.
- [ ] **Step 3: Implement.** `useBattle`'s PvE path: `startTrial`, then `GET /pve/seed`, then local play with `battlePreview`, then `finishTrial` when `done`. Draft moves stay in `localStorage` by `active.index`, so a reload resumes. If `/me` has an `active` on load, the client offers `Resume` or `Abandon`.
- [ ] **Step 4: Run** `pnpm -r typecheck`, every package's tests, and e2e via the temporary config — expected: PASS.
- [ ] **Step 5: Commit** — `feat: Trials with fatigue, a seed revealed after start, and heal-all`

---

### Task 5: Boss drops and speed-up tokens (§6.3, §5.6, M4 Q2, Q5, R74–R77)

**Files:**
- Modify: `packages/game-core/src/data/trials.ts`, `src/actions/trial-actions.ts`, `src/actions/breed-actions.ts` (`hatcheryUsed`), `test/trial-actions.test.ts`, `apps/web/src/panels/BattleResult.tsx` (create), `apps/web/src/panels/SpeedUpsRow.tsx`

**Interfaces:**
- Consumes: `s.speedUps`, `SpeedUpToken`, `Egg`, breeding timers.
- Produces:
```ts
export const BOSS_TOKENS: Readonly<Record<number, { token: SpeedUpToken; count: number }>>  // chapters 1–7
export const BOSS_EGGS: Readonly<Record<number, Rarity>>   // 5: 'uncommon', 7: 'rare'
export const TRIAL_CHAMPION_ID = 'trial-champion'
```

- [ ] **Step 1: Write the failing tests.** First clear of each Boss, literal (R75): Ch 1 and 2: 15 min × 2; Ch 3: 15 min × 3; Ch 4: 1 h × 3; Ch 5 and 6: 1 h × 4; Ch 7: 3 h × 5; none on Ch 8–10. Replays never pay them. They add to `speedUps`, and `useSpeedUp` spends them. Ch 5's egg is an Uncommon with primary Electric, Ch 7's a Rare with primary Metal, chosen by the action's `Rng`, deterministic on replay. It enters the Hatchery with its §3.5 hatch time ÷ preset, not `xpFree`, and a full Hatchery takes it above capacity, so it's never lost and new eggs wait (R76). Ch 10's first Boss clear gives one `trial-champion` at Lv 1 waiting in the Hatchery with no home, per Q5 (a), added to `discovered` on delivery; it needs a habitat of its elements like any hatchling; never a second. A whole chapter at 3 stars: `chestPulls` + 1 and the chapter in `starredChapters`, once, including when the 30th star comes on a replay. Ch 8–10 clears pay no $DRIS in this milestone (R77). `BattleResult` lists stars, Gold, Food, XP, tokens, egg and `Dragon Chest pull saved`.
- [ ] **Step 2: Run** `pnpm --filter @wyrmhaven/game-core test -- trial-actions` — expected: FAIL.
- [ ] **Step 3: Implement.** Roll drops in `finishTrial` after the battle, so the sim's draw order is unaffected. `chestPulls` is shown in `SpeedUpsRow`'s Settings section beside tokens; M8 spends it.
- [ ] **Step 4: Run** `pnpm -r typecheck`, game-core and web tests — expected: PASS.
- [ ] **Step 5: Commit** — `feat: Boss tokens, eggs, Trial Champion and saved chest pulls`

---

### Task 6: Bots fight Trials; pacing still holds (§4.3, §5.7, §7.2, R40, R41, Review Focus 5)

**Files:**
- Modify: `packages/game-core/test/helpers/xpBots.ts`, `test/xp-simulation.test.ts`
- Create: `packages/game-core/test/trials-balance.test.ts`

**Interfaces:**
- Consumes: `aiChoice`, `startTrial`, `finishTrial`, `nodeLocked`.
- Produces: nothing for later tasks. Literals pinned here are measured, then reported.

- [ ] **Step 1: Write the failing tests.**
  - Bots gain `fightTrials`: when a team can fight and a node is open, start it, play by `aiChoice`, finish it. Casual and non-stop bots on Flash-14 and Flash-28.
  - Levels: `endOfDay` stays `[12, 18, 25, 30, 32, 33, 34, 36, 37, 38, 39, 40]` for Flash-14 Days 1–12 for every bot, and Flash-28 stays on its rows. If it moves, stop and report; don't re-pin. XP never lost: `cumulativeXp(level) + xp` matches the sum of awards.
  - All 14 Goals still finish with no grants on both presets.
  - `trials-balance.test.ts`, each as a measured literal: the first day each chapter's Boss falls for the casual bot, with its breeding and feeding only; that every chapter's Boss is beatable by a counter team at the chapter's top level and top rarity with an AI player over 100 seeds, at a win rate above 50 %; share of 2 and 3 stars at equal level, and at +5 levels (answers Q2's effect); turns per battle against §6.2's 10–16 and 1v1 about 2; that Trials' share of Gold earned is reported against §5.7's 3 %, not pinned; minutes of rest per battle against §6.3's fatigue; Chapter 1 winnable by a PL 4 starter team of Terra, Flame and the first hybrid.
- [ ] **Step 2: Run** `pnpm --filter @wyrmhaven/game-core test -- xp-simulation trials-balance` — expected: FAIL.
- [ ] **Step 3: Implement** the bot change. Keep each bot under `BOT_TIMEOUT_MS`. If a chapter can't be beaten, or turns fall outside 8–20 on average, report it with numbers rather than tuning: all values are the GDD's.
- [ ] **Step 4: Run** `pnpm --filter @wyrmhaven/game-core test` — expected: PASS.
- [ ] **Step 5: Commit** — `test(game-core): bots fight Trials; levels hold; chapter balance measured`

---

### Task 7: The Trials screen (§6.3, R71)

**Files:**
- Modify: `apps/web/src/panels/TrialsPanel.tsx`, `panels/BattleResult.tsx`, `panels/BattleHub.tsx`, `styles/hud.css`, `hud/hudModel.ts`, `apps/web/test/trials.test.tsx` (create)

**Interfaces:**
- Consumes: `TRIAL_CHAPTERS`, `nodeRewards`, `nodeLocked`, `currentHp`, `canFight`.
- Produces: `TrialsPanel` props `{ onFight(chapter, node, team), onClose }`.

- [ ] **Step 1: Write the failing tests.** Chapters as a list showing theme, element icon, PL lock, `n / 30` stars; a chapter opens to 10 nodes with Boss marked, level, enemy element icons including the wildcard, stars and reward. The first open node is highlighted. `Replays left 3` per node. Team picker: 3 slots in order (first is lead), cards with HP bar, element and a 44 px tap target, counter hint against the node, default the last used team. HP ticks with the clock. `Heal all · $0.05` is disabled with `Everyone is healthy`. A resume banner while `active` exists. A shortcut on the HUD when a Boss is available isn't added: Battle stays the one entry. Attention items are unchanged.
- [ ] **Step 2: Run** `pnpm --filter @wyrmhaven/web test -- trials` — expected: FAIL.
- [ ] **Step 3: Implement.** Read screenshots at 390×844 and 1440×900 before committing.
- [ ] **Step 4: Run** `pnpm -r typecheck`, web tests — expected: PASS.
- [ ] **Step 5: Commit** — `feat(web): Elemental Trials screen`

---

### Task 8: The battle screen (§6.1, §6.2, §2.3, R80)

**Files:**
- Modify: `apps/web/src/game/scenes/BattleScene.ts`, `game/layout.ts`, `game/bridge.ts`, `panels/BattlePanel.tsx`, `state/battle.ts`, `styles/hud.css`, `apps/web/test/battle*.test.tsx`, `apps/web/e2e/battle.spec.ts`

**Interfaces:**
- Consumes: `BattleState`, `legalMoves`, `battlePreview`.
- Produces: `moveCard(b, m): { name, element, tier, hint: '2x' | '1x' | '0.5x' | 'IMMUNE', disabledReason: string | null }`, pure, in `state/battle.ts`.

- [ ] **Step 1: Write the failing tests.**
  - Layout, portrait (R80): enemy active upper right, your active lower left, each with name, level, HP bar and number, bench pips showing alive, KO'd, or hurt; a 2×2 grid of move buttons at the bottom, at least 44 px, then `Swap`; `Turn 7 / 30`, and in a Trial the star goal `3★: 8 turns, no KOs`. On desktop the same column, centred.
  - `moveCard`: name, element icon, tier, hint against the enemy's primary; `IMMUNE` for 0×; Physical `1x`; `Rests this turn` on T3 cooldown; `Lv 20` when locked; a locked or resting move is disabled, an immune one isn't.
  - Swap opens the bench; a KO opens the same list, with no way out (`replace`). Enemy turns play automatically after yours, with a short delay.
  - Scene: damage numbers, crit text, `IMMUNE` text with no damage shown, `2x` and `0.5x` tints, KO fade, swap slide; reduced motion jumps to the result. Dragons face each other using `dragonLook`. Backdrop `battle.backdrop.<element>` by chapter, a colour fill without art. Boss marked. Exit shows `Abandon?` with the cost: team falls to 1 HP.
  - e2e: a real Trial by clicks at 390×844: start, attack, swap, take a KO and replace, win, result shows stars. Same at 1440×900 for PvP.
- [ ] **Step 2: Run** `pnpm --filter @wyrmhaven/web test -- battle` — expected: FAIL.
- [ ] **Step 3: Implement.** The stage becomes portrait, 360×420, whole-number zoom, above the React controls. `integerZoom` follows it, and `BattleScene` keeps its `BATTLE` constant in `layout.ts`. The level-up screen waits for the end, as today.
- [ ] **Step 4: Run** `pnpm -r typecheck`, web tests, e2e via the temporary config — expected: PASS. Read screenshots at 390×844 and 1440×900.
- [ ] **Step 5: Commit** — `feat(web): portrait battle screen with moves, Swap, KO replacement and fx`

---

### Task 9: Art list and plumbing (§2, §6)

**Files:**
- Create: `docs/art/gdd-m5-art-list.md`
- Modify: `apps/web/src/art/types.ts`, `art/fromManifest.ts`, `art/fallback.ts`, `art/phaserLoader.ts`, `game/scenes/BattleScene.ts`, `panels/BattlePanel.tsx`, `apps/web/test/art.test.ts`

**Interfaces:**
- Consumes: keys from Tasks 7 and 8.
- Produces: the list, and code reading each key with a fallback.

- [ ] **Step 1: Write the failing tests.** Each new key has a fallback and is read when the manifest has it. A manifest with none still plays a whole battle.
- [ ] **Step 2: Run** `pnpm --filter @wyrmhaven/web test -- art` — expected: FAIL.
- [ ] **Step 3: Implement plumbing, and write the list** in the M4 list's format, written so an art thread with no other context can work from it, on its own branch from `gdd-m5`, committing only PNGs, the manifest, `apps/web/art/prompts.md` and `docs/art`. Fix any size against the code before listing it:
  - **Backdrops.** `battle.backdrop.<element>` × 10, 360×420 portrait, the chapter's theme, with space for dragons at the two standing spots.
  - **Move fx.** `fx.move.<element>` × 10 and `fx.move.physical`, one-shot, 64×64, with a stronger look possible by scale for Tier 3. `fx.hit`, `fx.crit`, `fx.immune`, `fx.ko`, `fx.swap`.
  - **Boss.** `battle.boss.marker` (crown, 16×16). `dragon.trial-champion`, `juvenile.trial-champion` and its egg per Q5, in the size of existing dragon sheets, an original design.
  - **Battle UI.** `ui.battle.platform` 64×32, `ui.battle.hpFrame`, `ui.battle.moveButton`, `ui.battle.swap`, `ui.star`, `ui.star.empty`, `ui.battle.turn`. Tier pips `ui.tier.1..3`.
  - **Trials.** `trial.chapter.<element>` × 10, 64×64 chapter cards, and `trial.node`, `trial.node.boss`, `trial.node.locked`.
  - Budget table with counts against the PixelLab balance (about 1,027 left), priority order: backdrops for Chapters 1–3, move fx, UI, Boss, the rest.
- [ ] **Step 4: Run** web tests — expected: PASS.
- [ ] **Step 5: Commit** — `docs(art): M5 art list; every key read with a fallback`

---

### Task 10: M5 verification and report

- [ ] **Step 1: `pnpm -r typecheck`, each package's tests, and e2e** — expected: green; record counts.
- [ ] **Step 2: Playtest** with `pnpm playtest` through the real UI, with a throwaway Playwright spec (deleted after), at 390×844 and 1440×900:
  - Fresh account to PL 4: Trials opens, Chapter 1 node 1 with a real team. Attack, 2×, 0.5×, `IMMUNE`, a crit, Swap, a KO and its replacement, T3's cooldown at Lv 20 with a grant. Compare HP after each turn with the server's result.
  - Fatigue: finish hurt, reopen: HP carried and rising at 6 % a minute by clock; a KO'd dragon at 1 HP refused until 25 %; Heal all at $0.05 with $DRIS; Flash-28 in a unit test only.
  - Stars: 1, 2 and 3 on one node, with a grant for over-levelling; replay at 50 %, no XP, 5 a day and the 6th refused; a new game day by clock.
  - Boss: Chapter 1 tokens, used on a running timer; Chapter 5 egg with a full Hatchery; Chapter 10 Boss with grants, Trial Champion arrives. A whole chapter at 3 stars saves a chest pull.
  - Abandon mid-battle: team at 1 HP. Reload mid-battle: `Resume` continues on the same seed. Two tabs.
  - PvP still works: one battle by clicks.
  - Frame time during a battle at 4× CPU throttle. Reduced motion. No page errors or unexpected 4xx.
- [ ] **Step 3: Take** `docs/art/m5-battle.png`, `m5-trials.png`, `m5-swap.png`, `m5-result.png` at 390×844 and `m5-desktop.png` at 1440×900; read each to check it shows what its name says.
- [ ] **Step 4: Write `docs/superpowers/reports/2026-10-31-m5-report.md`**: what works, what doesn't, what couldn't be verified, test counts, Task 6's measured balance, rulings made, deferred items, and the M4 economy questions restated with any new numbers.
- [ ] **Step 5: Commit** — `docs: M5 report and playtest screenshots`

---

## Carried to later milestones

- **M6:** Bastion, Arena Energy, leagues, Team Power matchmaking, Ghost teams, and `BOT_RARITIES` (R79).
- **M7:** $DRIS for Chapters 8–10 first and 3-star clears, and daily Token Trials (§6.3, §7.5, A16); heal-all's 100 % burn booked in the ledger (§7.4).
- **M8:** spending saved Dragon Chest pulls (§8.2), Pass tokens (§8.5).

## New rulings

Also recorded in `docs/superpowers/specs/2026-10-30-gdd-rulings.md`.

| # | Ruling | Why |
| --- | --- | --- |
| R62 | **Damage is integer maths:** MoveMult in hundredths, variance in whole thousandths from `rng.int(201)`, crit from `rng.int(100)`; two draws on every attack, even immune. | Client and server must not diverge; §6.2 gives the same results to the floor. |
| R63 | **A turn is an attack or a Swap, counted across both sides; a KO replacement isn't.** | §6.1: "Swap (uses the turn)", "enters free", "30 total turns". |
| R64 | **Tier 3's rest belongs to the dragon:** illegal on its next action, cleared by another move or by swapping out; a new entrant may use it. | §6.1 says "two turns in a row"; a swap breaks the row. |
| R65 | **PvE enemies use §6.4's AI.** It replaces a KO with the bench dragon that has the best multiplier against your active, ties lowest slot. | §6.3 names no AI, §6.4's is the only one, and it doesn't cover replacement. |
| R66 | **§6.4's swap test ignores Physical:** "every element move is 0.5× or worse". | Physical is always 1×, so as written the swap could never fire. |
| R67 | **Move names are ours, editable by shiko:** Strike (Physical); Terra Stone Toss, Quake Stomp, Mountain Fall; Flame Cinder Spit, Blaze Lash, Inferno Crown; Sea Spray Bolt, Riptide Lash, Abyss Surge; Nature Thorn Flick, Bramble Lash, Verdant Wrath; Electric Spark Jab, Arc Burst, Storm Lance; Ice Frost Nip, Rime Shard, Glacier Break; Metal Iron Tap, Steel Rake, Anvil Drop; Dark Shade Nip, Gloom Rend, Umbral Maw; Light Glint, Radiant Slash, Dawn Verdict; War Spear Jab, War Cleave, Warlord's Decree. | §6.1 sources ratios from another game; CLAUDE.md forbids copying its names. |
| R68 | **Fatigue is absolute HP plus a timestamp, regen floored, capped at max; a level-up raises max, not HP; 25 % means hp × 4 ≥ max.** | §6.3 gives rates only; this stays integer and pure. |
| R69 | **A Trial is frozen when it starts:** node, team, levels and HP are stored, and only then can the seed be read, named by `pve:playerId:index`. | Regen would make a client's preview differ from the server's re-simulation (A8). |
| R70 | **Abandoning, or a short or illegal list, is a loss with the team on 1 HP.** | Phase 2's forfeit rule: otherwise a revealed seed can be rerolled for free until it's perfect. |
| R71 | **A chapter needs its PL and the previous Boss; nodes go in order; gates are `trial:n` in `UNLOCKS`.** | §6.3 lists PLs and "10 nodes"; M3's one-table rule. |
| R72 | **Enemies are fixed per node:** level by linear steps through §6.3's range; two-rarity chapters split at node 5/6; slot 3 is the wildcard, one in three, with a primary that beats one of the chapter's counters; a Boss is top rarity and level with no stat bonus, and only marked. | §6.3 gives ranges and "about a third"; "one counter can't sweep it". |
| R73 | **Trials' Gold and Food are flat; XP takes `xpMult` and banks. Losses pay nothing. A replay is 50 %, floored, of the node's reward including a Boss's ×3, counted at start, per node and game day.** | §7.2 lists no PvE multiplier and §4.3 says all XP. |
| R74 | **Best stars are kept. A chapter's 30 stars save one `chestPulls`, once, spent in M8.** | Chests don't exist until M8. |
| R75 | **Boss tokens:** Ch 1–2 15 min × 2; Ch 3 15 min × 3; Ch 4 1 h × 3; Ch 5–6 1 h × 4; Ch 7 3 h × 5. | §6.3 says "2–5" with no sizes; rising with the chapter, from the sizes §5.6 has. |
| R76 | **A Boss egg has the chapter's primary, normal hatch time, and enters the Hatchery above capacity if full.** | §6.3 gives only rarity; a reward must never be lost, and §5.4's waiting rule needs a building. |
| R77 | **Chapters 8–10 pay no $DRIS until M7.** Stars are stored, so M7 can pay what's earned if it chooses. | A16: P is zero, and shiko will discuss tokens after gameplay. |
| R78 | **Heal-all is a store item at 50,000 micro-USD; unavailable when nobody's hurt or for a team in a Trial.** | §6.3, §7.4; the snapshot must not go stale. |
| R79 | **`BOT_RARITIES` stays until M6.** R24's PvE half ends here. | M6 owns matchmaking and Ghost teams. |
| R80 | **Battle screen:** portrait column with enemy upper right and yours lower left, 2×2 moves and Swap below, the same on desktop. | The GDD has no UI section despite the roadmap's "UI direction"; this is the genre's standard shape. |
