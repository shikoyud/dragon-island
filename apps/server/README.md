# Wyrmhaven server

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
| `GET /me` | bearer | player state, token balance, season info |
| `POST /actions` `{ action, idempotencyKey }` | bearer | runs one game-core action under the player row lock |
| `GET /sp` | bearer | season points: total, today, cap |
| `GET /pvp/offers` | bearer | three opponents (players with a defence team, bots to fill) with revealed battle seeds |
| `POST /withdraw` `{ grossWei }`, `GET /withdraw/pending` | bearer | EIP-712 claim voucher, one open at a time |
| `GET /season`, `GET /season/:id`, `GET /season/:id/actions?playerId=` | – / bearer (self) | commit hash, reveal, own action log for re-verification |
| `POST /admin/ban`, `/admin/unban`, `/admin/price`, `/admin/season/:id/reveal`, `/admin/jobs/:name/run` | `x-admin-token` | operations |

Errors are `{ error: CODE }`: 400 `INVALID_ACTION`, 401 `UNAUTHORIZED`, 402 `INSUFFICIENT_TOKENS`, 403 `BANNED`/`FORBIDDEN`, 409 `OFFER_NOT_FOUND`/`OFFER_EXPIRED`/`VOUCHER_PENDING`/`SEASON_ACTIVE`, 422 game-core codes and `WITHDRAW_LIMIT`, 429 `RATE_LIMITED`, 503 `PRICE_UNAVAILABLE`/`WITHDRAWALS_DISABLED`.

## How an action runs

`BEGIN` → lock the player row (`FOR UPDATE`; for a PvP battle the defender too, lower id first) → replay a known idempotency key → derive the seed `HMAC-SHA256(S, playerId:nonce)` (battles: `HMAC(S, battle:<id>)`) → `applyAction` → settle effects (`charge` converts micro-USD to wei at the `PriceSource` and debits; `payout` credits earned tokens; `defenceResult` adjusts the defender) → persist state and append `action_log` → `COMMIT`. Failed game-core actions are logged with status 422 and still consume the nonce.

## Jobs (scheduler in `src/jobs`)

- `indexer` (15 s): vault events up to `head − CONFIRMATIONS`; `Entered` unlocks earning, `Deposited` credits `credited`, `Claimed` closes the voucher. Idempotent by `(txHash, logIndex)`.
- `voucherExpiry` (60 s): refunds vouchers unclaimed 10 minutes past their deadline, once.
- `burnBatch` (10 min): burns 50% of past days' spend through the operator key, within the vault's daily burn limit.
- `season` (60 s): rolls the 14-day season and creates the next commit hash.

## Provably fair (spec §17)

`GET /season` publishes `keccak256(S)`. After the season ends an admin (later the close job) reveals `S`; a player fetches `GET /season/:id/actions?playerId=<me>` and checks each row with `verifyActionSeed(commitHash, S, playerId, nonce, seedHex)` from `src/services/seed.ts`, then replays `applyAction` with `createRng(seed32)`.

## Withdrawals

One open voucher per player; each at most 10% of the vault's `remainingPayoutToday()` and never more than the balance; 1-hour deadline; cumulative totals continue from the previous voucher (or the chain's `claimed`). Banned players can withdraw only `deposited − withdrawn`.

## Testnet prerequisites

Phase 3 contracts deployed, `VAULT_ADDRESS` set, `SIGNER_PRIVATE_KEY` matching `vault.signer()`, `OPERATOR_PRIVATE_KEY` matching `vault.operator()`, a price set via `POST /admin/price` (no pool TWAP yet).
