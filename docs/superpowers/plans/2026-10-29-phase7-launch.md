# Phase 7 — Launch (testnet beta, audit and legal prep) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Take Dragon Island from "runs on one PC" to a closed beta on Robinhood Chain testnet (chain 46630), with the code backed up, tested in CI on real Postgres, hosted, monitored, and with the audit and legal review ready to start.

**Architecture:** Three tracks run side by side. Track O is owner work only shiko can do (wallets, Safe, accounts, payments). Track C is code: small server changes the beta needs (admin tightening, season backfill, housekeeping, beta allowlist, monitoring, geo/terms gate) plus a VPS deploy bundle and CI. Track G is gated steps that touch a chain or real people (testnet deploy, beta invites), each needing shiko's explicit go. Mainnet is **not** in this plan: it gets its own plan once the audit report and the lawyer's answers are in, because both can change the contracts and the product.

**Tech Stack:** existing monorepo (pnpm 12, TypeScript, Vitest, Fastify 5, Drizzle on PGlite/pg, Vite + React + Phaser, Foundry), GitHub Actions, Docker Compose + Caddy on shiko's VPS, Postgres 16, Cloudflare (DNS/TLS, `CF-IPCountry`), Cloudflare R2 or Backblaze B2 for backups, Sentry (free tier), a Discord webhook for alerts.

**Spec:** `docs/superpowers/specs/2026-10-28-wyrmhaven-design.md` (§13 token/vault, §21 phase 7, §22 launch requirements), `docs/superpowers/specs/2026-10-29-base-building-design.md`, `contracts/README.md` (deploy steps, roles, security), `apps/web/README.md` (testnet checklist), `/mnt/project-files/launch/wyrmhaven-launch-checklist.md`, Phase 4 and Phase 6 reports (deferred minors).

## Global Constraints

- Testnet only: chain ID **46630**. `config.ts` refuses any other chain; keep it that way. Mainnet needs shiko's explicit word and a separate plan.
- **Never deploy, broadcast a transaction, or invite real players without shiko's explicit go in the thread.** The deployer key and the Safe are shiko's; Claude never holds or types a private key.
- Never commit `.env`, keys, keystores, admin tokens, or webhook URLs. Secrets live in GitHub Actions secrets and the VPS `.env` only.
- `packages/game-core` stays pure (no I/O, no `Date.now()`, no `Math.random()`).
- Currency amounts are integers (wei as bigint, USD in micro-dollars).
- Other threads commit to `main` in the same working tree: **stage by explicit path, never `git add -A` or `git add .`**.
- Track C tasks that add a SQL migration (Tasks 4, 5, 8) start only after the base-building build has landed on `main`, so migration numbers don't collide. Tasks 1, 2, 3, 6, 7 touch files base building does not, and may start now.
- Copy for players never promises earnings, returns or airdrops (same rule as the waitlist).
- TDD, one commit per task (conventional commits), `forge test` + `forge fmt --check` for any Solidity change (none planned).

## Rulings to confirm before execution

These were left open by Phase 6. The plan assumes the first option of each; Task 9 applies any change.

- **R1. Empty top-100 ranks.** The 30% placement pot is weighted over all 100 ranks; shares for ranks nobody holds stay in the vault. *(Alternative: renormalise over filled ranks, so a 20-player season pays out the whole 30% to those 20.)* Recommend keep: a tiny season can't hand a few accounts the whole pot.
- **R2. Earning-locked referrers.** Referrers who haven't paid the entry fee still accrue their 5% referral earnings (they can only use them after entering). *(Alternative: no referral earnings until entered.)* Recommend keep: spec gates only sell-back, SP and prizes on entry.
- **R3. PvE seeds.** PvE battle seeds stay secret; moves the client plan doesn't cover are filled by the server AI. *(Alternative: reveal PvE seeds up front like PvP offers.)* Recommend keep: PvE first clears pay gold and SP, and a revealed seed lets a script search for a guaranteed win.

## Decisions for shiko (recommended option first)

- **D1. Beta size and length:** up to 100 invited waitlist players for 3 weeks, covering one full 14-day season and its close. 
- **D2. Hosting for the beta:** your VPS with Docker Compose and self-hosted Postgres, nightly encrypted backups to R2. Move to managed Postgres before mainnet.
- **D3. Audit route:** a reputable solo auditor or small firm for ~200 nSLOC of Solidity (rough $5–15k), after our own Slither/Aderyn pass. Contest platforms cost more for little extra at this size.

