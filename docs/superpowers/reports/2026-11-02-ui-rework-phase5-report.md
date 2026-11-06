# UI rework Phase 5 report (dialogs, screens and Storage)

Plan: `docs/superpowers/plans/2026-11-02-ui-rework-phase5.md`. Design: `docs/superpowers/specs/2026-11-01-ui-rework-design.md`, Phase 5 table and Storage section. Branch `claude/project-thread-orpmoo`. Pushed, not merged.

## Result

Every dialog and full screen in the Phase 5 table now has its reference's layout, drawn with our own kit and art. Storage exists, with the five rules approved on 2026-11-01.

| Screen | What it has now |
| --- | --- |
| Storage (new) | Storage button beside Battle; plank with the item count; search and Go to shop; the Type filter (All, Dragons, Eggs, Buildings, Items) on the left; cards with Use and Sell. Use puts a building back with the free Move placement, takes an egg back to the Hatchery, or opens the home finder for a dragon. Speed-up tokens are listed with their count. |
| Store buttons | Building Info has Store. A habitat must be empty, and a breeder must not hold an egg. The dragon detail has Store, except for a dragon in the defence team or the Trial in progress. Each Hatchery egg has Store. |
| Info / Upgrade | Info: building art left with Store, Sell and Turn; table right. Upgrade: LVL N and N+1 side by side with the XP bubble, Benefits on the right, price or "Requires level N" lock. |
| Farm | A board of crop cards: food, XP, ready-in and the price. |
| Expand | More land, Premium land (gold only for now) and Open the next island. |
| New dragon | After a hatch: glow, "New" burst, the dragon's card, Sell for N, and Place in Habitat. |
| Shop | Home with six category cards (locked ones show their level), then card lists with an element filter. |
| Goals | Recommended and All tabs. Each row has an icon, title, hint, XP and gold pills, and Claim! or Go. Goal routes now include a habitat, a dragon and the right Shop category. |
| Dragon detail | Full screen: species plank, rarity and elements, where it lives, the dragon over a sky-and-ground backdrop, the level box, Feed N with pips, a Stats card (Health and Damage bars to the level cap, income) with a Moves side tab, then Sell, Store and Move. |
| Breeding | Full screen on the breeding backdrop. Parent 1 and Parent 2 run down each side, with search, an element filter and dragon cards. The middle holds the heart, Breed, the odds and the breeding buildings. The breeder's upgrade has moved to its Upgrade dialog. |
| Dragon Book | Ribbon tabs: Book, My dragons, and one per rarity. Search finds found species only. Then an element filter, a sort order, and numbered cards; species not yet found show as `???` silhouettes. |
| Quests | Trial chapters as tall cards side by side: ribbon, chapter art, Boss XP, Completed n/10 with a bar, and Battle or a lock with the reason. |
| Lineup | Three tall slots with the dragon, Go to Battle!, and the opponents along the bottom (`???` for species not in the Book). |
| Battle | Your plate is top left, the enemy's top right, with VS and the turn between them. On wide screens the four moves sit in one row, with Swap beside them. |

## Tests

| Check | Result |
| --- | --- |
| `pnpm -r typecheck` | clean |
| game-core unit | 1,055 passed (16 new Storage tests) |
| Server unit (PGlite) | 171 passed |
| Web unit | 1,019 passed (new: storage, goals, breeding columns, Book search and filter, dragon Moves tab, Store on a dragon and an egg) |
| Web e2e (12 specs) | 52 passed, 1 skipped (on-chain deposit, needs anvil). The new `storage.spec.ts` stores a farm, finds it in Storage, places it back and sees Storage empty. One old check (the 360px menu had two buttons) was updated for Storage. |
| Playtest with real mouse input, 1920×1080 and 844×390 | Passed, with no page or server errors and pixel fonts on every dialog. |

New in the playtest: the Flame habitat's dragon goes to Storage from its detail, then the empty habitat from its Info. Storage shows 2. Use on the habitat places it back with the Move bar and OK. Use on the dragon opens the home finder, and a tap on the habitat moves it back in.

## Screenshots

The files are `docs/art/ui-p5-<name>-<1920|844>.png`. Each name and its reference:

| Name | Reference |
| --- | --- |
| storage | storage |
| storage-home | the home finder after Use |
| goals | task |
| dragon | dragon-choosen |
| breeding | breeding-screen |
| book | dragonbook |
| quests | trial |
| lineup | combat-lineup |
| battle | combat |
| info | habitat-info |
| upgrade | habitat-upgrade |
| farm | food-farm-choosen-idle |
| expand | locked-land-selected |
| shop-home, shop-dragons | shop-category, shop-dragon |

| Reference | Matches | Differs |
| --- | --- | --- |
| storage | Plank with count, search with Go to shop, Type panel left, cards with Use and Sell | Speed-up tokens have no Use (they're used from a timer) |
| task | Tabs, rows with icon, title, hint, reward pills, Claim! / Go | Our goals come one at a time, so the other rows read Done or Later |
| dragon-choosen | Plank, level box left, Feed N, stats card with bars, side tabs, Move | No editable name: dragons have no name field yet. No stars or Empower/Rank Up, because those systems don't exist. |
| breeding-screen | Parent lists each side with search and filter, heart in the middle | — |
| dragonbook | Ribbons left, search and sort, numbered cards, silhouettes | The `ui.book.frame` and `ui.book.ribbon` art made the text unreadable when used as backgrounds, so the page and ribbons are drawn in CSS |
| trial | Tall cards, XP badge, title ribbon, art, Completed n/m, Battle or lock | — |
| combat-lineup | Three slots, Go to Battle!, opponents strip | — |
| combat | Plates in the top corners, VS with the turn, moves along the bottom | The stage stays portrait (R80), and the bench is shown as pips on the plates, not portraits down each side. At 844×390 the two plates share the top and VS is hidden. |

## Rulings made on your behalf

| Ruling | Cost if wrong |
| --- | --- |
| S1–S8 as in the plan (stored buildings keep their slot and level and are off the grid; pause works by shifting timers; Move takes a building out of Storage; tokens are listed without Use; Sell only for dragons and decorations; New dragon uses the home finder) | Small |
| The opponents strip and battle hide species not in the Book (R22) | None |
| The dragon detail has no editable name | A name field is a small game-core and server change |
| The breeding title stays "Breed", not a building name | None |

## Unverified or rough

- The plan's Review Focus item 4 asked for an overflow check on each screen in an e2e spec. Instead, each screen was checked by eye at 844×390 and passed the playtest; no spec asserts it.
- Tablet sizes weren't checked.
- The battle stage is still the portrait column. A true landscape battle needs `battleStage` and the camera changed together.
- Some screens scroll at 844×390 (Goals, the lineup's dragon list, Quests).

## Next

Phase 5 is the last phase in the design. What's left is the rough list above. Open a PR when you want one.
