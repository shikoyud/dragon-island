# Phase 2: game-core Battles, Matchmaking and Trophies Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend `@wyrmhaven/game-core` with a deterministic 3v3 battle simulator, defender AI, trophy and league math, matchmaking with bot fill, a 30-stage PvE campaign, and `setDefenceTeam` / `pvpBattle` / `pveBattle` actions behind the existing `applyAction`.

**Architecture:** Pure modules under `src/battle/` (stats, simulation), plus `trophy.ts`, `matchmaking.ts`, `pve.ts`. The simulator consumes a battle `Rng` and the attacker's submitted move list and returns a winner plus an event log; action handlers wrap it, apply rewards and daily caps to `PlayerState`, and emit a `defenceResult` effect for the server to apply to the other player. Opponent data arrives in the action as a server-built `OpponentSnapshot` (the server, never the client, fills it).

**Tech Stack:** Same as Phase 1 (TypeScript 5 strict, Vitest, pnpm). No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-28-wyrmhaven-design.md` §10–11, §12 (trophy reset only), §8 (XP values), §14 (battle gold is eligible). Phase 1 plan: `docs/superpowers/plans/2026-10-28-game-core-economy.md`.

## Global Constraints

- All Phase 1 Global Constraints still apply (purity, integer currency, no mutation, typed errors, `applyAction` validates raw payloads).
- Battle math may use floats internally (damage roll); every stored value (HP, damage, gold, trophies) is an integer.
- Stats: `HP = floor((100 + 20·L) × statPct / 100)`, `ATK = floor((10 + 3·L) × statPct / 100)`, `SPD = baseSpeed + L`.
- Moves: one per species element, power 100%; pure (single-element) species also get neutral `Strike`, power 80%.
- Damage = `max(1, floor(ATK × powerPct / 100 × multiplier × roll))`, `roll = 0.9 + 0.2 × rng.next()`; `multiplier = elementMultiplier(moveElement, defenderSpecies.elements[0])`.
- Round order: all living dragons by SPD descending; ties → attacker side first, then slot order. Order is fixed at round start; a dragon KO'd mid-round skips its turn.
- Attacker wins when all three defenders are KO'd; defender wins when all attackers are KO'd or after round 30 completes.
- Trophies: attack win +30, attack loss −15, defence win +5, defence loss −10, floor 0. Leagues by trophies: Bronze 0–399, Silver 400–799, Gold 800–1199, Platinum 1200–1599, Diamond 1600–1999, Champion 2000+ (index 0–5). PvP win gold = `100 × leagueIndex` (eligible).
- XP: PvP win 20; PvE first clear 15. Unlocks: PvE at player level 5, PvP at level 8. Caps: 20 PvP attacks per UTC day, 10 PvE replays per UTC day. Day counters are monotonic (same rule as the sell counter).
- Season reset: `t > 1000 → 1000 + floor((t − 1000) / 2)`.
- Out of scope: Season Points, eligibility of opponents for SP, battle ids/seed derivation (§17), persisting the other player's state (server applies the `defenceResult` effect), client UI.

## Review Focus

1. A submitted move list with a KO'd or out-of-range target, or too few moves → `ILLEGAL_MOVE` / `MISSING_MOVES` with the failing index, state untouched; no partial rewards. (Task 2, Task 6)
2. Defender AI across random teams and seeds never targets a KO'd dragon or picks a move the species does not have. (Task 2)
3. The PvP attack cap and PvE replay cap count attempts, not wins, and survive a clock stepping back across 00:00 UTC. (Task 6)
4. Selling a dragon that is in the saved defence team clears the team rather than leaving a dangling id; `pvpBattle` with a team containing a sold/unknown dragon → `INVALID_TEAM`. (Task 6)
5. Trophies never go below 0 on a loss, and league gold is computed from trophies before the battle, so a win that crosses a league boundary pays the old league. (Task 3, Task 6)

---

### Task 1: Combat stats, move lists and damage

**Files:**
- Create: `packages/game-core/src/battle/stats.ts`
- Test: `packages/game-core/test/battle-stats.test.ts`

**Interfaces:**
- Consumes: `Species`, `getSpecies`, `Catalog`, `RARITY`, `elementMultiplier`, `Element`, `Rng`
- Produces:
  - `interface BattleDragonSpec { speciesId: string; level: number }`
  - `interface CombatStats { hp: number; atk: number; spd: number }`
  - `interface BattleMove { name: string; element: Element | 'neutral'; powerPct: number }`
  - `combatStats(spec: BattleDragonSpec, c: Catalog): CombatStats`
  - `movesFor(sp: Species): BattleMove[]` — one per element in species order, `name` = element, `powerPct: 100`; then `{ name: 'Strike', element: 'neutral', powerPct: 80 }` when `sp.elements.length === 1`
  - `damage(atk: number, move: BattleMove, defender: Species, rng: Rng): { amount: number; multiplier: 2 | 1 | 0.5 }` — one `rng.next()` call

- [x] **Step 1: Write failing tests** (fixture catalog from Phase 1; add species `nature` (pure common) and `fn-rare` (`['fire','nature']`, rare) to `test/fixtures.ts`)

```ts
expect(combatStats({ speciesId: 'fire', level: 10 }, C)).toEqual({ hp: 300, atk: 40, spd: 60 })
expect(combatStats({ speciesId: 'fw-legend', level: 30 }, C)).toEqual({ hp: 1400, atk: 200, spd: 80 })
expect(combatStats({ speciesId: 'fw-rare', level: 1 }, C)).toEqual({ hp: 144, atk: 15, spd: 51 })  // floor(120×1.2), floor(13×1.2)
expect(movesFor(getSpecies(C, 'fire'))).toEqual([{ name: 'fire', element: 'fire', powerPct: 100 }, { name: 'Strike', element: 'neutral', powerPct: 80 }])
expect(movesFor(getSpecies(C, 'fw-rare')).map(m => m.name)).toEqual(['fire', 'water'])
// damage: 1,000 rolls of atk 40 fire move vs nature → every amount in [72, 88], multiplier 2
// atk 40 Strike vs nature → amounts in [28, 35], multiplier 1; atk 1 Strike → amount 1 (floor)
// damage(…, createRng(5)) twice gives equal results
```

- [x] **Step 2: Run `pnpm --filter @wyrmhaven/game-core test`** — expect FAIL (module missing)
- [x] **Step 3: Implement `stats.ts`**
- [x] **Step 4: Run tests** — expect PASS
- [x] **Step 5: Commit** `feat(game-core): combat stats, move lists and damage roll`

### Task 2: Battle simulation and defender AI

**Files:**
- Create: `packages/game-core/src/battle/sim.ts`
- Test: `packages/game-core/test/battle-sim.test.ts`

**Interfaces:**
- Consumes: Task 1 exports, `elementMultiplier`, `getSpecies`, `Rng`
- Produces:
  - `MAX_ROUNDS = 30`; `TEAM_SIZE = 3`
  - `interface PlayerMove { move: number; target: number }` — index into the acting dragon's `movesFor`, defender slot 0–2
  - `interface Combatant { spec: BattleDragonSpec; stats: CombatStats; hp: number; moves: BattleMove[] }`
  - `type Side = 'attacker' | 'defender'`
  - `interface BattleEvent { round: number; side: Side; slot: number; move: number; target: number; damage: number; multiplier: number; ko: boolean }`
  - `type BattleOutcome = { ok: true; winner: Side; rounds: number; log: BattleEvent[]; attacker: number[]; defender: number[] } | { ok: false; error: 'ILLEGAL_MOVE' | 'MISSING_MOVES'; at: number }` — `attacker`/`defender` are final HP per slot; `at` is the index into `moves`
  - `turnOrder(attackers: readonly Combatant[], defenders: readonly Combatant[]): { side: Side; slot: number }[]` — living only, SPD desc, ties attacker first then slot
  - `aiMove(actor: Combatant, targets: readonly Combatant[]): PlayerMove` — highest `elementMultiplier(move.element, target primary)` over living targets; among those, lowest current HP; ties → lowest slot; move ties → lowest move index
  - `isLegalMove(actor: Combatant, targets: readonly Combatant[], m: PlayerMove): boolean`
  - `simulateBattle(attacker: readonly BattleDragonSpec[], defender: readonly BattleDragonSpec[], moves: readonly PlayerMove[], rng: Rng, c: Catalog): BattleOutcome` — one `damage` call (one `rng.next()`) per attack, no other RNG use; unused trailing moves are ignored

- [x] **Step 1: Write failing tests** (`spec = (id, level) => ({ speciesId: id, level })`; `three = (id, level) => [spec(id,level), spec(id,level), spec(id,level)]`; `AI_ALL = Array(400).fill({ move: 0, target: 0 })`)
  - `turnOrder`: attacker `[fire L10 (spd 60), water L5 (55)]`, defender `[ice L10 (60), nature L1 (51)]` → `[{attacker,0},{defender,0},{attacker,1},{defender,1}]`; a combatant with `hp: 0` is omitted
  - `aiMove`: actor `fw-rare` vs targets `[water L1 full hp, nature L1 full hp, nature L1 hp 1]` → `{ move: 0, target: 2 }` (fire is ×2 vs nature; lowest HP among them); vs `[water, water, water]` at full HP → `{ move: 1, target: 0 }` (water move ×1 beats fire ×0.5; ties → slot 0); vs `[water hp 0, water, water]` → `target: 1`
  - `isLegalMove`: target hp 0 → false; `target: 3` → false; `move: 2` on a 2-move dragon → false; `move: 1.5` → false
  - fire L10 ×3 vs nature L1 ×3 with a move list of `{ move: 0, target: 0 }` repeated: `ok`, `winner: 'attacker'`, `rounds === 1`, every attacker event has `multiplier: 2`, `damage` in [72, 88], `log` has exactly 3 attacker events then the surviving defenders' events in SPD order
  - same with `moves: [{ move: 0, target: 0 }]` only → `{ ok: false, error: 'MISSING_MOVES', at: 1 }`
  - a move targeting a slot already KO'd this round → `{ ok: false, error: 'ILLEGAL_MOVE', at: <index> }`
  - `simulateBattle(three('fire', 1), three('fw-legend', 30), AI_ALL, …)` → `winner: 'defender'`, `rounds < 30`
  - `simulateBattle(three('fire', 1), three('fire', 1), …)` — same stats both sides, attacker-first tie-break → attacker wins (verify with seed 1); the losing side's final HP are all 0
  - round cap: add `wall` to the fixture (pure `earth`, legendary, `recipeOnly`, `baseSpeed 1`) and run `three('fire', 1)` (atk 13, ×0.5 vs earth → 5–7 damage) vs `three('wall', 30)` (hp 1400, atk 200) with attacker moves `AI_ALL`: the fire team deals at most 3 × 7 × 30 = 630 per defender over 30 rounds and cannot win, while `wall` SPD 31 acts after fire SPD 56; assert `winner: 'defender'` and `rounds <= 30`. Across 50 random seeds with random teams, `rounds` never exceeds 30, and `winner === 'defender'` whenever `rounds === 30` and an attacker is still alive
  - determinism: two runs with `createRng(9)` give `toEqual` outcomes; `createRng(10)` differs in at least one `damage`
  - AI legality fuzz: 200 battles with random teams (3 random non-recipe species each, levels 1–30 via `createRng(seed)`), attacker moves from `aiMove` as well; assert every event targets a living slot and uses a valid move index (replay the log against HP bookkeeping in the test)
- [x] **Step 2: Run tests** — expect FAIL
- [x] **Step 3: Implement `sim.ts`** — build `Combatant[]` per side; loop rounds 1..30: compute `turnOrder`, for each living actor pick the move (attacker: `moves[cursor++]`, validate with `isLegalMove`; defender: `aiMove`), apply `damage`, log, check for a winner after every attack.
- [x] **Step 4: Run tests** — expect PASS
- [x] **Step 5: Commit** `feat(game-core): deterministic 3v3 battle simulation with defender ai`

### Task 3: Trophies, leagues and season reset

**Files:**
- Create: `packages/game-core/src/trophy.ts`
- Test: `packages/game-core/test/trophy.test.ts`

**Interfaces:**
- Produces: `TROPHY = { attackWin: 30, attackLoss: -15, defenceWin: 5, defenceLoss: -10 }`; `LEAGUES: readonly { name: string; min: number }[]` (Bronze 0, Silver 400, Gold 800, Platinum 1200, Diamond 1600, Champion 2000); `leagueIndex(trophies: number): number`; `pvpWinGold(trophies: number): number` = `100 × leagueIndex`; `applyTrophies(trophies: number, delta: number): number` = `max(0, trophies + delta)`; `seasonResetTrophies(t: number): number`

- [x] **Step 1: Write failing tests**

```ts
expect([0, 399, 400, 1199, 1200, 1999, 2000, 9999].map(leagueIndex)).toEqual([0, 0, 1, 2, 3, 4, 5, 5])
expect(pvpWinGold(850)).toBe(200)
expect(applyTrophies(10, TROPHY.attackLoss)).toBe(0)
expect(applyTrophies(10, TROPHY.attackWin)).toBe(40)
expect([0, 1000, 1001, 1500, 2001].map(seasonResetTrophies)).toEqual([0, 1000, 1000, 1250, 1500])
```

- [x] **Step 2: Run tests** — expect FAIL
- [x] **Step 3: Implement `trophy.ts`**
- [x] **Step 4: Run tests** — expect PASS
- [x] **Step 5: Commit** `feat(game-core): trophies, leagues and season reset math`

### Task 4: Matchmaking and bot teams

**Files:**
- Create: `packages/game-core/src/matchmaking.ts`
- Test: `packages/game-core/test/matchmaking.test.ts`

**Interfaces:**
- Consumes: `BattleDragonSpec`, `Catalog`, `Rng`, `RARITY`
- Produces:
  - `interface OpponentSnapshot { playerId: string | null; trophies: number; level: number; team: readonly BattleDragonSpec[] }` — `playerId: null` marks a bot
  - `interface Seeker { trophies: number; level: number; teamLevel: number }` — `teamLevel` = rounded mean level of the seeker's defence team (server computes; 1 if none)
  - `MATCH_TROPHY_RANGE = 100`; `MATCH_LEVEL_RANGE = 5`; `MATCH_OFFERS = 3`; `BOT_RARITIES: readonly Rarity[] = ['common', 'rare']`
  - `generateBotTeam(level: number, c: Catalog, rng: Rng): BattleDragonSpec[]` — 3 picks (with replacement) via `rng.int` from non-recipe species whose rarity is in `BOT_RARITIES`, sorted by id for a stable catalog order before picking; all at `clamp(level, 1, 30)`
  - `generateBot(seeker: Seeker, c: Catalog, rng: Rng): OpponentSnapshot` — `trophies = max(0, seeker.trophies + rng.int(201) − 100)`, `level = seeker.level`, team from `generateBotTeam(seeker.teamLevel, …)`
  - `pickOpponents(seeker: Seeker, candidates: readonly OpponentSnapshot[], c: Catalog, rng: Rng): OpponentSnapshot[]` — filter `|trophies − seeker.trophies| ≤ 100` and `|level − seeker.level| ≤ 5`; choose up to 3 without replacement via `rng.int`; fill to 3 with `generateBot`

- [x] **Step 1: Write failing tests**
  - `generateBotTeam(40, C, createRng(1))` → 3 specs, every level 40 → clamped to 30, every species non-recipe with rarity common or rare
  - `generateBot({ trophies: 50, level: 8, teamLevel: 6 }, C, createRng(2))` → `playerId: null`, `trophies` in [0, 150], `level: 8`, team levels all 6
  - `pickOpponents` with 5 eligible and 2 ineligible candidates (trophies +101, level −6) → 3 results, all from the eligible 5, all distinct `playerId`s
  - with 1 eligible candidate → that candidate plus 2 bots (`playerId: null`)
  - with none → 3 bots; same seed → identical results; `candidates` not mutated
- [x] **Step 2: Run tests** — expect FAIL
- [x] **Step 3: Implement `matchmaking.ts`**
- [x] **Step 4: Run tests** — expect PASS
- [x] **Step 5: Commit** `feat(game-core): matchmaking window and bot team generation`

### Task 5: PvE campaign stages and rewards

**Files:**
- Create: `packages/game-core/src/pve.ts`
- Test: `packages/game-core/test/pve.test.ts`

**Interfaces:**
- Consumes: `BattleDragonSpec`, `Catalog`, `createRng`, `RARITY`, `Rarity`
- Produces:
  - `PVE_STAGES = 30`; `PVE_REPLAYS_PER_DAY = 10`; `PVE_MIN_PLAYER_LEVEL = 5`; `PVP_MIN_PLAYER_LEVEL = 8`; `PVP_ATTACKS_PER_DAY = 20`
  - `stageLevel(stage: number): number` = `min(30, stage + 2)`
  - `stageRarity(stage: number): Rarity` — `common` for 1–10, `rare` 11–20, `epic` 21–30
  - `stageTeam(stage: number, c: Catalog): BattleDragonSpec[]` — deterministic: `createRng(1_000 + stage)`; 3 picks from non-recipe species of `stageRarity(stage)`, falling back to the highest rarity below it that has species (so the pure-only launch catalog yields commons everywhere); all at `stageLevel(stage)`
  - `interface StageRewards { gold: number; food: number; xp: number }`
  - `stageRewards(stage: number, firstClear: boolean): StageRewards` — first clear `{ gold: 100·stage, food: 20·stage, xp: 15 }`; replay `{ gold: 25·stage, food: 0, xp: 0 }`

- [x] **Step 1: Write failing tests**

```ts
expect([1, 27, 28, 30].map(stageLevel)).toEqual([3, 29, 30, 30])
expect([1, 10, 11, 20, 21, 30].map(stageRarity)).toEqual(['common','common','rare','rare','epic','epic'])
expect(stageTeam(7, C)).toEqual(stageTeam(7, C))                       // fixed
expect(stageTeam(7, C).every(d => d.level === 9)).toBe(true)
expect(stageTeam(25, C).every(d => getSpecies(C, d.speciesId).rarity === 'epic')).toBe(true)   // fixture has fw-epic
expect(stageTeam(25, LAUNCH_CATALOG).every(d => getSpecies(LAUNCH_CATALOG, d.speciesId).rarity === 'common')).toBe(true) // fallback
expect(stageRewards(4, true)).toEqual({ gold: 400, food: 80, xp: 15 })
expect(stageRewards(4, false)).toEqual({ gold: 100, food: 0, xp: 0 })
```

- [x] **Step 2: Run tests** — expect FAIL
- [x] **Step 3: Implement `pve.ts`**
- [x] **Step 4: Run tests** — expect PASS
- [x] **Step 5: Commit** `feat(game-core): pve campaign stages and rewards`

### Task 6: Battle state, actions, validation and public API

**Files:**
- Create: `packages/game-core/src/actions/battle-actions.ts`
- Modify: `packages/game-core/src/state.ts` (new fields), `src/time.ts` (`dayCounter`), `src/actions/types.ts` (actions, errors, effect, result), `src/actions/validate.ts`, `src/actions/apply.ts`, `src/actions/island-actions.ts` (`sellDragon` clears the defence team), `src/index.ts`
- Modify tests: `test/state.test.ts` (new fields in the `newPlayer` expectation)
- Test: `packages/game-core/test/battle-actions.test.ts`, `test/battle-replay.test.ts`

**Interfaces:**
- Consumes: Tasks 1–5 exports, `earnGold`, `addXp`, `utcDay`
- Produces (`time.ts`): `interface DayCounter { day: number; count: number }`; `dayCounterAt(c: DayCounter, nowMs: number): DayCounter` — `{ day: utcDay(now), count: 0 }` when `utcDay(now) > c.day`, else `c` (monotonic)
- Produces (`state.ts`): `PlayerState` gains `defenceTeam: [string, string, string] | null`, `trophies: number`, `pvp: DayCounter` (attacks today), `pve: { cleared: number; replays: DayCounter }`; `newPlayer` → `defenceTeam: null, trophies: 0, pvp: { day: utcDay(now), count: 0 }, pve: { cleared: 0, replays: { day: utcDay(now), count: 0 } }`
- Produces (`types.ts`):
  - `Action` gains `{ type: 'setDefenceTeam'; dragonIds: [string, string, string] }`, `{ type: 'pvpBattle'; team: [string, string, string]; opponent: OpponentSnapshot; moves: PlayerMove[] }`, `{ type: 'pveBattle'; stage: number; team: [string, string, string]; moves: PlayerMove[] }`
  - `ActionError` gains `'INVALID_TEAM' | 'ILLEGAL_MOVE' | 'MISSING_MOVES' | 'DAILY_CAP_REACHED' | 'STAGE_LOCKED'`
  - `Effect` gains `{ type: 'defenceResult'; playerId: string; trophyDelta: number }` (only for non-bot opponents)
  - `ActionResult` ok variant gains `battle?: BattleOutcome & { ok: true }`
- Rules this task pins:
  - Team check (shared): exactly 3 distinct ids, each an owned dragon → else `INVALID_TEAM`.
  - `setDefenceTeam`: stores the ids. `sellDragon` sets `defenceTeam: null` when it contained the sold id.
  - `pvpBattle`: `LEVEL_TOO_LOW` below player level 8; `INVALID_TEAM`; `DAILY_CAP_REACHED` when `dayCounterAt(pvp, now).count >= 20`; `opponent.team` must have 3 entries else `INVALID_ACTION` (validation step). Simulate with `ctx.rng`; a sim error returns `{ ok: false, error }` and leaves state untouched (the attempt does not count). On success: `pvp.count + 1`; league gold from `pvpWinGold(trophies before)` as eligible gold and `addXp(20)` on a win; `trophies = applyTrophies(trophies, ±)`; effect `defenceResult` with `playerId` and `TROPHY.defenceWin` / `defenceLoss` when `opponent.playerId !== null`; result carries `battle`.
  - `pveBattle`: `LEVEL_TOO_LOW` below 5; `NOT_FOUND` when stage ∉ 1..30; `STAGE_LOCKED` when `stage > cleared + 1`; `INVALID_TEAM`; replay (`stage <= cleared`) → `DAILY_CAP_REACHED` when `replays.count >= 10`. Defender team = `stageTeam(stage)`. On a win: `stageRewards(stage, firstClear)` → `earnGold(eligible)`, `food +`, `addXp`; first clear sets `cleared = stage`; a replay increments `pve.replays.count` whether it was won or lost. A lost first-clear attempt changes nothing but still returns `battle`.
  - `validate.ts`: `dragonIds`/`team` are arrays of 3 strings; `moves` is an array of `{ move, target }` of non-negative integers; `opponent` has `playerId: string | null`, integer `trophies`/`level`, and `team` of 3 `{ speciesId: string, level: integer }`; `stage` is an integer.

- [x] **Step 1: Write failing tests** (`s8` = `newPlayer(0)` with `level: 8`, three fire dragons `d1 d2 d3` at level 10 in `h1`; `bot = { playerId: null, trophies: 0, level: 8, team: three('nature', 1) }`; `human = { ...bot, playerId: 'p2' }`; `AI = Array(400).fill({ move: 0, target: 0 })`; run with `createRng(1)` and `FIXTURE_CATALOG`)
  - `newPlayer(0)` expectation in `state.test.ts` gains the new fields; `dayCounterAt({ day: 2, count: 5 }, 1 * MS_PER_DAY)` → unchanged; at `3 * MS_PER_DAY` → `{ day: 3, count: 0 }`
  - `setDefenceTeam ['d1','d2','d3']` → stored; `['d1','d1','d2']` → `INVALID_TEAM`; `['d1','d2','dX']` → `INVALID_TEAM`; after `sellDragon d3` the team is `null`
  - `pvpBattle` on `newPlayer(0)` → `LEVEL_TOO_LOW`; `s8` vs `bot` with `AI` → ok, `winner: 'attacker'`, `trophies: 30`, `gold: 1000` (Bronze pays 0), `eligibleGold: 0`, `xp: 20`, `pvp.count: 1`, `effects: []`
  - same vs `human` → effects `[{ type: 'defenceResult', playerId: 'p2', trophyDelta: -10 }]`
  - `s8` with `trophies: 850` wins → `gold: 1200`, `eligibleGold: 200`, `trophies: 880`
  - `s8` with `trophies: 10` and team of level-1 fire vs `fw-legend` L30 bot → loss, `trophies: 0`, `xp: 0`, `effects: [{ …, trophyDelta: 5 }]` for a human opponent, `pvp.count: 1`
  - `moves: [{ move: 0, target: 0 }]` → `MISSING_MOVES`, and `pvp.count` stays 0
  - `pvp: { day: 0, count: 20 }` → `DAILY_CAP_REACHED`; at `nowMs = MS_PER_DAY` → ok with `pvp: { day: 1, count: 1 }`; with `pvp: { day: 5, count: 20 }` at `nowMs = 4 * MS_PER_DAY` → still `DAILY_CAP_REACHED`
  - `pveBattle` on `newPlayer(0)` → `LEVEL_TOO_LOW`; stage 0 / 31 → `NOT_FOUND`; stage 2 with `cleared: 0` → `STAGE_LOCKED`
  - `s8` stage 1 win → `gold: 1100`, `eligibleGold: 100`, `food: 120`, `xp: 15`, `pve.cleared: 1`, `pve.replays.count: 0`
  - replay stage 1 → `gold +25`, `food` unchanged, `xp` unchanged, `pve.replays.count: 1`; with `replays: { day: 0, count: 10 }` → `DAILY_CAP_REACHED`
  - stage 1 lost (level-1 team vs level-3 stage team with `fw-legend` fixtures excluded — use team `three('fire', 1)` vs stage 30) → state unchanged except nothing, `battle.winner: 'defender'`, `cleared: 0`
  - malformed: `moves: [{ move: '0', target: 0 }]`, `team: ['d1','d2']`, `opponent.team` of 2, `stage: 1.5` → `INVALID_ACTION`
  - `battle-replay.test.ts`: `s8` runs `pvpBattle` vs `human` then `pveBattle` stage 1 twice with a fresh `createRng(77)` per run; the final states, effects and battle logs are `toEqual`
- [x] **Step 2: Run tests** — expect FAIL
- [x] **Step 3: Implement** `dayCounterAt`, state fields, `battle-actions.ts`, validation, dispatch, `sellDragon` change, `index.ts` exports (`src/battle/*`, `trophy`, `matchmaking`, `pve`, new types)
- [x] **Step 4: Run the full suite and `pnpm -r typecheck`** — expect all PASS (Phase 1 tests unchanged except `state.test.ts`)
- [x] **Step 5: Commit** `feat(game-core): defence team, pvp and pve battle actions`

---

**Next plans:** Phase 3 (contracts on testnet 46630) is independent of this phase. Phase 4 (server) consumes `pickOpponents`, `OpponentSnapshot`, the `defenceResult` effect and the battle seed rule (§17).
