# UI rework Phase 2 report (pixel UI kit)

Plan: `docs/superpowers/plans/2026-11-02-ui-rework-phase2.md`. Design: `docs/superpowers/specs/2026-11-01-ui-rework-design.md`. Branch `claude/project-thread-orpmoo`, based on `ui-rework-p1` (`6e3d22b`). Pushed, not merged.

## Result

Every dialog now uses the kit. The kit's pieces are all in a gallery at `#/kit`.

| Piece | Now |
| --- | --- |
| Fonts | Silkscreen for titles and buttons, Pixelify Sans for body text. Both are OFL and ship in the bundle instead of coming from Google Fonts, and form controls inherit them. An e2e check fails if any visible text uses another family (review image-8, image-9). |
| Dialog frame | Cream panel with a grey bevelled rim, a wooden plank title on the top edge, an optional dark count badge (the Hatchery's "0/1"), and a round red close button on the corner. Only the body scrolls, so the plank and close stay in view. Long titles end in "…". |
| Full-screen frame | Backdrop (scene, wood or parchment), plank at the top centre, and back, help and close at the top right. Built and tested; Phase 5 screens use it. |
| Close, back, help | One square sprite each, 32 px on phones and 48 px on big screens (16 px art at 2× and 3×), so they never squish (review image-6). |
| Pills | Blue, yellow, green, purple, grey and red. Old buttons map to them: plain is blue, primary yellow, danger red, and ghost or disabled grey. A disabled pill shows its reason under it. |
| Price | A number with its currency icon, in red when you can't afford it. |
| Round action, card, resource pill, progress bar, bubble, ribbon, shield, tooltip, toast | Built, tested and shown in the gallery. Toasts already use the kit. The rest arrive on the island in Phases 3 to 5. |
| Scrollbar | Wooden track and chunky thumb (review image-7). |
| Art | 64 PixelLab pieces from the art thread are merged and wired: frame, plank, badge, close, back, help, 6 pills, round, lock, card, resource, plus, scrollbar, bubble, bar, 10 ribbons, 5 shields, plus the HUD and action icons for Phases 3 and 4. Every piece keeps its drawn look until its art key exists. |
| Hatchery | The castle art is warmer sandstone now, so it stands out from the grey rocks. The nest pixels are unchanged. |

## Tests

| Check | Result |
| --- | --- |
| `pnpm -r typecheck` | clean |
| web unit | 950 passed (kit tests among them) |
| Web e2e | 52 passed, 1 skipped (on-chain deposit, needs anvil), 0 failed, before the art merge |
| Kit e2e after the art merge | 2 of 2 passed (1920×1080 and 844×390) |
| All unit suites, after the art merge and the upgrade-post change | game-core 1,039, shared 9, waitlist 161, web 950, server 171: 2,330 passed, 0 failed |

E2E ran on this cloud machine's preinstalled Chromium through a local config that isn't committed (the repo pins a newer Playwright build than the one installed).

Playtest: a scripted run with real mouse clicks on the canvas and the HUD at 1920×1080 and 844×390 opened the habitat, farm (grew a crop), Hatchery, breeding mountain, a plot for sale (bought it), an obstacle (started a clear), then Shop, Dragon Book, Battle, Quests and Settings, and moved a habitat by tap and OK. There were no page errors or server errors, and the font check passed on every dialog. That run found one defect: on a landscape phone the close button hung off the screen's right edge. It's fixed.

## Screenshots

`docs/art/ui-p2-<name>-<1920|844>.png`, where name is kit, habitat, shop, farm, settings, hatchery, plot, obstacle, battle, dragonbook, quests, breed or move.

| Reference | Matches | Differs |
| --- | --- | --- |
| habitat-info, habitat-upgrade | Light panel, thick grey bevelled rim, wooden plank centred over the top edge, red round close on the top-right corner | Our inside is cream rather than pale mint. The dialogs' contents are still the old lists until Phase 5 lays them out. |
| grow-food-choosen | Plank title and close placement | The farm is still a list; the parchment board of crop cards is Phase 5 |
| shop-dragon, storage | Card shape: header band, ribbons, shield, price button, locked card with "Required level N" | Our card header is a plain green band (the reference has a scale pattern). The Shop list itself is Phase 5. |
| food-farm-choosen-*, hatchery-selected-* | Round action button look: white plate, orange ring, outlined label, timer above, lock badge, "New" badge | The action row on the island is Phase 4 |

## Rulings made on your behalf

| Ruling | Cost if wrong |
| --- | --- |
| P1: self-hosted Silkscreen + Pixelify Sans, nothing from Google | Small: swap a package |
| P2: inside a light frame the colour tokens flip, so old panel content turns dark-on-cream with no per-panel edits | Small |
| P3: `.btn` draws as a blue pill, primary yellow, danger red, ghost and disabled grey | Small |
| P4: the old navy `ui.panel` and `ui.close` art is no longer used by dialogs | None |
| P5: a `#/kit` gallery page | None |
| P6: rarity shield letters C, U, R, E, L | Small |
| Disabled pills keep the native `disabled` attribute and show their reason (126 tests rely on it) | Small |
| A frame's accessible name includes its badge ("Hatchery · 0/1"), so screen readers hear the count | Small |
| Big screens (from 1280×800) get a bigger plank, rim, pills and dialog (760 px), as the 1920 reference is | Small |

## Unverified or rough

- The kit's art was checked in the gallery and in dialogs at 1920 and 844 only. Tablet sizes weren't checked.
- Firefox and Safari: the pixel scrollbar uses `scrollbar-color` there, so the thumb is flat colour and not the art.
- The `:has()` selector keeps the plank in view while the body scrolls. It needs Chrome 105+, Safari 15.4+ or Firefox 121+; on older browsers the whole dialog scrolls instead.
- On a phone a dialog still covers the bottom menu, as it did before. Phase 3 replaces that menu.
- Settings is still three panels stacked in one dialog. Phase 3 gives it tabs.
- The PixelLab card header has no scale pattern, and a few action icons have a 3 px margin rather than 4 px.

## Phase 1 questions

These defaults were applied: 3 plots for sale at a time with Home still growing to 16, the upgrade post only when affordable (to do in Phase 4 with the action row), a vertical slider, the lower XP for clearing the starting land, and the floating look for the other islands in Phase 3.

## Next

Phase 3 (plan `docs/superpowers/plans/2026-11-02-ui-rework-phase3.md`): the main HUD in the reference layout, Settings tabs, and the floating Map and islands.
