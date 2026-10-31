# Dragon Island server

Authoritative game server: Fastify + PostgreSQL (Drizzle). Game rules live entirely in `@wyrmhaven/game-core`; the server adds wallet sign-in, locking, idempotency, provably-fair seeds, matchmaking, the token ledger, chain indexing, withdrawal vouchers, bans and jobs.

## Run

```bash
SESSION_SECRET=$(openssl rand -hex 32) ADMIN_TOKEN=$(openssl rand -hex 32) pnpm --filter @wyrmhaven/server dev
```

`src/config.ts` validates every key; `deploy/.env.server.example` documents them. With `NODE_ENV=production` the server refuses to start without `LAUNCH_AT`; in dev it falls back to when the `game` row was created. Without `DATABASE_URL` the server runs on a file-backed PGlite (Postgres in WASM) under `PGLITE_DIR`; set `DATABASE_URL` for a real Postgres. Migrations in `drizzle/` apply on start. Tests: `pnpm --filter @wyrmhaven/server test` (in-memory PGlite, no database to install). After changing `src/db/schema.ts`: `pnpm --filter @wyrmhaven/server db:generate`. After rebuilding the contracts: `pnpm --filter @wyrmhaven/server exec tsx scripts/sync-abi.ts`.

## Routes

| Route | Auth | Purpose |
|---|---|---|
| `GET /health` | – | liveness |
| `GET /auth/nonce`, `POST /auth/verify`, `POST /auth/logout` | – / bearer | SIWE sign-in (chain 46630), opaque bearer sessions |
| `GET /game` | – | launch time, server time, preset, day, phase, commit hash, and the secret once revealed |
| `GET /me` | bearer | player state, token balance, `game` (as `GET /game`), `termsRequired` (version to accept, or null) |
| `POST /me/terms { version }` | bearer | accept the current `TERMS_VERSION` (400 `TERMS_VERSION_MISMATCH` otherwise); `POST /auth/verify` also takes an optional `termsVersion` |
| `POST /actions` `{ action, idempotencyKey }` | bearer | runs one game-core action under the player row lock |
| `GET /pve/seed` | bearer | the active Trial's revealed battle seed; 409 `NO_ACTIVE_TRIAL` with none |
| `GET /pvp/offers` | bearer | three opponents (players with a defence team, bots to fill) with revealed battle seeds; a new call retires the previous unused set |
| `POST /withdraw` `{ grossWei }`, `GET /withdraw/pending` | bearer | EIP-712 claim voucher, one open at a time |
| `POST /admin/ban`, `/admin/unban`, `/admin/price`, `/admin/jobs/:name/run`, `/admin/beta/allow` | `x-admin-token` | operations |
| `GET /admin/players/:id`, `GET /admin/players?address=`, `GET /admin/stats`, `GET /admin/beta` | `x-admin-token` | live ops; the token is at least 32 chars and compared in constant time |

Every sign-in origin is kept in `sign_in_origins` as salted hashes for abuse review. Set `TRUST_PROXY=true` behind a reverse proxy so the IP is the client's.

Errors are `{ error: CODE }`: 400 `INVALID_ACTION`, 401 `UNAUTHORIZED`, 402 `INSUFFICIENT_TOKENS`, 403 `BANNED`/`FORBIDDEN`/`BETA_CLOSED`, 409 `OFFER_NOT_FOUND`/`OFFER_EXPIRED`/`VOUCHER_PENDING`, 422 game-core codes (including the base-building ones `OUT_OF_BOUNDS`, `OVERLAP`, `BUILDERS_BUSY`, `CLEARS_BUSY`, `NOT_OWNED`, `PLOT_OWNED`, `PLOT_NOT_ADJACENT`, `ISLAND_LOCKED`, `WRONG_ISLAND`, `UNDER_CONSTRUCTION`) and `WITHDRAW_LIMIT`, 428 `TERMS_REQUIRED`, 429 `RATE_LIMITED`, 451 `REGION_BLOCKED`, 503 `PRICE_UNAVAILABLE`/`WITHDRAWALS_DISABLED`.