## Review Focus

1. **A database with old unclosed seasons** (beta DB, restored backup): the close job must not pay a burst of past seasons on first boot. Task 3 test `backfill marks ended seasons closed without prizes` and the runbook step in Task 7.
2. **Allowlisted addresses in mixed case** (CSV exports are often lowercase, wallets sign checksummed): sign-in must match case-insensitively. Task 5 test `allowlist matches addresses regardless of case`.
3. **Concurrent actions on real Postgres** (two tabs, double-click): PGlite has one connection, so lock-order bugs only show in CI. Task 1 runs the whole server suite on Postgres 16.
4. **Server signer differs from `vault.signer()`** after a key rotation: every voucher would fail on-chain. Task 6 test `alerts when the configured signer is not the vault signer`.
5. **A backup that won't restore**: Task 7's restore drill restores the latest dump into a scratch database and runs `select count(*) from players`.

---

## Track O — owner prep (shiko, start now)

Each item lists what to do and what to send back in the thread. Claude can walk you through any of them.

- [ ] **O1. Verify chain values** at docs.robinhood.com/chain: testnet RPC, explorer URL, faucet, and whether Safe is deployed on 46630 (app.safe.global network list). Send back the four values or a screenshot. Claude then updates `docs/reference/02-robinhood-chain.md`, `contracts/.env.example`, `apps/server/.env.example`, the waitlist RPC setting, and the Blockscout verifier URL in `contracts/README.md`.
- [ ] **O2. Password manager + hardware wallets:** Bitwarden (or similar) for every key and token; two hardware wallets (Ledger/Trezor) for Safe signers. Rotate the PixelLab key that was pasted in chat.
- [ ] **O3. Testnet 2-of-3 Safe:** three signer addresses (ideally 2 hardware + 1 held by a trusted second person; never all three on one PC). Create the Safe on chain 46630. Send back the Safe address only.
- [ ] **O4. Testnet role addresses and deployer:** create fresh testnet-only EOAs for DEPLOYER, OPERATOR, SIGNER, TREASURY, LAUNCH_RECIPIENT (TREASURY and LAUNCH_RECIPIENT may be the Safe). Import the deployer into Foundry in WSL: `~/.foundry/bin/cast wallet import deployer --interactive`. Fund DEPLOYER and OPERATOR from the faucet. Send back the **public** addresses only.
- [ ] **O5. Name checks:** search "Dragon Island" in USPTO TESS, EUIPO eSearch and WIPO Global Brand Database (classes 9 and 41), the app stores and Steam; confirm the domain and X handle you'll use. Claude can do a first web pass and hand you the list; a trademark lawyer confirms before mainnet.
- [ ] **O6. Private GitHub repo:** create an empty **private** repo (e.g. `shikoyud/dragon-island`) on github.com, then tell Claude. Claude attaches it and Task 1 pushes `main`.
- [ ] **O7. Accounts:** Reown project ID (cloud.reown.com), an RPC provider that lists Robinhood Chain (Alchemy free tier), Cloudflare on the domain, `hello@` and `security@` mailboxes, a Sentry org (two projects: server, web), a Discord server with a private `#alerts` channel webhook, an R2 bucket with an access key. Put each secret in the password manager; send Claude only the non-secret IDs.
- [ ] **O8. VPS facts:** OS and version, RAM/disk, whether Docker is installed, the subdomains you want (suggest `play.` for the game, `www.`/apex for the waitlist). Give Claude SSH only through a Remote Control session on your PC if you want it to run the deploy; otherwise you run the commands in Task 7's runbook.
- [ ] **O9. Budget answers for D3** and a shortlist call with 2–3 auditors once Task 10's scope doc exists.

## Track C — code

### Task 1: Push to GitHub, real-Postgres test mode, CI

**Files:**
- Modify: `apps/server/test/helpers/testDb.ts`
- Modify: `apps/server/vitest.config.ts` (create if absent)
- Create: `.github/workflows/ci.yml`
- Modify: `CLAUDE.md` (Commands: how to run the server suite on Postgres; fix the `DrisToken`/`DrisVault` layout line to Dris names)

