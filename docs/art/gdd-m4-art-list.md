# Dragon Island M4 art list (GDD islands: big plots, Farm, obstacles, Map)

For the art thread to generate with PixelLab. **Art work happens on its own branch from `gdd-m4`** (for example `gdd-m4-art`), and it commits only PNGs, `apps/web/public/art/<version>/manifest.json`, `apps/web/art/prompts.md` and `docs/art`; the web code reads the keys below and falls back until each one lands, so the game runs before the art does. Missing keys are fine: nothing here blocks a release, and the client sends no request for a key the manifest lacks. Stage explicit paths only (`git commit -- <paths>`), never `git add -A`.

Style: the v1 set's palette and 1 px dark outline, transparent background, original designs only (do not base anything on other games). Sheets are one horizontal strip of equal frames; the manifest entry gives `w`/`h` per frame, `frames` and `fps` (the loader loops any sheet with `frames > 1` and `fps > 0`). Reduced-motion players see frame 0 of a looping sheet, so frame 0 must read well on its own. Record `top` (fully transparent rows above the art, smallest over all frames) for every building and obstacle sheet, as the v1 manifest does: badges sit just above it.

**Projection.** Same as `docs/art/hud-art-list.md`: isometric 2:1, one grid cell is a 16x8 diamond. A building with an n x n footprint stands on a `16n x 8n` diamond and its sprite's bottom-centre is that diamond's bottom vertex. Ground tiles are drawn with their diamond's top vertex at the cell's position (the 16x8 tile's top-left corner is 8 px left of that vertex).

**Where things draw (so a new sheet agrees with the code).**
- Habitats and Farms draw at `footprint width / sheet width`. A real 64-wide habitat sheet and a 48-wide Farm sheet draw at scale 1; the current 80-wide habitat sheets and 32-wide `building.farmPlot` still work, scaled to 0.8 and 1.5, until the new ones land. Mountain, Grove, Hatchery and Roost sheets already draw at 1.
- An obstacle sheet whose width is `footprint cells x 16` draws at scale 1.
- The island is 32 x 32 cells (4 x 4 plots of 8 x 8 cells), seen whole; the camera pans and zooms over it.

**Generation budget.** PixelLab has about **1,115 generations left**. One "generation" in the table below means one finished sheet or still (a key); it may take several PixelLab calls (a still is usually 1 to 3, a 4-frame sheet 2 to 5). Required: **64 keys**, which at the worst case of 5 calls each is about 320 calls, under a third of what is left; with the one optional key (**65**) about 325. Count calls as you go and stop at 800 remaining unless the owner says otherwise.

| Group | Keys | Generations |
|---|---|---|
| Habitats, 10 elements | `habitat.<element>` | 10 |
| Golden Aerie | `building.goldenAerie` | 1 |
| Farm | `building.farmPlot` | 1 |
| Crops, growth stages | `crop.<id>` x 6 | 6 |
| Crops, ripe sway | `crop.<id>.sway` x 6 | 6 |
| Obstacles | `obstacle.<kind>` x 6 | 6 |
| Map | `map.home`, `map.isle2` to `map.isle6`, `map.bridge`, `map.backdrop` | 8 |
| Island ground | `ground.<island>.<0..2>` x 5 islands | 15 |
| Island cliffs | `ground.cliff.<island>.sw` / `.se` x 5 islands | 10 |
| Fog | `ground.fog` (replaces the current one) | 1 |
| **Total (required)** | | **64** |
| Plot border mark (optional) | `ground.plotEdge` | 1 |
| **Total with the optional key** | | **65** |

Most of these **replace sheets that already exist in the v1 manifest under the same key** (the habitats, `building.goldenAerie`, `building.farmPlot`, all twelve crop keys, `obstacle.boulder`, `obstacle.bush`, `obstacle.tree`, the Map icons and `map.backdrop`, `ground.fog`). The rest are new keys (`obstacle.ancientTree`, `obstacle.largeRock`, `obstacle.smallRock`, `map.bridge`, `map.isle6`, all the per-island ground and cliffs, `ground.plotEdge`). Art lands in `apps/web/public/art/v1/` in place (the game's `ART_VERSION` is a code constant, `v1`): overwrite the PNG, update the manifest entry (`w`, `h`, `frames`, `fps`, `top`), and reload the game to see it.

Priority order if the budget runs short: **habitats (and the Golden Aerie), then the Farm and crops, then obstacles, then the Map, then island tiles** (grass first, then cliffs, then `ground.fog`); the optional keys last. Every group degrades alone: a missing habitat or Farm sheet is drawn from the old one, a missing obstacle from the nearest old sprite, a missing island tile from Home's, a missing Map icon from the old 32x32 one (or a drawn disc).

## Already final, do not regenerate

| Keys | Size | Footprint |
|---|---|---|
| `building.mountain.1` to `.3`, `building.grove.1` to `.3` | 80x80 | 5x5 |
| `building.hatchery`, `building.hatchery.2` to `.4` | 64x64 | 4x4 |
| `building.roost.1` to `.5` | 64x64 | 4x4 |

They already draw at scale 1. The art thread should look at each in the running game at scale 1 on the big island (one pass, zoom 1 and zoomed in) and **report** anything that sits off its diamond, clips, or reads too small; do not redo any without the owner's say-so.

## Buildings at final size

Replace the existing v1 sheets under the same keys (they are 80x64 habitats, an 80x64 one-frame Golden Aerie and a 32x32 Farm today). Each element's look carries over: start from the existing `habitat.<element>` sheet's colours, props and animation idea and redraw it onto the new platform (for example an edit pass from the v1 sheet).

| Key | Frame (px) | Frames | fps | Description |
|---|---|---|---|---|
| `habitat.<element>` | 64x56 | 4 | 4 | One sheet per element (`terra flame sea nature electric ice metal dark light war`, 10 in all): the element's platform with its element loop (embers flicker, water ripples, sparks, frost glints, ...). The platform itself does not move. 4x4 footprint |
| `building.goldenAerie` | 64x56 | 4 | 4 | Golden Aerie, the all-element habitat: the same platform shape as the habitats in white stone with gold trim, a ring of small gem-coloured motes (one per element colour) drifting above it, a soft golden shimmer loop. Replaces the v1 `building.goldenAerie` (80x64, one frame, drawn today at 0.8): same key, now 64x56 with a 4-frame loop. 4x4 footprint |
| `building.farmPlot` | 48x40 | 1 | 0 | Farm: tilled soil beds in a neat grid on a low wooden-edged diamond, with a small scarecrow or well at the back corner. The top face is empty soil so crops read on it. 3x3 footprint |

**Habitat and Aerie rules (the code is tuned to them).** **One silhouette** (sheet 64x56, pixel x 0 to 63, y 0 to 55; the anchor is the bottom-centre pixel (32, 55), the footprint's bottom vertex). The platform is a slab: a **52x26 top-face diamond** with its **centre at (32, 39), i.e. 16 px above the anchor**, vertices left (6, 39), right (58, 39), top (32, 26), bottom (32, 52), and a **3 px rim** (stone edge, outline included) below the face's lower edges, so the lowest rows (y 53 to 55) are the rim's front vertex. The 6 px margins left and right of the slab are for props and glow only. (The v1 sheets do not match this: their platform is a taller, wider slab whose top-face centre is about 26 px above the anchor at the 0.8 scale they draw at; `DRAGON_SPOTS` was meant for a 64x32 face centred 16 px up, which has no room for a rim, so the face is 52x26 and the spots are unchanged and all inside it, `layout.test.ts` checks this.) Dragons stand on fixed spots measured from the anchor: (0,-16) first, then (-14,-20), (14,-20), (0,-26), (-12,-11), (12,-11), (-22,-16), feet on those points (`apps/web/src/game/layout.ts`, `DRAGON_SPOTS`). The 48x48 dragon sprites draw over the habitat, so keep the front half of the top face flat and clear; put props, totems and the element's glow at the back and sides, rising into the top 26 rows.

**Farm rules.** The 48x24 top face sits in the bottom 24 rows with its centre 12 px above the bottom-centre of the sheet. Crops draw as separate sprites with their bottom-centre **10 px above the Farm's bottom vertex** (`y - 10` in `islandModel.ts`), at their own size, so the Farm's soil must show at that point.

## Crops

`crop.<id>` for the six ids the Farm grows. A growth strip: frame 0 is the sprout and the last frame is ripe; the game picks the frame from how far the crop has grown. They are no longer 16x16: they stand on a 3x3 Farm.

| Key | Frame (px) | Frames | fps | Description |
|---|---|---|---|---|
| `crop.dragonBush` | 24x24 | 3 | 0 | Growth stages of a dragon bush: seedling, leafy bush, bush heavy with red-green berries |
| `crop.emberWheat` | 24x24 | 3 | 0 | Ember wheat: green shoots, golden stalks, tall stalks with glowing orange tips |
| `crop.seaMelon` | 24x24 | 3 | 0 | Sea melon: vine seedling, flowering vine, a ripe blue-green striped melon |
| `crop.thunderPumpkin` | 24x24 | 3 | 0 | Thunder pumpkin: sprout, vine with a yellow flower, a ripe pumpkin with a jagged lightning mark |
| `crop.frostBerries` | 24x24 | 3 | 0 | Frost berries: pale sprout, frosted bush, bush with icy-blue berries |
| `crop.warlordPepper` | 24x24 | 3 | 0 | Warlord pepper: sprout, leafy plant, plant hung with dark crimson peppers |
| `crop.<id>.sway` | 24x24 | 4 | 4 | **Required, one per id (six keys).** Ripe-stage loop, same design as the last growth frame, swaying a pixel or two; frame 0 equals the ripe frame. The game draws it in place of the last growth frame once the crop is ripe, so if it stayed at the v1 16x16 the crop would shrink when it ripens |

These replace the existing v1 sheets: `crop.<id>` is 16x16 with 3 frames today and `crop.<id>.sway` is 16x16 with 4 frames. Replace **both** for all six ids, in the same pass. Draw each crop with its bottom-centre on the bottom-centre pixel of the frame (that point lands 10 px above the Farm's bottom vertex). Record `top` (transparent rows above the art) in the manifest for every crop and sway sheet: the ripe and timer badges sit just above it. The v1 manifest also holds `crop.sprout`, `crop.bushel`, `crop.harvest` and `crop.bounty` (and `.sway` of each): the game does not read them; leave them as they are.

## Obstacles

Stills, original designs, bottom-centre on the footprint's bottom vertex. The width is the footprint's (cells x 16), so each draws at scale 1. v1 has `obstacle.boulder` (32x32), `obstacle.bush` (16x16) and `obstacle.tree` (32x32): replace those under the same keys; `ancientTree`, `largeRock` and `smallRock` are new. Until a kind has its own sheet it uses the nearest old sprite (`boulder`, `ruin`, `rock`, `tree`, `bush`), whose size differs, so it is the sheets listed here that make them fit. Leave `obstacle.ruin` and `obstacle.rock` in the manifest.

| Key | Frame (px) | Frames | fps | Description |
|---|---|---|---|---|
| `obstacle.ancientTree` | 64x64 | 1 | 0 | 4x4: a huge gnarled ancient tree, thick twisted trunk with roots spreading over the ground, a dense dark-green crown, moss and a hollow. The crown must not hide the diamond's front corner |
| `obstacle.boulder` | 64x48 | 1 | 0 | 4x4: a massive rounded boulder with cracks, lichen and a few smaller stones at its foot, in grey-brown stone |
| `obstacle.largeRock` | 48x40 | 1 | 0 | 3x3: a jagged outcrop of two or three angular grey stones leaning together, one flat lit face |
| `obstacle.tree` | 32x40 | 1 | 0 | 2x2: an ordinary tree, a slim trunk and a round green crown with a few leaves on the ground |
| `obstacle.smallRock` | 32x24 | 1 | 0 | 2x2: a small cluster of three rounded stones with a tuft of grass |
| `obstacle.bush` | 16x16 | 1 | 0 | 1x1: a low round bush with a couple of berries or flowers |

They sit on any island's ground (green on Home, scorched or snowy elsewhere), so keep the colours neutral enough to read on all five themes, and keep a 1 px dark outline.

## Island tiles

Ground for the five islands past Home. Home keeps today's `ground.grass.0/1/2`, `ground.cliff.sw/se`. Make them with the same technique as the HUD art round: seamless isometric tiles (`create_tiles_pro` isometric, 32 px, view angle 30, depth 0, `outline_mode` segmentation, then downscale to 16x8), checked in a 4x4 block of the same tile for seams on all four edges. No outline on ground tiles. Each island's three tiles are a base, a lighter-detail variant and a variant with a small feature (pebble, flower, ember, crystal), like the Home set, so the pattern does not repeat visibly across 8x8 plots.

Island themes (names and themes from `packages/game-core/src/data/islands.ts`; `<island>` in the key is the id):

| Island | Id | Ground |
|---|---|---|
| Ember Reach | `isle2` | scorched red-brown earth with glowing ember cracks and charred grass tufts |
| Frostspire | `isle3` | pale frosted grass under thin snow, blue-white ice patches. Keep it **clearly different from `ground.fog`**: lighter, crisper, with visible blades and glints |
| Ironhold | `isle4` | slate-grey stone flags with rust-brown moss and worn iron-bolted plates |
| Shadowmere | `isle5` | dark violet-green moss and wet black soil with faint pale-violet spores |
| Warlord's Crown | `isle6` | polished dark crimson stone with thin gold inlay lines, a rare ash-grey patch |

| Key | Frame (px) | Frames | fps | Description |
|---|---|---|---|---|
| `ground.<island>.0` | 16x8 | 1 | 0 | Base tile of the island's ground; tiles seamlessly on all four edges. `<island>` is `isle2` `isle3` `isle4` `isle5` `isle6` (5 keys) |
| `ground.<island>.1` | 16x8 | 1 | 0 | Variant with lighter detail (5 keys) |
| `ground.<island>.2` | 16x8 | 1 | 0 | Variant with a small feature (5 keys) |
| `ground.cliff.<island>.sw` | 16x16 | 1 | 0 | Cliff face under one cell of the south-west edge, same frame rule as `ground.cliff.sw`: frame origin is the cell's bounding box (top vertex at x 8, y 0), the face hangs 8 px below the cell's lower-left edge (x 0 to 7), 1 px lip of the island's ground, earth or stone strata in the island's colours; repeats along the edge (5 keys) |
| `ground.cliff.<island>.se` | 16x16 | 1 | 0 | Same under the south-east edge (x 8 to 15), the lit side, lighter (5 keys) |
| `ground.fog` | 16x8 | 1 | 0 | **Replaces the current white cloud tile** (the one change to "ground.fog stays"). On the first screen the current fog reads as snow, white and bright beside the grass. Draw unowned, distant, misty land instead: a dim desaturated blue-grey haze (no white, darker than every grass tile, never brighter than the island ground beside it) with a faint hint of shaped land and soft drifting mist, so it reads as land you cannot reach yet. Tiles seamlessly on all four edges |
| `ground.plotEdge` | 16x8 | 1 | 0 | Optional. A faint border mark in a darker or lighter tone of grass with 40 % opacity, drawn over the plot's back-edge cells (its first row and first column of 8 x 8 cells) so owned plots read as separate squares. Transparent except the mark. Skip it if it looks busy at zoom 1 |

How the game uses them: the island scene bakes the landmass once per island (`IslandScene.drawGround`). For each island it reads `ground.<island>.<n>` (those present, in order, so 0, 1, 2) for grass, else Home's `ground.grass.<n>`; it uses `ground.cliff.<island>.sw` and `.se` only if **both** exist, else Home's pair. Pieces are chosen one island at a time, so a partial set is fine. Unowned land draws `ground.fog` on every island. The bake is keyed by island and owned plots and is made once the art set is loaded, so new PNGs show after a reload.

## Plots

| Key | Frame (px) | Frames | fps | Description |
|---|---|---|---|---|
| `island.sign` | 32x32 | 1 | 0 | Stays as it is (the expansion sign on a plot for sale). **Check it on the new `ground.fog`** and on the five island grounds at zoom 1: the sign must still read on a dim misty tile. Redraw it only if it does not, and say so in the PR |

## Map

The Map shows all six islands on one scrolling chart. It draws each `map.<id>` at **128 px wide** whatever the sheet's size (height follows), above that island's plot diamonds. `map.bridge` is drawn between two islands, `map.backdrop` is tiled behind everything.

| Key | Frame (px) | Frames | fps | Description |
|---|---|---|---|---|
| `map.home` | 128x96 | 1 | 0 | Home Isle seen whole from above and in front: green meadow, a small dragon roost and a few huts, the starting island. The island fills the frame's width, shadow-free, 1 px dark outline |
| `map.isle2` | 128x96 | 1 | 0 | Ember Reach: a dark island with a smouldering volcano and rivers of glowing lava, scorched trees |
| `map.isle3` | 128x96 | 1 | 0 | Frostspire: a snowy island with a tall ice spire in the middle, frozen pines, pale blue ice at the shore |
| `map.isle4` | 128x96 | 1 | 0 | Ironhold: a grey stone island crowned with a fortress of iron walls and towers, a forge glow |
| `map.isle5` | 128x96 | 1 | 0 | Shadowmere: a dark island ringed by drifting violet mist, twisted trees, a still black lake |
| `map.isle6` | 128x96 | 1 | 0 | Warlord's Crown: a crimson-and-gold island carrying a great crown-shaped citadel, the grandest of the six |
| `map.bridge` | 64x32 | 1 | 0 | A plank-and-rope bridge, drawn lying flat and horizontal, the same along its whole length: the game stretches it to the distance between two islands, turns it to point from one to the other, and tints it grey when not yet built. It must read in either isometric direction with a flip, so no left-right detail (no lantern on one end) and the top and bottom edges mirror each other |
| `map.backdrop` | 256x256 | 1 | 0 | Sea chart backdrop: deep blue water with soft wave lines and a faint compass rose, opaque. Seamless on all four edges (the game tiles it mirrored at 50 % alpha, so it must look calm, not busy). Replaces the current 320x180 |

**`map.isle6` and the Dawnspire alias.** Until the art thread adds `map.isle6` to the manifest, the game draws Warlord's Crown from the manifest's existing `map.dawnspire` (the code keeps that alias; the v1 manifest is not edited by the code). Add `map.isle6` as a new key, and leave `map.dawnspire` in the manifest. Once `map.isle6` is in, the alias line in `apps/web/src/art/fromManifest.ts` (`mapKey`) can be dropped.

The Map's old 32x32 icons (`map.home` to `map.isle5`, `map.dawnspire`) draw at 4x until replaced.
