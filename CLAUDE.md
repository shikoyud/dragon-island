# Dragon Island — Claude Code guide

Original dragon-breeding web game with play-and-earn on Robinhood Chain (Arbitrum Orbit L2).
Design source of truth: `docs/dragon-island-gdd.md` (the GDD) + `docs/superpowers/specs/2026-10-30-gdd-rulings.md`. Older specs in `docs/superpowers/specs/` are history.
Research: `reports/Dragon breeding genre and RaidLords.md`. Background: `docs/reference/`.

## Hard rules
- Original IP: generic element names are fine; never copy dragon names, art, text or audio from other games.
- `packages/game-core` is pure and deterministic: no I/O, no `Date.now()`, no `Math.random()`. Time (`nowMs`) and `Rng` are parameters.
- Gold, food, token and USD amounts are integers (USD in micro-dollars). No floats in currency math.
- Server is authoritative. Client sends intents (and battle move lists); server runs game-core and persists.
- Blockchain work targets Robinhood Chain **testnet (chain ID 46630)** unless I explicitly say mainnet. Never put private keys in code or commit `.env`.

## Layout
```
packages/game-core/   pure rules engine + battle sim (TypeScript, Vitest)
packages/shared/      API types, zod schemas
apps/server/          Fastify + PostgreSQL, SIWE, /actions, jobs, indexer, voucher signer
apps/web/             Phaser 3 + React + Reown AppKit/wagmi/viem
contracts/            Foundry: DrisToken (ERC-20), DrisVault, DrisDeployer
docs/                 specs, plans, reference
```

## Commands
- Install: `pnpm install`
- Test game-core: `pnpm --filter @wyrmhaven/game-core test`
- Typecheck all: `pnpm -r typecheck`
- Server tests on real Postgres: `TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/test pnpm --filter @wyrmhaven/server test` (default is in-process PGlite; files run serially and wipe the database)
- Contracts: `cd contracts && forge test -vv`

## Workflow
- TDD: failing test first, then minimal code, then commit.
- Plans live in `docs/superpowers/plans/`; execute one task at a time and tick its checkboxes.
- Conventional commits (`feat:`, `fix:`, `test:`, `chore:`).
- For Solidity changes, run `forge test` and `forge fmt --check`, and list security considerations in the PR.
