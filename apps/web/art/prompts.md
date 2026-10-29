# PixelLab prompts (art v1)

Generated with the PixelLab MCP tools on 2026-10-29 for `public/art/v1/`. Prompts describe our own designs only and never name another game or its style. The eggs, hatchlings and their design lines are shared with the waitlist site (`apps/waitlist/art/prompts.md`); the egg and hatchling PNGs are byte-identical in both apps.

## Shared style line

> cute chunky pixel art creature or item, 1px dark outline, limited palette, soft shading, transparent background, centered

The 16 px batch used: "cute chunky pixel art item, 1px dark outline, limited palette, transparent background, centered, small readable icon". Scenes and habitats add "chunky pixel art, 1px dark outline, limited palette, warm daylight".

## Species design lines (adult dragons)

Prompt: `young adult dragon standing on four legs, <line>`. Species ids are the element names in the launch catalog.

| Species | Design line |
| --- | --- |
| fire | ember orange scales, cream belly, two short horns, small bat wings, flame tipped tail |
| water | ocean blue scales, pale aqua belly, fin crest along back, finned tail |
| earth | warm brown scales, heavy rocky plates on back, blunt nose horn |
| nature | leaf green scales, leaf shaped ears and wings, vine tail with a leaf tip |
| electric | bright yellow scales, zigzag crest, bolt shaped tail tip |
| ice | pale cyan scales, white belly, frost crystal spikes on back |
| metal | steel grey scales, riveted armor plates, small angular horns |
| dark | violet scales, curved horns, smoky shadow tail, glowing eyes |
| light | cream gold scales, small halo ring above head, feathery wings |

Egg and hatchling lines: see the waitlist prompts file.

## Generation runs

| Run | Tool | Cost | Used for |
| --- | --- | --- | --- |
| 32 px batch | `create_1_direction_object`, size 32, 64 item descriptions | 10 | eggs, hatchlings, 32 px icons (waitlist), nest, farm plot |
| 48 px batch | `create_1_direction_object`, size 48, 16 item descriptions | 10 | adult dragons (dark is the second take), hoard, hatchery |
| 16 px batch | `create_1_direction_object`, size 16, 54 item descriptions | 10 | crop stages, 16 px icons, cursor |
| Island | `create_image_pixen` 480×272, seed 11 | 1 | `island.base` |
| Habitats | `create_image_pixen` 96×64, seed 21, transparent | 7 | fire, water, earth, nature, electric, ice (plus one discarded fire take) |
| Habitats (paid plan) | `create_image_pixen` 96×64, seed 21, transparent | 3 | metal, dark, light (replaced the trial-era recolours) |
| Habitat test | `create_image_pixflux` img2img from the water tile | 1 | discarded (kept the water colours) |
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
| `habitat.<element>` | `habitat-<element>.png` | 80×64 | 1 | 0 | "flat square ground tile seen from above at a three-quarter angle, open flat top of <surface>, thin <rim> rim, short earth side, nothing standing on it, simple, chunky pixel art, 1px dark outline, limited palette, warm daylight". Surfaces / rims: fire black volcanic rock with glowing orange lava cracks / dark stone; water clear blue pond water with two lily pads / grey stone; earth packed brown clay earth in low terraces with small boulders / sandstone; nature lush green grass with tiny ferns and flowers / mossy stone with vines; electric dark slate with copper coils and glowing yellow sparks / copper; ice white snow and pale blue frosted stone with small icicles on the rim / pale ice; metal riveted steel plates with a small glowing forge vent grate / iron; dark purple-black shadow stone with glowing violet runes / dark purple stone; light polished white marble with a gold sunburst inlay / gold trim. |
| `building.nexus` | `nexus.png` | 80×64 | 1 | 0 | same template: pale grey flagstone with a glowing rainbow prism crystal in the centre, nine small stone pillars each topped with a different coloured gem |
| `building.nest` | `nest.png` | 32×32 | 1 | 0 | dragon nest of woven twigs and straw, bowl shaped, empty |
| `building.hatchery` | `hatchery.png` | 48×48 | 1 | 0 | wooden hatchery hut with straw roof, round door and a warm lantern |
| `building.farmPlot` | `farm-plot.png` | 32×24 | 1 | 0 | small tilled farm plot of dark soil with wooden edge, empty (cropped from 32×32) |
| `building.hoard` | `hoard.png` | 48×48 | 1 | 0 | dragon treasure hoard: big pile of gold coins with gems and a small chest |
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
| `island.locked` | 16×16 | 16 px #27 | dim night grass tile with faint padlock, full square tile |
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

Not regenerated: `building.hatchery` and `building.hoard` stay 48×48 (the art list sizes them 64×64), `building.farmPlot` stays 32×24, `building.nest` 32×32.