**Interfaces:**
- Produces: env `TEST_DATABASE_URL`; when set, `testDb()` uses `createPgDb(url)` + `migrate` once per file and the same truncate-all wipe. Vitest `fileParallelism` is `false` when it is set (one shared database).

- [ ] **Step 1:** After O6, add the repo as `origin` and `git push -u origin main`. Confirm on GitHub that no `.env`, `.pglite`, `contracts/lib` or keystore files are in the tree (`git ls-files | grep -Ei '\.env$|pglite|keystore'` prints nothing).
- [ ] **Step 2:** Implement the `TEST_DATABASE_URL` branch in `testDb.ts` and the `fileParallelism` switch.
- [ ] **Step 3:** Write `ci.yml`, triggered on push and pull_request to `main`, four jobs:
  - `ts`: `pnpm/action-setup` (reads `packageManager`), Node 22, `pnpm install --frozen-lockfile`, `pnpm -r typecheck`, `pnpm -r test`.
  - `server-postgres`: `postgres:16` service, `TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/test`, `pnpm --filter @wyrmhaven/server test`.
  - `contracts`: `foundry-rs/foundry-toolchain`, the two pinned `forge install … --no-git` lines from `contracts/README.md`, `forge fmt --check`, `forge test -vv`.
  - `e2e`: `pnpm exec playwright install --with-deps chromium`, `pnpm --filter @wyrmhaven/web test:e2e`.
- [ ] **Step 4:** Push; all four jobs green. Any `server-postgres` failure is a real concurrency bug (Review Focus 3): fix it with superpowers:systematic-debugging, failing test first, one commit per bug.
- [ ] **Step 5:** In GitHub settings, protect `main`: require the four checks (shiko clicks, Claude gives the link).
- [ ] **Step 6: Commit**
```bash
git add .github/workflows/ci.yml apps/server/test/helpers/testDb.ts apps/server/vitest.config.ts CLAUDE.md
git commit -m "ci: run typecheck, tests, server on Postgres 16, forge and e2e on every push"
```

### Task 2: Tighten the two admin routes

**Files:**
- Modify: `apps/server/src/routes/admin.ts:24,98-113`
- Modify: `apps/server/src/jobs/seasonClose.ts`
- Modify: `apps/server/src/index.ts` (scheduler caller) and any other `closeSeasons` caller
- Modify: `apps/web/src/pages/Admin.tsx` (show the close/reveal reply; reload after ban/unban, both Phase 6 minors)
- Test: `apps/server/test/admin-live.test.ts`, `apps/server/test/seasonClose.test.ts`

**Interfaces:**
- Produces: `closeSeasons(deps: { db: Db; clock: Clock }, opts?: { seasonId?: number }): Promise<{ closed: number[]; busy: boolean }>`. With `seasonId`, closes only that season (if ended past the grace and unclosed). `busy` is true when the advisory lock was held by someone else.

- [ ] **Step 1: Write the failing tests**
```ts
it('POST /admin/inflow accepts only buyback', async () => {
  const r = await t.app.inject({ method: 'POST', url: '/admin/inflow', headers: admin, payload: { source: 'spend', wei: '1', ref: 'x' } })
  expect(r.statusCode).toBe(400)
  expect((await t.app.inject({ method: 'POST', url: '/admin/inflow', headers: admin, payload: { source: 'buyback', wei: '1', ref: 'b1' } })).statusCode).toBe(200)
})
it('POST /admin/season/:id/close closes only that season', async () => {
  // seasons 1 and 2 both ended past the grace; close 2
  expect((await close(2)).json()).toEqual({ closed: [2] })
  expect(await closedAt(1)).toBeNull()
})
it('close returns 409 SEASON_BUSY while another close holds the lock', /* hold pg_advisory_lock(7302) on a second connection, or stub closeSeasons to return busy */)
it('close of an already closed season returns 409 ALREADY_CLOSED')
it('scheduler path still closes every ended season in order', /* closeSeasons(deps) → { closed: [1, 2], busy: false } */)
```
- [ ] **Step 2:** Run `pnpm --filter @wyrmhaven/server test -- admin-live seasonClose`; expect the new tests to fail.
- [ ] **Step 3:** Change `inflowBody.source` to `z.literal('buyback')`; add the `opts.seasonId` filter and `busy` result to `closeSeasons`; map `busy` → `AppError(409, 'SEASON_BUSY')`, closed already → `AppError(409, 'ALREADY_CLOSED')`. Admin UI: render the JSON reply under the Close/Reveal buttons and refetch the player after Ban/Unban.
- [ ] **Step 4:** Server and web tests pass; `pnpm -r typecheck` clean.
- [ ] **Step 5: Commit** (paths above) `fix(server): admin inflow is buyback-only; season close targets one season and reports a busy lock`

