# Phase 5: Web Client Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `apps/web`, a pixel-art Phaser 3 + React client for Wyrmhaven: wallet sign-in, the island (habitats, dragons, nests, hatchery, farms), breeding with exact odds, the store and Hoard, PvP/PvE battles played turn by turn and submitted as move lists, token deposit/withdraw against the vault, Season Points and a season re-verification page. Playwright smoke tests cover sign-in, breed, battle, deposit and withdraw (spec §20).

**Architecture:** Vite + React 19 for all UI (panels, forms, wallet), Phaser 3 for the two scenes (Island, Battle) rendered pixel-perfect at a 480×270 base with integer zoom. Server state lives in TanStack Query keyed on `/me`; every mutation is one `POST /actions` with a fresh idempotency key and replaces the cached state with the response. A tiny typed event bus (`src/game/bridge.ts`) connects Phaser (clicks, hovers) and React (state, panel open/close); Phaser never calls the API. Wallet via Reown AppKit + wagmi + viem on Robinhood Chain testnet (46630); the same `clientActionSchema`/API types from `@wyrmhaven/shared`; game-core is imported directly for odds, battle preview and seed verification so the client never re-implements a rule. Art is chosen only through `src/art/slots.ts` (the waitlist's manifest format) with programmatic pixel fallbacks, so every task works before PixelLab assets exist.

**Tech Stack:** Vite 8, React 19, Phaser ^3.90 (spec says Phaser 3), `@reown/appkit` + `@reown/appkit-adapter-wagmi` 1.8, wagmi 3, viem 2, `@tanstack/react-query` 5, zod 4, Vitest 5 + `@testing-library/react` + jsdom, Playwright 1.64, TypeScript 5 strict.

**Spec:** `docs/superpowers/specs/2026-10-28-wyrmhaven-design.md` §2–§15, §17 (re-verify), §18, §20. Art direction and slot format: `docs/superpowers/specs/2026-10-29-waitlist-design.md` §6 (pixel art, same style as the waitlist). Server API: `apps/server/README.md`. Prior rulings: Phase 4 report (server-built opponents, revealed battle seeds, voucher sizing).

## Global Constraints

- Original IP: all art prompts describe our own designs; no other game's names, art or style words. Element names are generic.
- Pixel rendering: Phaser `pixelArt: true`, `roundPixels: true`, base 480×270, `Scale.FIT` with integer zoom only; sprites placed on whole pixels; CSS `image-rendering: pixelated` for HTML sprites; `prefers-reduced-motion` shows frame 0 (same rules as the waitlist).
- The client never computes a rule the server owns: gold/food/XP/trophies come from the response state; odds from `breedingOdds`; battle animation from `simulateBattle`/`battlePreview` with the revealed seed; prices from `priceMicroUsd` for display only.
- Money shown as formatted strings from `bigint`/micro-USD; no float math on amounts. Token amounts in wei (`bigint`), USD in micro-dollars.
- Testnet only: chain 46630 in the wagmi config; `VITE_VAULT_ADDRESS`/`VITE_TOKEN_ADDRESS` from env; the client refuses to send a transaction on any other chain.
- Every API error (`{ error }`) is surfaced with a human message from one `errorMessages` map; unknown codes show the code.
- Accessibility: every control is a real `<button>`/`<input>` with a label; the Phaser canvas is decorative (`aria-hidden`) and every scene action has an equivalent in a React panel.
- Out of scope (Phase 6/7): season prizes UI beyond SP totals, referrals, Telegram, cosmetics, admin UI, mainnet.

## Review Focus

1. A response with a new `state` must replace the cache atomically with any pending optimistic UI; a 422 shows the error and leaves the last good state (no half-updated UI). (Task 4)
2. Battle move selection must only ever offer legal moves (living targets, the actor's own moves); the submitted list must reproduce the previewed battle exactly (same seed, same `simulateBattle`). (Task 5)
3. Wallet/chain guards: a wrong chain, a missing vault address, or an amount above the balance disables Send before any signature request; a deposit shows both approve and deposit steps and never double-submits. (Task 6)
4. The Island scene must never place two dragons on one slot or leave a dragon hidden; a hatchling waiting (`habitatId: null`) is shown in the hatchery with a "no room" hint. (Task 3)
5. Loss of session (401 anywhere) returns the user to the sign-in panel without losing unsent input, and a replayed idempotency key is never reused for a different action. (Tasks 1, 4)

---

### Task 1: App scaffold, API client, wallet sign-in

**Files:**
- Create: `apps/web/package.json` (`@wyrmhaven/web`; scripts `dev`, `build`, `preview`, `test: vitest run`, `test:e2e: playwright test`, `typecheck: tsc --noEmit`), `vite.config.ts` (React plugin, `server.proxy['/api'] → http://localhost:3000` rewriting `/api` away), `tsconfig.json`, `index.html`, `vitest.config.ts` (jsdom, `setupTests.ts`), `.env.example` (`VITE_API_URL=/api`, `VITE_CHAIN_ID=46630`, `VITE_RPC_URL`, `VITE_VAULT_ADDRESS`, `VITE_TOKEN_ADDRESS`, `VITE_REOWN_PROJECT_ID`, `VITE_TEST_WALLET=0`)
- Create: `src/main.tsx`, `src/App.tsx`, `src/api/client.ts`, `src/api/errors.ts`, `src/api/session.ts`, `src/wallet/config.ts`, `src/wallet/SignIn.tsx`, `src/state/me.ts` (Query hooks), `src/styles/tokens.css` (element colours identical to the waitlist's, pixel font Silkscreen + Inter)
- Test: `apps/web/test/client.test.ts`, `test/signin.test.tsx`

**Interfaces:**
- Produces (`api/client.ts`): `class ApiError extends Error { status: number; code: string }`; `createApi(opts: { baseUrl: string; getToken: () => string | null; onUnauthorized: () => void; fetchImpl?: typeof fetch })` returning typed methods for every server route: `nonce()`, `verify(message, signature)`, `logout()`, `me()`, `action(action: ClientAction, idempotencyKey: string): Promise<ActionResponse>`, `sp()`, `offers()`, `withdraw(grossWei: bigint)`, `pendingWithdraw()`, `season()`, `seasonActions(id, playerId)`. Bigint fields are parsed from strings at the boundary. A 401 calls `onUnauthorized` once and rethrows.
- Produces (`api/errors.ts`): `errorMessages: Record<string, string>` covering every `ActionError` and server code from `apps/server/README.md`; `messageFor(code: string): string`.
- Produces (`api/session.ts`): `sessionStore` (token in `localStorage` key `wyrm.session`, player id, address) with `subscribe`; `useSession()`.
- Produces (`wallet/config.ts`): `robinhoodTestnet` chain (46630, RPC from env), `wagmiAdapter`, `appKit` (`createAppKit`) and, when `VITE_TEST_WALLET=1`, a wagmi `mock` connector seeded with the e2e account so Playwright can sign without a browser wallet.
- Produces (`wallet/SignIn.tsx`): Connect (AppKit modal) → "Sign in" builds a SIWE message with `createSiweMessage` (domain = `location.host`, uri = `location.origin`, chainId 46630, nonce from `/auth/nonce`, issuedAt now) → `signMessage` → `verify` → session stored → `/me` loaded. Shows wrong-network and rejected-signature states.
- Produces (`state/me.ts`): `useMe()` (Query `['me']`), `applyStateFromResponse(qc, state)`.

- [x] **Step 1: Write failing tests** (`fetchImpl` stub)
  - `createApi` posts `/actions` with `{ action, idempotencyKey }` and a `Bearer` header, parses `balanceWei` on `/me` to `bigint`, throws `ApiError{ status: 422, code: 'PLOT_BUSY' }` on `{ error }` bodies, and calls `onUnauthorized` exactly once for two concurrent 401s.
  - `messageFor('INSUFFICIENT_GOLD')` is a sentence; `messageFor('WHATEVER')` returns `'WHATEVER'`.
  - `<SignIn>` with a mocked wagmi provider (connected mock account): clicking Sign in requests `/auth/nonce`, signs a message containing `Chain ID: 46630` and the nonce, posts `/auth/verify`, stores the token, and renders the address; a `signMessage` rejection shows "Signature rejected".
- [x] **Step 2: Run `pnpm --filter @wyrmhaven/web test`** — expect FAIL
- [x] **Step 3: Implement** (and `pnpm install` the dependencies above)
- [x] **Step 4: Run tests and `pnpm -r typecheck`** — expect PASS
- [x] **Step 5: Commit** `feat(web): vite scaffold, typed api client, siwe sign-in`

### Task 2: Art slots, manifest loader and pixel fallbacks

**Files:**
- Create: `apps/web/src/art/types.ts`, `src/art/slots.ts`, `src/art/fromManifest.ts`, `src/art/fallback.ts`, `src/art/phaserLoader.ts`, `public/art/v0/manifest.json` (empty `assets`), `apps/web/art/prompts.md` (empty template for Task 8)
- Test: `apps/web/test/art.test.ts`

**Interfaces:**
- Produces (`art/types.ts`): `Sprite = { src: string; w: number; h: number; frames: number; fps: number }`; `interface GameArtSet { version: string; egg: Record<Element, Sprite>; hatchling: Record<Element, Sprite>; dragon: Record<string /* speciesId */, Sprite>; habitat: Record<Element, Sprite>; building: { nest: Sprite; hatchery: Sprite; farmPlot: Sprite; cropStage: Record<CropId, Sprite>; hoard: Sprite }; elementIcon: Record<Element, Sprite>; ui: { panel: Sprite; button: Sprite; cursor: Sprite }; island: { base: Sprite; layers: Sprite[] } }` — same `Sprite` and manifest format as the waitlist (`{ assets: Record<key, { file, w, h, frames, fps }> }`), keys `egg.<element>`, `hatchling.<element>`, `dragon.<speciesId>`, `habitat.<element>`, `building.<name>`, `crop.<cropId>`, `icon.<element>`, `ui.<name>`, `island.base`, `island.layer.<n>`.
- Produces (`art/fromManifest.ts`): `artSetFromManifest(version, manifest, catalog: Catalog): GameArtSet` — missing keys yield `{ src: '', w, h, frames: 1, fps: 0 }` with the slot's default size (eggs/hatchlings 32×32, dragons 48×48, habitats 96×64, icons 16×16, island 480×270).
- Produces (`art/fallback.ts`): `drawFallback(ctx: CanvasRenderingContext2D, slot: FallbackSlot, element: Element, w, h)` — deterministic programmatic pixel art (a 2-colour egg oval, a blocky dragon silhouette with an element-coloured belly, a habitat platform, a 9-slice panel) so the game is playable with no assets; `fallbackKey(slot, element)`.
- Produces (`art/phaserLoader.ts`): `loadArt(scene: Phaser.Scene, art: GameArtSet)` — queues every non-empty sprite as a spritesheet (`frameWidth: w`) and generates canvas textures for empty ones via `drawFallback`; `playOrStill(sprite: Phaser.GameObjects.Sprite, key, fps, reducedMotion)`; `textureKey(slotPath)`.
- `ACTIVE_ART` built from `public/art/v0/manifest.json` at boot (fetched; version string busts caches).

- [x] **Step 1: Write failing tests**
  - manifest `{ 'egg.fire': { file: 'egg-fire.png', w: 32, h: 32, frames: 6, fps: 8 } }` → `art.egg.fire.src === '/art/v1/egg-fire.png'`, `frames 6`; missing `egg.ice` → empty `src`, `32×32`, `frames 1`
  - `dragon` keys come from the catalog species ids (9 for the launch catalog), all empty with `48×48`
  - `drawFallback` on a 32×32 canvas (jsdom canvas via `canvas` package or `vitest-canvas-mock`): fills ≥ 20% of pixels with the element base colour for `egg`; two calls are pixel-identical (deterministic)
  - `loadArt` in a Phaser `HEADLESS` game: after `create`, textures exist for every slot key (fallbacks generated), and `playOrStill` with `reducedMotion: true` never starts an animation
- [x] **Step 2: Run tests** — expect FAIL
- [x] **Step 3: Implement**
- [x] **Step 4: Run tests** — expect PASS
- [x] **Step 5: Commit** `feat(web): art slot system with manifest loader and pixel fallbacks`

### Task 3: Island scene

**Files:**
- Create: `apps/web/src/game/bridge.ts`, `src/game/config.ts`, `src/game/layout.ts`, `src/game/scenes/BootScene.ts`, `src/game/scenes/IslandScene.ts`, `src/game/GameCanvas.tsx`
- Test: `apps/web/test/layout.test.ts`, `test/bridge.test.ts`, `test/island.test.ts`

**Interfaces:**
- Produces (`bridge.ts`): `type GameEvent = { type: 'select'; target: Target } | { type: 'hover'; target: Target | null } | { type: 'ready' }`; `type Target = { kind: 'habitat'; id } | { kind: 'dragon'; id } | { kind: 'nest'; index } | { kind: 'hatchery'; slot } | { kind: 'farm'; plot } | { kind: 'hoard' } | { kind: 'empty' }`; `bridge.emit/on/off`; `bridge.setState(state: PlayerState | null)`; `bridge.setArt(art)`; `bridge.setClock(nowMs)`.
- Produces (`layout.ts`, pure): `BASE = { w: 480, h: 270 }`; `habitatSlots(index: number, count: number): { x, y }` (grid of up to 12 platforms), `dragonSlots(habitatIndex, slot, slots): { x, y }`, `nestPos(i)`, `hatcheryPos(slot)`, `farmPos(plot)`, `hoardPos()`; `integerZoom(viewportW, viewportH): number` = `max(1, floor(min(vw/480, vh/270)))`.
- Produces (`config.ts`): `createGame(parent: HTMLElement, art: GameArtSet): Phaser.Game` with `type: Phaser.AUTO` (HEADLESS under test), `pixelArt: true`, `roundPixels: true`, `scale: { mode: Phaser.Scale.NONE, width: 480, height: 270, zoom: integerZoom(...) }`, resize handler re-applying integer zoom.
- Produces (`IslandScene`): renders from `bridge` state: one platform sprite per habitat with its element colour and `storedGold`-based coin badge (computed with `storedGold` from game-core and the bridge clock), one dragon sprite per resident at `dragonSlots`, eggs on nests with a countdown badge, hatchery eggs and waiting hatchlings, farm plots with crop stage (0–3 by elapsed fraction), the Hoard when `hoardLevel > 0`; pointer down → `bridge.emit({ type: 'select', target })`; hover → `hover`. Idle animations via `playOrStill`.
- Produces (`GameCanvas.tsx`): mounts the game once, forwards `useMe().data.state` and `Date.now()` ticks (1 s) into the bridge, applies `prefers-reduced-motion`.

- [x] **Step 1: Write failing tests**
  - `habitatSlots(i, n)` for n ≤ 12 returns 12 distinct whole-pixel positions inside `BASE`; `dragonSlots(h, s, 7)` distinct for s < 7; `integerZoom(1920, 1080) === 4`, `(500, 280) === 1`, `(400, 200) === 1`
  - bridge: `on('select')` receives emitted events; `off` unsubscribes; `setState` triggers `on('state')`
  - HEADLESS Island scene with `newPlayer(0)` state: 2 habitat sprites, 2 dragon sprites, 1 empty nest marker, 0 hatchery eggs, 2 farm plots; a state with a waiting hatchling (`habitatId: null`) shows it at `hatcheryPos` with the `noRoom` badge; no two dragons share a position; simulating a pointer down on a habitat emits `{ type: 'select', target: { kind: 'habitat', id: 'h1' } }`
- [x] **Step 2: Run tests** — expect FAIL
- [x] **Step 3: Implement**
- [x] **Step 4: Run tests** — expect PASS
- [x] **Step 5: Commit** `feat(web): island scene with pixel-perfect layout and react bridge`

### Task 4: Economy panels and the action hook

**Files:**
- Create: `apps/web/src/state/actions.ts`, `src/ui/Panel.tsx` (9-slice frame with fallback border), `src/ui/Money.tsx` (format gold/food/µUSD/wei), `src/ui/Timer.tsx`, `src/panels/ResourcesBar.tsx`, `src/panels/HabitatPanel.tsx`, `src/panels/DragonPanel.tsx`, `src/panels/BreedPanel.tsx`, `src/panels/NestsPanel.tsx`, `src/panels/FarmPanel.tsx`, `src/panels/StorePanel.tsx`, `src/panels/PanelHost.tsx` (opens the panel for the bridge's selected target)
- Test: `apps/web/test/actions.test.tsx`, `test/panels.test.tsx`

**Interfaces:**
- Produces (`state/actions.ts`): `useAction()` → `{ run(action: ClientAction): Promise<ActionResponse>; pending: boolean; error: ApiError | null }` — one in-flight action at a time per client (the server locks anyway); a fresh `crypto.randomUUID()` key per `run`, retried with the **same** key on a network failure (never on a 4xx); on success `applyStateFromResponse`; `sp` toast when awarded; 401 → sign-in.
- Produces (`ui/Money.tsx`): `formatGold(n)`, `formatMicroUsd(µ)` ("$0.50"), `formatWei(wei, decimals = 18, maxFrac = 4)` (string math on `bigint`, no floats).
- Panels (all driven by `useMe().data.state`, catalog from game-core):
  - `ResourcesBar`: gold (and eligible share), food, level + XP bar (`xpToNext`), trophies, token balance.
  - `HabitatPanel`: element, level, residents, stored gold (`storedGold`), Collect, Upgrade (cost from `HABITAT_LEVELS`), Move dragon here (list of movable dragons via `canLiveIn` + free slots), Build new habitat (element picker, cost `habitatBuildCost`, disabled at `maxHabitats`).
  - `DragonPanel`: species, level, gold/min, Feed (cost `foodToNextLevel`, disabled at 30), Sell (`RARITY.sellGold`, disabled when ≤ 2 dragons), Set as defence team member.
  - `BreedPanel`: pick two owned dragons ≥ 4; shows `breedingOdds(a, b, { boost: oddsBoosts > 0, pity })` as a sorted table with percentages (2 decimals) and the boost/pity notes (§6 "UI shows the exact odds"); Breed button when a nest is free.
  - `NestsPanel`: nests with timers, Collect egg (→ hatchery) when ready, Skip (price from `priceMicroUsd`), hatchery slots with Hatch when ready, Skip.
  - `FarmPanel`: plots, crop picker with cost/food/time from `CROPS`, Plant, Harvest when ready, Buy plot (`plotCost`), Skip.
  - `StorePanel`: every `StoreItem` with `priceMicroUsd` and the token equivalent at the current price (from `/me`? The server has no price route → ruling: add `price` to `/me` response is a server change; instead show USD only here and the token charge after the response).
- Every button is disabled with a reason tooltip when game-core would refuse (computed client-side only for enablement; the server still decides).

- [x] **Step 1: Write failing tests** (RTL with a fake `api`; state fixtures from `newPlayer(0)`)
  - `useAction().run` sends a UUID key, applies the returned `state` to the `['me']` cache, and after a 422 the cache still holds the previous state and `error.code === 'PLOT_BUSY'`; a thrown `TypeError: fetch failed` retries once with the same key; a 401 clears the session
  - `BreedPanel` with d1/d2 at level 4 shows rows `fire 50.00%` / `water 50.00%` (launch catalog, fallback pool) and with `oddsBoosts: 1` shows "Odds boost active"; Breed is disabled when `nests` has no `null`
  - `HabitatPanel` for h1 at `nowMs = 600_000` shows "20 gold stored" and Upgrade "1,000 gold"; Collect calls `run({ type: 'collectGold', habitatId: 'h1' })`
  - `DragonPanel`: Sell disabled with "Keep at least two dragons" at 2 dragons; Feed shows "4 food"
  - `FarmPanel`: Plant sprout → `run({ type: 'plant', plot: 0, crop: 'sprout' })`; a busy plot shows a `Timer` and Harvest disabled until ready
  - `StorePanel`: skip on a nest egg with 1_800_001 ms left shows "$0.20"; nest 2 shows "$2.00"
- [x] **Step 2: Run tests** — expect FAIL
- [x] **Step 3: Implement**
- [x] **Step 4: Run tests** — expect PASS
- [x] **Step 5: Commit** `feat(web): economy panels and the single action hook`

### Task 5: Battle preview helper, battle scene and PvP/PvE panels

**Files:**
- Create: `packages/game-core/src/battle/preview.ts` (+ export from `index.ts`), `packages/game-core/test/battle-preview.test.ts`
- Create: `apps/web/src/game/scenes/BattleScene.ts`, `src/panels/BattlePanel.tsx`, `src/panels/PvpPanel.tsx`, `src/panels/PvePanel.tsx`, `src/state/battle.ts`
- Test: `apps/web/test/battle.test.tsx`

**Interfaces:**
- Produces (game-core `preview.ts`): `battlePreview(attacker, defender, moves, rng: Rng, catalog): { log: BattleEvent[]; attacker: Combatant[]; defender: Combatant[]; round: number; next: { side: Side; slot: number } | null; done: BattleOutcome | null }` — replays exactly like `simulateBattle` up to the first attacker action without a move (`next` = that actor; `done` = null) or to the end (`done` = the outcome). `simulateBattle(...)` with the same inputs and `moves` extended by any legal choice at `next` continues the same log (property test).
- Produces (`state/battle.ts`): `useBattle()` — holds `{ offer | stage, team, moves, seed32 }`; `preview` recomputed with `createRng(seed32)` on every change (offers carry `seedHex`; PvE: the seed is unknown to the client before submission → preview uses `createRng(0)` and the panel says "preview; rolls may differ"); `legalMovesFor(next)` via `isLegalMove`; `choose(move, target)`; `undo()`; `submit()` → `run({ type: 'pvpBattle', offerId, team, moves })` or `pveBattle`.
- Produces (`BattleScene`): draws both teams (3 sprites each, HP bars), animates the preview log step by step (attack lunge, hit flash, KO fade) with `reducedMotion` skipping to the final frame; highlights `next` actor and legal targets; pointer on a target emits `bridge` `{ type: 'battleTarget', slot }`.
- Produces (`PvpPanel`): Offers (GET `/pvp/offers`, Refresh retires the old set per server rule), opponent cards (level, trophies, team), Fight → team picker (3 owned dragons; defence team preselected) → `BattlePanel`. `PvePanel`: 30 stages, cleared/locked state, first-clear rewards from `stageRewards`, replays left (10/day), Fight.
- Produces (`BattlePanel`): move buttons for `next` actor (`movesFor`), target buttons for living defenders, Undo, Submit (enabled when `preview.done` exists for PvP, or at any time for PvE with a "moves until here" note), result view (winner, trophies/gold/SP from the response).

- [x] **Step 1: Write failing tests**
  - game-core: `battlePreview` with no moves returns `next = { side: 'attacker', slot: fastest attacker }` and an empty attacker log (defenders faster than the first attacker have acted); with a full legal move list `done` equals `simulateBattle(...)`; 200 random seeds/teams: for a prefix of moves, `battlePreview(prefix).log` is a prefix of `simulateBattle(full).log`
  - `useBattle` (offer with `seedHex`, water L20 team vs fire L1 bots): `legalMovesFor(next)` has 2 moves × 3 targets; after `choose(0,0)`, `choose(0,1)`, `choose(0,2)`, `preview.done.winner === 'attacker'` and `submit()` posts exactly those three moves with the `offerId`
  - `BattlePanel` disables a target button for a KO'd defender; Submit disabled until `done` (PvP)
  - `PvePanel` shows stage 2 locked when `pve.cleared === 0`, and "Replays left: 10"
- [x] **Step 2: Run tests** — expect FAIL
- [x] **Step 3: Implement** (`pnpm --filter @wyrmhaven/game-core test` must stay green)
- [x] **Step 4: Run tests** — expect PASS
- [x] **Step 5: Commit** `feat(web): battle preview, battle scene, pvp/pve panels`

### Task 6: Chain panels (enter, deposit, withdraw), Hoard, season and re-verify

**Files:**
- Create: `packages/shared/src/abi.ts` (WyrmVault + minimal ERC-20 ABI; `apps/server/scripts/sync-abi.ts` writes both), `packages/shared/src/verify.ts` (WebCrypto HMAC-SHA256 + keccak256 via viem: `verifySeed(commitHash, secretHex, label, seedHex): Promise<boolean>`)
- Create: `apps/web/src/chain/vault.ts` (wagmi hooks: `useVault()` → `entryFeeWei`, `remainingPayoutToday`, `allowance`, `tokenBalance`; `enter()`, `approve(amount)`, `deposit(amount)`, `claim(voucher)`), `src/panels/WalletPanel.tsx`, `src/panels/HoardPanel.tsx`, `src/panels/SeasonPanel.tsx`, `src/pages/Verify.tsx`
- Test: `packages/shared/test/verify.test.ts`, `apps/web/test/chain.test.tsx`

**Interfaces:**
- `WalletPanel`: address, token wallet balance vs in-game balance, **Enter** (payable `enter()` with `entryFeeWei`, hidden once `earningUnlocked`), **Deposit** (amount input in tokens → wei; step 1 Approve if `allowance < amount`, step 2 Deposit; both disabled on wrong chain / missing addresses / amount > wallet balance; shows the 2% fee and credited amount), **Withdraw** (amount ≤ in-game balance and ≤ server limit → `POST /withdraw` → shows the voucher → **Claim** calls `claim(cumulative, deadline, signature)`; pending voucher shown from `/withdraw/pending` with its deadline and the "re-credited if unclaimed" note), tx status links to the explorer.
- `HoardPanel`: hoard level, daily limit and remaining (`remainingSellMicroUsd` from game-core on the client state), eligible gold, Sell gold (amount → `sellGold`), Build/upgrade Hoard (`buy { kind: 'hoard' }`, needs level 5), locked state before `earningUnlocked`.
- `SeasonPanel`: season id, days left, commit hash, SP today/total/cap (`/sp`), daily quests checklist (derived from today's action log is server-only → ruling: show the three quests with their points and "earned today" from the `sp` toasts in this session only), link to Verify.
- `Verify.tsx` (`/verify/:seasonId`): after reveal, fetches `/season/:id` and `/season/:id/actions?playerId=me`, recomputes every `seedHex` from `seedLabel` with `verifySeed`, and re-runs `applyAction`/`simulateBattle` for each logged action from the previous row's state (first row from `newPlayer`), showing ✓/✗ per row; before reveal, shows the commit hash and "secret not yet revealed".

- [x] **Step 1: Write failing tests**
  - `verifySeed(commitHash(S), S, 'p:1', actionSeed(S,'p',1n).seedHex)` true (vectors generated with the server's `seed.ts` and pasted as constants); wrong label false
  - `WalletPanel` with mocked wagmi reads: Deposit disabled on chain 1 with "Switch to Robinhood Chain testnet"; with allowance 0 the primary button says "Approve"; after approve resolves it says "Deposit"; amount above wallet balance disables with "Not enough WYRM"; Withdraw above the in-game balance disabled; a pending voucher renders Claim with the deadline
  - `HoardPanel`: locked copy before `earningUnlocked`; with hoard 1 and 300_000 eligible gold shows "$1.00 left today" and Sell enabled
  - `Verify`: a fixture of 3 logged actions and the revealed secret → 3 ✓; a tampered seedHex → ✗ on that row
- [x] **Step 2: Run tests** — expect FAIL
- [x] **Step 3: Implement**
- [x] **Step 4: Run tests and `pnpm -r typecheck`** — expect PASS
- [x] **Step 5: Commit** `feat(web): wallet, deposit/withdraw, hoard, season and re-verify`

### Task 7: Playwright smoke tests (spec §20)

**Files:**
- Create: `apps/web/playwright.config.ts` (webServer: server on PGlite with `FakeChainClient` via `E2E=1` env + Vite with `VITE_TEST_WALLET=1`), `apps/web/e2e/helpers.ts` (fresh PGlite dir per run, test account = anvil key 0), `e2e/signin.spec.ts`, `e2e/breed.spec.ts`, `e2e/battle.spec.ts`, `e2e/deposit-withdraw.spec.ts`
- Modify: `apps/server/src/index.ts` (`E2E=1` → in-memory PGlite, `FakeChainClient` with `remainingPayout` seeded, `FixedPriceSource`, and a `POST /e2e/grant` route that credits tokens and sets `earningUnlocked`, registered only under `E2E=1`)

- [x] **Step 1: Write the specs** (they fail until wired)
  - sign-in: open `/`, click Connect (mock wallet auto-connects), Sign in → ResourcesBar shows "1,000 gold"
  - breed: feed d1 and d2 to level 4 via the panels (food granted by `/e2e/grant`), open Breed, pick both, see "50.00%" rows, Breed → nest shows a 15 s timer; advance by waiting (server clock is real; the tutorial egg is 15 s) → Collect → hatchery timer 15 s → Hatch → a third dragon appears in the Island scene (DOM count of dragon markers = 3)
  - battle: grant level 8 and three level-20 water dragons via `/e2e/grant`, set defence team, open PvP → 3 offers → Fight a bot → choose 3 moves → Submit → result shows "+30 trophies"
  - deposit/withdraw: `/e2e/grant` tokens; Withdraw 1 token → voucher card with a deadline; `/withdraw/pending` shows it; (on-chain Deposit/Claim run only when `E2E_RPC_URL` and contract addresses are set, against a local anvil with the Phase 3 deployment; otherwise `test.skip` with the reason)
- [x] **Step 2: Run `pnpm --filter @wyrmhaven/web test:e2e`** — expect FAIL
- [x] **Step 3: Implement the E2E server mode and fix what the flows reveal**
- [x] **Step 4: Run e2e** — expect PASS (deposit/claim skipped without anvil, stated in the output)
- [x] **Step 5: Commit** `test(web): playwright smoke for sign-in, breed, battle, withdraw`

### Task 8: Pixel art with PixelLab (requires the `pixellab` MCP tools)

**Files:**
- Create: `apps/web/public/art/v1/*.png`, `public/art/v1/manifest.json`, `apps/web/art/prompts.md`
- Modify: `apps/web/src/art/slots.ts` (`ACTIVE_ART` → v1)

Must run in a session where the `pixellab` MCP tools are loaded (the server is configured on this machine for the Claude CLI; the Phase 4/5 session did not have them). If unavailable, stop and report; every other task works on fallbacks.

- [x] **Step 1:** Write one shared style line (our own: "chunky pixel art, 1-px dark outline, limited palette, warm island daylight, transparent background") and one design line per species in `prompts.md` (shape, horns/fins/wings, element colour from `tokens.css`); reuse the waitlist's egg/hatchling designs for continuity (same prompts, same sizes) so the two apps share a look.
- [x] **Step 2:** Generate: 9 eggs (32×32, 6-frame wobble), 9 hatchlings (32×32, idle 4–8 frames), 9 adult pure dragons (48×48, idle 4–8 frames), 9 habitat platforms (96×64 static), nest, hatchery, farm plot (static) + 4 crop stages × 4 crops as a single 16×16 sheet, Hoard (static), island base (480×270) + one animated layer (6–8 frames), 9 element icons (16×16), UI panel/button 9-slice and a cursor. Save as horizontal sprite sheets; record prompt, size and frame count in `prompts.md`.
- [x] **Step 3:** Write `manifest.json`; run the Task 2 tests against it (`artSetFromManifest` yields no empty `src` for the keys above); view `/` and the battle scene at zoom 1–4 for alignment; fix offsets in `layout.ts` if a sprite's feet are not on the platform.
- [x] **Step 4:** `pnpm --filter @wyrmhaven/web test` → PASS
- [x] **Step 5:** Commit `feat(web): PixelLab art v1`

> Done 2026-10-29. Layout changed for the real sprite sizes: habitats fill a 4×3 grid of 96×64 tiles from the meadow centre outward, are drawn back row first, and dragons stand on the tile face. Crop sheets are growth stages chosen by frame. The PixelLab trial (40 generations) covered every slot; idle animations, the water layer, three habitat recolours (metal, dark, light) and the UI frames were made in code from the PixelLab images. Alignment was checked with an offline composite of the layout; the battle scene was not viewed in a running client. See `apps/web/art/prompts.md`.

### Task 9: Shell, responsiveness, error states, README

**Files:**
- Create: `apps/web/src/Shell.tsx` (layout: canvas + side panel on ≥ 900 px, canvas + bottom sheet below), `src/ui/Toast.tsx`, `src/ui/ErrorBoundary.tsx`, `apps/web/README.md`
- Modify: `src/App.tsx`, root `package.json` (`dev` runs server + web with `concurrently`)
- Test: `apps/web/test/shell.test.tsx`

- [x] **Step 1: Write failing tests** — at 360 px width the panel host renders as a bottom sheet (`data-layout="sheet"`), at 1280 px as a sidebar; an `ApiError` thrown by a mutation shows one toast with `messageFor(code)`; the boundary renders "Something broke" with a Reload button on a render error; a 401 from `/me` shows `SignIn`
- [x] **Step 2: Run tests** — expect FAIL
- [x] **Step 3: Implement**; README: run (`pnpm dev` starts server on :3000 and web on :5173), env vars, test and e2e commands, how art slots work, the testnet checklist (contract addresses, Reown project id)
- [x] **Step 4: Run `pnpm -r test`, `pnpm -r typecheck`, `pnpm --filter @wyrmhaven/web build`** — expect PASS
- [x] **Step 5: Commit** `feat(web): responsive shell, toasts, error boundary, docs`

---

**After this plan:** a playable testnet client once the Phase 3 contracts are deployed and the server runs with real addresses. Phase 6 adds season prizes UI, referrals, cosmetics and the Telegram bot; Phase 7 is the closed beta.
