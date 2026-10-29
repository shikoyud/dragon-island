# Live Layer Implementation Plan (Phase 6)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Seasons that actually close (prize pool from vault inflows, prizes credited, trophies reset, secret revealed), referrals with anti-abuse, a Telegram notifier, an admin surface, and the web panels that show all of it.

**Architecture:** Prize math is pure in `game-core` (bigint wei in, per-player wei out). The server keeps a `vault_inflows` ledger every inflow source writes to, a `season_close` job that is idempotent under an advisory lock, a `referrals` service hooked into `charge`, and a `telegram` service behind a `TelegramClient` seam (fake in tests). The web client gets leaderboard, prizes, referral and Telegram UI in the existing Season panel plus a token-gated `/admin` page.

**Tech Stack:** TypeScript 5.9, Vitest 5, Fastify 5 + Drizzle (PGlite in tests), zod 4, React 19, TanStack Query. No new runtime dependencies (Telegram via `fetch`).

**Spec:** `docs/superpowers/specs/2026-10-28-wyrmhaven-design.md` §11 (trophy reset), §12, §13 (vault shares), §16, §17, §18 (jobs, Telegram), §21 phase 6. Inherited rulings: memory notes for Phases 2 and 4 (daily quests set, seed labels, PGlite transaction rule).

## Global Constraints

- game-core is pure: no I/O, no `Date.now()`, no `Math.random()`; all money is integer `bigint` wei or integer micro-USD.
- "A season lasts 14 days. At reset, trophies above 1,000 become 1,000 + floor((t − 1,000) / 2)." (`seasonResetTrophies` exists in game-core.)
- "Prize pool = 30% of the vault's net inflows during the season (vault share of spend + vault share of deposit/withdraw fees + buybacks + forfeited balances)."
- "70% threshold pot: SP tiers 200 / 500 / 1,000 / 2,000 get 10% / 20% / 30% / 40%, split equally among players who reached each tier (highest tier only)."
- "30% placement pot: top 100 by SP, weight (101 − rank)."
- "Prizes are credited to in-game token balances when the season closes."
- "Referrer earns 5% of a referred player's token spend, paid from the vault's share; nothing if the IP or device fingerprint matches."
- "Banned accounts forfeit earned balances and prizes but may withdraw their own deposits."
- PGlite: never query the outer `db` inside `db.transaction`; pass `tx`.
- Server tests run sequentially (PGlite boots per file). Stage commits by explicit path (shared worktree with the waitlist thread).
- Secrets (bot token, admin token) come from env only; never in code or committed `.env`.

## Review Focus

1. A season closes while a player's action transaction is mid-flight: SP written after the standings snapshot must not be lost or double counted → Task 3 test "closing twice credits nothing the second time and standings are read inside the close transaction".
2. A player banned after earning SP: no prize, and their tier share redistributes to the others → Task 1 test "banned/ineligible players are excluded before tiers are split".
3. Fewer than 100 ranked players, or nobody reaches a tier: the unspent pot stays in the vault (not redistributed) → Task 1 test "unreached tiers and empty ranks leave wei unspent".
4. Referral self-dealing: same IP hash or device hash, or referring yourself, or claiming a code after spending → Task 4 tests.
5. Telegram outage: the notifier must not spam when it recovers or lose track of what was sent → Task 5 test "a failed send is retried next run; a successful one is never repeated".

---

### Task 1: Pure prize math in game-core

**Files:**
- Create: `packages/game-core/src/prizes.ts`
- Modify: `packages/game-core/src/index.ts` (export)
- Test: `packages/game-core/test/prizes.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export const PRIZE = { poolShareBps: 3000, thresholdBps: 7000, placementBps: 3000, tiers: [{ sp: 200, bps: 1000 }, { sp: 500, bps: 2000 }, { sp: 1000, bps: 3000 }, { sp: 2000, bps: 4000 }], topN: 100 } as const
  export interface Standing { playerId: string; sp: number }
  export interface PrizeAward { playerId: string; wei: bigint; tier: number | null; rank: number | null }
  /** `poolWei` is the whole prize pool (already 30% of inflows). Returns awards > 0 only; unspent wei stays in the vault. */
  export function computePrizes(poolWei: bigint, standings: readonly Standing[]): { awards: PrizeAward[]; unspentWei: bigint }
  export function prizePoolWei(netInflowsWei: bigint): bigint  // floor(inflows * 3000 / 10000)
  ```
