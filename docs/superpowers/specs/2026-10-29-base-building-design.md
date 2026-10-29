# Dragon Island — Base Building Spec

Status: approved by the owner on 2026-10-29 (proposal doc: https://claude.ai/artifact/JUE7GPBq1MQH6gXFaR89br).
Extends the main spec `2026-10-28-wyrmhaven-design.md`. Where this file and §7–9 or §15 of the main spec differ, this file wins; the differences are listed in §12 here.
All names, layouts and numbers are our own.

## 1. Goal

Turn the fixed island into genre-standard base building: a grid the player places, moves and turns buildings on; timed builds and upgrades; a Build shop; a home island that grows in paid steps; five further islands covered in obstacles; cosmetic decorations; and one speed-up rule for every timer.

Everything here is gold sink or spend. No new gold faucet is added and nothing changes sell-back eligibility, the Hoard limits, or the 50/50 burn and vault split of spend.

## 2. Grid and islands

- Islands are square grids of 16 px cells. A cell is addressed `(col, row)` from the top-left; a building's position is its top-left cell.
- The **home island** starts at 12×12 and grows by expansion steps (§3). The five **outer islands** (§4) are fixed 16×16.
- Art stays the current 3/4 top-down pixel style; the view pans and zooms in whole-pixel steps. The client never decides legality; it previews it with the same game-core function the server uses.

### Footprints

All footprints are square, so turning never changes the cells covered.

| Building | Footprint | Count limit |
|---|---|---|
| Habitat | 5×5 | `2 + floor(playerLevel / 5) + 3 × (outer islands unlocked)`; the Nexus habitat does not count |
| Nexus habitat | 5×5 | 1, Dawnspire only (§4) |
| Hatchery | 4×4 | 1, home island only, present from the start |
| Hoard | 4×4 | 1, home island only |
| Farm plot | 2×2 | 6 (main spec §7) |
| Nest | 2×2 | 4 (main spec §7) |
| Decoration | 1×1, 2×2 or 3×3 | land only |

### Placement rules

- A building must lie fully inside its island's unlocked land and must not overlap another building or an uncleared obstacle. There are no road, adjacency or edge rules.
- **Move** and **turn** are free, instant and allowed at any time, including while the building is under construction. A move keeps the building's timers and stored gold. Moving between islands is allowed for any building except the hatchery and the Hoard, and a habitat's dragons move with it.
- **Facing** is 0–3. Launch art ships a front view and its mirror: facings 0 and 2 draw the front, 1 and 3 the mirror. Side and back views can be added later without a rule change.
- Buildings cannot be sold or stored. Decorations can be removed (§7).

### Starting layout (new players, 12×12 home island)

| Building | Position |
|---|---|
| Fire habitat `h1` | (0, 0) |
| Water habitat `h2` | (5, 0) |
| Farm plots 1 and 2 | (10, 0), (10, 2) |
| Hatchery | (0, 8) |
| Nest 1 | (4, 8) |

The rest of §9 of the main spec (gold, food, dragons) is unchanged.

## 3. Home island expansion

Each step adds a 2-cell strip, alternating width then height, from 12×12 to a fixed maximum of 24×24. Steps are bought in order, cost gold only (any gold, ineligible first as usual), need a player level, and finish instantly. Each new strip carries one bush and one rock at fixed positions (§5).

| Step | Size | Min player level | Cost (gold) |
|---|---|---|---|
| 1 | 14×12 | 2 | 1,000 |
| 2 | 14×14 | 4 | 2,500 |
| 3 | 16×14 | 7 | 5,000 |
| 4 | 16×16 | 10 | 10,000 |
| 5 | 18×16 | 14 | 20,000 |
| 6 | 18×18 | 18 | 40,000 |
| 7 | 20×18 | 22 | 75,000 |
| 8 | 20×20 | 27 | 125,000 |
| 9 | 22×20 | 32 | 200,000 |
| 10 | 22×22 | 37 | 325,000 |
| 11 | 24×22 | 42 | 500,000 |
| 12 | 24×24 | 47 | 750,000 |

Total 2,053,500 gold. The next locked strip is shown on the island itself with its cost and level; it is not a shop item.

## 4. Outer islands

Unlocked in order, instantly, for gold, with a player level gate. A map view switches islands; locked ones show their level and price.

| Island | Min player level | Cost (gold) | Grid | Needs |
|---|---|---|---|---|
| 2nd | 12 | 40,000 | 16×16 | — |
| 3rd | 20 | 150,000 | 16×16 | 2nd |
| 4th | 30 | 500,000 | 16×16 | 3rd |
| 5th | 40 | 1,200,000 | 16×16 | 4th |
| Dawnspire (special) | 45 | 3,000,000 | 16×16 | 5th, and the player owns at least one legendary dragon at unlock time |

- An outer island's land is fully owned on unlock but about 30% covered by obstacles (§5).
- Each unlocked outer island (Dawnspire included) raises the habitat limit by 3: at most 27 at level 50 with all five.
- Nests, farm plots, habitats and decorations can go on any island. The hatchery and the Hoard stay on the home island. A hatched dragon goes to the first finished habitat in list order that matches an element and has room, on any island.
- **Dawnspire** is the only island where the **Nexus habitat** can be built: one 5×5 habitat that accepts dragons of any element, with the cap (120,000) and slots (7) of a level-5 habitat and no upgrades. It costs 250,000 gold and a 12 h build. Dawnspire also has three decorations of its own (§7).

## 5. Obstacles

Obstacles cover cells; nothing can be placed on them until cleared. Clearing costs gold, takes a builder slot and a timer (§6), and pays XP and food on finish. It never pays gold. Every island and every expansion strip has a fixed list of obstacles at fixed positions (game-core data); nothing regrows, so the total reward is finite.

| Obstacle | Footprint | Cost (gold) | Timer | XP | Food |
|---|---|---|---|---|---|
| Bush | 1×1 | 100 × m | 1 min | 20 × m | 10 × m |
| Rock | 1×1 | 250 × m | 5 min | 40 × m | 0 |
| Tree | 2×2 | 800 × m | 30 min | 100 × m | 60 × m |
| Boulder | 2×2 | 2,000 × m | 2 h | 250 × m | 0 |
| Ruin | 3×3 | 6,000 × m | 8 h | 700 × m | 300 × m |

| Where | m | Obstacles | Cells | Gold to clear all | XP for all |
|---|---|---|---|---|---|
| Each home expansion strip | 1 | 1 bush, 1 rock | 2 | 350 | 60 |
| 2nd island | 2 | 10 bush, 8 rock, 6 tree, 4 boulder, 2 ruin | 76 | 55,600 | 7,040 |
| 3rd island | 5 | same set | 76 | 139,000 | 17,600 |
| 4th island | 12 | same set | 76 | 333,600 | 42,240 |
| 5th island | 25 | same set | 76 | 695,000 | 88,000 |
| Dawnspire | 40 | same set | 76 | 1,112,000 | 140,800 |

All obstacles together give 296,400 XP, about 15% of the 2.02 million XP from level 1 to 50. Obstacle XP goes through the normal `addXp`. Timers are not multiplied by m.

## 6. Construction

- **Builders.** At most 2 constructions run at once per player, counting new buildings, upgrades and obstacle clearing together. The number is fixed and never sold.
- **Start.** Gold is spent when construction starts; there is no cancel. The build or upgrade needs the level gate in §8 and, for a new building, a legal placement in the same action.
- **During.** A building under upgrade keeps working at its current level. A new building can be moved and turned but does nothing: a habitat under construction counts toward the habitat limit but cannot take dragons (moves and hatching skip it); a farm plot cannot be planted; a nest cannot take an egg.
- **Finish.** When `readyAtMs <= now` the `finishConstruction` action applies the result. The client sends it automatically while the game is open; the server never applies it on its own, so the action log stays the only source of state changes. Finishing a habitat upgrade collects the habitat first (existing rule: every change to rate or cap collects first). Finishing an obstacle clear removes it and pays its XP and food.
- **No XP from building or upgrading.** Only obstacles pay XP (§5).
- **Tutorial.** The first two constructions a player starts (any kind) take 15 s instead of their timer, like the 15 s first breed and hatch.

## 7. Buildings and upgrade curves

Upgrades start from the building itself (tap it, see the next level, cost, timer, gate), not from the shop. "Cost to reach" is the gold paid to start the upgrade to that level.

### Habitats

Cap, slots and costs are the main spec's §7 values; timers and gates are new.

| Level | Gold cap | Slots | Cost to reach (gold) | Timer | Min player level |
|---|---|---|---|---|---|
| 1 | 500 | 3 | 500 × 2^n (n = habitats of that element owned) | 10 min × 2^k, k = habitats owned − 2, capped at 8 h | 1 |
| 2 | 2,500 | 4 | 1,000 | 10 min | 1 |
| 3 | 10,000 | 5 | 5,000 | 1 h | 5 |
| 4 | 40,000 | 6 | 20,000 | 4 h | 10 |
| 5 | 120,000 | 7 | 80,000 | 10 h | 18 |

New habitat timers: 10 min for the 3rd habitat, then 20, 40, 80, 160, 320 min, and 8 h from the 9th on. The Nexus habitat is fixed at level 5 (§4).

### Farm plots

Plots 3–6 keep their costs (500, 1,000, 2,000, 4,000 gold) and get build timers of 2 min, 10 min, 30 min and 1 h. Each plot upgrades to raise the food from every crop harvested on it: `food = floor(cropFood × percent / 100)`, applied at harvest.

| Plot level | Food | Cost to reach (gold) | Timer | Min player level |
|---|---|---|---|---|
| 1 | 100% | — | — | 1 |
| 2 | 115% | 1,500 | 15 min | 4 |
| 3 | 130% | 8,000 | 1 h | 10 |
| 4 | 150% | 30,000 | 4 h | 18 |

### Hatchery

| Level | Slots | Cost to reach (gold) | Timer | Min player level |
|---|---|---|---|---|
| 1 | 3 | — | — | 1 |
| 2 | 4 | 12,000 | 2 h | 8 |
| 3 | 5 | 75,000 | 8 h | 20 |

### Nests

Extra nests stay store items at $2 / $4 / $8 (main spec §15) and arrive instantly, ready to place. Each nest upgrades with gold to shorten breeding: `breedTime = floor(base × percent / 100)`, fixed when the egg is laid, using the level of the nest the egg goes in. The 15 s tutorial breed and all hatch times are unaffected.

| Nest level | Breed time | Cost to reach (gold) | Timer | Min player level |
|---|---|---|---|---|
| 1 | 100% | — | — | 1 |
| 2 | 90% | 15,000 | 2 h | 12 |
| 3 | 80% | 90,000 | 8 h | 24 |

### Hoard

Unchanged: unlocks at player level 5, bought and upgraded with tokens (main spec §14), instant, no timer. Its first purchase places a 4×4 Hoard on the home island.

### Decorations

Purely cosmetic: no effect on income, XP or anything else. Unlimited in number. Removing one refunds 25% of its price (floored) as **ineligible** gold; the item is gone. Only the Dawnspire items are island-restricted.

| Decoration | Footprint | Cost (gold) | Min player level |
|---|---|---|---|
| Stone path | 1×1 | 10 | 1 |
| Picket fence | 1×1 | 25 | 1 |
| Flower patch | 1×1 | 50 | 1 |
| Ember lantern | 1×1 | 150 | 2 |
| Driftwood bench | 2×2 | 400 | 4 |
| Hay cart | 2×2 | 1,000 | 6 |
| Shell fountain | 2×2 | 3,000 | 9 |
| Crystal cluster | 2×2 | 8,000 | 13 |
| Egg totem | 2×2 | 20,000 | 18 |
| Moonwell | 3×3 | 50,000 | 24 |
| Bone arch | 3×3 | 150,000 | 32 |
| Sky shrine | 3×3 | 400,000 | 40 |
| Dawn obelisk (Dawnspire only) | 2×2 | 100,000 | 45 |
| Star pool (Dawnspire only) | 3×3 | 300,000 | 45 |
| Dragon colossus (Dawnspire only) | 3×3 | 1,000,000 | 45 |

## 8. Build shop

A gold-and-token shop for everything that goes on the grid. Buying puts the item in placement mode (ghost follows the pointer, cells show legal or not); the purchase action carries the chosen island, position and facing and is only sent on confirm. The existing Store keeps skips, food, odds boosts, level-ups and the pass.

| Category | Items | Paid in | Unlocks at player level |
|---|---|---|---|
| Habitats | one per element (9) | gold | 1; disabled at the habitat limit, showing the level that raises it |
| Farming | farm plot (3rd–6th) | gold | 1 |
| Breeding | nest (2nd–4th) | tokens | 1 |
| Hoard | Hoard | tokens | 5 |
| Decorations | §7 list | gold | per item |

Locked items stay visible, greyed, with their level. Expansion steps and island unlocks are bought in place (edge sign, map), not in the shop.

## 9. Speed-ups

One rule for every timer: finishing early costs **$0.10 per started 30 minutes remaining**, paid in tokens, exactly the existing skip (main spec §15). Targets: nest, hatchery slot, farm plot crop, and now any construction (build, upgrade, obstacle clear). A construction skip sets `readyAtMs = now` and finishes the construction in the same action. The only free speed-ups are the two 15 s tutorial constructions (§6); there are no free "last minutes" skips.

## 10. Economy checks

- No new gold faucet: the only gold returned is the 25% decoration refund, ineligible and never more than was spent.
- Sell-back untouched: eligibility, "ineligible gold is spent first", the rate and the Hoard limits stay as in main spec §14.
- Faster levelling (farm yields, nest speed, obstacle XP) raises habitat income, which is still eligible gold under the habitat caps and the Hoard's daily limit.
- New sinks: home expansion 2,053,500; island unlocks 4,890,000; clearing every obstacle 2,339,400; Nexus habitat 250,000; farm upgrades 39,500 per plot; hatchery 87,000; nest upgrades 105,000 per nest; decorations unbounded.
- New spend: construction skips are store charges like any other, 50% burned and 50% to the vault.

## 11. Rules engine, state and actions (game-core)

- New state: `islands` (home size step; which outer islands are unlocked; remaining obstacles per island), a `placement { island, col, row, facing }` on every habitat, nest, farm plot, the hatchery, the Hoard and each decoration; `level` on farm plots, nests and the hatchery; `constructions[]` (at most 2) each `{ kind: 'build' | 'upgrade' | 'clear', target, readyAtMs }`; a tutorial construction counter.
- New actions: `placeBuilding` (buy + place: habitat, farm plot, decoration, Nexus; nests and the Hoard are placed by their store purchase), `moveBuilding` (island, position, facing), `expandIsland`, `unlockIsland`, `clearObstacle`, `startUpgrade`, `finishConstruction`, `removeDecoration`; `buy` gains the `skip` target `construction`.
- New errors: `OUT_OF_BOUNDS`, `OVERLAP`, `BUILDERS_BUSY`, `ISLAND_LOCKED`, `MAX_ISLAND`, `WRONG_ISLAND`, `UNDER_CONSTRUCTION`, `NO_LEGENDARY`.
- Pure and deterministic as before; layouts and obstacle positions are static data.
- Server: player state is JSON, so no schema change beyond new zod action schemas. Existing states (playtest and dev only; nothing is deployed) get a one-time default placement on first load.
- Web: grid island scene with pan and zoom, placement mode, island map, Build shop panel, per-building upgrade view with timer and skip.
- Art: about 60 PixelLab generations: the 9 habitats re-cut to 5×5, hatchery, Hoard, nest, farm plot, Nexus habitat, 15 decorations, 5 obstacles, locked-land tile, expansion sign, 6 island map icons.

## 12. Changes to the main spec

| Main spec | Before | Now |
|---|---|---|
| §7 habitats | new habitat and upgrade finish instantly | timed constructions (§6, §7 here); levels 3–5 gated at player level 5, 10, 18 |
| §7 habitat limit | `2 + floor(level / 5)` | `+ 3 per outer island`; Nexus exempt |
| §7 hatchery | fixed 3 slots | levels 1–3, slots 3/4/5 |
| §7 nests | fixed breed time | levels 1–3, 100/90/80% breed time |
| §7 farms | plots instant, fixed yield | plots 3–6 timed; levels 1–4, 100–150% yield |
| §8 XP | no XP from building | obstacle clearing pays finite XP (§5) |
| §9 start | no layout | starting layout on a 12×12 grid (§2) |
| §15 skip | breed/hatch/farm | plus constructions, same price |
| §21 phases | 7 phases | this feature is Phase 6b, before launch |

## 13. Testing

- game-core: unit tests for every table and rule above (placement, overlap, bounds, facing, expansion order and gates, island order and gates, obstacle rewards and totals, builder limit, finish semantics, gates, yields, breed percent, skip pricing, decoration refund), plus replay determinism.
- Server: integration tests for each new action and the construction skip charge.
- Web: Playwright run that places, moves, turns, expands, unlocks an island, clears an obstacle, upgrades and skips.