### Task 3: Season backfill command

**Files:**
- Create: `apps/server/src/services/seasonBackfill.ts`
- Create: `apps/server/src/scripts/backfillSeasons.ts`
- Modify: `apps/server/package.json` (script `season:backfill`)
- Test: `apps/server/test/seasonBackfill.test.ts`

**Interfaces:**
- Produces: `backfillClosedSeasons(db: Db, clock: Clock, opts: { endedBeforeMs: number; dryRun: boolean }): Promise<{ seasonIds: number[] }>`: stamps `closed_at = now` and `revealed = true` on every season with `closed_at is null and ends_at <= endedBeforeMs`; pays no prizes, touches no trophies, writes nothing when `dryRun`.
- CLI: `pnpm --filter @wyrmhaven/server season:backfill -- --ended-before 2026-11-01T00:00:00Z [--apply]` (dry run unless `--apply`), reads `DATABASE_URL`, prints the ids.

- [ ] **Step 1: Failing tests:** `backfill marks ended seasons closed without prizes` (two ended seasons with inflows and SP → both `closedAt` set, `revealed` true, zero `season_prizes` rows, trophies unchanged); `backfill leaves the current season and later-ending seasons open`; `dry run changes nothing`; `closeSeasons after backfill closes nothing`.
- [ ] **Step 2:** Run; fail.
- [ ] **Step 3:** Implement service and CLI (one transaction, under the same advisory lock id `7_302` as `closeSeasons`).
- [ ] **Step 4:** Tests pass.
- [ ] **Step 5: Commit** `feat(server): season backfill command for databases with old unclosed seasons`

### Task 4: Housekeeping job and balance check *(after base building lands)*

**Files:**
- Create: `apps/server/src/jobs/prune.ts`
- Modify: `apps/server/src/jobs/scheduler.ts` (`prune: 60 * 60_000`), `apps/server/src/index.ts`
- Modify: `apps/server/src/db/schema.ts` (`check('balances_token_wei_nonneg', sql\`token_wei >= 0\`)`), generate the next migration with `pnpm --filter @wyrmhaven/server db:generate`
- Test: `apps/server/test/prune.test.ts`, `apps/server/test/db.test.ts`

**Interfaces:**
- Produces: `prune(deps: { db: Db; clock: Clock }): Promise<{ nonces: number; rateLimits: number; offers: number }>` deleting `siwe_nonces` with `expires_at < now`, `rate_limits` with `window_start < now − 1 day`, `battle_offers` with `expires_at < now − 7 days` (used or not; resolved battles keep their seed in the action log).

- [ ] **Step 1: Failing tests:** each table keeps fresh rows and loses old ones by the thresholds above; `updating token_wei below zero throws` (constraint).
- [ ] **Step 2:** Run; fail. **Step 3:** Implement and generate the migration. **Step 4:** Pass locally and in CI on Postgres.
- [ ] **Step 5: Commit** `chore(server): hourly prune of nonces, rate limits and old offers; non-negative token balance check`

### Task 5: Closed-beta allowlist *(after base building lands)*

**Files:**
- Modify: `apps/server/src/db/schema.ts` (`beta_allowlist`: `address text primary key` stored lowercase, `added_at timestamptz not null default now()`), new migration
- Modify: `apps/server/src/config.ts` (`BETA_CLOSED: z.enum(['true','false']).default('false')`)
- Modify: `apps/server/src/services/auth.ts` (`verifyAndLogin`: after signature checks, if `BETA_CLOSED` and the lowercase address is not listed, `throw new AppError(403, 'BETA_CLOSED')`; nonce still consumed)
- Modify: `apps/server/src/routes/admin.ts` (`POST /admin/beta/allow` `{ addresses: string[] }` max 500, returns `{ added: number }`; `GET /admin/beta` returns count)
- Modify: `apps/web/src/api` error copy: `BETA_CLOSED` → "Dragon Island is in a closed beta right now. Join the waitlist to get an invite."; Admin page Beta tab with a textarea paste (one address per line, accepts the waitlist CSV `wallet` column)
- Test: `apps/server/test/beta.test.ts`, web test for the error copy