- Ranking: sort by `sp` desc, then `playerId` asc (deterministic); players with `sp === 0` are not ranked and never win. Tier share per player = floor(tierPot / count); remainder unspent. Placement: weight 101 − rank for ranks 1..min(100, n); award = floor(placementPot × weight / sumWeights).

- [ ] **Step 1: Write the failing tests**

```ts
it('splits the threshold pot by highest tier reached and the placement pot by 101 − rank', () => {
  const pool = 10_000n * 10n ** 18n
  const r = computePrizes(pool, [{ playerId: 'a', sp: 2100 }, { playerId: 'b', sp: 600 }, { playerId: 'c', sp: 600 }, { playerId: 'd', sp: 10 }])
  const threshold = (pool * 7000n) / 10_000n, placement = pool - threshold
  const a = r.awards.find(x => x.playerId === 'a')!
  expect(a.tier).toBe(3)
  expect(a.rank).toBe(1)
  // tier 2000 pot 40% all to a; tier 500 pot 20% split b/c; tiers 200 and 1000 unreached → unspent
  const sumW = 100n + 99n + 98n + 97n
  expect(a.wei).toBe((threshold * 4000n) / 10_000n + (placement * 100n) / sumW)
  expect(r.awards.find(x => x.playerId === 'b')!.wei).toBe((threshold * 2000n) / 10_000n / 2n + (placement * 99n) / sumW)
  expect(r.awards.find(x => x.playerId === 'c')!.rank).toBe(3) // tie broken by playerId
  expect(r.awards.find(x => x.playerId === 'd')!.tier).toBeNull()
  expect(r.unspentWei).toBe(pool - r.awards.reduce((n, x) => n + x.wei, 0n))
})
it('unreached tiers and empty ranks leave wei unspent', () => {
  const r = computePrizes(1_000_000n, [{ playerId: 'a', sp: 50 }])
  expect(r.awards).toEqual([{ playerId: 'a', wei: (300_000n * 100n) / 100n, tier: null, rank: 1 }])
  expect(r.unspentWei).toBe(700_000n)
})
it('ignores zero-SP players and an empty season', () => {
  expect(computePrizes(5n, [{ playerId: 'a', sp: 0 }])).toEqual({ awards: [], unspentWei: 5n })
  expect(prizePoolWei(10_001n)).toBe(3_000n)
})
it('ranks at most 100 players', () => {
  const many = Array.from({ length: 150 }, (_, i) => ({ playerId: `p${String(i).padStart(3, '0')}`, sp: 150 - i }))
  const r = computePrizes(10n ** 24n, many)
  expect(r.awards.filter(a => a.rank !== null)).toHaveLength(100)
})
```
(The "banned/ineligible excluded" case is the caller's job: the server passes only eligible standings — Task 3 tests it.)

- [ ] **Step 2: Run** `pnpm --filter @wyrmhaven/game-core exec vitest run test/prizes.test.ts` — Expected: FAIL, module not found.
- [ ] **Step 3: Implement `prizes.ts`** per the Interfaces block; export from `index.ts`.
- [ ] **Step 4: Run the test file, then** `pnpm --filter @wyrmhaven/game-core test` — Expected: all pass (173 + 4).
- [ ] **Step 5: Commit** `git add packages/game-core/src/prizes.ts packages/game-core/src/index.ts packages/game-core/test/prizes.test.ts && git commit -m "feat(game-core): season prize math"`

---

### Task 2: Vault inflow ledger

**Files:**
- Modify: `apps/server/src/db/schema.ts` (add `vaultInflows`, `seasons.closedAt`, `seasonPrizes`, `players.referrerId/ipHash/deviceHash`, `referralPayouts`, `telegramLinks`, `telegramNotices`) — one migration for the whole phase: `pnpm --filter @wyrmhaven/server db:generate` → `apps/server/drizzle/0002_live_layer.sql`
- Create: `apps/server/src/services/inflows.ts`
- Modify: `apps/server/src/services/ledger.ts` (`charge` records spend share), `apps/server/src/services/indexer.ts` (Deposited/Claimed fee shares), `apps/server/src/services/bans.ts` (forfeit)
- Test: `apps/server/test/inflows.test.ts`

**Interfaces:**
- Schema: `vault_inflows(id bigserial, season_id int fk, source text, wei numeric(78,0), ref text, created_at)`, unique `(source, ref)`. Sources: `'spend' | 'depositFee' | 'claimFee' | 'buyback' | 'forfeit'`.
- Produces:
  ```ts
  export type InflowSource = 'spend' | 'depositFee' | 'claimFee' | 'buyback' | 'forfeit'
  /** Idempotent on (source, ref). Resolves the season from `clock()`. Returns false when the ref was already recorded. */
  export async function recordInflow(tx: Tx, clock: Clock, source: InflowSource, wei: bigint, ref: string): Promise<boolean>
  export async function seasonInflows(db: Db | Tx, seasonId: number): Promise<{ totalWei: bigint; bySource: Record<InflowSource, bigint> }>
  ```
- Amounts (spec §13): spend → `wei / 2n` (the burned half is not an inflow), ref `spend:<playerId>:<actionNonce>` (charge gets a `ref` param replacing `_reason`); Deposited → `amount − credited − burned`, ref `<txHash>:<logIndex>`; Claimed → `gross − net − burned`, same ref form; forfeit → the forfeited wei from `banPlayer`, ref `ban:<playerId>:<bannedAtMs>`; buyback → admin-recorded (Task 6).

- [ ] **Step 1: Write failing tests** — `recordInflow` twice with one ref writes one row; `seasonInflows` sums by source; a store purchase through `POST /actions` records `spend` = half the charged wei; an indexed Deposited log (amount 100, credited 98, burned 1) records `depositFee` 1; a Claimed log (gross 100, net 95, burned 2.5 → use 1000/950/25) records `claimFee` 25; `banPlayer` with earned 7 records `forfeit` 7.
- [ ] **Step 2: Run** `pnpm --filter @wyrmhaven/server exec vitest run test/inflows.test.ts` — Expected: FAIL (no module / no table).
- [ ] **Step 3: Add schema + migration, implement `inflows.ts`, wire `charge`, indexer and `banPlayer`.** Referral deduction comes in Task 4 (spend share then = `wei/2n − referralWei`).
- [ ] **Step 4: Run the file, then** `pnpm --filter @wyrmhaven/server test` — Expected: all pass.
- [ ] **Step 5: Commit** `git add apps/server/src/db apps/server/drizzle apps/server/src/services/inflows.ts apps/server/src/services/ledger.ts apps/server/src/services/indexer.ts apps/server/src/services/bans.ts apps/server/test/inflows.test.ts && git commit -m "feat(server): vault inflow ledger"`

---

### Task 3: Season close job, leaderboard and prize routes

**Files:**
- Create: `apps/server/src/jobs/seasonClose.ts`, `apps/server/src/services/standings.ts`
- Modify: `apps/server/src/app.ts` (job `seasonClose`, replaces `season` in the registry; `DEFAULT_INTERVALS_MS.seasonClose = 60_000`), `apps/server/src/routes/season.ts`, `packages/shared/src/api.ts`
- Test: `apps/server/test/seasonClose.test.ts`, `apps/server/test/standings.test.ts`

**Interfaces:**
- Consumes: `computePrizes`, `prizePoolWei`, `seasonResetTrophies` (game-core); `seasonInflows`, `creditEarned`, `revealSecret`.
- Produces:
  ```ts
  /** Eligible = earning unlocked and not banned, sp > 0. */
  export async function standings(db: Db | Tx, seasonId: number, limit?: number): Promise<Standing[]>
  export async function playerRank(db: Db | Tx, seasonId: number, playerId: string): Promise<{ rank: number | null; sp: number }>
  /** Closes every ended, unclosed season in id order inside one transaction each (advisory lock 7302). Returns closed ids. */
  export async function closeSeasons(deps: { db: Db; clock: Clock }): Promise<number[]>
  ```
- Close steps (one `db.transaction`): lock; `seasons.closedAt IS NULL AND endsAt <= now` → for each: `pool = prizePoolWei(totalWei)`; `awards = computePrizes(pool, standings(tx, id))`; `creditEarned(tx, playerId, wei, 'prize:<seasonId>')` per award; insert `season_prizes(season_id, player_id, wei, tier, rank)`; `players.trophies = seasonResetTrophies(trophies)` and the same inside `state.trophies` (jsonb `jsonb_set`); set `revealed = true`, `closedAt = now`.
- Routes (no auth): `GET /season/:id/leaderboard` → `{ seasonId, poolWei: BigString, closed: boolean, top: { rank, playerId, address, sp }[] (≤100), me?: { rank, sp, prizeWei? } }` (`me` when a session header is present); `GET /season/:id/prizes/me` → `{ wei: BigString, tier, rank } | null` (session required). Add `LeaderboardResponse`, `PrizeResponse` to shared.

- [ ] **Step 1: Write failing tests**
  - `closeSeasons` on an ended season with inflows 1,000e18 and three eligible players credits `earnedWei` per `computePrizes(300e18, …)`, writes `season_prizes`, reveals the secret, halves trophies above 1,000 on both columns, and returns `[id]`.
  - "closing twice credits nothing the second time": second call returns `[]`, balances unchanged.
  - "banned and locked players are excluded": a banned player with 2,500 SP gets no row; an earning-locked player's SP is ignored.
  - A running season is not closed.
  - `GET /season/:id/leaderboard` orders by sp desc then playerId, hides banned players, returns `me.rank` for the caller.
- [ ] **Step 2: Run both files** — Expected: FAIL.
- [ ] **Step 3: Implement** `standings.ts`, `seasonClose.ts`, routes, shared types; register the job.
- [ ] **Step 4: Run the files, then the server suite and** `pnpm -r typecheck` — Expected: pass.
- [ ] **Step 5: Commit** `git add apps/server/src/jobs/seasonClose.ts apps/server/src/jobs/scheduler.ts apps/server/src/services/standings.ts apps/server/src/routes/season.ts apps/server/src/app.ts packages/shared/src/api.ts apps/server/test/seasonClose.test.ts apps/server/test/standings.test.ts && git commit -m "feat(server): season close with prizes, trophy reset and leaderboard"`

---

### Task 4: Referrals

**Files:**
- Create: `apps/server/src/services/referrals.ts`, `apps/server/src/routes/referral.ts`
- Modify: `apps/server/src/services/auth.ts` (store `ipHash`, `deviceHash` at sign-in), `apps/server/src/services/ledger.ts` (`charge` pays the referrer), `apps/server/src/app.ts`, `packages/shared/src/api.ts`
- Test: `apps/server/test/referrals.test.ts`

**Interfaces:**
- Schema (Task 2 migration): `players.referrer_id uuid null`, `players.ip_hash text null`, `players.device_hash text null`; `referral_payouts(id, referrer_id, referred_id, wei, ref unique, created_at)`.
- Hashes: `sha256(SESSION_SECRET ‖ value)` hex; IP from `req.ip` (trustProxy on), device from header `x-device-id` (the web client stores a random UUID in localStorage `wyrm.device` and sends it on every request). Missing header → `deviceHash = null` (never matches).
- Produces:
  ```ts
  export const REFERRAL_BPS = 500
  /** Code = first 8 hex chars of the player id without dashes; lookup is by prefix match, so a collision returns NOT_FOUND. */
  export function referralCode(playerId: string): string
  export async function claimReferral(tx: Tx, clock: Clock, playerId: string, code: string): Promise<void>
  // throws AppError 404 NOT_FOUND (no/ambiguous code), 409 REFERRAL_SELF, 409 REFERRAL_ALREADY_SET, 409 REFERRAL_AFTER_SPEND (balances.spentWei > 0), 403 REFERRAL_SAME_DEVICE (ip or device hash equal and non-null)
  /** Called by `charge`: credits floor(wei × 500 / 10000) to the referrer's earnedWei, records referral_payouts, returns the wei paid (0 without a referrer). */
  export async function payReferral(tx: Tx, clock: Clock, playerId: string, spendWei: bigint, ref: string): Promise<bigint>
  ```
- Routes (session + active): `GET /referral/me` → `{ code, referredCount, earnedWei: BigString, referrer: boolean }`; `POST /referral/claim { code }` → `{ ok: true }`. Shared: `ReferralMeResponse`, `ReferralClaimRequest`.
- `charge` ordering: `paid = payReferral(...)`; `recordInflow('spend', wei/2n − paid, ref)`.

- [ ] **Step 1: Write failing tests** — claim then spend 1,000 wei credits 50 to the referrer's `earnedWei` and records inflow `spend` 450; self-claim 409; second claim 409; claim after a spend 409; same `x-device-id` at both sign-ins → 403; same IP → 403 (use `inject` with `remoteAddress`); unknown code 404; `GET /referral/me` returns the code and counts.
- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Implement** service, routes, auth hashes, `charge` hook, shared types.
- [ ] **Step 4: Run the file, the server suite, typecheck** — Expected: pass.
- [ ] **Step 5: Commit** `git add apps/server/src/services/referrals.ts apps/server/src/routes/referral.ts apps/server/src/services/auth.ts apps/server/src/services/ledger.ts apps/server/src/app.ts packages/shared/src/api.ts apps/server/test/referrals.test.ts && git commit -m "feat(server): referrals with device and IP checks"`

---

### Task 5: Telegram notifier

**Files:**
- Create: `apps/server/src/telegram/client.ts` (`TelegramClient` + `createTelegramClient(token)` over `fetch` + `FakeTelegramClient`), `apps/server/src/services/telegram.ts`, `apps/server/src/routes/telegram.ts`, `apps/server/src/jobs/telegramNotify.ts`
- Modify: `apps/server/src/config.ts` (`TELEGRAM_BOT_TOKEN?`, `TELEGRAM_WEBHOOK_SECRET?`, `TELEGRAM_BOT_NAME?`), `apps/server/src/app.ts` (deps.telegram, routes and job only when the token is set), `packages/shared/src/api.ts`
- Test: `apps/server/test/telegram.test.ts`

**Interfaces:**
- Schema (Task 2 migration): `telegram_links(player_id pk, chat_id text unique, linked_at)`, `telegram_link_codes(code pk, player_id, expires_at)`, `telegram_notices(player_id, kind, ref, sent_at, primary key (player_id, kind, ref))`.
- Produces:
  ```ts
  export interface TelegramClient { sendMessage(chatId: string, text: string): Promise<void> }
  export async function createLinkCode(db: Db, clock: Clock, playerId: string): Promise<{ code: string; deepLink: string }> // 8 random base32 chars, 10 min TTL, link https://t.me/<TELEGRAM_BOT_NAME>?start=<code>
  export async function handleUpdate(db: Db, clock: Clock, tg: TelegramClient, update: unknown): Promise<void> // `/start <code>` links; `/stop` unlinks; anything else replies with help
  /** Due notices: eggs ready (`nest:<index>:<readyAtMs>`), habitat at its gold cap (`habitat:<id>:<lastCollectedMs>`). */
  export function dueNotices(state: PlayerState, catalog: Catalog, nowMs: number): { kind: 'eggReady' | 'habitatFull'; ref: string; text: string }[]
  export async function runTelegramNotify(deps: { db: Db; clock: Clock; tg: TelegramClient; catalog: Catalog }): Promise<{ sent: number; failed: number }>
  ```
- Notice texts (ours): `Your <species> egg is ready to hatch.` / `Your <element> habitat is full (<cap> gold). Collect it!`. A notice row is inserted only after a successful send; a failed send is logged and retried next run. Job interval 60 s; only players with a link row are scanned.
- Routes: `POST /telegram/link` (session) → `{ code, deepLink }`; `DELETE /telegram/link`; `GET /telegram/me` → `{ linked: boolean }`; `POST /telegram/webhook` requires header `x-telegram-bot-api-secret-token === TELEGRAM_WEBHOOK_SECRET`, else 401.

- [ ] **Step 1: Write failing tests** — `dueNotices` on a state with one ready egg and one capped habitat returns both with stable refs and nothing when neither is due; webhook with wrong secret → 401; `/start <code>` links the chat and a second `/start` with the same code (expired/used) replies with an error text; `runTelegramNotify` sends once, "a failed send is retried next run; a successful one is never repeated" (fake throws on first call).
- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Implement** client, service, routes, job, config.
- [ ] **Step 4: Run the file, suite, typecheck** — Expected: pass.
- [ ] **Step 5: Commit** `git add apps/server/src/telegram apps/server/src/services/telegram.ts apps/server/src/routes/telegram.ts apps/server/src/jobs/telegramNotify.ts apps/server/src/config.ts apps/server/src/app.ts packages/shared/src/api.ts apps/server/test/telegram.test.ts && git commit -m "feat(server): Telegram link and ready-egg / full-habitat notices"`

---

### Task 6: Admin API hardening and live-ops routes

**Files:**
- Modify: `apps/server/src/routes/admin.ts`, `apps/server/src/config.ts` (`ADMIN_TOKEN` min 32, `TRUST_PROXY` boolean default false), `apps/server/src/app.ts` (`trustProxy`)
- Test: `apps/server/test/admin-live.test.ts`

**Interfaces (all under `x-admin-token`, compared with `timingSafeEqual`):**
- `GET /admin/players/:id` → `{ player: { id, address, level, trophies, earningUnlocked, bannedAt, banReason, referrerId }, balance: { tokenWei, depositedWei, withdrawnWei, spentWei, earnedWei } as BigStrings, sp: { total, today }, telegramLinked }`
- `GET /admin/players?address=0x…` → same shape, 404 if unknown.
- `GET /admin/season/:id/summary` → `{ season: SeasonInfo, closedAt, inflows: bySource + totalWei, poolWei, standingsCount, prizesPaidWei }`
- `POST /admin/inflow { source: 'buyback', wei: BigString, ref }` → records via `recordInflow` (409 on a duplicate ref).
- `POST /admin/season/:id/close` → runs `closeSeasons` and returns the ids closed (409 `SEASON_ACTIVE` if not ended).
- `GET /admin/stats` → `{ players, earningUnlocked, banned, actions24h, openVouchers }`.
- Keep the existing ban/unban/price/reveal/jobs routes.

- [ ] **Step 1: Write failing tests** — wrong token 401 and a 31-char `ADMIN_TOKEN` is refused by `loadConfig`; player lookup by id and address; summary after a seeded inflow; duplicate buyback ref 409; close on an active season 409; stats counts.
- [ ] **Step 2: Run** — Expected: FAIL. (Existing tests use `ADMIN_TOKEN: 'admin-token'`: update `test/helpers/testApp.ts` to a 32+ char token in this task.)
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run the file, suite, typecheck** — Expected: pass.
- [ ] **Step 5: Commit** `git add apps/server/src/routes/admin.ts apps/server/src/config.ts apps/server/src/app.ts apps/server/test/admin-live.test.ts apps/server/test/helpers/testApp.ts && git commit -m "feat(server): live-ops admin routes, constant-time admin token"`

---

### Task 7: Web — season leaderboard, prizes, referral, Telegram

**Files:**
- Modify: `apps/web/src/api/client.ts` (`leaderboard(id)`, `prizeMe(id)`, `referralMe()`, `claimReferral(code)`, `telegramLink()`, `telegramUnlink()`, `telegramMe()`, send `x-device-id`), `apps/web/src/api/errors.ts` (copy for the new codes), `apps/web/src/panels/SeasonPanel.tsx`
- Create: `apps/web/src/api/device.ts` (`deviceId()` → localStorage `wyrm.device`), `apps/web/src/panels/ReferralPanel.tsx`, `apps/web/src/panels/TelegramPanel.tsx`
- Modify: `apps/web/src/panels/PanelHost.tsx`, `apps/web/src/App.tsx` (toolbar entries `Referral`, `Alerts`)
- Test: `apps/web/test/live.test.tsx`

**Behaviour:**
- Season panel: prize pool so far (`Tokens`), top 10 with the caller's row highlighted and `Your rank: #n` (or `Unranked`), "Last season: you won X WYRM" when `prizeMe(previous id)` is non-null; previous id = `season.id − 1` when > 0.
- Referral panel: your code with a copy button, `n referred · earned X WYRM`, and an input + `Claim code` button that is disabled once `referrer === true`; errors shown through the toast copy map (`REFERRAL_SELF: "You can't refer yourself"`, `REFERRAL_ALREADY_SET`, `REFERRAL_AFTER_SPEND: "Referral codes must be entered before your first purchase"`, `REFERRAL_SAME_DEVICE: "That code can't be used from this device or network"`).
- Alerts panel: when unlinked, `Link Telegram` opens `deepLink` in a new tab and polls `telegramMe` every 3 s for 2 minutes; when linked, `Unlink`. Hidden entirely when the server returns 404 for `/telegram/me` (bot not configured).

- [ ] **Step 1: Write failing tests** — leaderboard renders rank rows and the caller's rank; referral code shown and claim posts the code; claim error maps to the copy; Telegram panel shows Link/Unlink by `linked`; `x-device-id` header is on every request and stable across `createApi` calls.
- [ ] **Step 2: Run** `pnpm --filter @wyrmhaven/web exec vitest run test/live.test.tsx` — Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run the web suite, typecheck, `pnpm --filter @wyrmhaven/web build`** — Expected: pass.
- [ ] **Step 5: Commit** `git add apps/web/src apps/web/test/live.test.tsx && git commit -m "feat(web): leaderboard, prizes, referral and Telegram panels"`

---

### Task 8: Web — admin page

**Files:**
- Create: `apps/web/src/pages/Admin.tsx`, `apps/web/src/api/admin.ts` (`createAdminApi(baseUrl, token)` with the Task 6 routes)
- Modify: `apps/web/src/App.tsx` (render `<Admin />` instead of the game when `location.hash === '#/admin'`; the Verify page is state-driven, this is the first hash route)
- Test: `apps/web/test/admin.test.tsx`

**Behaviour:** token entered once (kept in `sessionStorage` `wyrm.admin`, never localStorage); tabs: Player lookup (by id or address → the summary, Ban/Unban with a reason field), Season (summary, `Close now` with a confirm, `Reveal`), Inflows (`Record buyback` form), Price (`Set price` micro-USD per token), Jobs (buttons for each registry name). Every mutation shows the response or the error code.

- [ ] **Step 1: Write failing tests** — no token → form only; player lookup renders balance fields; Ban requires a reason and posts; `Close now` posts after confirm.
- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run the web suite, typecheck, build** — Expected: pass.
- [ ] **Step 5: Commit** `git add apps/web/src apps/web/test/admin.test.tsx && git commit -m "feat(web): admin page"`

---

### Task 9: End-to-end season close and docs

**Files:**
- Modify: `apps/server/src/routes/e2e.ts` (`POST /e2e/clock { nowMs }` to move the server clock in E2E mode; `POST /e2e/inflow`), `apps/server/src/index.ts` (mutable clock in E2E), `apps/web/e2e/helpers.ts`
- Create: `apps/web/e2e/season.spec.ts`
- Modify: `apps/web/README.md`, `apps/server/README.md` (Telegram setup: BotFather token, `setWebhook` with the secret, env names), `docs/superpowers/reports/` entry comes from the executor's final report.

- [ ] **Step 1: Write the failing e2e** — grant SP via `/e2e/grant` (extend with `sp`), record an inflow, advance the clock 15 days, run `seasonClose` via `/admin/jobs/seasonClose/run`, reload: Season panel shows "Last season: you won … WYRM" and the leaderboard shows season 2.
- [ ] **Step 2: Run** `pnpm --filter @wyrmhaven/web test:e2e` — Expected: the new spec fails.
- [ ] **Step 3: Implement** the e2e routes and helpers; write the docs.
- [ ] **Step 4: Run e2e twice, `pnpm -r test`, `pnpm -r typecheck`** — Expected: all green.
- [ ] **Step 5: Commit** `git add apps/server/src/routes/e2e.ts apps/server/src/index.ts apps/web/e2e apps/web/README.md apps/server/README.md && git commit -m "test(e2e): season close flow; docs for Telegram and admin"`
