# Dragon Island M1 art list (GDD core loop)

For the art thread to generate with PixelLab. It commits only PNGs, `apps/web/public/art/<version>/manifest.json` and `docs/art`; the web code reads the keys below and falls back (a drawn placeholder) until each one lands, so the game runs before the art does. Missing keys are fine: nothing here blocks a release.

Style: the v1 set's palette and 1 px dark outline, transparent background, original designs only (do not base anything on other games). Sheets are one horizontal strip of equal frames; the manifest entry gives `w`/`h` per frame, `frames` and `fps` (the loader loops any sheet with `frames > 1` and `fps > 0`). Reduced-motion players see frame 0, so frame 0 must read well on its own.

Element ids are now `terra flame sea nature electric ice metal dark light war`. The old ids `fire water earth` no longer exist: do not use them in keys or file names. War is the tenth element: crimson and iron (palette base `#a32638`, dark `#5e1420`, light `#d9566a`), spiked plate and banners, no gold trim.

**Projection.** Same as `docs/art/hud-art-list.md`: isometric 2:1, bottom-centre of a building sprite on its footprint diamond's bottom vertex.

## War element

| Key | Frame (px) | Frames | fps | Description |
|---|---|---|---|---|
| `habitat.war` | 80x64 | 4 | 4 | War habitat platform: dark iron slab, crimson banners, a brazier flicker loop; platform does not move |
| `dragon.war` | 48x48 | 4 to 6 | 6 | Adult War dragon, breathing idle, same facing as the other `dragon.<element>` sheets: crimson scales, iron spikes and horn guards |
| `hatchling.war` | 32x32 | 4 to 6 | 6 | War hatchling, breathing idle, same rules |
| `egg.war` | 32x32 | 4 | 4 | Crimson egg with iron banding, wobble loop (rests upright on frame 0) |
| `icon.war.16` | 16x16 | 1 | 0 | Element icon: crossed iron spears over a crimson shield |
| `icon.war.32` | 32x32 | 1 | 0 | Same at 32 px |

## Juveniles (Lv 4-6)

One sheet per Basic species, 40x40, between the hatchling (32) and the adult (48): same design, proportions and palette as that species' hatchling and adult, so the three stages read as one dragon growing. Breathing idle, same facing as the adult, feet on the bottom-centre. Frame 0 must read well alone.

| Key | Frame (px) | Frames | fps | Description |
|---|---|---|---|---|
| `juvenile.terra` | 40x40 | 4 to 6 | 6 | Terra juvenile (earth-brown, stone plates) |
| `juvenile.flame` | 40x40 | 4 to 6 | 6 | Flame juvenile (ember red-orange, ember-tipped tail) |
| `juvenile.sea` | 40x40 | 4 to 6 | 6 | Sea juvenile (blue, fin crests) |
| `juvenile.nature` | 40x40 | 4 to 6 | 6 | Nature juvenile (green, leaf frills) |
| `juvenile.electric` | 40x40 | 4 to 6 | 6 | Electric juvenile (yellow, spark crest) |
| `juvenile.ice` | 40x40 | 4 to 6 | 6 | Ice juvenile (pale cyan, frost spikes) |
| `juvenile.metal` | 40x40 | 4 to 6 | 6 | Metal juvenile (steel grey, riveted plates) |
| `juvenile.dark` | 40x40 | 4 to 6 | 6 | Dark juvenile (deep violet, shadow wisps) |
| `juvenile.light` | 40x40 | 4 to 6 | 6 | Light juvenile (white and gold, halo crest) |
| `juvenile.war` | 40x40 | 4 to 6 | 6 | War juvenile (crimson, iron spikes) |

The species ids are the Basics' ids (`LAUNCH_CATALOG.species`), which equal the element ids. `juvenile.<species>` is already wired (Task B11); hybrids keep using their adult sheet until they get art.

## Buildings

| Key | Frame (px) | Frames | fps | Description |
|---|---|---|---|---|
| `building.goldenAerie` | 80x64 | 1 | 0 | Golden Aerie: a gold re-skin of the Nexus at exactly the same size and footprint (80x64, bottom-centre on the footprint's bottom vertex): gold-plated platform, warm light, same silhouette so it reads as a premium Nexus. Today the Aerie reuses the Nexus sprite; the code prefers this key whenever the manifest has it |

## Crops (GDD crops)

Six crops, each a 16x16 sheet with 3 growth frames (sprout, growing, ripe) plus a sway loop for the ripe stage. Frame 0 is the freshly planted stage. Keys use the GDD crop ids, not the old v1 tier names.

| Key | Frame (px) | Frames | fps | Description |
|---|---|---|---|---|
| `crop.dragonBush` | 16x16 | 3 | 0 | Dragon Bush: low green bush with scaly leaves and small red berries when ripe |
| `crop.emberWheat` | 16x16 | 3 | 0 | Ember Wheat: wheat stalks with glowing orange ears |
| `crop.seaMelon` | 16x16 | 3 | 0 | Sea Melon: blue-green striped melon on a vine |
| `crop.thunderPumpkin` | 16x16 | 3 | 0 | Thunder Pumpkin: yellow pumpkin with a zig-zag spark pattern |
| `crop.frostBerries` | 16x16 | 3 | 0 | Frost Berries: pale blue berries on a frosted twig |
| `crop.warlordPepper` | 16x16 | 3 | 0 | Warlord Pepper: crimson pepper with a dark iron-grey cap |
| `crop.<cropId>.sway` | 16x16 | 4 | 4 | Ripe-stage sway loop for each of the six crops (six sheets); same ripe art as frame 2 of the growth sheet, gently swaying; frame 0 equals the ripe frame |

All six `crop.<cropId>` sheets (and `.sway` loops) have landed; the code reads them directly.

## Effects

| Key | Frame (px) | Frames | fps | Description |
|---|---|---|---|---|
| `fx.coins` | 32x32 | 8 | 12 | Gold coin burst: coins pop up from the centre, arc and fade; played once (one-shot) when a gold badge is tapped; a drawn fallback (a small heap of coins) exists |

## Delivered (2026-10-30)

All keys above are in `apps/web/public/art/v1/manifest.json` (prompts and job details in `apps/web/art/prompts.md`; contact sheet `docs/art/gdd-m1-art-preview.png`). Every sheet matches the tables above, with 4 frames where a range was allowed. Additions and notes:

| Key | Note |
|---|---|
| `icon.war` | 16x16, same image as `icon.war.16`. Not in the list, but `elementIcon` reads `icon.<element>` for every element, so without it the War icon stays on its fallback |
| `habitat.war` | banners reach the top of the frame, so `top` is 0 and badges sit at the banner tips |
| `building.goldenAerie` | bounding box identical to `building.nexus` (x 2-78, y 10-64) |
| `crop.<cropId>` | 3 growth frames, as listed; the v1 stand-ins were 4, so `apps/web/test/art.test.ts` now expects 3 |
| `fx.coins` | frame 0 already shows the coins in a low arc, so it reads alone under reduced motion. Play it one-shot, as `IslandScene` does `fx.hatch` |