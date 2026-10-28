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
| `GET /pvp/offers` | bearer | three opponents (players with a defence team, bots to fill) with revealed battle seeds; a new call retires the previous unused set |
| `POST /withdraw` `{ grossWei }`, `GET /withdraw/pending` | bearer | EIP-712 claim voucher, one open at a time |
| `GET /season`, `GET /season/:id`, `GET /season/:id/actions?playerId=` | – / bearer (self) | commit hash, reveal, own action log for re-verification |
| `POST /admin/ban`, `/admin/unban`, `/admin/price`, `/admin/season/:id/reveal`, `/admin/jobs/:name/run` | `x-admin-token` | operations |

Errors are `{ error: CODE }`: 400 `INVALID_ACTION`, 401 `UNAUTHORIZED`, 402 `INSUFFICIENT_TOKENS`, 403 `BANNED`/`FORBIDDEN`, 409 `OFFER_NOT_FOUND`/`OFFER_EXPIRED`/`VOUCHER_PENDING`/`SEASON_ACTIVE`, 422 game-core codes and `WITHDRAW_LIMIT`, 429 `RATE_LIMITED`, 503 `PRICE_UNAVAILABLE`/`WITHDRAWALS_DISABLED`.

## How an action runs

`BEGIN` → lock the player row (`FOR UPDATE`; for a PvP battle the defender too, lower id first) → replay a known idempotency key → derive the seed `HMAC-SHA256(S, playerId:nonce)` (battles: `HMAC(S, battle:<id>)`) → `applyAction` → settle effects (`charge` converts micro-USD to wei at the `PriceSource` and debits; `payout` credits earned tokens; `defenceResult` adjusts the defender) → persist state and append `action_log` → `COMMIT`. Failed game-core actions are logged with status 422 and still consume the nonce.

## Jobs (scheduler in `src/jobs`)

- `indexer` (15 s): vault events from `INDEXER_START_BLOCK` up to `head − CONFIRMATIONS`, in `INDEXER_CHUNK` ranges; `Entered` unlocks earning, `Deposited` credits `credited`, `Claimed` closes the voucher (and takes the tokens back if the server had already refunded it). Events for wallets that have not signed in yet are stored and applied on their first sign-in. Idempotent by `(txHash, logIndex)`.
- `voucherExpiry` (60 s): for vouchers unclaimed 10 minutes past their deadline, asks the chain whether the player's cumulative total already covers them (late claim → mark claimed) and refunds the rest, once.
- `burnBatch` (10 min): burns 50% of past days' spend through the operator key, within the vault's daily burn limit. Each burn is recorded as a pending attempt before it is sent and booked only on a successful receipt; a Postgres advisory lock keeps the scheduler and `POST /admin/jobs/burnBatch/run` from overlapping.
- `season` (60 s): rolls the 14-day season and creates the next commit hash.

## Provably fair (spec §17)

`GET /season` publishes `keccak256(S)`. After the season ends an admin (later the close job) reveals `S`; a player fetches `GET /season/:id/actions?playerId=<me>` and checks each row: `seedHex == HMAC-SHA256(S, seedLabel)` where `seedLabel` is `<playerId>:<nonce>` for actions and `battle:<playerId>:<nonce>` / `battle:<offerId>` for battles, then replays `applyAction` with `createRng(first 4 bytes)`.

## Withdrawals

One open voucher per player; each at most 10% of the vault's `remainingPayoutToday()` minus every voucher still open anywhere, and at most 10% of the chain's remaining cap per player per UTC day; never more than the balance; 1-hour deadline; cumulative totals continue from `max(previous voucher, chain.claimed)`. Chain reads happen before the player lock is taken. Banned players can withdraw only `deposited − withdrawn`.

The §14 sell-back ledger (`state.ledger.depositedMicroUsd` / `withdrawnMicroUsd`) is derived on every action from the token balances at the current price (deposits rounded down, withdrawals up), so the penalty ratio and deposit-repayment limit follow real chain activity.

## Testnet prerequisites

Phase 3 contracts deployed, `VAULT_ADDRESS` set, `SIGNER_PRIVATE_KEY` matching `vault.signer()`, `OPERATOR_PRIVATE_KEY` matching `vault.operator()`, a price set via `POST /admin/price` (no pool TWAP yet).
