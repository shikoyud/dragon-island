# UI rework from layout references (design, approved by shiko 2026-11-01)

Living copy: https://claude.ai/artifact/J9ZoM2r3yh9PF4fUzEqmbZ

Inputs on shiko's PC:
- `C:\Users\nnduy\Downloads\layout-reference\` — 35 reference screenshots; the file name describes each one.
- `C:\Users\nnduy\Downloads\feedback\review.md` and `image-2.png` … `image-9.png` — playtest review. Ignore its first bullet ("Fix the UI layout (in )").

## Ground rules

- **Same layout, our skin.** Match the references' element positions, relative sizes, button order, flows and states exactly. The references are screenshots of another studio's game: never copy its art, logo, character designs or text (species, cup, crop, building names). CLAUDE.md's original-IP rule applies. All art comes from PixelLab in Wyrmhaven's pixel style.
- **One font family.** A pixel display font for titles and buttons and a matching pixel body font. No browser default font anywhere (review image-8, image-9).
- **Landscape.** Desktop and landscape phone get the reference layout. Portrait phones show a "rotate your device" screen (shiko's answer, Q3).
- **Hide what isn't built.** Social, News, Offers, chat, Decor, Orbs, Packs, Empower, Rank Up, Book Mastery and Collections stay hidden until their milestone (Q2).
- **Currencies.** The reference's gems slot shows $DRIS (plus opens deposit), then Gold, then Food (Q1).
- **Game rules unchanged** except Storage (below). Prices, timers, caps and unlocks stay as the GDD and rulings set them.

## Phase 1: island and placement fixes (review.md)

| Fix | What changes | Reference |
| --- | --- | --- |
| Island shape | Home Isle becomes a floating island with an irregular rocky cliff edge, a river and waterfalls off the side, in a sky with clouds, not a square of grass. Plot grid unchanged underneath. | all-island-layout, building-1 |
| 3 locked plots | Home Isle starts with only 3 locked plots around the starting land. Each shows a wooden "for sale" sign with "Tap to buy", a darker ground tint, and its obstacles drawn visibly on top. | locked-land |
| Fewer obstacles | Fewer obstacles on the starting land, with a minimum gap so none overlap (review image-3). Spawns on bought plots keep the M4 table but enforce the same gap. | building-1 |
| Big tree fit | Ancient Tree base sits on the ground (shadow, roots on the tile), no hard-cut edge (review image-2). | locked-land |
| Move | Pressing Move lifts the building but it stays put. It moves only when the player taps a tile or drags it there; it never follows the cursor. Green/red footprint shows if the spot is free. Cancel (red X) and OK (green tick) at bottom centre, bouncing arrow over the building. | building-1 |
| Habitat size | Habitat art drawn larger on its footprint so 2–4 dragons fit without crowding. A wooden post with a green up-arrow marks an upgradable habitat. | choose-habitat-to-place-after-hatch |
| Hatchery | Dome replaced by a bigger stone castle with a straw nest in the courtyard; eggs sit in the nest with a small progress bar. | hatchery-selected-1egg-pending, -ready |
| Zoom | Vertical zoom slider with minus/plus at the right edge. | building-1 |

## Phase 2: pixel UI kit

| Component | Look | Fixes |
| --- | --- | --- |
| Dialog frame | Light panel, grey bevelled border; wooden plank title centred on the top edge, optional dark count badge ("3", "2/4") | replaces dark navy panels |
| Full-screen frame | Scene background, plank title top centre, close/back top right, optional help (?) | Shop, Storage, Breeding, Book, Quests, battle |
| Close button | Round red button, white X, orange rim, one square sprite at integer scale | review image-6 (squished) |
| Back button | Orange rounded square, white left arrow | |
| Pill buttons | Blue (buy/upgrade/select), yellow (go/battle/place), green (claim/feed/confirm), purple (premium), grey (unavailable), red (offer) | |
| Price label | Number + currency icon in a button; red number when unaffordable | |
| Round action button | White rounded square, orange ring, big icon, outlined label below, optional timer above and lock badge | |
| Cards | Rounded card, scale-pattern header, title, element ribbons, rarity shield, art, bottom price button; grey + lock + "Required level N" when locked | |
| Resource pill | Icon, dark number field, green plus | |
| Scrollbar | Pixel scrollbar: wooden track, chunky thumb | review image-7 |
| Tooltip/toast | Small rounded panel, pixel body font | review image-9 |
| Bubble | White speech bubble, dark outline, tail, one icon | |
| Progress bar | Dark rounded bar, green fill, time left centred | |
| Ribbon/shield/stars | Element ribbon, rarity shield with letter, five stars | |

Art loads through the existing art slots and manifest; every component falls back to drawn shapes until its PixelLab art lands.

## Phase 3: main HUD

| Area | Contents |
| --- | --- |
| Top left | Level in a blue star over the avatar frame; Dragon Book button with "found / total" and a red new-entry badge; search button |
| Top centre | Resource pills: $DRIS, Gold, Food |
| Top right | Settings gear (News/Offers column hidden) |
| Left edge | Goals button with a "Claim!"/"Start!" bubble when a goal is ready (chat hidden) |
| Right edge | Zoom slider |
| Bottom left | Storage, Battle (Social hidden) |
| Bottom right | Shop (market stall) |
| Bottom centre | Empty, for the action bar and Move buttons |

Remove the old bars, the Finals countdown (review image-5) and the dark side panels. Wallet, deposit, withdraw and sign-out move into Settings tabs. The M4 Map opens from a HUD button and shows the islands floating in the sky (all-island-layout), locked ones greyed and chained.

## Phase 4: selecting things on the island

Tap = yellow footprint outline + a row of round action buttons bottom right, the object's name in a label above the last button.

| Selected | State | Buttons | Reference |
| --- | --- | --- | --- |
| Habitat | any | dragon portraits (level badge), Get Egg, Collect (amount above), Upgrade, Info, Move | habitat-choosen |
| Hatchery | empty | Storage, Get Egg, Upgrade, Info, Move | hatchery-selected-empty |
| Hatchery | hatching | Hatch (time above, "New" badge), Upgrade, Info, Move | hatchery-selected-1egg-pending |
| Hatchery | ready | Hatch, Upgrade, Info, Move | hatchery-selected-1egg-ready |
| Farm | idle | Grow Food, Upgrade (lock badge if gated), Info, Move | food-farm-choosen-idle |
| Farm | growing | Speed Up (time above), Upgrade, Info, Move | food-farm-choosen-growing |
| Farm | ready | Collect, Upgrade, Info, Move | food-farm-choosen-ready |
| Breeding building | any | Breed, Rebreed, Upgrade, Info, Move | breeding-mountain |
| Obstacle | not started | Clear (shovel), name and gold cost above | obstacle-selected |
| Locked plot | any | opens Expand | locked-land-selected |

Without selecting: collect bubbles over habitats with gold, ready farms and cleared obstacles (XP), tap to collect; a progress bar under any running timer; after hatching, valid habitats outlined with a bouncing arrow, the rest dimmed, Cancel bottom right.

## Phase 5: dialogs and screens

| Screen | Layout | Reference |
| --- | --- | --- |
| Info | Plank "<Building> level N"; art left; rows: max dragons, elements, max gold, description; Store and Sell under the art | habitat-info |
| Upgrade | Plank "Upgrade <building> level N"; level N and N+1 art side by side with XP bubble; Benefits list (old value + green increase); Upgrade price button or lock + "Requires level N" | habitat-upgrade, food-farm-level-up-not-enough-level |
| Farm | Parchment board of crop cards in two columns: name plank, art, food and XP, ready time, price | grow-food-choosen |
| New dragon | Glow over the island; dragon bottom left with "New" burst; card with XP, rarity, elements, skills, income/min; Sell for N / Place in Habitat | new-dragon |
| Expand | Three cards: plot for gold, plot for premium, unlock next island ("Unavailable" when gated); resource footer | locked-land-selected |
| Shop home | 3×2 category cards with yellow headers; locked card shows lock + level | shop-selected |
| Shop list | Plank with owned/limit badge, optional note; horizontal card row; wooden footer with resource pills, filter pills, Category button opening the element strip | shop-dragon, shop-habitat, shop-building, shop-category |
| Storage | Plank with count; search + "Go to shop"; wooden filter panel left; item cards with Use and Sell | storage |
| Goals | Tabs Recommended / All; rows with icon, title, hint, reward pills, Claim or Go | task |
| Dragon detail | Plank with type + rarity; editable name; dragon on a backdrop; level and stars left; Feed N; stats card with bars; side tabs; Move | dragon-choosen |
| Breeding | Parent 1 / Parent 2 lists each side with search and element filter; heart in the middle | breeding-screen |
| Dragon Book | Open-book frame, ribbon tabs left, search and sort, numbered card grid, silhouettes for undiscovered | dragonbook |
| Quests | Sideways tall quest cards: XP badge, title ribbon, boss art, "Completed n/m", Battle or lock | trial |
| Battle lineup | Plank with cup badge; three slots with Select Dragon; Go to Battle; opponents strip | combat-lineup |
| Battle | Portraits, stars, HP bars top corners; our own VS emblem with round number; bench down each side; Swap; move buttons along the bottom | combat |

## Storage (approved by shiko 2026-11-01)

Storage holds almost anything, buildings included. If the code does not already support this, add it with these rules:
1. Storable: eggs, dragons, every building except the Hatchery, and speed-up tokens.
2. Storing a habitat requires it to be empty of dragons and collects its gold first.
3. A stored building keeps its level and earns nothing; a running build or upgrade timer pauses.
4. No size limit.
5. Placing from Storage is free and uses the normal Move placement.

## Art list (PixelLab)

1. Home Isle ground with cliff edge, river, waterfalls; sky and clouds; locked-plot tint; "for sale" sign; Ancient Tree with grounded base; castle Hatchery with straw nest (all levels); larger habitats for all 10 elements; upgrade-arrow post; zoom slider.
2. Dialog frame and plank (9-slice); close/back/help; pills ×6; round action frame and lock badge; card frame; resource pill and plus; scrollbar; bubble; progress bar; element ribbons ×10; rarity shields; star. Fonts are licence-checked pixel fonts, not PixelLab.
3. Level star, avatar frame, HUD icons (book, search, settings, goals, storage, battle, shop), currency icons, floating versions of the six islands.
4. Action icons (get egg, collect, upgrade, info, move, hatch, grow food, speed up, breed, rebreed, clear); bubble icons (gold, food, XP).
5. Shop category art; expand icons; parchment and wood backgrounds; new-dragon burst; breeding scene; book frame and ribbons; quest card frames; arena backdrop; VS emblem; move-type icons.

## Done means

Each phase: a writing-plans plan first; TDD; unit + e2e green (old HUD tests updated, never skipped); `pnpm playtest` through place, move, collect, hatch, grow, buy a plot, clear an obstacle, every dialog; screenshots at 1920×1080 and landscape phone next to each reference in a report; a check that no visible text uses a browser default font.
