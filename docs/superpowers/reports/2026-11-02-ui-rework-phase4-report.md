# UI rework Phase 4 report (selecting things on the island)

Plan: `docs/superpowers/plans/2026-11-02-ui-rework-phase4.md`. Design: `docs/superpowers/specs/2026-11-01-ui-rework-design.md`, Phase 4 table. Branch `claude/project-thread-orpmoo`. Pushed, not merged.

## Result

A tap on a building now selects it instead of opening a dialog. It gets a yellow outline on the ground, and a row of round buttons appears bottom right, beside Shop, with its name in a label over the last button. A second tap on it, a tap on empty land, or Escape deselects it. A dialog opened from the row closes back to the row, and Move from the row returns to it after OK or Cancel.

| Selected | State | Buttons |
| --- | --- | --- |
| Habitat | any | one per dragon, Get Egg, Collect (gold stored above it), Upgrade, Info, Move |
| Hatchery | empty | Get Egg, Upgrade, Info, Move |
| Hatchery | hatching | Hatch (time above, "New" badge; opens the Hatchery to speed it up), Upgrade, Info, Move |
| Hatchery | ready | Hatch (hatches it), Upgrade, Info, Move |
| Farm | idle | Grow Food, Upgrade, Info, Move |
| Farm | growing | Speed Up (time above), Upgrade, Info, Move |
| Farm | ready | Collect (harvests), Upgrade, Info, Move |
| Breeding building | any | Breed (time above while breeding; collects a ready egg), Upgrade, Info, Move |
| Obstacle | not started | Clear, gold cost above |
| Obstacle | clearing | Speed Up (time above) |
| Plot for sale | | opens Expand, as before |

A dragon tap selects its habitat. Upgrade shows a lock with "Level N" when you're too low; it still opens Info, which says why. The row switches state by itself when a timer runs out (Speed Up becomes Collect).

On the island, habitats with gold show a white GOLD or FULL bubble and ripe farms a FOOD bubble. One tap collects or harvests without selecting. Growing crops have a progress bar. The "Needs attention" column on the left is gone.

A dragon waiting in the Hatchery, once a habitat has room for it, opens a home finder when tapped. Every habitat it fits glows green with an arrow over it, Cancel sits bottom right, and a tap on a glowing habitat moves the dragon there.

## Tests

| Check | Result |
| --- | --- |
| `pnpm -r typecheck` | clean |
| Web unit | 993 passed (action row model, bar, selection flow, outline, bubbles, bars, home finder among them) |
| Web e2e (all 11 specs) | 52 passed, 1 skipped (on-chain deposit, needs anvil), 0 failed |
| Playtest, real mouse input, 1920×1080 and 844×390 | passed, no page or server errors |

The playtest tapped each building on the canvas and checked its row: habitat (then Info and close, row stays), farm (Grow Food, planted, row turns to Speed Up), Hatchery, breeding mountain (Breed opens breeding), then Escape. It bought a plot from its sign, selected the bush and cleared it from the row, and opened every HUD dialog. It took the Map to Ember Reach and back, then moved a habitat from its row; the row came back after OK.

## Screenshots

`docs/art/ui-p4-<name>-<1920|844>.png`, where name is row-habitat, row-farm, row-hatchery, row-breed, row-obstacle or row-after-move. Also `ui-p4-row-habitat-390.png` (portrait phone).

| Reference | Matches | Differs |
| --- | --- | --- |
| obstacle-selected | Name label, cost above, one Clear button with a shovel | The cost reads "100 gold" in text, not a number with a gold-bar icon |
| habitat-choosen, food-farm-choosen-*, hatchery-selected-* | Round buttons bottom right, name over the last, timer chip above, "New" badge, lock badge | Dragon buttons show the element icon, not a dragon portrait (Phase 5). Our row sits left of Shop, not over it. |
| breeding-mountain | Breed, Upgrade, Info, Move | No Rebreed: game-core has no rebreed action |

## Rulings made on your behalf

| Ruling | Cost if wrong |
| --- | --- |
| A1–A4 as in the plan (tap selects; Info and Upgrade open the existing panel; bubbles collect without selecting; Get Egg opens the Shop) | Small |
| A5 changed: `hatch` already puts a new dragon in the first habitat with room, so there's nothing to choose right after hatching without a rules change. The home finder is for a dragon waiting in the Hatchery once a habitat has room. | Small; letting the player pick a home on every hatch would be a game-core change |
| The "Needs attention" column is removed. Its jobs moved: Goals has its bubble, gold and crops their bubbles, and a finished build completes by itself. An active Trial no longer has a shortcut; Battle opens it. | Small: the list's model is still there |
| Upgrade with a level gate stays tappable (it opens Info) and shows a lock | None |
| Storage on the empty Hatchery's row is left out until Phase 5 builds Storage | None |

## Unverified or rough

- Construction and breeding timers have no bar, only the time: the state stores when they end, not when they started.
- A finished obstacle clear has no XP bubble. It completes by itself, as before.
- Dragon buttons in the habitat row use the element icon until Phase 5 has portraits.
- On a 844×390 phone a habitat with three dragons makes an 8-button row; it fits, but the labels are tight.
- Tablet sizes weren't checked.

## Next

Phase 5: the dialogs and screens in the reference layouts (Shop home, Farm board, Hatchery, Dragon Book, breeding, Quests, battle), using the Phase 5 art already merged.