- [ ] **Step 1: Failing tests:** `closed beta refuses unlisted wallets with 403 BETA_CLOSED`; `allowlist matches addresses regardless of case`; `open beta (BETA_CLOSED=false) lets anyone in`; `admin allow is idempotent and rejects malformed addresses with 400`; existing sessions keep working after an address is added.
- [ ] **Step 2–4:** fail, implement, pass. **Step 5: Commit** `feat: closed-beta allowlist for sign-in with an admin paste box`

### Task 6: Monitoring and alerts

**Files:**
- Create: `apps/server/src/jobs/chainWatch.ts`, `apps/server/src/services/alerts.ts`
- Modify: `apps/server/src/app.ts` (`/health` runs `select 1`; 503 `{ ok: false }` on failure), `apps/server/src/config.ts` (`ALERT_WEBHOOK_URL` optional URL, `SENTRY_DSN` optional), `apps/server/src/index.ts` (Sentry init when DSN set; schedule `chainWatch` every 5 min only when `VAULT_ADDRESS` is set)
- Modify: `apps/web/src/main.tsx` (Sentry init when `VITE_SENTRY_DSN` set)
- Modify: `apps/server/src/chain/abi.ts` / `fake.ts` if `paused()`, `signer()` reads are missing
- Test: `apps/server/test/chainWatch.test.ts`, `apps/server/test/smoke.test.ts` (health)

**Interfaces:**
- Produces: `sendAlert(cfg: Pick<Config,'ALERT_WEBHOOK_URL'>, fetchFn: typeof fetch, text: string): Promise<void>` (Discord webhook `{ content }`, no-op without URL, never throws). `chainWatch(deps: { db: Db; clock: Clock; chain: ChainClient; config: Config; alert: (text: string) => Promise<void> }): Promise<string[]>` returning the alert texts it sent.
- Alert rules (each fires once per state change, state kept in memory): vault `paused()` flips; `vault.signer()` ≠ address of `SIGNER_PRIVATE_KEY`; vault token balance fell more than 2.5% in 24 h (design cap is 2%); indexer's last processed block older than 10 min.

- [ ] **Step 1: Failing tests** (fake chain): `alerts when the vault pauses and again when it unpauses`; `alerts when the configured signer is not the vault signer`; `alerts on a balance drop above 2.5% in 24 hours`; `alerts on indexer lag over 10 minutes`; `does not repeat an alert while the condition holds`; `health returns 503 when the database is down`.
- [ ] **Step 2–4:** fail, implement, pass.
- [ ] **Step 5: Commit** `feat(server): health check hits the database; chain watch alerts to a webhook; optional Sentry`

### Task 7: VPS deploy bundle and runbook

**Files:**
- Create: `apps/server/Dockerfile` (multi-stage: pnpm install with `--filter @wyrmhaven/server...`, run `tsx src/index.ts` as non-root user)
- Create: `apps/server/src/scripts/migrate.ts` + script `db:migrate` in `apps/server/package.json` (runs `migrate(createPgDb(DATABASE_URL).db)`)
- Create: `deploy/docker-compose.yml` (services: `postgres:16` with a named volume and no published port; `server` with `env_file: .env.server`; `caddy:2` serving `apps/web/dist` and proxying `/api/*` to `server:3000` with the prefix stripped, same as `vite.config.ts`; optional `waitlist` service)
- Create: `deploy/Caddyfile`, `deploy/.env.server.example` (every key from `apps/server/.env.example` plus `DATABASE_URL`, `TRUST_PROXY=true`, `BETA_CLOSED=true`, `ALERT_WEBHOOK_URL`, `SENTRY_DSN`)
- Create: `deploy/backup.sh` (`pg_dump -Fc` → `age`-encrypted → `rclone copy` to R2; keep 14 daily, 8 weekly), `deploy/restore-drill.sh`
- Create: `deploy/README.md` (runbook)
- Modify: `.github/workflows/ci.yml` (job `deploy-bundle`: `docker compose -f deploy/docker-compose.yml config` and `docker build -f apps/server/Dockerfile .`; `shellcheck deploy/*.sh`)

