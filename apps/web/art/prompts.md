# PixelLab prompts (art v1)

Generated with the PixelLab MCP tools on 2026-10-29 for `public/art/v1/`. Prompts describe our own designs only and never name another game or its style. The eggs, hatchlings and their design lines are shared with the waitlist site (`apps/waitlist/art/prompts.md`); the egg and hatchling PNGs are byte-identical in both apps.

## Shared style line

> cute chunky pixel art creature or item, 1px dark outline, limited palette, soft shading, transparent background, centered

The 16 px batch used: "cute chunky pixel art item, 1px dark outline, limited palette, transparent background, centered, small readable icon". Scenes and habitats add "chunky pixel art, 1px dark outline, limited palette, warm daylight".

## Species design lines (adult dragons)

Prompt: `young adult dragon standing on four legs, <line>`. Species ids are the element names in the launch catalog.

| Species | Design line |
| --- | --- |
| flame | ember orange scales, cream belly, two short horns, small bat wings, flame tipped tail |
| sea | ocean blue scales, pale aqua belly, fin crest along back, finned tail |
| terra | warm brown scales, heavy rocky plates on back, blunt nose horn |
| nature | leaf green scales, leaf shaped ears and wings, vine tail with a leaf tip |
| electric | bright yellow scales, zigzag crest, bolt shaped tail tip |
| ice | pale cyan scales, white belly, frost crystal spikes on back |
| metal | steel grey scales, riveted armor plates, small angular horns |
| dark | violet scales, curved horns, smoky shadow tail, glowing eyes |
| light | cream gold scales, small halo ring above head, feathery wings |

Egg and hatchling lines: see the waitlist prompts file.

War has no prompts yet, including its icon, and uses the drawn fallback (`FALLBACK_PALETTE.war`) until the art list lands.

## Generation runs

| Run | Tool | Cost | Used for |
| --- | --- | --- | --- |
| 32 px batch | `create_1_direction_object`, size 32, 64 item descriptions | 10 | eggs, hatchlings, 32 px icons (waitlist), nest, farm plot |
| 48 px batch | `create_1_direction_object`, size 48, 16 item descriptions | 10 | adult dragons (dark is the second take), hoard, hatchery |
| 16 px batch | `create_1_direction_object`, size 16, 54 item descriptions | 10 | crop stages, 16 px icons, cursor |
| Island | `create_image_pixen` 480×272, seed 11 | 1 | `island.base` |
| Habitats | `create_image_pixen` 96×64, seed 21, transparent | 7 | flame, sea, terra, nature, electric, ice (plus one discarded flame take) |
| Habitats (paid plan) | `create_image_pixen` 96×64, seed 21, transparent | 3 | metal, dark, light (replaced the trial-era recolours) |
| Habitat test | `create_image_pixflux` img2img from the sea tile | 1 | discarded (kept the sea colours) |
| Waitlist hero | `create_image_pixen` 320×180, seed 7 | 1 | waitlist `hero.base` |
| Base-building habitats | `create_image_pixen` 80×64, seed 21 (ice, metal, dark, light: seed 22 with "large … filling the whole canvas"), transparent | 14 | the nine habitats re-cut to the 5×5 footprint, plus the nexus (4 discarded first takes were too small) |
| Base-building 16 px | `create_1_direction_object`, size 16, 28 item descriptions | 10 | small decorations, bush, rock, locked land |
| Base-building 32 px | `create_1_direction_object`, size 32, 54 item descriptions | 10 | 2×2 decorations, tree, boulder, sign, map icons |
| Base-building 48 px | `create_1_direction_object`, size 48, 16 item descriptions | 10 | 3×3 decorations, ruin |

The first seven runs are the whole 40-generation trial. Everything below marked "code" was made locally from these PixelLab images.

## Assets

