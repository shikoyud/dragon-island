# Dragon Island server

Authoritative game server: Fastify + PostgreSQL (Drizzle). Game rules live entirely in `@wyrmhaven/game-core`; the server adds wallet sign-in, locking, idempotency, provably-fair seeds, Season Points, matchmaking, the token ledger, chain indexing, withdrawal vouchers, bans and jobs.

## Run

```bash
cp .env.example .env            # fill in SESSION_SECRET, ADMIN_TOKEN, and the chain values once deployed
pnpm --filter @wyrmhaven/server dev
```

Without `DATABASE_URL` the server runs on a file-backed PGlite (Postgres in WASM) under `PGLITE_DIR`; set `DATABASE_URL` for a real Postgres. Migrations in `drizzle/` apply on start. Tests: `pnpm --filter @wyrmhaven/server test` (in-memory PGlite, no database to install). After changing `src/db/schema.ts`: `pnpm --filter @wyrmhaven/server db:generate`. After rebuilding the contracts: `pnpm --filter @wyrmhaven/server exec tsx scripts/sync-abi.ts`.

## Routes

| Route | Auth | Purpose |
|---|---|---|
| `GET /health` | – | liveness |
| `GET /auth/nonce`, `POST /auth/verify`, `POST /auth/logout` | – / bearer | SIWE sign-in (chain 46630), opaque bearer sessions |
| `GET /me` | bearer | player state, token balance, season info, `termsRequired` (version to accept, or null) |
| `POST /me/terms { version }` | bearer | accept the current `TERMS_VERSION` (400 `TERMS_VERSION_MISMATCH` otherwise); `POST /auth/verify` also takes an optional `termsVersion` |
| `POST /actions` `{ action, idempotencyKey }` | bearer | runs one game-core action under the player row lock |
| `GET /sp` | bearer | season points: total, today, cap |
| `GET /pvp/offers` | bearer | three opponents (players with a defence team, bots to fill) with revealed battle seeds; a new call retires the previous unused set |
| `POST /withdraw` `{ grossWei }`, `GET /withdraw/pending` | bearer | EIP-712 claim voucher, one open at a time |
| `GET /season`, `GET /season/:id`, `GET /season/:id/actions?playerId=` | – / bearer (self) | commit hash, reveal, own action log for re-verification |
| `GET /season/:id/leaderboard`, `GET /season/:id/prizes/me` | – (bearer adds `me`) / bearer | top 100 by SP, prize pool so far, own rank and prize |
| `GET /referral/me`, `POST /referral/claim { code }` | bearer | your code and earnings; enter someone's code once, before your first purchase |
| `POST /admin/ban`, `/admin/unban`, `/admin/price`, `/admin/season/:id/reveal`, `/admin/jobs/:name/run` | `x-admin-token` | operations |
| `GET /admin/players/:id`, `GET /admin/players?address=`, `GET /admin/season/:id/summary`, `POST /admin/inflow`, `POST /admin/season/:id/close`, `GET /admin/stats` | `x-admin-token` | live ops (Phase 6); the token is at least 32 chars and compared in constant time |

### Vault inflows and prizes (spec §12)

Every token amount the vault keeps is written to `vault_inflows` for the current season: the vault's half of each spend (minus the referrer's 5%), the vault's share of deposit and claim fees (from indexed events), balances forfeited on a ban, and buybacks the treasury records through `POST /admin/inflow { source: "buyback", wei, ref }`. The prize pool is 30% of the season total; `seasonClose` pays 70% of it by SP tier (200/500/1,000/2,000 → 10/20/30/40%, highest tier only, equal shares) and 30% to the top 100 weighted by 101 − rank. Unreached tiers and rounding stay in the vault. Prizes are credited as earned balance (forfeitable on ban).

### Referrals (spec §16)

A code is the first 8 hex characters of a player id. `POST /referral/claim` is refused for yourself, after a code is already set, after any purchase, and when any sign-in of the referrer shares an IP or an `x-device-id` with any sign-in of the claimant (every origin is kept in `sign_in_origins` as salted hashes). The same overlap check runs again at every payout, and banned referrers are never paid; in both cases the vault keeps the full half of the spend. Set `TRUST_PROXY=true` behind a reverse proxy so the IP is the client's.

Seasons close `CLOSE_GRACE_MS` (5 minutes) after `endsAt`, so an action that started in the old season and commits after the boundary still counts for prizes.

Errors are `{ error: CODE }`: 400 `INVALID_ACTION`, 401 `UNAUTHORIZED`, 402 `INSUFFICIENT_TOKENS`, 403 `BANNED`/`FORBIDDEN`/`BETA_CLOSED`, 409 `OFFER_NOT_FOUND`/`OFFER_EXPIRED`/`VOUCHER_PENDING`/`DUPLICATE_REF`, and from `POST /admin/season/:id/close` `ALREADY_CLOSED`/`SEASON_ACTIVE`/`SEASON_GRACE` (ended less than 5 minutes ago; the close job takes it)/`SEASON_BUSY` (another close holds the lock; retry), 422 game-core codes (including the base-building ones `OUT_OF_BOUNDS`, `OVERLAP`, `BUILDERS_BUSY`, `ISLAND_LOCKED`, `MAX_ISLAND`, `WRONG_ISLAND`, `UNDER_CONSTRUCTION`, `NO_LEGENDARY`, `NEXUS_EXISTS`, `MAX_EXPANSION`) and `WITHDRAW_LIMIT`, 428 `TERMS_REQUIRED`, 429 `RATE_LIMITED`, 451 `REGION_BLOCKED`, 503 `PRICE_UNAVAILABLE`/`WITHDRAWALS_DISABLED`.

