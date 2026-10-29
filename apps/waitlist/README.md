# Dragon Island waitlist

Next.js 16 waitlist site: sign in with X, do four X tasks, bind a wallet by signing a message, join, get a share card.
Package `@wyrmhaven/waitlist`. Run commands from the repo root with `pnpm --filter @wyrmhaven/waitlist <script>`, or from `apps/waitlist`.

## Environment

Copy `.env.example` to `.env.local` (never commit it).

| Key | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres connection string. Required in production. Unset outside production = local PGlite. |
| `SESSION_SECRET` | Signs session cookies. In production it must be at least 32 characters; use 32+ random bytes, e.g. `openssl rand -base64 48`. |
| `X_CLIENT_ID`, `X_CLIENT_SECRET` | X OAuth 2.0 credentials (see below). |
| `X_ACCOUNT_HANDLE` | The project X account people follow (required in production). |
| `ANNOUNCEMENT_POST_ID` | ID of the post to like, repost and comment on (required in production). |
| `NEXT_PUBLIC_REOWN_PROJECT_ID` | Reown (WalletConnect) project id. Needed at build time. Required in production (the page fails on its first request without it); in development the wallet step shows a notice instead. |
| `NEXT_PUBLIC_RH_TESTNET_RPC` | Robinhood Chain testnet (chain id 46630) RPC. Only used to configure the wallet library. |
| `NEXT_PUBLIC_SITE_URL` | Public origin, e.g. `https://dragonisland.example`. Used for the OAuth callback and card URLs. |
| `ADMIN_TOKEN` | Bearer token for the CSV export. Export is disabled if unset. In production a set token must be at least 32 characters. |
| `MIN_X_ACCOUNT_AGE_DAYS` | Minimum X account age (default 30). |
| `X_FAKE`, `X_FAKE_ID`, `X_FAKE_USERNAME`, `PGLITE_DIR` | Local dev / tests only (below). `X_FAKE=1` is refused in production. |

`NEXT_PUBLIC_*` values are inlined at build time; set them before `pnpm build`.

## X developer app

1. Create a project and app in the X developer portal.
2. Enable OAuth 2.0 as a **confidential client** (web app), and copy the client id and secret into `X_CLIENT_ID` / `X_CLIENT_SECRET`.
3. Callback URL: `<site>/api/auth/x/callback` (must match `NEXT_PUBLIC_SITE_URL` exactly).
4. Scopes requested: `users.read tweet.read`. The site only reads the profile (id, handle, name, avatar, creation date) and never posts.

## Reown project id

Create a project at the Reown dashboard (cloud.reown.com), add your site origin to its allowed domains, and put the id in `NEXT_PUBLIC_REOWN_PROJECT_ID`.

## Run locally (no Postgres, no X app)

```
X_FAKE=1 SESSION_SECRET=dev-secret-dev-secret-dev-secret-00 pnpm --filter @wyrmhaven/waitlist dev
```

With `DATABASE_URL` unset, data lives in a file-backed PGlite in `PGLITE_DIR` (default `.pglite`, git-ignored) and is migrated on first use. `X_FAKE=1` replaces X sign-in with a fixed test profile. `next dev` also writes an `AGENTS.md` into this folder; it is git-ignored.

## Tests

- `pnpm --filter @wyrmhaven/waitlist test` runs unit and service tests (Vitest, PGlite).
- `pnpm --filter @wyrmhaven/waitlist typecheck`
- `pnpm --filter @wyrmhaven/waitlist test:e2e` runs the Playwright smoke test on port 3100 against `next dev` with `X_FAKE=1` and a throwaway PGlite dir. The first run may need `npx playwright install chromium`. The suite takes about 35 seconds because the server enforces the real 15 second task delay.

## Deploy

1. Set the environment above (production needs `DATABASE_URL`, a 32+ character `SESSION_SECRET`, `X_ACCOUNT_HANDLE`, `ANNOUNCEMENT_POST_ID`, `NEXT_PUBLIC_REOWN_PROJECT_ID`, X credentials, `NEXT_PUBLIC_SITE_URL`, and a 32+ character `ADMIN_TOKEN` if you want the export).
2. **Required deploy step: run migrations.** The app does not migrate Postgres on boot.
   ```
   DATABASE_URL=postgres://... pnpm --filter @wyrmhaven/waitlist db:migrate
   ```
   Run it on every deploy before starting the new version.
3. `pnpm --filter @wyrmhaven/waitlist build` then `pnpm --filter @wyrmhaven/waitlist start` (run from the app directory: migrations, sprites and the card font are read relative to the working directory).

**Proxy assumption.** Per-IP rate limits use the first entry of `X-Forwarded-For`. Deploy behind a proxy or CDN that overwrites that header with the real client address; if clients can set it themselves, the limits can be bypassed. Rate-limit state is in memory, per process.

## Export

```
curl -H "Authorization: Bearer $ADMIN_TOKEN" <site>/api/admin/export > waitlist.csv
```

Rows are ordered by waitlist position. Columns: `position,handle,wallet,element,invites`, then `<task>_opened_at,<task>_confirmed_at` for follow, like, repost and comment, then `joined_at`. Handles have no leading `@` (spreadsheets read it as a formula). Treat the file as personal data.

## Swapping in real art

All art is chosen in `src/art/slots.ts` (`ACTIVE_ART`). Every slot has a flat colour fallback, so missing files never break the page.

1. Add `public/art/<version>/` with the sprite PNGs and a `manifest.json` in the same shape as `public/art/v0/manifest.json`.
2. In `src/art/slots.ts`, import the new manifest and point `ACTIVE_ART` at `artSetFromManifest('<version>', manifest)`.
3. Run `test` and open the home page and `/c/<code>` to check the card. Sprites scale by integer factors only.

## Before launch

- Verify X API pricing. Each sign-in reads one profile (roughly $0.01 per read at the time of writing); check the current pricing and your expected volume.
- Verify Robinhood Chain details at docs.robinhood.com/chain. Chain id 46630 is the testnet. The docs list the public RPC as rate-limited and not for production, and the exact URL was not on the page we checked, so confirm `NEXT_PUBLIC_RH_TESTNET_RPC` (the default in `.env.example` is unverified) or use a provider endpoint. The waitlist only asks for a signature, never a transaction.
- Any "play-and-earn" or token wording needs legal review before it ships. The site must not promise earnings, token price, airdrops or allocations.
