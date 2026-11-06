# UI rework Phase 3 report (main HUD, Settings, floating Map and islands)

Plan: `docs/superpowers/plans/2026-11-02-ui-rework-phase3.md`. Design: `docs/superpowers/specs/2026-11-01-ui-rework-design.md`. Branch `claude/project-thread-orpmoo`. Pushed, not merged.

## Result

| Area | Now |
| --- | --- |
| Top left | Avatar in a steel frame with the level on a blue star, the Dragon Book button beside it ("found/total", with a "New" count for dragons found since you last opened the Book), and the XP bar under them. |
| Top centre | DRIS, Gold and Food pills in the kit look. DRIS + opens Settings on the Wallet tab; Food + opens the Store. On a portrait phone they drop to a second row, clear of the right-hand buttons. |
| Top right | Settings, then Map under it. |
| Left | Goals, with a "Start!" or "Claim!" bubble when a goal is ready to start or claim. Its dialog is now titled Goals too. |
| Bottom corners | Battle on the left, Shop on the right. The bottom centre is left clear for the island. |
| Gone from the HUD | Breed (the breeding mountain opens it), Wings, Inbox, and the Finals clock (now in Settings). |
| Settings | One dialog with two tabs. Account holds the Finals countdown, speed-ups and sign-out. Wallet holds deposit, withdraw and the entry fee. |
| Map | The six islands float in the sky with the island scene's sky and clouds behind them. The new floating island art is drawn at 2× (256 px wide), with no plot grid under it; the label still gives the owned count. Islands that aren't open yet are dimmed and carry a chain and padlock. Bridges run from island middle to island middle. |
| Other islands | Every island is now a floating landmass like Home: owned land plus the plots offered for sale, its own ground tiles (Ember Reach is ash), a rocky rim, river and waterfalls. Fog diamonds are gone. A locked island shows only sky. Every "For sale" sign now says "Tap to buy". |

## Tests

| Check | Result |
| --- | --- |
| `pnpm -r typecheck` | clean |
| Web unit | 962 passed |
| Web e2e (all 11 specs) | 52 passed, 1 skipped (on-chain deposit, needs anvil), 0 failed |
| Playtest, real mouse input, 1920×1080 and 844×390 | passed, no page or server errors |

The playtest clicked through habitat, farm (grew a crop), Hatchery, breeding mountain, a plot for sale (bought it), an obstacle (started a clear), then each HUD button: Shop, Dragon Book, Battle, Goals, Settings and both its tabs, DRIS + and Food +. Then it opened the Map, dragged it, clicked Ember Reach, bought its Bridge, pressed Go, tapped a sign on Ember Reach, came home and moved a habitat. The font check passed on every dialog.

Two defects found and fixed along the way. On a 390×844 phone the resource pills ran under the Map button. The Goals button opened a dialog titled "Quests".

## Screenshots

`docs/art/ui-p3-<name>-<1920|844>.png`, where name is hud, settings, settings-wallet, goals, map, map-isle2 or isle2. Also `ui-p3-hud-390.png` (portrait phone).

| Reference | Matches | Differs |
| --- | --- | --- |
| all-island-layout (HUD) | Avatar with level star and Book count at top left, three pills with green plus buttons at top centre, Settings at top right, Goals with a bubble on the left, Battle and Shop in the bottom corners, clear bottom centre | No Social, Storage, News or Offers buttons (no such features yet; Storage and search stay hidden, ruling Q2). Map sits under Settings, since we have no save button. |
| all-island-layout (Map) | Floating islands in the sky, locked ones dimmed with a chain | The reference packs big, detailed islands close together across the screen. Ours is a vertical chain of smaller 256 px islands with labels, so on a short landscape phone you drag to see the next island. |
| Island view | Floating landmass, cliff, waterfalls, sky, signs on land for sale | On Ember Reach the rim rocks, river and waterfall are still Home's (grey stone, blue water). Only the ground tiles are its own. |

## Rulings made on your behalf

| Ruling | Cost if wrong |
| --- | --- |
| Q1: the "Needs attention" column stays until the Phase 4 action row replaces it | Small |
| Q2: Storage and search stay hidden (no such features) | None |
| Q3: Breed leaves the HUD; the breeding mountain opens it | Small: one button |
| Q4: the Book's "New" badge remembers what you've seen in this browser (localStorage), not on the server | Small |
| Q5: the XP bar stays under the avatar | Small |
| Q6: the Finals countdown moves to Settings, Account tab | Small |
| Q7: the Map button sits under Settings | Small |
| The Map draws floating islands at 2× with no plot grid; the label carries the plot count | Small |
| Other islands show owned and offered land only, as Home does, and their signs say "Tap to buy" | Small |
| The Goals dialog is titled Goals, to match its button | None |

## Unverified or rough

- Other islands use Home's rim rocks, river and waterfall art. Themed rims (lava for Ember Reach, ice for Frostspire) would need new art.
- The Map's islands are smaller and further apart than the reference's; a denser, bigger layout would mean new positions and probably bigger art.
- The Book's "New" count is per browser, so a second device shows the same dragons as new again.
- Tablet sizes weren't checked; 1920×1080, 1280×720, 844×390 and 390×844 were.

## Next

Phase 4 (plan `docs/superpowers/plans/2026-11-02-ui-rework-phase4.md`): tap to select, the round action row, bubbles and bars on the island.