### Country block list and terms (both off by default)

`BLOCKED_COUNTRIES` (comma list of ISO alpha-2 codes) refuses `/auth/*`, `/actions` and `/withdraw`, `/withdraw/*` with 451 `REGION_BLOCKED`, using Cloudflare's `CF-IPCountry`; it is ignored unless `TRUST_PROXY=true`. While the list is set it fails closed: a missing header (the request did not come through Cloudflare; Caddy strips the header from non-Cloudflare peers), `XX` (unknown) or `T1` (Tor) is refused too. `/health`, `/admin/*`, `/me` and everything else are never blocked. With `TERMS_VERSION` set, `POST /actions` and `GET /pvp/offers` answer 428 `TERMS_REQUIRED` (a banned player gets 403 `BANNED` first on PvP) until the player's accepted version equals it (bumping the version asks everyone again). Sign-in, `/me` and withdrawals are never terms-gated.

## How an action runs

`BEGIN` → lock the player row (`FOR UPDATE`; for a PvP battle the defender too, lower id first) → replay a known idempotency key → derive the seed `HMAC-SHA256(S, playerId:nonce)` (battles: `HMAC(S, battle:<id>)`) → `applyAction` → settle effects (`charge` converts micro-USD to wei at the `PriceSource` and debits; `payout` credits earned tokens; `defenceResult` adjusts the defender) → persist state and append `action_log` → `COMMIT`. Failed game-core actions are logged with status 422 and still consume the nonce.

## Jobs (scheduler in `src/jobs`)

- `indexer` (15 s): vault events from `INDEXER_START_BLOCK` up to `head − CONFIRMATIONS`, in `INDEXER_CHUNK` ranges; `Entered` unlocks earning, `Deposited` credits `credited`, `Claimed` closes the voucher (and takes the tokens back if the server had already refunded it). Events for wallets that have not signed in yet are stored and applied on their first sign-in. Idempotent by `(txHash, logIndex)`.
- `voucherExpiry` (60 s): for vouchers unclaimed 10 minutes past their deadline, asks the chain whether the player's cumulative total already covers them (late claim → mark claimed) and refunds the rest, once.
- `burnBatch` (10 min): burns 50% of past days' spend through the operator key, within the vault's daily burn limit. Each burn is recorded as a pending attempt before it is sent and booked only on a successful receipt; a Postgres advisory lock keeps the scheduler and `POST /admin/jobs/burnBatch/run` from overlapping.
- `season` (60 s): rolls the 14-day season and creates the next commit hash.
- `seasonClose` (60 s): for each ended, unclosed season (advisory lock): computes prizes from the inflow ledger and the eligible standings (earning unlocked, not banned), credits them, resets trophies above 1,000 to 1,000 + half the excess, reveals the secret and stamps `closed_at`. Also runnable through `POST /admin/season/:id/close`, which answers 409 `ALREADY_CLOSED`, `SEASON_ACTIVE`, `SEASON_GRACE` or `SEASON_BUSY` (see the error list).

## Provably fair (spec §17)

`GET /season` publishes `keccak256(S)`. After the season ends an admin (later the close job) reveals `S`; a player fetches `GET /season/:id/actions?playerId=<me>` and checks each row: `seedHex == HMAC-SHA256(S, seedLabel)` where `seedLabel` is `<playerId>:<nonce>` for actions and `battle:<playerId>:<nonce>` / `battle:<offerId>` for battles, then replays `applyAction` with `createRng(first 4 bytes)`.

## Withdrawals

One open voucher per player; each at most 10% of the vault's `remainingPayoutToday()` minus every voucher still open anywhere, and at most 10% of the chain's remaining cap per player per UTC day; never more than the balance; 1-hour deadline; cumulative totals continue from `max(previous voucher, chain.claimed)`. Chain reads happen before the player lock is taken. Banned players can withdraw only `deposited − withdrawn`.

The §14 sell-back ledger (`state.ledger.depositedMicroUsd` / `withdrawnMicroUsd`) is derived on every action from the token balances at the current price (deposits rounded down, withdrawals up), so the penalty ratio and deposit-repayment limit follow real chain activity.

## Testnet prerequisites

Phase 3 contracts deployed, `VAULT_ADDRESS` set, `SIGNER_PRIVATE_KEY` matching `vault.signer()`, `OPERATOR_PRIVATE_KEY` matching `vault.operator()`, a price set via `POST /admin/price` (no pool TWAP yet).
