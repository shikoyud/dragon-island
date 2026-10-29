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
| Habitat test | `create_image_pixflux` img2img from the water tile | 1 | discarded (kept the water colours) |
| Waitlist hero | `create_image_pixen` 320×180, seed 7 | 1 | waitlist `hero.base` |

That is the whole 40-generation trial. Everything below marked "code" was made locally from these PixelLab images.

## Assets

| Key | File | Size | Frames | fps | Prompt / method |
| --- | --- | --- | --- | --- | --- |
| `egg.<element>` | `egg-<element>.png` | 32×32 | 6 | 8 | `dragon egg, <egg line>`; code: rows sheared about the bottom edge, top row offset 0, 2, 2, 0, −2, −2 px |
| `hatchling.<element>` | `hatchling-<element>.png` | 32×32 | 4 | 4 | `baby dragon hatchling sitting, <hatchling line>`; code: upper 45% moved down 0, 0, 1, 1 px (breathing) |
| `dragon.<species>` | `dragon-<species>.png` | 48×48 | 4 | 4 | species line above; same breathing code |
| `habitat.<element>` | `habitat-<element>.png` | 96×64 | 1 | 0 | "flat oval ground tile seen from above at a three-quarter angle, open flat top of <surface>, thin <rim> rim, short earth side, nothing standing on it, simple, …". Surfaces: fire black volcanic rock with glowing orange lava cracks; water clear blue pond with two lily pads; earth packed brown earth with small boulders; nature lush grass with tiny ferns and flowers; electric dark slate with glowing yellow crystal shards; ice white snow with pale blue ice crystals. Code: metal and dark are hue/saturation recolours of the electric tile, light is a warm recolour of the ice tile. |
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
