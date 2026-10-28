# Phase 1: game-core Economy Rules Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A pure, deterministic TypeScript package implementing every Wyrmhaven economy rule (elements, breeding odds, nests/hatchery, habitats, farms, leveling, player XP, gold eligibility, Hoard sell limits, store pricing and effects) behind one `applyAction` entry point.

**Architecture:** pnpm monorepo with `packages/game-core` (zero runtime deps). Pure rule modules (one responsibility each) feed thin action handlers grouped by area; `applyAction(state, action, nowMs, rng, catalog)` returns a new state plus side-effect requests (`charge` / `payout`) for the server to settle in tokens. Time and RNG are always injected.

**Tech Stack:** Node ≥ 20 (local: 24), pnpm ≥ 9 (local: 12), TypeScript 5 strict, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-28-wyrmhaven-design.md` (§3–9, §14, §15). Read it alongside this plan.

## Global Constraints

- game-core imports nothing outside `src/`; no `Date.now()`, `Math.random()`, `fetch`, `fs`.
- Gold, food, XP, timestamps (ms) and money are integers. Money is **micro-USD** (`$1 = 1_000_000`). Probabilities for display may be floats.
- No function mutates its arguments; every action returns a new `PlayerState`. A failed action returns `{ ok: false, error }` and no state.
- Elements: `fire, water, earth, nature, electric, ice, metal, dark, light`.
- Rarity (breed ms / hatch ms / base gold per min / stat % / score / sell gold / XP): common 120_000/120_000/2/100/0/100/10; rare 1_800_000/1_800_000/5/120/1/500/30; epic 14_400_000/14_400_000/12/150/2/2_500/100; legendary 43_200_000/43_200_000/30/200/3/10_000/300.
- Tutorial: the first breed and the first hatch each take 15_000 ms.
- Max dragon level 30; breeding needs level ≥ 4; legendary recipes need both parents ≥ 15 and roll 3%.
- Entity ids: `h<n>` habitats, `d<n>` dragons, from one shared `nextId` counter.
- Out of scope (later phases): battles and battle gold, Season Points, season pass, cosmetics, ledger-updating system actions, token conversion.

## Review Focus

1. Device clock moves backwards (`nowMs` earlier than a stored timestamp) → collecting yields 0 and never moves `lastCollectedMs` back; timers stay not-ready. (Task 7)
2. Selling dragons until fewer than 2 remain → `LAST_DRAGONS`, so a player can never lose the ability to breed. (Task 7)
3. Hatchery holding eggs plus hatched dragons with no habitat → `collectEgg` returns `HATCHERY_FULL` and the egg stays in its nest. (Task 8)
4. Sell-back with zero lifetime deposits, and the counter at the UTC day boundary → no division by zero; limit resets at 00:00 UTC. (Task 6, Task 9)
5. Gold from selling dragons spent then "re-earned" → spending consumes ineligible gold first, so sale gold can never be sold back for tokens. (Task 4)

---

### Task 1: Monorepo scaffold, elements and seeded RNG

**Files:**
- Create: `package.json` (private; scripts `test: pnpm -r test`, `typecheck: pnpm -r typecheck`), `pnpm-workspace.yaml` (`packages/*`, `apps/*`), `.gitignore` (`node_modules`, `dist`, `.env*`), `tsconfig.base.json` (strict, `noUncheckedIndexedAccess`, ES2022, moduleResolution bundler)
- Create: `packages/game-core/package.json` (name `@wyrmhaven/game-core`, `type: module`, scripts `test: vitest run`, `typecheck: tsc --noEmit`), `packages/game-core/tsconfig.json`
- Create: `packages/game-core/src/elements.ts`, `packages/game-core/src/rng.ts`
- Test: `packages/game-core/test/elements.test.ts`, `packages/game-core/test/rng.test.ts`

**Interfaces:**
- Produces: `type Element = 'fire'|'water'|'earth'|'nature'|'electric'|'ice'|'metal'|'dark'|'light'`; `ELEMENTS: readonly Element[]` (that order); `STRENGTHS: Record<Element, readonly Element[]>` (spec §3 table); `elementMultiplier(move: Element | 'neutral', defender: Element): 2 | 1 | 0.5`; `pairKey(a: Element, b: Element): string` (alphabetical, joined by `+`: `'fire+water'`, `'ice+ice'`)
- Produces: `interface Rng { next(): number; int(maxExclusive: number): number }`; `createRng(seed: number): Rng` (mulberry32, seed `>>> 0`; `int(n) = Math.floor(next() * n)`)

- [x] **Step 1: `git init`; create the root and package files; `pnpm add -Dw typescript vitest`**
- [x] **Step 2: Write failing tests**

```ts
// elements.test.ts
expect(ELEMENTS).toHaveLength(9)
expect(elementMultiplier('fire', 'nature')).toBe(2)
expect(elementMultiplier('nature', 'fire')).toBe(0.5)
expect(elementMultiplier('fire', 'water')).toBe(0.5)
expect(elementMultiplier('fire', 'earth')).toBe(0.5)
expect(elementMultiplier('fire', 'electric')).toBe(1)
expect(elementMultiplier('dark', 'light')).toBe(2)
expect(elementMultiplier('light', 'dark')).toBe(2)
expect(elementMultiplier('dark', 'fire')).toBe(1)
expect(elementMultiplier('neutral', 'water')).toBe(1)
expect(pairKey('water', 'fire')).toBe('fire+water')
expect(pairKey('ice', 'ice')).toBe('ice+ice')
const base = ELEMENTS.slice(0, 7)
for (const e of base) {
  expect(STRENGTHS[e]).toHaveLength(2)
  expect(base.filter(a => STRENGTHS[a].includes(e))).toHaveLength(2) // weak to exactly 2
  for (const t of STRENGTHS[e]) expect(STRENGTHS[t]).not.toContain(e) // no mutual pairs
}
// rng.test.ts
const a = createRng(42), b = createRng(42)
expect([1,2,3,4,5].map(() => a.next())).toEqual([1,2,3,4,5].map(() => b.next()))
expect(createRng(1).next()).not.toBe(createRng(2).next())
const r = createRng(7), counts = [0,0,0,0]
for (let i = 0; i < 10_000; i++) counts[r.int(4)]!++
expect(counts.every(c => c >= 2_000)).toBe(true)
```

- [x] **Step 3: Run `pnpm --filter @wyrmhaven/game-core test`** — expect FAIL (modules missing)
- [x] **Step 4: Implement `elements.ts` and `rng.ts`** — multiplier checks "move strong vs defender" before the reverse check, so dark/light give 2.
- [x] **Step 5: Run tests and `pnpm -r typecheck`** — expect PASS, no type errors
- [x] **Step 6: Commit** `chore: scaffold monorepo; feat(game-core): elements and seeded rng`

### Task 2: Rarity, catalog and dragon math

**Files:**
- Create: `packages/game-core/src/rarity.ts`, `src/catalog.ts`, `src/data/launch-catalog.ts`, `src/dragon.ts`
- Create: `packages/game-core/test/fixtures.ts`
- Test: `packages/game-core/test/catalog.test.ts`, `test/dragon.test.ts`

**Interfaces:**
- Consumes: `Element`, `ELEMENTS`, `pairKey`
- Produces (`rarity.ts`): `type Rarity = 'common'|'rare'|'epic'|'legendary'`; `RARITY: Record<Rarity, { breedMs; hatchMs; baseGold; statPct; score; sellGold; xp: number }>` (Global Constraints values)
- Produces (`catalog.ts`): `interface Species { id: string; name: string; elements: readonly Element[]; rarity: Rarity; baseSpeed: number; recipeOnly: boolean }`; `interface Recipe { parents: readonly [string, string]; legendaryId: string }`; `interface Catalog { species: ReadonlyMap<string, Species>; recipes: readonly Recipe[] }`; `makeCatalog(species: Species[], recipes?: Recipe[]): Catalog`; `getSpecies(c: Catalog, id: string): Species` (throws `Error('UNKNOWN_SPECIES')`); `validateCatalog(c: Catalog): string[]` (error codes below; `[]` = valid)
- Produces (`data/launch-catalog.ts`): `LAUNCH_CATALOG: Catalog` — the 9 pure commons, id = element name (`'fire'`, `'water'`, …), placeholder names, `baseSpeed` 40–60, no recipes. Hybrids, epics and legendaries are content work added later.
- Produces (`dragon.ts`): `MAX_DRAGON_LEVEL = 30`; `effLevel(level: number): number`; `goldPerMinute(speciesRarity: Rarity, level: number): number`; `foodToNextLevel(level: number): number` (defined for 1–29)
- Produces (`test/fixtures.ts`): `FIXTURE_CATALOG` = species `fire`, `water`, `ice` (pure commons), `fw-common`, `fw-rare`, `fw-epic` (elements `['fire','water']`), `fw-legend` (`['fire','water']`, legendary, `recipeOnly`); recipe `{ parents: ['fw-rare','fw-epic'], legendaryId: 'fw-legend' }`

- [x] **Step 1: Write failing tests**

```ts
expect(RARITY.rare.breedMs).toBe(1_800_000)
expect(() => getSpecies(LAUNCH_CATALOG, 'nope')).toThrow('UNKNOWN_SPECIES')
expect(validateCatalog(LAUNCH_CATALOG)).toEqual([])
const base = [...LAUNCH_CATALOG.species.values()]
const sp = (id: string, elements: Element[], rarity: Rarity, recipeOnly = false): Species =>
  ({ id, name: id, elements, rarity, baseSpeed: 50, recipeOnly })
expect(validateCatalog(makeCatalog([...base, sp('a', ['fire','water'], 'common'), sp('b', ['water','fire'], 'common')])))
  .toContain('DUPLICATE_TIER:fire+water:common')
expect(validateCatalog(makeCatalog([...base, sp('L', ['fire','ice'], 'legendary')]))).toContain('LEGENDARY_NOT_RECIPE:L')
expect(validateCatalog(makeCatalog(base.filter(s => s.id !== 'ice')))).toContain('MISSING_PURE:ice')
expect(validateCatalog(makeCatalog(base, [{ parents: ['x', 'fire'], legendaryId: 'y' }]))).toContain('UNKNOWN_RECIPE_SPECIES:x')
// dragon.test.ts
expect([1, 10, 11, 12, 30].map(effLevel)).toEqual([1, 10, 10, 11, 20])
expect(goldPerMinute('common', 1)).toBe(2)
expect(goldPerMinute('rare', 12)).toBe(55)
expect(goldPerMinute('legendary', 30)).toBe(600)
expect([1, 9, 10, 19, 20, 29].map(foodToNextLevel)).toEqual([4, 324, 800, 2888, 6400, 13456])
```

- [x] **Step 2: Run tests** — expect FAIL
- [x] **Step 3: Implement the four source files and `fixtures.ts`** — `DUPLICATE_TIER` keys use `pairKey` (pure species: `'fire+fire'`).
- [x] **Step 4: Run tests** — expect PASS
- [x] **Step 5: Commit** `feat(game-core): rarity, catalog validation, dragon math`

### Task 3: Breeding odds and roll

**Files:**
- Create: `packages/game-core/src/breeding.ts`
- Test: `packages/game-core/test/breeding.test.ts`

**Interfaces:**
- Consumes: `Catalog`, `Species`, `getSpecies`, `RARITY`, `Rng`, `Element`, `pairKey`
- Produces:
  - `interface Parent { speciesId: string; level: number }`
  - `interface BreedContext { boost: boolean; pity: Readonly<Record<string, number>> }`
  - `interface BreedRoll { speciesId: string; pairKey: string; rarePlus: boolean }`
  - `tierWeights(scoreSum: number, boost: boolean): Record<Rarity, number>` → common 70, rare 25 + 5S (+10 boost), epic 5 + 2S (+5 boost), legendary 1
  - `poolFor(eA: Element, eB: Element, a: Parent, b: Parent, c: Catalog): Species[]` — non-recipe species whose element **set** equals `{eA, eB}`; if empty, the distinct parent species
  - `breedingOdds(a: Parent, b: Parent, ctx: BreedContext, c: Catalog): Record<string, number>` — exact probabilities (non-zero entries only), averaging over the equally likely element picks, applying recipe, weights and pity exactly as `rollOffspring`
  - `rollOffspring(a: Parent, b: Parent, ctx: BreedContext, c: Catalog, rng: Rng): BreedRoll`
- RNG call order (fixed for replay): `int(|A.elements|)`, `int(|B.elements|)`, then if a recipe matches and both levels ≥ 15 `next() < 0.03` → legendary (stop), then `int(totalWeightOfPresentTiers)` for the tier, then `int(tierSize)` for the species. Pity (`ctx.pity[pairKey] >= 10`) drops the common tier when the pool has any rare+ tier.

- [ ] **Step 1: Write failing tests** (use `FIXTURE_CATALOG`; `p = (id, level = 4) => ({ speciesId: id, level })`; `none = { boost: false, pity: {} }`; compare with `toBeCloseTo(x, 6)`)
  - `breedingOdds(p('fire'), p('water'), none)` → `{ 'fw-common': 0.70, 'fw-rare': 0.25, 'fw-epic': 0.05 }`
  - boost → `fw-rare` 35/115, `fw-epic` 10/115
  - `pity: { 'fire+water': 10 }` → `{ 'fw-rare': 25/30, 'fw-epic': 5/30 }`
  - `p('fire') × p('ice')` → `{ fire: 0.5, ice: 0.5 }` (fallback pool); `p('fire') × p('fire')` → `{ fire: 1 }`
  - `p('fw-rare', 15) × p('fw-epic', 15)` → `fw-legend` 0.03, `fire` 0.2425, `water` 0.2425, `fw-epic` 0.97 × 0.5 × 11/121
  - same parents at level 14 → no `fw-legend` key
  - every odds table above sums to 1 (±1e-9)
  - 20,000 `rollOffspring(p('fire'), p('water'), none, …, createRng(1))` rolls: `fw-epic` share in [0.04, 0.06]
  - two rolls with `createRng(9)` return equal `BreedRoll`s
  - 1,000 rolls with pity 10 never return `fw-common`; every roll has `pairKey === 'fire+water'` and `rarePlus === true`
- [ ] **Step 2: Run tests** — expect FAIL
- [ ] **Step 3: Implement `breeding.ts`** — integer weights for the roll; `breedingOdds` computes the same branches analytically.
- [ ] **Step 4: Run tests** — expect PASS
- [ ] **Step 5: Commit** `feat(game-core): breeding odds and roll with recipes and pity`

### Task 4: Player state, gold eligibility and player XP

**Files:**
- Create: `packages/game-core/src/state.ts`, `src/wallet.ts`, `src/progression.ts`
- Test: `packages/game-core/test/state.test.ts`, `test/wallet.test.ts`, `test/progression.test.ts`

**Interfaces:**
- Consumes: `Element`
- Produces (`state.ts`):

```ts
type CropId = 'sprout' | 'bushel' | 'harvest' | 'bounty'
interface Egg { speciesId: string; readyAtMs: number }
interface Dragon { id: string; speciesId: string; level: number; habitatId: string | null } // null = waiting in hatchery
interface Habitat { id: string; element: Element; level: number; lastCollectedMs: number }
interface FarmPlot { crop: CropId | null; readyAtMs: number }
interface PlayerState {
  gold: number; eligibleGold: number; food: number; xp: number; level: number
  dragons: Dragon[]; habitats: Habitat[]; nests: (Egg | null)[]; hatchery: Egg[]; farms: FarmPlot[]
  pity: Record<string, number>; oddsBoosts: number; hoardLevel: number; earningUnlocked: boolean
  sell: { day: number; soldTodayMicroUsd: number }
  ledger: { depositedMicroUsd: number; withdrawnMicroUsd: number; soldMicroUsd: number }
  tutorial: { breedDone: boolean; hatchDone: boolean }
  nextId: number
}
newPlayer(nowMs: number): PlayerState
HATCHERY_SLOTS = 3
```

- Produces (`wallet.ts`): `earnGold(s: PlayerState, amount: number, eligible: boolean): PlayerState`; `spendGold(s: PlayerState, amount: number): PlayerState | null` — `null` if `amount > gold`; consumes `gold − eligibleGold` first, then eligible gold
- Produces (`progression.ts`): `MAX_PLAYER_LEVEL = 50`; `xpToNext(level: number): number` = 50·L²; `addXp(s: PlayerState, xp: number): PlayerState` — levels up while `xp ≥ xpToNext(level)` (subtracting), stops at 50 and keeps accumulating XP there

- [ ] **Step 1: Write failing tests**

```ts
expect(newPlayer(0)).toEqual({
  gold: 1000, eligibleGold: 0, food: 100, xp: 0, level: 1,
  dragons: [{ id: 'd1', speciesId: 'fire', level: 1, habitatId: 'h1' }, { id: 'd2', speciesId: 'water', level: 1, habitatId: 'h2' }],
  habitats: [{ id: 'h1', element: 'fire', level: 1, lastCollectedMs: 0 }, { id: 'h2', element: 'water', level: 1, lastCollectedMs: 0 }],
  nests: [null], hatchery: [], farms: [{ crop: null, readyAtMs: 0 }, { crop: null, readyAtMs: 0 }],
  pity: {}, oddsBoosts: 0, hoardLevel: 0, earningUnlocked: false,
  sell: { day: 0, soldTodayMicroUsd: 0 }, ledger: { depositedMicroUsd: 0, withdrawnMicroUsd: 0, soldMicroUsd: 0 },
  tutorial: { breedDone: false, hatchDone: false }, nextId: 3,
})
expect(newPlayer(86_400_000 * 3 + 5).sell.day).toBe(3)
const s = newPlayer(0)                                  // gold 1000, eligible 0
const e = earnGold(s, 500, true)
expect([e.gold, e.eligibleGold]).toEqual([1500, 500])
expect(earnGold(s, 100, false).eligibleGold).toBe(0)
const sp = spendGold(e, 1200)!                          // 1000 ineligible used first
expect([sp.gold, sp.eligibleGold]).toEqual([300, 300])
expect(spendGold(s, 1001)).toBeNull()
expect(xpToNext(1)).toBe(50)
expect(addXp(s, 60)).toMatchObject({ level: 2, xp: 10 })
expect(addXp(s, 250)).toMatchObject({ level: 3, xp: 0 })
expect(addXp({ ...s, level: 50, xp: 0 }, 999_999)).toMatchObject({ level: 50, xp: 999_999 })
expect(s).toEqual(newPlayer(0))                         // inputs not mutated
```

- [ ] **Step 2: Run tests** — expect FAIL
- [ ] **Step 3: Implement the three files**
- [ ] **Step 4: Run tests** — expect PASS
- [ ] **Step 5: Commit** `feat(game-core): player state, gold eligibility, player xp`

### Task 5: Habitat and farm rules

**Files:**
- Create: `packages/game-core/src/habitat.ts`, `src/farm.ts`
- Test: `packages/game-core/test/habitat.test.ts`, `test/farm.test.ts`

**Interfaces:**
- Consumes: `Habitat`, `Dragon`, `PlayerState`, `CropId`, `Species`, `Catalog`, `goldPerMinute`
- Produces (`habitat.ts`): `HABITAT_LEVELS: readonly { cap: number; slots: number; upgradeCost: number | null }[]` (index = level − 1; spec §7 table); `canLiveIn(sp: Species, h: Habitat): boolean`; `residents(s: PlayerState, habitatId: string): Dragon[]`; `storedGold(h: Habitat, residents: readonly Dragon[], c: Catalog, nowMs: number): number` — `min(cap, floor(max(0, now − last) / 60_000) × Σ goldPerMinute)`; `habitatBuildCost(s: PlayerState, e: Element): number` = 500 × 2^(owned of e); `maxHabitats(playerLevel: number): number` = 2 + floor(L / 5)
- Produces (`farm.ts`): `CROPS: Record<CropId, { growMs: number; cost: number; food: number }>` (sprout 60_000/20/10, bushel 1_800_000/200/150, harvest 14_400_000/1_000/900, bounty 43_200_000/2_500/3_000); `MAX_PLOTS = 6`; `plotCost(currentPlots: number): number` = 500 × 2^(currentPlots − 2)

- [ ] **Step 1: Write failing tests** (fixture catalog; `s = newPlayer(0)`, `h1 = s.habitats[0]`)
  - `storedGold(h1, residents(s,'h1'), FIXTURE_CATALOG, 600_000) === 20`; at `300 × 60_000` → 500 (cap); at `90_000` → 2; with `lastCollectedMs: 600_000` and now `300_000` → 0
  - `canLiveIn(fw-common, water habitat)` true; `canLiveIn(fire, water habitat)` false
  - `habitatBuildCost(s, 'earth') === 500`; `habitatBuildCost(s, 'fire') === 1000`
  - `[1, 4, 5, 50].map(maxHabitats)` → `[2, 2, 3, 12]`
  - `HABITAT_LEVELS[4]` → `{ cap: 120_000, slots: 7, upgradeCost: null }`
  - `[2, 3, 5].map(plotCost)` → `[500, 1000, 4000]`
- [ ] **Step 2: Run tests** — expect FAIL
- [ ] **Step 3: Implement `habitat.ts` and `farm.ts`**
- [ ] **Step 4: Run tests** — expect PASS
- [ ] **Step 5: Commit** `feat(game-core): habitat income and farm rules`

### Task 6: Sell-back limits and store pricing

**Files:**
- Create: `packages/game-core/src/sell.ts`, `src/store.ts`
- Test: `packages/game-core/test/sell.test.ts`, `test/store.test.ts`

**Interfaces:**
- Consumes: `PlayerState`, `foodToNextLevel`, `MAX_DRAGON_LEVEL`
- Produces (`sell.ts`): `MICRO_USD_PER_GOLD = 5` (10,000 gold = $0.05); `HOARD: readonly { costMicroUsd: number; limitMicroUsd: number }[]` (index = level − 1: 2M/1M, 4M/2M, 8M/4M, 15M/7M, 25M/12M, 40M/20M, 60M/30M); `HOARD_MIN_PLAYER_LEVEL = 5`; `utcDay(nowMs: number): number`; `dailySellLimitMicroUsd(hoardLevel: number, ledger: PlayerState['ledger']): number`; `remainingSellMicroUsd(s: PlayerState, nowMs: number): number` (0 counter when `s.sell.day !== utcDay(now)`)
  - Limit: 0 if `hoardLevel === 0`; else `base = max(HOARD[l−1].limit, min(floor(dep / 3), max(0, dep − sold)))`; then withdrawn `w` vs deposited `dep` (integer comparisons): `w > 3·dep` → 0, `w > 2·dep` → floor(base / 5), `w > dep` → floor(base / 2). With `dep = 0`, any `w > 0` gives 0.
- Produces (`store.ts`): `type StoreItem = { kind: 'skip'; target: 'nest' | 'hatchery' | 'farm'; index: number } | { kind: 'nest' } | { kind: 'foodPack' } | { kind: 'levelUp'; dragonId: string } | { kind: 'oddsBoost' } | { kind: 'hoard' }`; `MAX_NESTS = 4`; `FOOD_PACK = 1_000`; `priceMicroUsd(item: StoreItem, s: PlayerState, nowMs: number): number | null` — `null` when not purchasable now (missing target, nothing to skip, already max)
  - skip 100_000 × ceil(remainingMs / 1_800_000); nest 2M / 4M / 8M by current nest count 1 / 2 / 3; foodPack 500_000; levelUp max(50_000, 500 × foodToNextLevel(level)); oddsBoost 500_000; hoard `HOARD[hoardLevel].costMicroUsd`

- [ ] **Step 1: Write failing tests**

```ts
const L = (dep: number, w: number, sold = 0) => ({ depositedMicroUsd: dep, withdrawnMicroUsd: w, soldMicroUsd: sold })
expect(dailySellLimitMicroUsd(0, L(10_000_000, 0))).toBe(0)
expect(dailySellLimitMicroUsd(1, L(0, 0))).toBe(1_000_000)
expect(dailySellLimitMicroUsd(1, L(6_000_000, 0))).toBe(2_000_000)       // deposit repayment wins
expect(dailySellLimitMicroUsd(1, L(6_000_000, 0, 5_500_000))).toBe(1_000_000)
expect(dailySellLimitMicroUsd(1, L(6_000_000, 7_000_000))).toBe(1_000_000)  // >1x halves
expect(dailySellLimitMicroUsd(1, L(6_000_000, 13_000_000))).toBe(400_000)   // >2x fifth
expect(dailySellLimitMicroUsd(1, L(6_000_000, 19_000_000))).toBe(0)         // >3x paused
expect(dailySellLimitMicroUsd(7, L(0, 0))).toBe(30_000_000)
expect(dailySellLimitMicroUsd(7, L(0, 1))).toBe(0)
const day5 = 5 * 86_400_000
const s = { ...newPlayer(day5), hoardLevel: 1, sell: { day: 5, soldTodayMicroUsd: 300_000 } }
expect(remainingSellMicroUsd(s, day5 + 1)).toBe(700_000)
expect(remainingSellMicroUsd(s, day5 + 86_400_000)).toBe(1_000_000)
// store.test.ts (newPlayer(0) as base)
const egg = (readyAtMs: number) => ({ ...newPlayer(0), nests: [{ speciesId: 'fire', readyAtMs }] })
expect(priceMicroUsd({ kind: 'skip', target: 'nest', index: 0 }, egg(1_800_001), 0)).toBe(200_000)
expect(priceMicroUsd({ kind: 'skip', target: 'nest', index: 0 }, egg(1_800_000), 0)).toBe(100_000)
expect(priceMicroUsd({ kind: 'skip', target: 'nest', index: 0 }, egg(0), 0)).toBeNull()
expect(priceMicroUsd({ kind: 'nest' }, newPlayer(0), 0)).toBe(2_000_000)
expect(priceMicroUsd({ kind: 'nest' }, { ...newPlayer(0), nests: [null, null, null, null] }, 0)).toBeNull()
expect(priceMicroUsd({ kind: 'levelUp', dragonId: 'd1' }, newPlayer(0), 0)).toBe(50_000)
// d1 at level 20 → 3_200_000; at level 30 → null; unknown dragon → null
expect(priceMicroUsd({ kind: 'hoard' }, newPlayer(0), 0)).toBe(2_000_000)
// hoardLevel 6 → 60_000_000; hoardLevel 7 → null; foodPack → 500_000; oddsBoost → 500_000
```

- [ ] **Step 2: Run tests** — expect FAIL
- [ ] **Step 3: Implement `sell.ts` and `store.ts`**
- [ ] **Step 4: Run tests** — expect PASS
- [ ] **Step 5: Commit** `feat(game-core): hoard sell limits and store pricing`

### Task 7: `applyAction` with island and farm actions

**Files:**
- Create: `packages/game-core/src/actions/types.ts`, `src/actions/island-actions.ts`, `src/actions/farm-actions.ts`, `src/actions/apply.ts`
- Test: `packages/game-core/test/island-actions.test.ts`, `test/farm-actions.test.ts`

**Interfaces:**
- Consumes: Tasks 2–6 exports
- Produces (`types.ts`):

```ts
type Action =
  | { type: 'collectGold'; habitatId: string }
  | { type: 'buildHabitat'; element: Element }
  | { type: 'upgradeHabitat'; habitatId: string }
  | { type: 'moveDragon'; dragonId: string; habitatId: string }
  | { type: 'feed'; dragonId: string }
  | { type: 'sellDragon'; dragonId: string }
  | { type: 'buyFarmPlot' }
  | { type: 'plant'; plot: number; crop: CropId }
  | { type: 'harvest'; plot: number }
  | { type: 'startBreed'; parentA: string; parentB: string }
  | { type: 'collectEgg'; nest: number }
  | { type: 'hatch'; slot: number }
  | { type: 'sellGold'; gold: number }
  | { type: 'buy'; item: StoreItem }
type ActionError = 'NOT_FOUND' | 'INVALID_AMOUNT' | 'INSUFFICIENT_GOLD' | 'INSUFFICIENT_FOOD' | 'MAX_LEVEL'
  | 'LEVEL_TOO_LOW' | 'INVALID_PARENTS' | 'NO_FREE_NEST' | 'NEST_EMPTY' | 'NOT_READY' | 'HATCHERY_FULL'
  | 'NO_HABITAT_SLOT' | 'HABITAT_LIMIT' | 'ELEMENT_MISMATCH' | 'MAX_PLOTS' | 'PLOT_BUSY' | 'PLOT_EMPTY'
  | 'MAX_NESTS' | 'LAST_DRAGONS' | 'EARNING_LOCKED' | 'NO_HOARD' | 'SELL_LIMIT_REACHED' | 'NOTHING_TO_SKIP'
type Effect = { type: 'charge'; microUsd: number } | { type: 'payout'; microUsd: number }
type ActionResult = { ok: true; state: PlayerState; effects: Effect[] } | { ok: false; error: ActionError }
interface ActionCtx { nowMs: number; rng: Rng; catalog: Catalog }
```

- Produces (`apply.ts`): `applyAction(s: PlayerState, a: Action, nowMs: number, rng: Rng, catalog: Catalog = LAUNCH_CATALOG): ActionResult` — `switch` dispatch to one handler per type `(s, a, ctx) => ActionResult`. Breeding and economy cases return `NOT_FOUND` until Tasks 8 and 9 replace them.
- Rules this task pins: `collectGold` uses `earnGold(…, true)` and sets `lastCollectedMs = max(last, now)`; gold costs use `spendGold`; `buildHabitat` needs `habitats.length < maxHabitats(level)`; `moveDragon` collects source (if any) and target habitats first, same-habitat move is a no-op success; `feed` raises one level, costs `foodToNextLevel`, adds `floor(cost / 10)` XP; `sellDragon` refuses when `dragons.length <= 2`, credits `RARITY.sellGold` as ineligible gold; `plant` requires an empty plot; `harvest` requires `now >= readyAtMs`.

- [ ] **Step 1: Write failing tests** (`s = newPlayer(0)`, `rng = createRng(1)`, `FIXTURE_CATALOG`; `run = (st, a, t) => applyAction(st, a, t, rng, FIXTURE_CATALOG)`)
  - collect h1 at 600_000 → gold 1020, eligibleGold 20, h1.lastCollectedMs 600_000, effects `[]`; then collect at 300_000 → gold 1020, lastCollectedMs 600_000; collect `'h9'` → `NOT_FOUND`
  - buildHabitat earth at level 1 → `HABITAT_LIMIT`; with `level: 5` → gold 500, new habitat `{ id: 'h3', element: 'earth', level: 1, lastCollectedMs: t }`, nextId 4
  - upgradeHabitat h1 → gold 0, level 2; again with gold 0 → `INSUFFICIENT_GOLD`; at level 5 → `MAX_LEVEL`
  - moveDragon d1 → h2 → `ELEMENT_MISMATCH`; waiting dragon `{ id: 'd9', speciesId: 'fw-common', level: 1, habitatId: null }` → h2 succeeds; into a habitat with 3 residents → `NO_HABITAT_SLOT`
  - feed d1 → level 2, food 96; d1 at level 9 with food 400 → level 10, food 76, xp 32; food 3 → `INSUFFICIENT_FOOD`; level 30 → `MAX_LEVEL`
  - sellDragon with 2 dragons → `LAST_DRAGONS`; with d9 added, sell d9 → gold 1100, eligibleGold 0, 2 dragons left
  - buyFarmPlot → gold 500, 3 plots; with 6 plots → `MAX_PLOTS`
  - plant plot 0 sprout at 0 → gold 980, `{ crop: 'sprout', readyAtMs: 60_000 }`; plant it again → `PLOT_BUSY`; harvest at 59_999 → `NOT_READY`; at 60_000 → food 110 and plot `{ crop: null, readyAtMs: 0 }`; harvest empty plot → `PLOT_EMPTY`; plant bounty with 1000 gold → `INSUFFICIENT_GOLD`; plot 7 → `NOT_FOUND`
  - after all calls, `s` still equals `newPlayer(0)`
- [ ] **Step 2: Run tests** — expect FAIL
- [ ] **Step 3: Implement `types.ts`, `island-actions.ts`, `farm-actions.ts`, `apply.ts`**
- [ ] **Step 4: Run tests** — expect PASS
- [ ] **Step 5: Commit** `feat(game-core): applyAction with island and farm actions`

### Task 8: Breeding, egg and hatch actions

**Files:**
- Create: `packages/game-core/src/actions/breed-actions.ts`
- Modify: `packages/game-core/src/actions/apply.ts` (dispatch `startBreed`, `collectEgg`, `hatch`)
- Test: `packages/game-core/test/breed-actions.test.ts`

**Interfaces:**
- Consumes: `rollOffspring`, `RARITY`, `addXp`, `canLiveIn`, `residents`, `HABITAT_LEVELS`, `HATCHERY_SLOTS`
- Rules this task pins:
  - `startBreed`: parents must be two distinct owned ids (`INVALID_PARENTS`), both level ≥ 4 (`LEVEL_TOO_LOW`), a `null` nest (`NO_FREE_NEST`; use the lowest index). `boost = oddsBoosts > 0` (decrement only on success). Egg `readyAtMs = now + (tutorial.breedDone ? RARITY[r].breedMs : 15_000)`; set `breedDone`. Pity: `rarePlus` → `pity[key] = 0`, else `+1`. XP `RARITY[r].xp`.
  - `collectEgg`: `NEST_EMPTY`, `NOT_READY`, `HATCHERY_FULL` when `hatchery.length + waiting dragons >= 3`. Moves egg to hatchery with `readyAtMs = now + (tutorial.hatchDone ? hatchMs : 15_000)`; set `hatchDone`.
  - `hatch`: `NOT_FOUND` for a bad slot, `NOT_READY`; creates `d<nextId>` at level 1 in the first habitat (list order) it `canLiveIn` with free slots, else `habitatId: null`; XP `RARITY[r].xp`.

- [ ] **Step 1: Write failing tests** (fixture catalog; `s4` = `newPlayer(0)` with d1, d2 at level 4)
  - startBreed d1 d1 → `INVALID_PARENTS`; d1 dX → `INVALID_PARENTS`; on `newPlayer(0)` (level 1) → `LEVEL_TOO_LOW`
  - startBreed d1 d2 on `s4` at 0 → `nests[0].readyAtMs === 15_000`, `tutorial.breedDone`, `xp === RARITY[rarity of egg species].xp`; a second startBreed → `NO_FREE_NEST`
  - with `tutorial.breedDone: true`, at t = 1_000 → `nests[0].readyAtMs === 1_000 + RARITY[r].breedMs`
  - `oddsBoosts: 1` → 0 after success; still 1 after a `LEVEL_TOO_LOW` failure
  - `pity: { 'fire+water': 10 }` → egg species is rare+ and `pity['fire+water'] === 0`; with `pity: {}`, `pity['fire+water']` is 1 if the egg is common, else 0
  - collectEgg at 14_999 → `NOT_READY`; at 15_000 → `nests[0] === null`, `hatchery[0].readyAtMs === 30_000`, `tutorial.hatchDone`; empty nest → `NEST_EMPTY`
  - hatchery with 2 eggs plus one dragon with `habitatId: null` → `HATCHERY_FULL`, nest unchanged
  - hatch slot 0 of a ready `fw-common` egg → new dragon `{ id: 'd3', speciesId: 'fw-common', level: 1, habitatId: 'h1' }`, hatchery empty, nextId 4; with h1 and h2 full → `habitatId: null`; slot 5 → `NOT_FOUND`; not ready → `NOT_READY`
- [ ] **Step 2: Run tests** — expect FAIL
- [ ] **Step 3: Implement `breed-actions.ts` and wire `apply.ts`**
- [ ] **Step 4: Run tests** — expect PASS
- [ ] **Step 5: Commit** `feat(game-core): breeding, egg collection and hatching actions`

### Task 9: Sell-back and store actions, public API, replay

**Files:**
- Create: `packages/game-core/src/actions/economy-actions.ts`, `src/index.ts`
- Modify: `packages/game-core/src/actions/apply.ts` (dispatch `sellGold`, `buy`)
- Test: `packages/game-core/test/economy-actions.test.ts`, `test/replay.test.ts`

**Interfaces:**
- Consumes: `remainingSellMicroUsd`, `utcDay`, `MICRO_USD_PER_GOLD`, `HOARD_MIN_PLAYER_LEVEL`, `priceMicroUsd`, `MAX_NESTS`, `FOOD_PACK`, `MAX_DRAGON_LEVEL`
- Produces (`index.ts`): re-exports every public type and function from Tasks 1–9.
- Rules this task pins:
  - `sellGold`: checks in order `EARNING_LOCKED`, `NO_HOARD`, `INVALID_AMOUNT` (not a positive integer), `INSUFFICIENT_GOLD` (`gold > eligibleGold`), `SELL_LIMIT_REACHED` (`gold × 5 > remaining`). Deducts from `gold` and `eligibleGold`; resets `sell` to today first; adds the value to `sell.soldTodayMicroUsd` and `ledger.soldMicroUsd`; effects `[{ type: 'payout', microUsd }]`.
  - `buy`: validate (`NOT_FOUND` missing target, `NOTHING_TO_SKIP`, `MAX_NESTS`, `MAX_LEVEL` for level-up at 30 or Hoard at 7, `LEVEL_TOO_LOW` for Hoard below player level 5), apply the effect (skip sets `readyAtMs = now`; nest appends `null`; foodPack +1,000 food; levelUp +1 level with no food or XP; oddsBoost +1 charge; hoard +1 level), effects `[{ type: 'charge', microUsd: priceMicroUsd(item, s, now) }]`.

- [ ] **Step 1: Write failing tests** (`base = { ...newPlayer(0), earningUnlocked: true, hoardLevel: 1, gold: 300_000, eligibleGold: 300_000 }`)
  - `newPlayer(0)` sell 1 → `EARNING_LOCKED`; `{ ...base, hoardLevel: 0 }` → `NO_HOARD`; `0`, `-1`, `1.5` → `INVALID_AMOUNT`; `{ ...base, eligibleGold: 10 }` sell 11 → `INSUFFICIENT_GOLD`
  - sell 100_000 → gold 200_000, eligibleGold 200_000, `sell.soldTodayMicroUsd` 500_000, `ledger.soldMicroUsd` 500_000, effects `[{ type: 'payout', microUsd: 500_000 }]`
  - then sell 100_001 → `SELL_LIMIT_REACHED`; sell 100_000 → ok (1_000_000 today); then sell 1 → `SELL_LIMIT_REACHED`; at `86_400_000` sell 100_000 → ok with `sell = { day: 1, soldTodayMicroUsd: 500_000 }`
  - buy foodPack → food 1_100, effects `[{ type: 'charge', microUsd: 500_000 }]`; buy nest → 2 nests, charge 2_000_000; with 4 nests → `MAX_NESTS`
  - buy skip on a nest egg ready at 1_800_001 → `readyAtMs === 0`, charge 200_000; skip a ready egg → `NOTHING_TO_SKIP`; skip nest index 3 → `NOT_FOUND`
  - buy levelUp d1 → level 2, food unchanged, charge 50_000; at level 30 → `MAX_LEVEL`
  - buy oddsBoost → `oddsBoosts` 1; buy hoard at player level 4 → `LEVEL_TOO_LOW`; at level 5 → `hoardLevel` 1, charge 2_000_000; at hoardLevel 7 → `MAX_LEVEL`
  - replay: from `{ ...newPlayer(0), food: 200 }` with `FIXTURE_CATALOG` and a fresh `createRng(123)` each run, apply: collectGold h1 @60_000; plant 0 sprout @60_000; harvest 0 @120_000; feed d1 ×3 and feed d2 ×3 @120_000; startBreed d1 d2 @120_000; collectEgg 0 @135_000; hatch 0 @150_000. Every result is `ok`, and the two runs' final states and effect lists are equal.
- [ ] **Step 2: Run tests** — expect FAIL
- [ ] **Step 3: Implement `economy-actions.ts`, wire `apply.ts`, write `index.ts`**
- [ ] **Step 4: Run the full suite and `pnpm -r typecheck`** — expect all PASS, no type errors
- [ ] **Step 5: Commit** `feat(game-core): sell-back and store actions, public api, replay test`

---

**Next plans:** Phase 2 (battles, matchmaking, trophies) and Phase 3 (contracts on testnet 46630) can start once this phase is merged; neither depends on the other.