- [ ] **Step 1:** Write the Dockerfile and `db:migrate`; CI job builds the image (the failing check first: add the CI job, push, see it fail on the missing Dockerfile).
- [ ] **Step 2:** Compose, Caddyfile, env example; `docker compose config` passes in CI.
- [ ] **Step 3:** `backup.sh` and `restore-drill.sh`; `restore-drill.sh` restores the newest dump into a scratch database and prints `select count(*) from players` (Review Focus 5); shellcheck clean.
- [ ] **Step 4:** `deploy/README.md` runbook, in order: install Docker; Cloudflare DNS for `play.` (proxied) with Caddy getting TLS; copy `.env.server`; `docker compose up -d postgres`; `docker compose run --rm server pnpm db:migrate`; **`season:backfill --ended-before <now> --apply` on any restored or reused database** (Review Focus 1); `docker compose up -d`; cron `backup.sh` nightly and `restore-drill.sh` weekly; UptimeRobot on `https://play.<domain>/api/health`; how to pause the vault (operator `pause()` via `cast`, Safe unpauses); who to call.
- [ ] **Step 5: Commit** `feat(deploy): docker compose bundle, migrations command, encrypted backups and restore drill`

### Task 8: Geo-block and terms acceptance *(after base building lands; country list comes from the lawyer, mechanism ships off)*

**Files:**
- Modify: `apps/server/src/config.ts` (`BLOCKED_COUNTRIES` comma list of ISO codes, default empty; `TERMS_VERSION` string, default `''` = not required)
- Create: `apps/server/src/plugins/geo.ts` (with `TRUST_PROXY` on, reads `cf-ipcountry`; blocked → 451 `REGION_BLOCKED` on `/auth/*`, `/actions`, `/withdraw*`; `/health` and `/admin/*` never blocked)
- Modify: `players` schema (`terms_version text`), new migration; `POST /auth/verify` accepts `termsVersion`; if `TERMS_VERSION` is set and the player's stored version differs, actions return 428 `TERMS_REQUIRED` until `POST /me/terms { version }`
- Modify: web: a one-screen terms prompt (links to Terms, Privacy, Risk pages) shown on `TERMS_REQUIRED`; error copy for `REGION_BLOCKED`
- Test: `apps/server/test/geo.test.ts`, `apps/server/test/terms.test.ts`, web test

- [ ] **Step 1: Failing tests:** `blocked country gets 451 on sign-in and actions`; `header ignored when TRUST_PROXY is off`; `health and admin are never geo-blocked`; `actions need the current terms version when one is set`; `accepting terms unblocks actions`.
- [ ] **Step 2–4:** fail, implement, pass. **Step 5: Commit** `feat: country block list and versioned terms acceptance, both off by default`

### Task 9: Apply rulings R1–R3 *(only if shiko changes one)*

- R1 changed → `packages/game-core/src/prizes.ts`: weights over filled ranks only; update `prizes` tests' expected awards (game-core, then server `seasonClose` test).
- R2 changed → `apps/server/src/services/referrals.ts`: skip payout when the referrer's `earning_unlocked` is false; test `locked referrer earns nothing`.
- R3 changed → `apps/server/src/services/actions.ts` PvE branch: issue a PvE offer with a revealed seed like PvP (`battle_offers` row with `kind = 'pve'`), and drop the AI fill for PvE in `packages/game-core/src/battle/sim.ts:60`; tests mirror the PvP offer tests.
- Commit each as its own `feat:`/`fix:`.

## Track G — gated steps (each needs shiko's go)

### Task 10: Audit prep (no chain access; may start any time)

**Files:** Create `docs/audit/scope.md`, `docs/audit/self-review.md`.

- [ ] **Step 1:** Run in WSL: `slither contracts/` and `aderyn contracts/` (install with `pipx install slither-analyzer`, `cargo install aderyn` or the release binary). Triage every finding in `self-review.md` as fixed / false positive / accepted, with reasons. Any fix is a separate task with `forge test` + `forge fmt --check`.
- [ ] **Step 2:** `scope.md`: commit hash, files and nSLOC (`DrisToken`, `DrisVault`, `DrisDeployer`, `script/Deploy.s.sol`), roles table, invariants already fuzzed, known design choices (no emergency exit on the 400M vault seed by design; 2%/day payout cap; signer/operator compromise bounds), out of scope (server, game).
- [ ] **Step 3:** Tag `contracts-audit-v1` once shiko picks an auditor (D3); no contract change after the tag except audit fixes.
- [ ] **Step 4: Commit** `docs(audit): scope and static-analysis self-review`

