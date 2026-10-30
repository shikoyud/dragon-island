# PixelLab prompts (art v1)

Generated with the PixelLab MCP tools on 2026-10-29. Prompts describe our own designs only. The eggs and hatchlings are the same files as `apps/web/public/art/v1/` (same prompts, same 32×32 size), so the waitlist and the game share one look. The full asset list for both apps is in `apps/web/art/prompts.md`.

## Shared style line

> cute chunky pixel art creature or item, 1px dark outline, limited palette, soft shading, transparent background, centered

Scenes add their own lighting: night for the waitlist hero, warm daylight for the game island.

## Element design lines

| Element | Egg | Hatchling |
| --- | --- | --- |
| flame | ember orange shell with dark red speckles and a wavy flame band | ember orange scales, cream belly, two stubby horns, tiny wings, flame tipped tail |
| sea | ocean blue shell with pale aqua wave stripes | ocean blue scales, pale aqua belly, fin crest on head, finned tail |
| terra | warm brown shell with tan pebble spots and a crack-like ridge | warm brown scales, rocky plates on back, blunt nose horn |
| nature | leaf green shell with light green leaf pattern | leaf green scales, leaf shaped ears, vine tail with a leaf tip |
| electric | bright yellow shell with a dark gold zigzag bolt stripe | bright yellow scales, zigzag crest, bolt shaped tail tip |
| ice | pale cyan shell with white frost crystal spots | pale cyan scales, white belly, small frost crystal spikes on back |
| metal | steel grey shell with riveted bands | steel grey scales, armor plates, small angular horns |
| dark | deep violet shell with small glowing lilac star dots | violet scales, curved horns, smoky shadow tail, glowing eyes |
| light | cream gold shell with a soft white glowing ring band | cream gold scales, small halo ring above head, feathery wingtips |

Egg prompt: `dragon egg, <egg line>`. Hatchling prompt: `baby dragon hatchling sitting, <hatchling line>`.

War has no prompts yet, including its icon, and uses the drawn fallback (a dark red block) until the art list lands.

## Assets

| Key | File | Size | Frames | fps | Source |
| --- | --- | --- | --- | --- | --- |
| `egg.<element>` | `egg-<element>.png` | 32×32 | 6 | 8 | `create_1_direction_object` (size 32, one 64-item batch with the shared style line and the egg prompts). Wobble frames are rows sheared about the bottom edge (top row offsets 0, 2, 2, 0, −2, −2 px). |
| `hatchling.<element>` | `hatchling-<element>.png` | 32×32 | 4 | 4 | Same batch, hatchling prompts. Breathing frames move the upper 45% of the sprite down 0, 0, 1, 1 px. |
| `icon.<element>` | `icon-<element>.png` | 32×32 | 1 | 0 | Same batch: `element icon: <orange flame / blue water droplet / brown rock boulder / green leaf / yellow lightning bolt / cyan snowflake / grey gear cog / violet crescent moon / cream gold sun> emblem`. |
| `hero.base` | `hero.png` | 256×180 | 1 | 0 | `create_image_pixen` 320×180, seed 7: "a small floating island in a starry night sky, grassy top with a few round trees, a cosy stone nest and glowing dragon eggs, waterfall pouring off one edge, rocky underside with hanging roots, deep navy and violet sky with soft stars, chunky pixel art, 1px dark outline, limited palette, night lighting". Cropped to the centred 256 px so the 2× hero fits its column. |
| `hero.layer.0` | `hero-layer-0.png` | 256×180 | 6 | 8 | The waterfall's own pixels, each column cycled downward by one sixth of its length per frame; transparent elsewhere. |
| `ui.panel` | `ui-panel.png` | 24×24 | 1 | 0 | Hand-drawn 9-slice frame (8 px slices): night-violet fill, light top-left bevel. |
| `ui.button` | `ui-button.png` | 24×16 | 1 | 0 | Hand-drawn amber button frame in the same style. |

The PixelLab trial (40 generations) was spent on this set and the game set, so the animations, the hero layer and the UI frames were built in code from the PixelLab stills rather than with PixelLab's animation or UI tools. Replace them in a later art version if a paid plan is available.
