# Phase 6 — Live layer: what was built

Plan: `docs/superpowers/plans/2026-10-29-live-layer.md` (Task 5, Telegram, removed by you before execution).

## Built

- **Prize math** (`packages/game-core/src/prizes.ts`): pure bigint. 70% of the pool by SP tier (200/500/1,000/2,000 → 10/20/30/40%, highest tier only, equal shares), 30% to the top 100 weighted 101 − rank over all 100 ranks. Unreached tiers, empty ranks and rounding stay in the vault.
- **Vault inflow ledger** (`vault_inflows`): the vault's half of each spend (minus the referrer's 5%), the vault's share of deposit and claim fees from indexed events, forfeits on ban, and buybacks recorded by an admin. Idempotent per source and reference. The prize pool is 30% of the season total.
- **Season close job** (`seasonClose`, every 60 s, advisory-locked): 5 minutes after a season ends it credits prizes to in-game balances, records them, resets trophies above 1,000 to 1,000 + half the excess (both copies), reveals the season secret and stamps `closed_at`. Idempotent; also triggerable from the admin API.
- **Leaderboard**: `GET /season/:id/leaderboard` (top 100, prize pool so far, your rank when signed in) and `GET /season/:id/prizes/me`. Banned and earning-locked players are excluded from standings and prizes.
- **Referrals**: your code is the first 8 characters of your player id. A code can be entered once, before your first purchase, never for yourself, and never when any sign-in of the referrer shares an IP or device with any sign-in of yours (salted hashes in `sign_in_origins`). Referrers earn 5% of referred spend out of the vault's half; the overlap check runs again at each payout and banned referrers get nothing.
- **Admin API**: constant-time `x-admin-token` (min 32 chars), `TRUST_PROXY` flag; player lookup by id or address with balance/SP/ban, season summary (inflows by source, pool, prizes paid), record buyback, close season, stats, plus the existing ban/unban/price/reveal/jobs.
- **Web**: Season panel shows the leaderboard (top 10, your row highlighted, your rank), the prize pool so far and last season's prize; a Referral panel with copy-to-clipboard and claim; an operator console at `#/admin` (token in sessionStorage only) with Player, Season, Inflows, Price and Jobs tabs. Every request carries a per-browser `x-device-id`.
- **Tests**: game-core 177, server 108, web 93, Playwright 6 (new: a season closes end-to-end with the prize landing in the balance). `POST /e2e/clock` moves the server clock in E2E mode only.

## Review pass (fresh reviewer, one fix pass)

Fixed with tests that failed first: a season could close before an action that started in it committed (now a 5-minute grace); referral checks ran only at claim time against the latest sign-in (now full origin history, re-checked at every payout); banned referrers were still paid.

Rulings I made:
- **Placement pot with fewer than 100 players**: weights always sum over all 100 ranks, so a small season does not let one account take the whole 30% pot. Cost if wrong: small seasons pay out less than they could.
- **Earning-locked referrers are still paid** referral earnings (the spec gates only sell-back, SP and prizes on entry). Cost if wrong: locked accounts accrue tokens they can only use after entering.
- (From planning) unreached tiers stay in the vault; codes must be entered before the first purchase.

Deferred minors (not fixed): equal-SP ties are broken by player id (say so in the UI); deposit/claim fees for wallets that never signed in are recorded late or never; on first deploy every already-ended season closes in one burst (backfill `closed_at` first); `POST /admin/inflow` accepts any source; `POST /admin/season/:id/close` closes every ended season and hides a busy lock; admin UI hides Close/Reveal replies and doesn't reload after Ban/Unban; Season/Referral panels show nothing on a query error and duplicate an aria-label; the public leaderboard recomputes standings twice per request with no cache; referral code lookup is a table scan with untested collisions; `players.referrer_id` has no foreign key.

## Next

Phase 7 (launch): closed testnet beta → audit → legal review → mainnet token + pool → open. Before the beta: deploy Phase 3 contracts to testnet 46630, set the server env (`VAULT_ADDRESS`, `SIGNER_PRIVATE_KEY`, `INDEXER_START_BLOCK`, `TRUST_PROXY`), the web env (`VITE_VAULT_ADDRESS`, `VITE_TOKEN_ADDRESS`, `VITE_REOWN_PROJECT_ID`), run the migrations on a real Postgres, and work through the pre-launch minors listed in the Phase 4 and 6 reports.
