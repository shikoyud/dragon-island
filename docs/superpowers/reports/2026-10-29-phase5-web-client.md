# Phase 5 — Web client: what was built

Branch state: all Phase 5 tasks except Task 8 are committed and green. Last commit `1af9acd`.

## Built

- **`apps/web`** — Vite 8 + React 19 + Phaser 3.90 pixel-art client (480×270 base, integer zoom, `pixelArt`, reduced-motion aware).
- **API layer** — typed `createApi` client, error copy map, session store (localStorage), `useMe` (TanStack Query) as the single source of truth, `useAction` (one intent in flight, UUID idempotency key, one retry on network failure, toasts every failure, invalidates `/me` after charges/payouts).
- **Wallet** — `WalletAdapter` seam: Reown AppKit + wagmi in production, in-page anvil account for e2e. SIWE sign-in pinned to chain 46630.
- **Chain** — `VaultAdapter` seam over WyrmVault / WYRM token: enter, approve → deposit, withdraw voucher → claim, with receipt waiting and one transaction at a time. Refuses if the connected wallet is not the signed-in account.
- **Game canvas** — Boot / Island / Battle scenes; a pure `islandModel` builds everything the scenes draw; a `bridge` carries state and selection between React and Phaser.
- **Art slots** — manifest-driven sprite sheets with deterministic pixel fallbacks, so the game runs with no assets. Prompts file ready for PixelLab.
- **Panels** — Resources, Habitat, Dragon, Breed (exact odds from game-core), Nests, Farm, Store, Hoard, Wallet, Arena (exact preview from the revealed seed), Campaign (approximate preview; server AI finishes unplanned turns), Season, Verify page (§17 re-verification).
- **Tests** — 75 web unit tests, 173 game-core, 88 server; Playwright e2e: sign-in, breed, battle (campaign + arena), deposit/withdraw (on-chain part skipped without a local anvil), 360px layout.

## Review pass (fresh reviewer, then one fix pass)

Fixed: silent action errors, deposit flow stuck/double-submit, wallet/session mismatch, stale token balance, 401 cache, Submit after result, E2E mode usable as a faucet, 360px overflow, in-flight `/me` clobbering newer state.

Ruling: **PvE move lists are finished by the server AI** when the plan runs short or a move is illegal under the real seed (the seed is secret, so the client's preview can only be a guess). Cost if wrong: less skill expression in PvE; never a silent forfeit.

Deferred minors (not fixed, listed for later): chain id env unchecked; withdraw ignores the 10% daily limit client-side; island redraws every second; battle log replays from the start; scene-switch warning spam; dead Hoard click listener; non-integer crop scale; Hoard disabled-reason copy; duplicate list keys; Verify page overclaims replay; no purchase confirmation; multi-tab sign-out; untested GameCanvas/PanelHost/adapters; 1.48 MB bundle.

## Not done

- **Task 8 — PixelLab art.** The PixelLab tools were not loaded in this session. Run it in a session that has them (restart with the MCP server configured, or the waitlist thread). The art slots and `art/prompts.md` are ready; dropping files into `public/art/v1/` + a manifest and bumping `ART_VERSION` is all the code needs.
- **Rotate the PixelLab key** that was pasted in chat; it is not in the repo, but it is in the conversation.

## Run it

```bash
pnpm dev
```

Server on :3000 (PGlite), web on :5173. Set `VITE_REOWN_PROJECT_ID` for the wallet modal; vault/token addresses once Phase 3 contracts are deployed to testnet.

## Next

Phase 6 (live layer: seasons UI, leaderboards, quests) or the testnet deployment checklist in `apps/web/README.md`.
