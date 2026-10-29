# Dragon Island web client

Pixel-art Phaser 3 + React client for the game server in `apps/server`. All rules come from `@wyrmhaven/game-core` (odds, battle preview, prices, limits); the client only renders state and sends intents.

## Run

```bash
pnpm dev                 # from the repo root: server on :3000 (PGlite) + web on :5173
pnpm --filter @wyrmhaven/web dev   # web only (expects the server on :3000; Vite proxies /api)
```

`cp .env.example .env.local` and set `VITE_REOWN_PROJECT_ID` (cloud.reown.com) for the wallet modal, and `VITE_VAULT_ADDRESS` / `VITE_TOKEN_ADDRESS` once the Phase 3 contracts are deployed; the chain panels stay disabled without them. Testnet only (chain 46630).

## Test

```bash
pnpm --filter @wyrmhaven/web test        # Vitest + Testing Library (jsdom)
pnpm --filter @wyrmhaven/web test:e2e    # Playwright: boots the server in E2E mode and Vite with a test wallet
pnpm --filter @wyrmhaven/web build
```

The e2e server (`E2E=1`) runs on an in-memory PGlite with a fake chain, a fixed price and a `POST /e2e/grant` setup route; the web app uses an in-page wallet (anvil account 0) when `VITE_TEST_WALLET=1`. Neither exists in production builds. The on-chain deposit/claim spec is skipped unless `E2E_RPC_URL` points at a local anvil with the Phase 3 deployment.

## Layout

| Path | What |
|---|---|
| `src/api` | typed fetch client (`createApi`), error copy, session store |
| `src/wallet` | `WalletAdapter` (wagmi + Reown AppKit in production, in-page account for e2e), SIWE sign-in |
| `src/chain` | `VaultAdapter` (wagmi reads/writes against DrisVault and the token) |
| `src/state` | TanStack Query state (`useMe`), the single action hook (`useAction`), battle builder (`useBattle`) |
| `src/game` | Phaser: `createGame`, `layout` (480×270 base, integer zoom), `islandModel` (pure), scenes, `bridge` to React |
| `src/art` | art slots: manifest → `GameArtSet`, programmatic pixel fallbacks, Phaser loader |
| `src/panels` | React panels (habitat, dragon, breed, nests, farm, store, wallet, hoard, arena, campaign, season) |
| `src/pages/Verify.tsx` | spec §17 re-verification of a season's action log |
| `src/pages/Admin.tsx` | operator console at `#/admin` (token kept in sessionStorage): player lookup and bans, season summary / close / reveal, buyback entry, price, jobs |

The Season panel shows the leaderboard (top 10, your rank), the prize pool so far and last season's prize; the Referral panel shows your code and lets you enter someone else's once, before your first purchase. Every request carries a random per-browser `x-device-id` so the server can refuse self-referrals.

## Art slots

Art is chosen only through `src/art/slots.ts`. `public/art/<version>/manifest.json` lists sprite sheets as `{ "egg.fire": { file, w, h, frames, fps }, ... }` with keys `egg.<element>`, `hatchling.<element>`, `dragon.<speciesId>`, `habitat.<element>`, `building.nest|hatchery|farmPlot|hoard|nexus`, `decoration.<id>`, `obstacle.<kind>`, `map.<islandId>`, `island.locked|sign`, `crop.<cropId>`, `icon.<element>`, `ui.panel|button|cursor`, `island.base`, `island.layer.<n>`. Missing keys get a deterministic pixel fallback, so the game runs with no assets. To ship PixelLab art: add `public/art/v1/`, write its manifest, set `ART_VERSION` in `slots.ts`, record prompts in `art/prompts.md` (our own designs only).

Base-building slots fall back to coloured boxes sized by footprint (16 px per cell; habitat and Nexus 80x64). The full generation list is `docs/art/base-building-art-list.md`. Facings 0/2 draw the sprite, 1/3 mirror it.

Known gaps in the base-building client: no PixelLab art for the new slots yet (boxes only); `island.locked` and `map.<island>` are loaded but not drawn yet (locked land is a flat fill, the map panel is a text list); the v1 habitat sheets are 96x64, wider than the 80 px footprint, until they are re-cut; the e2e drives the canvas through `window.__bridge` (test wallet only) rather than pixel clicks; construction badges are canvas-only and not asserted in e2e.

Rendering rules: Phaser `pixelArt` + `roundPixels`, whole-pixel positions, integer zoom only, CSS `image-rendering: pixelated`, `prefers-reduced-motion` shows frame 0.

## Testnet checklist

1. Phase 3 contracts deployed; `VITE_VAULT_ADDRESS`, `VITE_TOKEN_ADDRESS` set here and `VAULT_ADDRESS`, `SIGNER_PRIVATE_KEY`, `INDEXER_START_BLOCK` on the server.
2. Reown project id set; `SIWE_DOMAIN`/`SIWE_URI` on the server match the site origin.
3. A token price set via `POST /admin/price` (no pool TWAP yet).
4. Verify RPC/explorer values against docs.robinhood.com/chain.