| Key | File | Size | Frames | fps | Prompt / method |
| --- | --- | --- | --- | --- | --- |
| `egg.<element>` | `egg-<element>.png` | 32×32 | 6 | 8 | `dragon egg, <egg line>`; code: rows sheared about the bottom edge, top row offset 0, 2, 2, 0, −2, −2 px |
| `hatchling.<element>` | `hatchling-<element>.png` | 32×32 | 4 | 4 | `baby dragon hatchling sitting, <hatchling line>`; code: upper 45% moved down 0, 0, 1, 1 px (breathing) |
| `dragon.<species>` | `dragon-<species>.png` | 48×48 | 4 | 4 | species line above; same breathing code |
| `habitat.<element>` | `habitat-<element>.png` | 80×64 | 1 | 0 | "flat square ground tile seen from above at a three-quarter angle, open flat top of <surface>, thin <rim> rim, short earth side, nothing standing on it, simple, chunky pixel art, 1px dark outline, limited palette, warm daylight". Surfaces / rims: flame black volcanic rock with glowing orange lava cracks / dark stone; sea clear blue pond water with two lily pads / grey stone; terra packed brown clay earth in low terraces with small boulders / sandstone; nature lush green grass with tiny ferns and flowers / mossy stone with vines; electric dark slate with copper coils and glowing yellow sparks / copper; ice (seed 23) pale blue frosted stone slabs dusted with white snow and a few small ice crystals / pale ice; metal riveted steel plates with a small glowing forge vent grate / iron; dark purple-black shadow stone with glowing violet runes / dark purple stone; light polished white marble with a gold sunburst inlay / gold trim. |
| `building.nexus` | `nexus.png` | 80×64 | 1 | 0 | seed 22, template opening "flat square ground tile seen from the front at a three-quarter angle with its edges running horizontal" (matches the habitats' angle): pale grey flagstone with a glowing rainbow prism crystal in the centre, nine small stone pillars each topped with a different coloured gem |
| `building.nest` | `nest.png` | 32×32 | 1 | 0 | dragon nest of woven twigs and straw, bowl shaped, empty |
| `building.hatchery` | `hatchery.png` | 64×64 | 1 | 0 | `create_image_pixen` seed 21: small stone hatchery hall with a round domed roof and four warm-lit arched egg niches along its front, standing on a flat square stone base with a short earth side, seen from above at a three-quarter angle, simple, chunky pixel art, 1px dark outline, limited palette, warm daylight |
| `building.farmPlot` | `farm-plot.png` | 32×32 | 1 | 0 | `create_image_pixen` seed 21: flat square farm plot seen from above at a three-quarter angle, tilled dark soil bed in rows with a low wooden plank border and a small wooden stake marker in one corner, short earth side, nothing growing, (style line) |
| `building.hoard` | `hoard.png` | 64×64 | 1 | 0 | `create_image_pixen` seed 21: dragon treasure hoard: a heap of gold coins and colourful gems spilling from an open iron-banded wooden chest, on a flat square stone base with a short earth side, seen from above at a three-quarter angle, (style line) |
| `crop.sprout` | `crop-sprout.png` | 16×16 | 4 stages | 0 | tiny green seed sprout in soil / small green seedling with two leaves / leafy green herb plant / bushy green herb with white flowers |
| `crop.bushel` | `crop-bushel.png` | 16×16 | 4 stages | 0 | tiny wheat sprout in soil / short green wheat stalks / tall green wheat with heads forming / ripe golden wheat bushel |
| `crop.harvest` | `crop-harvest.png` | 16×16 | 4 stages | 0 | tiny vine sprout in soil / small curling pumpkin vine / pumpkin vine with a small green pumpkin / ripe orange pumpkin |
| `crop.bounty` | `crop-bounty.png` | 16×16 | 4 stages | 0 | tiny sapling in soil / small berry bush / berry bush with green berries / berry bush full of ripe red berries |
| `icon.<element>` | `icon-<element>.png` | 16×16 | 1 | 0 | `<orange flame / blue water droplet / brown rock / green leaf / yellow lightning bolt / cyan snowflake / grey gear cog / violet crescent moon / cream gold sun> icon` |
| `ui.cursor` | `ui-cursor.png` | 16×16 | 1 | 0 | small arrow mouse pointer cursor, white with dark outline |
| `ui.panel` | `ui-panel.png` | 24×24 | 1 | 0 | code: hand-drawn 9-slice frame, same as the waitlist |
| `ui.button` | `ui-button.png` | 24×16 | 1 | 0 | code: hand-drawn amber button frame, same as the waitlist |
| `island.base` | `island.png` | 480×270 | 1 | 0 | "a large green floating island seen from slightly above, wide flat grassy meadow covering most of the island with open empty space, a few small round trees and flowers along the edges, a sandy shore strip at the bottom, rocky cliff underside, bright blue daytime sky with soft white clouds around it, …" (480×272, one row trimmed top and bottom) |
| `island.layer.0` | `island-layer-0.png` | 480×270 | 6 | 4 | code: 240 fixed water pixels (seeded) twinkle through two highlight colours, transparent elsewhere |

Crop sheets are growth stages, not an animation: the island model shows the frame for the current growth fraction (fps 0).

## Base-building set (2026-10-29)

Shared object line: "top-down prop for a pixel art island builder game, three-quarter view from above, chunky pixel art, 1px dark outline, limited palette, warm daylight, transparent background, centered" ("small … garden prop" at 16 px, "large … landmark prop" at 48 px). Each slot got three or four item descriptions in the batch; the pick is the candidate index. Item text follows `docs/art/base-building-art-list.md`.

Cleanup (code, `process.cjs` in the art session): alpha forced to 0 or 255, stray specks not touching the main shape removed (habitats keep the main shape only, which strips the debris the seed-22 takes drew in the corners), then the shape is placed bottom-centre on the exact canvas so it stands on the footprint's bottom edge. `island.locked` is a full-bleed tile and keeps its pixels as drawn.

| Key | Size | Batch pick | Item description used |
| --- | --- | --- | --- |
| `decoration.stonePath` | 16×16 | 16 px #2 | three flat round grey paving stones with moss between them |
| `decoration.picketFence` | 16×16 | 16 px #4 | two weathered wooden fence posts joined by one rail |
| `decoration.flowerPatch` | 16×16 | 16 px #10 | little clump of colourful wildflowers with green leaves |
| `decoration.emberLantern` | 16×16 | 16 px #14 | standing iron lantern on a post, warm ember light |
| `obstacle.bush` | 16×16 | 16 px #17 | round tangled thorny shrub with small thorns |
| `obstacle.rock` | 16×16 | 16 px #20 | rounded grey rock with a flat yellow-green lichen patch |
| `island.locked` | 16×16 | tileset | the all-lower base tile of `create_topdown_tileset` (standard, 16 px): lower "dark blue-grey night fog drifting over dim ground, soft low mist", upper "green grass meadow"; tiles seamlessly, no padlock |
| `decoration.driftwoodBench` | 32×32 | 32 px #1 | pale driftwood bench on two stumps |
| `decoration.hayCart` | 32×32 | 32 px #5 | small hay cart with two wooden wheels full of straw |
| `decoration.shellFountain` | 32×32 | 32 px #9 | stone fountain with a big spiral shell pouring water into a basin |
| `decoration.crystalCluster` | 32×32 | 32 px #12 | cluster of tall blue-violet crystals with pale highlights |
| `decoration.eggTotem` | 32×32 | 32 px #18 | tribal carved post holding three painted dragon eggs |
| `decoration.dawnObelisk` | 32×32 | 32 px #22 | dark stone obelisk with glowing gold sunrise carving |
| `obstacle.tree` | 32×32 | 32 px #24 | gnarled dead-looking leafless tree with tangled roots |
| `obstacle.boulder` | 32×32 | 32 px #30 | huge mossy grey rock split by a crack |
| `island.sign` | 32×32 | 32 px #33 | wooden signpost with a golden plus sign painted on the board |
| `map.home` | 32×32 | 32 px #37 | small grassy island with a little thatched hut, map icon |
| `map.isle2` | 32×32 | 32 px #40 | tiny island with one palm tree on sand, map icon |
| `map.isle3` | 32×32 | 32 px #43 | rocky island with a waterfall pouring off its edge, map icon |
| `map.isle4` | 32×32 | 32 px #46 | green island with one tall pointed stone spire, map icon |
| `map.isle5` | 32×32 | 32 px #48 | island crowned with dark storm clouds and lightning, map icon |
| `map.dawnspire` | 32×32 | 32 px #52 | sky island with a shining gold peak and sunrise behind, map icon |
| `decoration.moonwell` | 48×48 | 48 px #1 | old round stone well filled with shimmering silver water and a crescent reflection |
| `decoration.boneArch` | 48×48 | 48 px #3 | gateway arch made of two huge curved ivory ribs |
| `decoration.skyShrine` | 48×48 | 48 px #7 | little open shrine pavilion on pillars, curly cloud carved roof, chimes |
| `decoration.starPool` | 48×48 | 48 px #9 | circular pool of dark water scattered with floating star lights |
| `decoration.dragonColossus` | 48×48 | 48 px #13 | huge mossy stone dragon statue coiled on a plinth, wings half spread |
| `obstacle.ruin` | 48×48 | 48 px #15 | ancient broken stone columns and wall rubble with green vines |

### Fix round (same day)

| Run | Tool | Cost | Used for |
| --- | --- | --- | --- |
| Buildings | `create_image_pixen` 64×64 hatchery and hoard, 32×32 farm plot, seeds 21 and 22 | 6 | seed 21 of each (seed 22 hatchery was a boxy temple; seed 22 hoard was a heavier chest with less spill) |
| Ice habitat | `create_image_pixen` 80×64, seeds 21 and 23 | 2 | seed 23 (70×49, same angle and depth as the others) |
| Nexus | `create_image_pixen` 80×64, seeds 22 and 23 | 2 | seed 22 |
| Locked land | `create_image_pixen` 16×16 and 32×32 "seamless fog" | 2 | discarded: framed, not tileable |
| Locked land | `create_topdown_tileset` standard 16 px | 1 | its all-fog base tile |

`building.nest` keeps its 32×32 batch sprite. Hatchery eggs and waiting hatchlings still use the old `hatcherySpot` offsets, so they sit over the dome.

## HUD, iso ground and animation set (2026-10-30)

Keys follow `docs/art/hud-art-list.md`. Cleanup (code): alpha forced to 0 or 255; dragons, hatchlings, eggs and the sign keep their main shape only (stray specks removed); habitats keep everything (embers, sparks and motes are part of the loop). `top` is the fewest transparent top rows across a sheet's frames. Total spend this round: 284 generations (1,656 left of 2,000 on 2026-10-30).

| Run | Tool | Cost | Used for |
| --- | --- | --- | --- |
| Ground (outlined) | `create_tiles_pro` isometric 32 px, view angle 30, depth 0, seed 31 | 10 | discarded except as a check (1 px outline shows a grid when tiled) |
| Ground (seamless) | `create_tiles_pro` isometric 32 px, view angle 30, depth 0, `outline_mode` segmentation, seed 33: "1). bright green meadow grass 2). … flowers 3). … pebbles 4). darker lush green grass with clover 5). clear blue sea water with small white wave highlights 6). shallow turquoise water over sand 7). dark blue-grey night fog 8). grass with small tufts" | 10 | `ground.grass.0/1/2` (tiles 0, 5, 6), water start frame (tile 10) |
| Cloud fog | same settings, seed 34: "soft white and pale grey fluffy cloud fog completely covering the ground" ×4 | 10 | `ground.fog` (tile 12) |
| Cliffs | `create_tiles_pro` isometric 32 px, view angle 30, depth 0.6, seed 32: "green grass top with a tall layered brown dirt cliff side with small roots" (+3 others) | 10 | `ground.cliff.sw/se` (tile 4) |
| Cliffs (wrong view) | same, `tile_view` side, seed 31 | 10 | discarded: flat 2 px diamond |
| Shore set | `create_tiles_pro` tileset "grass to water", seed 31 | 10 | not used yet (corner set with block sides; kept in the PixelLab account) |
| HUD sheets | `create_ui_asset` ×3 (256², 512×288, 256²), seeds 41–43, warm brown wood + amber gold | 45 | style source only (`ui.*` small pieces were redrawn at native size below) |
| HUD pieces | `create_image_pro_flash` seed 61/63, style image = 48×48 crop of the pill sheet's icon slot (24×16 crop for the bars) | 35 | `ui.button.round`, `ui.button.round.active`, `ui.avatarFrame`, `ui.close` (16 px, no style), `ui.pill`, `ui.xpBar` (8 middle rows of a 24×16), `ui.tab` |
| Icons | `create_image_pro_flash` 32×32 seed 51, style image `icon-light.png`, "game UI icon: <subject>, chunky pixel art icon, 1px dark outline, centered, transparent background" | 80 (+3 heavy-load failures, not charged) | `icon.<name>.32`; `.16` is a 2× mode downsample in code |
| Sign | `create_image_pro_flash` 32×32 seed 62, style = 32×32 crop of `hatchery.png` | 5 | `island.sign` |
| Map backdrop | `create_map_object` 320×180 high top-down lineless | 2 runs | run 1 drew a corner island (discarded); run 2 "open deep blue ocean … wave contour lines like an old sea chart, a faint pale compass rose … no land" → `map.backdrop` |
| Animations | `animate_image` (1 generation each) on frame 0 of the v1 sprite, frame_count 4; sheet = input + first 3 generated frames | 44 | see below |
| FX starts | `create_image_pro_flash` 32×32 hammer + dust, 48×48 egg burst, seed 64 | 10 | start frames for `fx.construction` / `fx.hatch` |

Subjects: food meat drumstick on the bone; gold stack of gold coins; dris round violet and teal crystal token coin with a small dragon claw emblem; xp glowing blue five-point star; timer brass hourglass; build wooden hammer; map rolled-open parchment map with a red X; season green banner flag with a leaf and sun emblem; leaderboard golden trophy cup; referral two hands shaking with a small green plus; settings grey metal cog; dragons cute green dragon head in profile; breed two small dragon eggs with a pink heart; battle two crossed swords over a small round shield; hoard open chest overflowing with coins and gems; store market stall with a red and white striped awning.

Animation actions (seed): dragons (71) "gentle breathing idle loop: chest rises and falls, wings shift slightly, tail sways a little, feet stay planted, returns to the starting pose" (terra re-rolled with seed 81 "subtle breathing … back spikes keep their exact shape"; flame uses generated frames 1–4 because frame 0 has a ground shadow the others lack); hatchlings (72) "baby dragon breathing idle loop …" (light re-rolled, seed 81, "the golden halo stays floating above its head"); eggs (73) "egg wobbles gently side to side … settles back upright"; habitats (74) one line per element (lava cracks glow and embers flicker / pond ripples and glints / dust motes drift / grass and ferns sway / sparks between copper coils / frost sparkles (re-rolled seed 82) / forge vent glows with steam / runes pulse / sunburst shimmers), platform held still; `ground.water` (75) wave shimmer on the 32×32 tile, cropped to the 32×16 diamond; `crop.<crop>.sway` (76, sprout re-rolled 82) on the ripe stage; `fx.construction` (77) hammer strike loop; `fx.hatch` (77) frame_count 6, input + 5 generated frames.

## GDD M1 set (2026-10-30)

Keys follow `docs/art/gdd-m1-art-list.md`. Cleanup (code): alpha forced to 0 or 255; dragons, juveniles, hatchlings and the egg keep their main shape only; the habitat, crops, sway loops and coins keep everything. Sprites are placed bottom-centre. Animation sheets are the input plus three generated frames (seven for `fx.coins`); a frame that jumped or changed colour was skipped, as listed below.

| Run | Tool | Cost | Used for |
| --- | --- | --- | --- |
| War stills | `create_image_pro_flash` seed 91, style image = the metal sprite of the same slot (`color_palette` off) | 20 | `dragon.war`, `hatchling.war`, `egg.war`, `habitat.war` |
| War icon | `create_image_pro_flash` 32×32 seeds 91 and 92, style image `icon-battle-32.png` | 10 | seed 92; seed 91 was too small. Gold trim recoloured to iron in code; `.16` is a 2× mode downsample; `icon.war` is the same 16 px image because `elementIcon` reads the unsuffixed key |
| Golden Aerie | `edit_image_pro_flash` and `edit_image_pixen` on `nexus.png`, seed 91 | 6 | pro flash (warmer light); bounding box is identical to the Nexus |
| Juveniles | `edit_image_pixen` on frame 0 of each adult, 40×40, seed 93 (flame: seed 94, adds "remove the grey ground shadow") | 11 | ten `juvenile.<species>` starts; flame seed 93 is the one discarded |
| Crops | `create_1_direction_object` size 16, 36 item descriptions | 10 | growth frames; picks below |
| Frost berries ripe | `create_image_pixen` 16×16 seed 93 (discarded), `create_image_pro_flash` 16×16 seed 95, style image the v1 ripe bounty stage | 6 | `crop.frostBerries` frame 2 |
| Coins start | `create_image_pro_flash` 32×32 seed 96 | 5 | `fx.coins` frame 0 |
| Animations | `animate_image` (1 generation each) on the cleaned still | 24 | see below |

Prompts: adult "young adult dragon standing on four legs, three-quarter view facing left, crimson red scales, darker maroon belly plates, iron grey spikes along the back, iron horn guards on two short horns, small bat wings, spiked iron tail tip, (style line)"; hatchling "baby dragon hatchling sitting, crimson red scales, darker maroon belly, tiny iron grey spikes on its head and back, small iron horn nubs, stubby tail with an iron spike tip, big eyes, (style line)"; egg "dragon egg, crimson red shell with two dark iron bands riveted around it, (item style line), upright"; habitat "flat square isometric ground platform seen from above at a three-quarter angle, dark iron plate slab with rivets and a short earth side, a burning iron brazier in the centre, two small crimson war banners on iron poles at the back corners, nothing else standing on it, (scene style line)", with the pale cross the model drew on the banners filled crimson in code; icon "game UI icon: large crimson red heater shield filling the whole canvas, two crossed dark iron spears with iron shafts behind it, the spear tips reaching the corners, chunky pixel art icon, 1px dark outline, centered, transparent background, bold and readable at small size"; juvenile edit "the same dragon one growth stage younger: juvenile, slightly bigger head, shorter legs, same colours, same design details and same facing, standing on four legs, 1px dark outline"; Aerie edit "make the whole platform gold plated: polished gold flagstones and gold rim, gold pillars, warm golden light glowing from the central crystal, keep the exact same shape, silhouette and gems"; coins "a small burst of five shiny gold coins popping upward from a central point, coins spread in a low arc, cute chunky pixel art effect, 1px dark outline, limited palette, transparent background, centered".

Crop items (batch index; sprout / growing / ripe): `dragonBush` 3 / 4 / 5 tiny low green sprout with scale patterned leaves, medium green scaly-leaved bush, round green scaly-leaved bush covered with bright red berries; `emberWheat` 6 / 7 / 8 short green wheat sprout, medium wheat stalks green turning orange, tall wheat stalks with glowing orange ears; `seaMelon` 12 / 13 / 14 tiny curling blue-green vine sprout, blue-green vine with a tiny striped melon, large round blue-green striped melon on a vine; `thunderPumpkin` 18 / 19 / 20 tiny pumpkin vine sprout with yellow-green leaves, pumpkin vine with a small pale yellow pumpkin, bright yellow pumpkin with a dark zig-zag lightning pattern; `frostBerries` 27 / 28 / seed 95 pale blue-green seedling with frost, small frosty twig with a few pale blue buds, a bunch of six round pale icy blue berries hanging from a short white frosted twig; `warlordPepper` 33 / 34 / 32 small dark green seedling with red stem, dark green pepper plant with a small red pepper, large crimson red pepper with a dark iron grey cap and stem.

Animation actions (seed; generated frames used): adult and juveniles (71; 1, 2, 3, metal 1, 3, 4) "gentle breathing idle loop: chest rises and falls, wings shift slightly, tail sways a little, feet stay planted, returns to the starting pose", with a clause holding plates, spikes or armour to their exact shape on terra, metal and War; `juvenile.light` (82; 1, 2, 3) adds "the flat golden halo keeps the exact same flat oval shape" after seed 71 turned the halo; hatchling (81; 1, 3, 4) "subtle baby dragon breathing idle loop: chest rises and falls one pixel, body stays in place sitting still, tail tip moves slightly, head stays facing the same way, returns to the starting pose" (seed 72 discarded); egg (81; 1, 2, 3) "egg wobbles gently side to side, tilting a little left then right, the bottom stays planted, the iron bands keep their exact position on the shell, settles back upright" (seed 73 squashed the bands, discarded); habitat (74; 1, 2, 3) "brazier flames flicker and small embers rise, the crimson banners ripple gently in the wind; the iron platform, poles and brazier bowl stay completely still"; `crop.<cropId>.sway` (76; bush, melon, pumpkin 1, 3, 4; berries 1, 2, 4; wheat, pepper 1, 2, 3) one line per crop on the ripe stage, frame 0 byte-identical to frame 2 of the growth sheet; `fx.coins` (77; 1 to 7, frame_count 8) "gold coins fly outward and upward from the centre, arc over, fall and fade away one by one until almost nothing remains".

## GDD M2 set (2026-10-31)

Keys follow `docs/art/gdd-m2-art-list.md`. Cleanup (code): alpha forced to 0 or 255, specks of 1 to 3 pixels dropped (detached halos and wisps stay). Adult and juvenile sheets are the cleaned still plus the three generated frames closest to it, chosen in code by coverage drift, floating pixels, colour shift and foot-line shift, then checked by eye. Buildings are moved bottom-centre on the canvas.

| Run | Tool | Cost | Used for |
| --- | --- | --- | --- |
| Hybrid adults | `edit_image_pixen` on frame 0 of the primary Basic, 48×48, seed 101 (rerolls 102, 104) | 101 | `dragon.<hybrid>` start frames |
| Legendary adults | `edit_image_pixen` on frame 0 of the primary Basic, seed 103 | 5 | `dragon.<legendary>` start frames |
| Juveniles | `edit_image_pixen` on the cleaned adult, 40×40, seed 93 | 96 | `juvenile.<id>` start frames |
| Idles | `animate_image` (1 generation each), frame_count 4, seed 71 (11 rerolled, seed 82) | 203 | all 192 dragon and juvenile sheets |
| Mountain, Grove level 1 | `create_image_pro_flash` 80×80, style image `hatchery.png` (Grove `color_palette` off), seeds 106 and 105 (Mountain seed 105 discarded: base too small) | 15 | `building.mountain.1`, `building.grove.1` |
| Building upgrades | `edit_image_pixen` on level 1 (Hatchery: on `hatchery.png`), seeds 105 and 106 | 9 | `building.mountain.2/3`, `building.grove.2/3`, `building.hatchery.2/3/4` |
| War egg loop (waitlist) | `animate_image` on frame 0 of `egg-war.png`, frame_count 6, seed 81, same action as the M1 egg; sheet = input + five generated frames | 1 | waitlist `egg.war`; `hatchling.war` and `icon.war` are copies of the game's `hatchling-war.png` and `icon-war-32.png` |
| Book | one discarded `edit_image_pixen`, then drawn in code | 1 | `book.unknown`: the metal Basic's outline in flat dark grey with a question mark, so it shows no element (the edited version kept the sea tail, discarded) |

`building.hatchery.1` is not added: the art list allows level 1 to stay the existing `building.hatchery`.

Hybrid prompt: "same dragon, same pose and facing, keep the <primary body>, <accents>, tail <accent>, 1px dark outline, transparent background". Primary bodies: earth-brown body and stone plates; ember red-orange body (plus "no ground shadow"); blue body; green body and leaf frills; bright yellow body; pale cyan body; steel-grey riveted body; deep violet body; white and gold body and halo; crimson body and iron spikes. Accents: terra grey or brown stone plate studs, tan pebble textured belly, stone club tail; flame orange ember flame tail tip, glowing horn tips; sea blue fin crests, pale foam-white belly, blue fin tail; nature green leaf frills, vines on legs and tail, leaf tail; electric yellow spark crest, zig-zag lightning stripes, bolt tail tip; ice pale blue frost crystal spikes, white rime, ice crystal tail tip; metal steel rivet studs, plated claws, steel tail tip; dark a few violet shadow wisps, dim glowing eye, smoke tail tip; light small flat golden halo, gold trim, gold star tail; war dark iron spikes, iron horn guards, iron spiked tail tip.

Reroll prompts where the accent read too faintly (`dark-war`, `dark-metal`, `nature-metal`, `nature-war`, `electric-war`, `sea-metal`, `metal-war`, `light-metal`, `light-war`): metal "bright polished steel plates with visible rivets on the back and chest, steel plated legs and claws, steel horn caps"; war "big sharp iron grey spikes standing tall along the whole back, iron helmet guards on the horns, crimson red chest plate, big iron spiked ball on the tail". `terra-dark` was rerolled at seed 102 because seed 101 turned the whole body dark.

Legendary prompts ("same pose and facing, turn this into a regal legendary <name> dragon: ..., ornate and majestic, 1px dark outline, transparent background"): `magma-sovereign` from terra, glowing lava cracks, three tall stone horns, tall flames along the back; `glacier-warlord` from ice, ornate dark iron armour, tall iron helm, jagged ice crystal wings, crimson sash; `radiant-aegis` from light, polished steel plate with gold rivets, shield crest, double ring halo, steel-feathered wings; `last-light` from light, dark iron spiked pauldrons, sunburst halo, huge white wings edged in crimson; `final-dawn` from light, carved stone plates with gold inlay, stone and gold sun disc, white wings fading to dawn gold, stone club tail with a gold band.

Juvenile edit: "the same dragon one growth stage younger: juvenile, slightly bigger head, shorter legs, same colours, same design details and same facing, standing on four legs, 1px dark outline". Idle: "gentle breathing idle loop: chest rises and falls, tail sways a little, feet stay planted, plates, spikes, armour and halo keep their exact shape, returns to the starting pose"; rerolls: "very subtle breathing idle loop: chest rises and falls one pixel, tail sways slightly, the feet stay exactly on the same ground line, colours do not change, nothing new appears, returns to the starting pose" on adult `dark-nature`, `dark-light`, `dark-ice`, `last-light`, `flame-electric`, `metal-sea`, `radiant-aegis` and juvenile `flame-ice`, `electric-nature`, `dark-electric`, `war-electric`.

Buildings: Mountain "isometric game building filling the whole canvas width, breeding mountain: a rocky mountain peak with a dark cave mouth at its front and a flat stone altar ledge before the cave, earth-brown and grey stone, one small ember brazier on the ledge, wide diamond shaped rocky base touching the left and right edges of the canvas and the bottom edge"; Grove "isometric game building, breeding grove: a ring of broad leafy trees around a mossy clearing with a flat stone at its centre, green foliage and soft gold light, sitting on a diamond shaped grassy base, the front of the clearing is open and visible"; level edits as listed in the art list, each starting "the same <building>, same base".

## GDD M3 set (2026-10-31)

Keys follow `docs/art/gdd-m3-art-list.md`. Each Roost tier is an edit of the tier before it. Cleanup (code): sprite moved so the bottom-centre of its lowest row sits on the bottom edge at x=32; specks of 1 to 3 pixels dropped on Tiers 1 to 4 (Tier 5 keeps its motes). `icon.quests.*` is not generated: nothing reads it, the HUD keeps the built-in glyph.

| Run | Tool | Cost | Used for |
| --- | --- | --- | --- |
| Roost Tier 1 | `create_image_pro_flash` 64�64, style image `hatchery.png`, seed 301 | 5 | `building.roost.1` |
| Roost Tiers 2 to 5 | `edit_image_pixen`, seeds 302, 307, 309, 310 (candidates 303, 304, 305, 306, 308, 311 discarded) | 10 | `building.roost.2` to `.5` |
| Goal mark | `edit_image_pixen` on `ui-close.png`, seed 322 (two `create_image_pixen` tries, seeds 320 and 321, discarded: tick off the plate) | 3 | `ui.goal` |
| Level-up | drawn in code: two rising 2:1 rings in gold-white with dithered fade, ground glow, four-point stars (no generation; the `level_up` part of `vfx_workbench` was tried for free and dropped, it is a pillar with arrows, not a ring) | 0 | `fx.levelUp` |

Tier 1: "isometric game building filling the whole canvas width, dragon roost: a low round nest of woven branches and straw sitting on a small stone base shaped like a wide diamond, one single carved wooden perch post rising beside the nest, a few warm-grey feathers in the nest, the base touches the left and right edges of the canvas and the bottom edge, 1px dark outline, transparent background, no dragon, no egg".

Tier 2: "the same dragon roost, same stone base, same angle: the nest deeper and wider, a dark wooden rim around the nest, add a second carved perch post on the left side, a small red banner hanging from the right post". Tier 3: "the same dragon roost, keep the big round nest exactly as wide and visible: taller stone plinth as wide as before with carved steps at the front, a narrow thatched straw awning spanning between the tops of the two back posts, leaning over only the back of the nest, no front posts, two crimson banners"; asking for a canopy on the posts instead gives a wishing well that hides the nest. Tier 4: "the same dragon roost, keep the same plinth, steps and big round nest fully visible: the back canopy is now built of grey stone slabs on dark timber beams, the beam ends curve upward like dragon horns, bronze bands on the posts and bronze trim along the plinth, warm orange light glowing in the middle of the nest, crimson banners with gold edge"; without "in the middle of" the nest turns into a lava pool. Tier 5: "the same dragon roost, same plinth shape, steps and round nest, now ascended: all stone becomes pale ivory marble with gold trim, posts and horns become white and gold, canopy of pale gold-trimmed stone, a floating golden halo ring hovering above the canopy, radiant white-gold light spilling from the nest, small glowing light motes drifting in the air, white and gold banners". All end "1px dark outline, transparent background".

Goal mark: "same round badge and black outline: the plate becomes bright green with a gold rim, replace the X with one bold white-gold check mark tick".
