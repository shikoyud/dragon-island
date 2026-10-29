# HUD rework (full-screen island, overlaid HUD)

Follows the base-building fix (09758af: isometric island, pure camera). Owner feedback: the sidebar UI is bad; wants a genre-standard HUD over a full-screen island. Layout idea only from the owner's reference screenshot; no art, icons, text or numbers from it. Art keys: docs/art/hud-art-list.md.

## Layout decisions

- **Canvas**: `.game-root` is `position: fixed; inset: 0`; the Phaser canvas fills it (Scale.RESIZE). Nothing scrolls; no sidebar. The `Shell` sidebar/sheet layout is deleted; signed-out players see a centred welcome card with Sign in over the sea.
- **Overlay**: `.hud` covers the screen with `pointer-events: none`; only its controls take pointer events, so drags and clicks between controls reach the island. The HUD reports its top and bottom heights to the bridge (`setInsets`), and the camera frames the island in the band between them.
- **Top-left**: avatar badge (level number in a round frame) and an XP bar with `xp / next`.
- **Top-centre**: `role=status` "Resources" with three pills, food, gold, DRIS, each with a `+` (food and gold open the Store, DRIS opens the wallet). Once the Hoard exists the gold pill shows today's remaining sell limit under the amount.
- **Top-right**: settings button (wallet, address, sign out).
- **Right column**: round buttons Season (days left badge), Ranks (leaderboard, opens the season dialog at the board), Map, Referral, and Admin only when this tab holds an operator token (links to `#/admin`).
- **Left column**: "attention" shortcuts from a pure `attentionItems(state, nowMs)`: builds in progress (timer, Finish when ready), eggs in nests (timer, Collect when ready), hatchery eggs, ripe crops, hatchlings with no room, daily quests. At most five; each opens its panel or acts.
- **Bottom bar**: large labelled round buttons Dragons, Breed, Battle, Hoard, Build, Store. Build is highlighted while placing. Battle opens one dialog with Campaign and Arena tabs.
- **Dialogs**: every panel opens in one `Dialog` host: centred modal on wide screens (min-width 700 px), bottom sheet below that, max-height with its own scroll, a scrim that closes on click, Escape closes, a large close button. One dialog at a time; a scene click replaces the open one.
- **Placement**: while placing no dialog is open; the bottom bar is replaced by a fixed strip (Turn / Confirm / Cancel, plus "Can't build here"), and the camera pans the ghost into the free band.
- **Style**: tokens.css palette and Silkscreen; pills and round buttons are CSS (dark fill, 2 px border, hard shadow); icons come from the manifest (`icon.<name>.32`) and fall back to small built-in pixel glyphs. Readable at 390 px, no horizontal scroll: the bottom bar shrinks labels, the right column becomes smaller buttons.

## Tasks

- [x] 1. Art plumbing: manifest keys beyond the typed slots reach the client (`art.extra`), fallbacks for `fx.*`; island ground uses `ground.*` tiles when present; `fx.construction` over constructions, `fx.hatch` once on a hatch.
- [ ] 2. Pure HUD logic: `attentionItems`, gold pill sell limit, XP fraction (vitest).
- [ ] 3. HUD components and `Dialog` (Testing Library), App rewritten on them, `Shell` removed.
- [ ] 4. E2E: helpers and specs on the new HUD; `e2e/hud.spec.ts` full flow at desktop and mobile sizes.
- [ ] 5. Screenshots: docs/art/base-building-home.png, docs/art/hud-desktop.png, docs/art/hud-mobile.png.