### Task 11: Legal pack (drafts for the lawyer, not legal advice)

**Files:** Create `docs/legal/questions-for-counsel.md`, `docs/legal/terms-draft.md`, `docs/legal/privacy-draft.md`, `docs/legal/risk-disclosure-draft.md`, `docs/legal/token-disclosures.md`.

- [ ] Questions cover spec §22: is $DRIS or its sale a security, and where; paid odds boosts plus cash-out vs gambling and loot-box laws; KYC/sanctions screening on withdrawals; tax reporting; age gating; which countries to block (feeds `BLOCKED_COUNTRIES`); waitlist data (X handle + wallet) under GDPR; whether the beta needs Terms already (yes, recommended).
- [ ] Token disclosures: supply 1B, 50/40/10 split, 12-month team vesting, the 400M vault seed with no emergency exit, Safe signers (roles, not names), fees, payout cap, that rewards are not guaranteed.
- [ ] Commit `docs(legal): counsel questions and draft player-facing pages`. Shiko sends the pack to a lawyer; answers feed the mainnet plan.

### Task 12: Testnet deploy *(needs: base building merged on main and green in CI, O1, O3, O4, Tasks 1–7 done, shiko's go)*

- [ ] **Step 1:** Rerun `forge test -vv` and `forge fmt --check` in WSL on the commit being deployed (also clears the rename thread's open item).
- [ ] **Step 2:** Dry run on anvil per `contracts/README.md` step 3; note the three addresses.
- [ ] **Step 3: Shiko's go,** then shiko runs step 4 from `contracts/README.md` with `--account deployer` (Claude never handles the key). Save the broadcast JSON path.
- [ ] **Step 4:** Safe signers call `vault.acceptOwnership()`; confirm `owner()` is the Safe on the explorer. **No server key goes live before this.**
- [ ] **Step 5:** Record token, vault, vesting and Safe addresses in `docs/reference/02-robinhood-chain.md` (with Dris names) and confirm verification on the official explorer. Commit `docs: testnet 46630 deployment addresses`.
- [ ] **Step 6:** Fill `deploy/.env.server` (`VAULT_ADDRESS`, `TOKEN_ADDRESS`, `SIGNER_PRIVATE_KEY`, `OPERATOR_PRIVATE_KEY`, `INDEXER_START_BLOCK` = deploy block, RPC provider URL) and the web build env (`VITE_VAULT_ADDRESS`, `VITE_TOKEN_ADDRESS`, `VITE_REOWN_PROJECT_ID`, `VITE_SENTRY_DSN`); bring the stack up per the Task 7 runbook; set the price via `POST /admin/price`.
- [ ] **Step 7: Smoke test** on `https://play.<domain>` with two test wallets: sign in, pay entry, breed, battle, deposit, withdraw (voucher claims on-chain), admin console works, chain watch silent, a forced alert (pause then unpause from the operator) reaches Discord.

### Task 13: Closed beta *(needs Task 12 and shiko's go on the invite list)*

- [ ] Export the waitlist CSV, pick up to D1's number, paste into Admin → Beta. Invite through the channel shiko chooses (Discord invite + X DM); the message says testnet tokens have no value.
- [ ] Feedback: Discord `#beta-bugs` and `#beta-feedback`; Claude triages daily into `docs/beta/triage.md` (bug / balance / UX, severity).
- [ ] Watch: one full season close lands correctly (prizes credited, trophies reset, secret revealed, Verify page re-checks it), backups and restore drill run, no unexplained alerts.
- [ ] **Exit criteria** for moving to mainnet planning: no open critical bugs; one season closed and verified; restore drill passed at least twice; audit booked; lawyer engaged. Then Claude writes the mainnet plan (mainnet Safe with hardware signers, mainnet deploy, Uniswap v4 pool and the 30-minute TWAP price source, geo/terms switched on, open launch).