### Country block list and terms (both off by default)

`BLOCKED_COUNTRIES` (comma list of ISO alpha-2 codes) refuses `/auth/*`, `/actions` and `/withdraw`, `/withdraw/*` with 451 `REGION_BLOCKED`, using Cloudflare's `CF-IPCountry`; it is ignored unless `TRUST_PROXY=true`. While the list is set it fails closed: a missing header (the request did not come through Cloudflare; Caddy strips the header from non-Cloudflare peers), `XX` (unknown) or `T1` (Tor) is refused too. `/health`, `/admin/*`, `/me` and everything else are never blocked. With `TERMS_VERSION` set, `POST /actions` and `GET /pvp/offers` answer 428 `TERMS_REQUIRED` (a banned player gets 403 `BANNED` first on PvP) until the player's accepted version equals it (bumping the version asks everyone again). Sign-in, `/me` and withdrawals are never terms-gated.

## How an action runs

`BEGIN` → lock the player row (`FOR UPDATE`; for a PvP battle the defender too, lower id first) → replay a known idempotency key → derive the seed `HMAC-SHA256(S, playerId:nonce)` (battles: `HMAC(S, battle:<id>)`) → `applyAction` → settle effects (`charge` converts micro-USD to wei at the `PriceSource` and debits; `payout` credits earned tokens; `defenceResult` adjusts the defender) → persist state and append `action_log` → `COMMIT`. Failed game-core actions are logged with status 422 and still consume the nonce.

## Jobs (scheduler in `src/jobs`)

- `indexer` (15 s): vault events from `INDEXER_START_BLOCK` up to `head − CONFIRMATIONS`, in `INDEXER_CHUNK` ranges; `Entered` unlocks earning, `Deposited` credits `credited`, `Claimed` closes the voucher (and takes the tokens back if the server had already refunded it). Events for wallets that have not signed in yet are stored and applied on their first sign-in. Idempotent by `(txHash, logIndex)`.
- `voucherExpiry` (60 s): for vouchers unclaimed 10 minutes past their deadline, asks the chain whether the player's cumulative total already covers them (late claim → mark claimed) and refunds the rest, once.
- `burnBatch` (10 min): burns 50% of past days' spend through the operator key, within the vault's daily burn limit. Each burn is recorded as a pending attempt before it is sent and booked only on a successful receipt; a Postgres advisory lock keeps the scheduler and `POST /admin/jobs/burnBatch/run` from overlapping.
- `prune` (hourly): deletes expired sign-in nonces, rate-limit windows over a day old, and battle offers that expired over 7 days ago.
- `chainWatch` (5 min, only with `VAULT_ADDRESS` set): alerts on chain anomalies through `ALERT_WEBHOOK_URL`.

## Provably fair (spec §17)

`GET /game` publishes `keccak256(S)` for the game's one secret (row 1 of `game`) and `revealedSecret` once `game.revealed` is set; nothing sets it yet, and no route serves the action log yet. Each `action_log` row satisfies `seedHex == HMAC-SHA256(S, seedLabel)` where `seedLabel` is `<playerId>:<nonce>` for actions and `battle:<playerId>:<nonce>` / `battle:<offerId>` for battles, and replays through `applyAction` with `createRng(first 4 bytes)`.

## Withdrawals

One open voucher per player; each at most 10% of the vault's `remainingPayoutToday()` minus every voucher still open anywhere, and at most 10% of the chain's remaining cap per player per UTC day; never more than the balance; 1-hour deadline; cumulative totals continue from `max(previous voucher, chain.claimed)`. Chain reads happen before the player lock is taken. Banned players can withdraw only `deposited − withdrawn`.

## Testnet prerequisites

Phase 3 contracts deployed, `VAULT_ADDRESS` set, `SIGNER_PRIVATE_KEY` matching `vault.signer()`, `OPERATOR_PRIVATE_KEY` matching `vault.operator()`, a price set via `POST /admin/price` (no pool TWAP yet).
