# Architecture

```
 Browser (apps/web)                  Server (apps/server)                 Robinhood Chain
 ┌────────────────────┐  intents,    ┌─────────────────────────┐         ┌──────────────────┐
 │ Phaser scenes      │  move lists  │ Fastify API, SIWE auth  │         │ WyrmToken ERC-20 │
 │ React UI           │ ───────────▶ │ game-core (pure TS)     │ vouchers│ WyrmVault        │
 │ Reown AppKit/wagmi │ ◀─────────── │ PostgreSQL + action log │ ──────▶ │  enter/deposit/  │
 └────────────────────┘    state     │ jobs: burn, buyback,    │ ◀────── │  claim/burn      │
          │ signs enter/deposit/claim │ season close, indexer   │  events └──────────────────┘
          └──────────────────────────────────────────────────────────────▶ Uniswap v4 pool (TWAP)
```

## Responsibilities
- **game-core:** every rule; `applyAction(state, action, nowMs, rng) → { ok, state } | { ok: false, error }`; battle simulator replays move lists. Deterministic → auditable.
- **server:** wallet sign-in (signed message), per-player row lock per action, idempotency keys, action log, commit-reveal season seeds, EIP-712 withdrawal vouchers, indexer for `Entered`/`Deposited`/`Claimed`, jobs (burn batch, buyback, season close, TWAP cache).
- **web:** renders state, sends intents, shows odds, wallet flows.
- **contracts:** `WyrmToken` (fixed 1B, no owner); `WyrmVault` (`enter()` payable, `deposit(amount)`, `claim(cumulative, sig)`, operator `burn(amount)` with daily limit, 2% daily payout cap, pause, Safe owner, rotatable operator/signer).

## What RaidLords taught us (see report)
- Only money needs to be on-chain; everything else is a database row.
- Share the deterministic battle sim between client and server and replay on the server.
- Gaps to beat them on: verified contracts, multisig ownership, published addresses, an audit.
