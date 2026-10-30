# Dragon Island M2 art list (GDD breeding)

For the art thread to generate with PixelLab. It commits only PNGs, `apps/web/public/art/<version>/manifest.json` and `docs/art`; the web code reads the keys below and falls back until each one lands, so the game runs before the art does. Missing keys are fine: nothing here blocks a release, and the client sends no request for a key the manifest lacks.

Style: the v1 set's palette and 1 px dark outline, transparent background, original designs only (do not base anything on other games). Sheets are one horizontal strip of equal frames; the manifest entry gives `w`/`h` per frame, `frames` and `fps` (the loader loops any sheet with `frames > 1` and `fps > 0`). Reduced-motion players see frame 0, so frame 0 must read well on its own. Same facing as the Basic `dragon.<element>` sheets, feet on the bottom-centre.

Element ids are `terra flame sea nature electric ice metal dark light war`. Species ids come from `packages/game-core/src/data/species-rows.ts` (`SPECIES_ROWS`); the key suffix is the species id exactly, with its hyphens.

**Projection.** Same as `docs/art/hud-art-list.md`: isometric 2:1, bottom-centre of a building sprite on its footprint diamond's bottom vertex.

**Hybrid look (GDD 2.3).** The first element in the id is the primary: it sets the body and the palette. The second sets the accents (spikes, crests, trim, glow). `flame-sea` (a flame-red body with sea fins) and `sea-flame` (a blue body with ember tips) are different dragons: never mirror one into the other. The tri-hybrid `flame-ice-sea` has flame as body, ice as its main accent and a sea touch. Reuse each element's Basic design language so a hybrid reads as a relative of its primary Basic (`dragon.flame`, `dragon.sea` and so on), at the same proportions, but with its own silhouette.

**Generation budget.** One generation here means one finished sheet (a key below); a sheet may take several PixelLab calls. Counts by group, each with a `dragon.<id>` (48x48) and a `juvenile.<id>` (40x40):

| Group | Species | Sheets |
|---|---|---|
| Epics and the tri-hybrid | 9 | 18 |
| Rares | 34 | 68 |
| Uncommons | 48 | 96 |
| Legendaries | 5 | 10 |
| Dragon and juvenile total | 96 | 192 |
| Buildings (Mountain 3, Grove 3, Hatchery 4) | | 10 |
| `book.unknown` | | 1 |
| Waitlist War set (egg, hatchling, icon) | | 3 |
| **Total** | | **206** |

Priority order if the budget runs short: Epics and the tri-hybrid, then Rares, then Uncommons, then Legendaries. Within a group do the `dragon.<id>` first, then its juvenile. A species with no sheet is drawn with its primary Basic's sheet, so a missing one is never blank. The buildings and `book.unknown` are cheap and visible on day one: do them before the Uncommons.

Silhouettes in the Dragon Book (R22) need no art of their own.

## Breeding buildings

A Mountain or Grove will have a 5x5 footprint from M4, so its sprite is 80x80 with the bottom-centre on the footprint's bottom vertex (the diamond is 80x40 wide and the art rises above it). Draw and keep them at 80x80: until M4 the buildings stand on a 2-cell footprint (R9) and the game draws the sheets smaller with `BREEDER_ART_SCALE` (`apps/web/src/game/islandModel.ts`), so nothing here needs a smaller size. The Hatchery is a 4x4 footprint at 64x64 (as `building.hatchery` today, with its four egg niches in the same places: `layout.ts` `HATCHERY_NICHES`). Each level should read as an upgrade of the one before: same silhouette base, more ornament. The Hatchery's fifth slot is a one-off purchase, not a level, and has no sheet. Fallbacks: a missing level uses the next lower level's sheet, then `building.nest` (breeders) or `building.hatchery` (Hatchery).

| Key | Frame (px) | Frames | fps | Description |
|---|---|---|---|---|
| `building.mountain.1` | 80x80 | 1 | 0 | Breeding Mountain level 1: a rocky peak with a cave mouth and a flat stone altar ledge at its front, earth-brown and grey stone, a small ember brazier |
| `building.mountain.2` | 80x80 | 1 | 0 | Level 2: the same peak, taller, with carved stone steps, banner poles and two braziers |
| `building.mountain.3` | 80x80 | 1 | 0 | Level 3: the same peak crowned with a stone ring, carved dragon-horn pillars and a warm glow in the cave |
| `building.grove.1` | 80x80 | 1 | 0 | Breeding Grove level 1: a ring of broad trees around a mossy clearing with a flat stone, green and soft gold light |
| `building.grove.2` | 80x80 | 1 | 0 | Level 2: the same grove, fuller, with hanging flowers and a small spring |
| `building.grove.3` | 80x80 | 1 | 0 | Level 3: the same grove with glowing blossoms and a pale gold glow over the clearing (the premium level) |
| `building.hatchery.1` | 64x64 | 1 | 0 | Hatchery level 1: a low stone hall with four egg niches along the front arc |
| `building.hatchery.2` | 64x64 | 1 | 0 | Level 2: same hall and niches, with a tiled roof and torches |
| `building.hatchery.3` | 64x64 | 1 | 0 | Level 3: same hall, a higher roof and gold-trimmed niches |
| `building.hatchery.4` | 64x64 | 1 | 0 | Level 4: same hall, a crested roof and warm glowing niches |

Level 1 of the Hatchery may simply be the existing `building.hatchery`; add `building.hatchery.1` only if the art differs.

## Dragon Book

| Key | Frame (px) | Frames | fps | Description |
|---|---|---|---|---|
| `book.unknown` | 48x48 | 1 | 0 | Stand-in for an undiscovered species that has no sprite of its own yet: a plain dark-grey dragon-shaped mark with a small question mark, no element colours (it must not reveal the species) |

## Waitlist War set

For `apps/waitlist/public/art/v1/` (its own manifest, keys without a number suffix: `egg.war`, `hatchling.war`, `icon.war`). Match the other nine elements there: the same style line, and the same file naming (`egg-war.png`, `hatchling-war.png`, `icon-war.png`). War palette: crimson base `#a32638`, dark `#5e1420`, light `#d9566a`, iron grey plate, no gold trim. The waitlist currently draws a dark red block for War.

| Key | Frame (px) | Frames | fps | Description |
|---|---|---|---|---|
| `egg.war` | 32x32 | 6 | 8 | Crimson egg with iron banding and small iron studs, wobble loop (rests upright on frame 0); same frame count and fps as the waitlist's other eggs |
| `hatchling.war` | 32x32 | 4 | 4 | War hatchling, crimson scales with small iron horn nubs, breathing idle; same frame count and fps as the other waitlist hatchlings |
| `icon.war` | 32x32 | 1 | 0 | Element icon: crossed iron spears over a crimson shield, as `icon.war.32` in the game set |

## Hybrid and Legendary dragons, in priority order

Adults are 48x48 (as `dragon.<element>`), juveniles 40x40 (as `juvenile.<element>`), 4 to 6 frames at 6 fps, breathing idle, same facing as the Basics. The hatchling stage and the egg stay the primary element's (`hatchling.<element>`, `egg.<element>`), so they need no new art. The Legendaries' names come from the GDD; their looks below come from their two elements only, so design each as an original dragon.

## Epics and the tri-hybrid (9 species, 18 sheets)

| Key | Frame (px) | Frames | fps | Description |
|---|---|---|---|---|
| `dragon.terra-dark` | 48x48 | 4 to 6 | 6 | Adult Terra-Dark (epic): earth-brown scales and stone plates (terra) with shadow wisps and dim glowing eyes (dark) |
| `juvenile.terra-dark` | 40x40 | 4 to 6 | 6 | Juvenile Terra-Dark: same design, proportions and palette as `dragon.terra-dark`, smaller, breathing idle |
| `dragon.flame-ice` | 48x48 | 4 to 6 | 6 | Adult Flame-Ice (epic): ember red-orange scales (flame) with frost spikes and white rime (ice) |
| `juvenile.flame-ice` | 40x40 | 4 to 6 | 6 | Juvenile Flame-Ice: same design, proportions and palette as `dragon.flame-ice`, smaller, breathing idle |
| `dragon.sea-war` | 48x48 | 4 to 6 | 6 | Adult Sea-War (epic): blue scales (sea) with iron spikes and horn guards (war) |
| `juvenile.sea-war` | 40x40 | 4 to 6 | 6 | Juvenile Sea-War: same design, proportions and palette as `dragon.sea-war`, smaller, breathing idle |
| `dragon.nature-electric` | 48x48 | 4 to 6 | 6 | Adult Nature-Electric (epic): green scales and leaf frills (nature) with a spark crest and zig-zag stripes (electric) |
| `juvenile.nature-electric` | 40x40 | 4 to 6 | 6 | Juvenile Nature-Electric: same design, proportions and palette as `dragon.nature-electric`, smaller, breathing idle |
| `dragon.electric-nature` | 48x48 | 4 to 6 | 6 | Adult Electric-Nature (epic): yellow scales (electric) with leaf frills and vine wraps (nature) |
| `juvenile.electric-nature` | 40x40 | 4 to 6 | 6 | Juvenile Electric-Nature: same design, proportions and palette as `dragon.electric-nature`, smaller, breathing idle |
| `dragon.ice-flame` | 48x48 | 4 to 6 | 6 | Adult Ice-Flame (epic): pale cyan scales (ice) with ember-tipped tail and horn glow (flame) |
| `juvenile.ice-flame` | 40x40 | 4 to 6 | 6 | Juvenile Ice-Flame: same design, proportions and palette as `dragon.ice-flame`, smaller, breathing idle |
| `dragon.dark-terra` | 48x48 | 4 to 6 | 6 | Adult Dark-Terra (epic): deep violet scales (dark) with stone-plate studs and a tan pebble belly (terra) |
| `juvenile.dark-terra` | 40x40 | 4 to 6 | 6 | Juvenile Dark-Terra: same design, proportions and palette as `dragon.dark-terra`, smaller, breathing idle |
| `dragon.war-sea` | 48x48 | 4 to 6 | 6 | Adult War-Sea (epic): crimson scales and iron spikes (war) with fin crests and a pale foam belly (sea) |
| `juvenile.war-sea` | 40x40 | 4 to 6 | 6 | Juvenile War-Sea: same design, proportions and palette as `dragon.war-sea`, smaller, breathing idle |
| `dragon.flame-ice-sea` | 48x48 | 4 to 6 | 6 | Adult Flame-Ice-Sea (epic): ember red-orange scales (flame) with ice accents (frost spikes and white rime) and a sea touch (fin crests and a pale foam belly) |
| `juvenile.flame-ice-sea` | 40x40 | 4 to 6 | 6 | Juvenile Flame-Ice-Sea: same design, proportions and palette as `dragon.flame-ice-sea`, smaller, breathing idle |

## Rares (34 species, 68 sheets)

| Key | Frame (px) | Frames | fps | Description |
|---|---|---|---|---|
| `dragon.terra-flame` | 48x48 | 4 to 6 | 6 | Adult Terra-Flame (rare): earth-brown scales and stone plates (terra) with ember-tipped tail and horn glow (flame) |
| `juvenile.terra-flame` | 40x40 | 4 to 6 | 6 | Juvenile Terra-Flame: same design, proportions and palette as `dragon.terra-flame`, smaller, breathing idle |
| `dragon.terra-electric` | 48x48 | 4 to 6 | 6 | Adult Terra-Electric (rare): earth-brown scales and stone plates (terra) with a spark crest and zig-zag stripes (electric) |
| `juvenile.terra-electric` | 40x40 | 4 to 6 | 6 | Juvenile Terra-Electric: same design, proportions and palette as `dragon.terra-electric`, smaller, breathing idle |
| `dragon.terra-metal` | 48x48 | 4 to 6 | 6 | Adult Terra-Metal (rare): earth-brown scales and stone plates (terra) with rivet studs and plated claws (metal) |
| `juvenile.terra-metal` | 40x40 | 4 to 6 | 6 | Juvenile Terra-Metal: same design, proportions and palette as `dragon.terra-metal`, smaller, breathing idle |
| `dragon.terra-war` | 48x48 | 4 to 6 | 6 | Adult Terra-War (rare): earth-brown scales and stone plates (terra) with iron spikes and horn guards (war) |
| `juvenile.terra-war` | 40x40 | 4 to 6 | 6 | Juvenile Terra-War: same design, proportions and palette as `dragon.terra-war`, smaller, breathing idle |
| `dragon.flame-terra` | 48x48 | 4 to 6 | 6 | Adult Flame-Terra (rare): ember red-orange scales (flame) with stone-plate studs and a tan pebble belly (terra) |
| `juvenile.flame-terra` | 40x40 | 4 to 6 | 6 | Juvenile Flame-Terra: same design, proportions and palette as `dragon.flame-terra`, smaller, breathing idle |
| `dragon.flame-sea` | 48x48 | 4 to 6 | 6 | Adult Flame-Sea (rare): ember red-orange scales (flame) with fin crests and a pale foam belly (sea) |
| `juvenile.flame-sea` | 40x40 | 4 to 6 | 6 | Juvenile Flame-Sea: same design, proportions and palette as `dragon.flame-sea`, smaller, breathing idle |
| `dragon.flame-nature` | 48x48 | 4 to 6 | 6 | Adult Flame-Nature (rare): ember red-orange scales (flame) with leaf frills and vine wraps (nature) |
| `juvenile.flame-nature` | 40x40 | 4 to 6 | 6 | Juvenile Flame-Nature: same design, proportions and palette as `dragon.flame-nature`, smaller, breathing idle |
| `dragon.sea-flame` | 48x48 | 4 to 6 | 6 | Adult Sea-Flame (rare): blue scales (sea) with ember-tipped tail and horn glow (flame) |
| `juvenile.sea-flame` | 40x40 | 4 to 6 | 6 | Juvenile Sea-Flame: same design, proportions and palette as `dragon.sea-flame`, smaller, breathing idle |
| `dragon.sea-nature` | 48x48 | 4 to 6 | 6 | Adult Sea-Nature (rare): blue scales (sea) with leaf frills and vine wraps (nature) |
| `juvenile.sea-nature` | 40x40 | 4 to 6 | 6 | Juvenile Sea-Nature: same design, proportions and palette as `dragon.sea-nature`, smaller, breathing idle |
| `dragon.sea-electric` | 48x48 | 4 to 6 | 6 | Adult Sea-Electric (rare): blue scales (sea) with a spark crest and zig-zag stripes (electric) |
| `juvenile.sea-electric` | 40x40 | 4 to 6 | 6 | Juvenile Sea-Electric: same design, proportions and palette as `dragon.sea-electric`, smaller, breathing idle |
| `dragon.nature-flame` | 48x48 | 4 to 6 | 6 | Adult Nature-Flame (rare): green scales and leaf frills (nature) with ember-tipped tail and horn glow (flame) |
| `juvenile.nature-flame` | 40x40 | 4 to 6 | 6 | Juvenile Nature-Flame: same design, proportions and palette as `dragon.nature-flame`, smaller, breathing idle |
| `dragon.nature-sea` | 48x48 | 4 to 6 | 6 | Adult Nature-Sea (rare): green scales and leaf frills (nature) with fin crests and a pale foam belly (sea) |
| `juvenile.nature-sea` | 40x40 | 4 to 6 | 6 | Juvenile Nature-Sea: same design, proportions and palette as `dragon.nature-sea`, smaller, breathing idle |
| `dragon.nature-ice` | 48x48 | 4 to 6 | 6 | Adult Nature-Ice (rare): green scales and leaf frills (nature) with frost spikes and white rime (ice) |
| `juvenile.nature-ice` | 40x40 | 4 to 6 | 6 | Juvenile Nature-Ice: same design, proportions and palette as `dragon.nature-ice`, smaller, breathing idle |
| `dragon.nature-light` | 48x48 | 4 to 6 | 6 | Adult Nature-Light (rare): green scales and leaf frills (nature) with a halo crest and gold trim (light) |
| `juvenile.nature-light` | 40x40 | 4 to 6 | 6 | Juvenile Nature-Light: same design, proportions and palette as `dragon.nature-light`, smaller, breathing idle |
| `dragon.electric-terra` | 48x48 | 4 to 6 | 6 | Adult Electric-Terra (rare): yellow scales (electric) with stone-plate studs and a tan pebble belly (terra) |
| `juvenile.electric-terra` | 40x40 | 4 to 6 | 6 | Juvenile Electric-Terra: same design, proportions and palette as `dragon.electric-terra`, smaller, breathing idle |
| `dragon.electric-sea` | 48x48 | 4 to 6 | 6 | Adult Electric-Sea (rare): yellow scales (electric) with fin crests and a pale foam belly (sea) |
| `juvenile.electric-sea` | 40x40 | 4 to 6 | 6 | Juvenile Electric-Sea: same design, proportions and palette as `dragon.electric-sea`, smaller, breathing idle |
| `dragon.electric-metal` | 48x48 | 4 to 6 | 6 | Adult Electric-Metal (rare): yellow scales (electric) with rivet studs and plated claws (metal) |
| `juvenile.electric-metal` | 40x40 | 4 to 6 | 6 | Juvenile Electric-Metal: same design, proportions and palette as `dragon.electric-metal`, smaller, breathing idle |
| `dragon.electric-light` | 48x48 | 4 to 6 | 6 | Adult Electric-Light (rare): yellow scales (electric) with a halo crest and gold trim (light) |
| `juvenile.electric-light` | 40x40 | 4 to 6 | 6 | Juvenile Electric-Light: same design, proportions and palette as `dragon.electric-light`, smaller, breathing idle |
| `dragon.ice-nature` | 48x48 | 4 to 6 | 6 | Adult Ice-Nature (rare): pale cyan scales (ice) with leaf frills and vine wraps (nature) |
| `juvenile.ice-nature` | 40x40 | 4 to 6 | 6 | Juvenile Ice-Nature: same design, proportions and palette as `dragon.ice-nature`, smaller, breathing idle |
| `dragon.ice-metal` | 48x48 | 4 to 6 | 6 | Adult Ice-Metal (rare): pale cyan scales (ice) with rivet studs and plated claws (metal) |
| `juvenile.ice-metal` | 40x40 | 4 to 6 | 6 | Juvenile Ice-Metal: same design, proportions and palette as `dragon.ice-metal`, smaller, breathing idle |
| `dragon.ice-war` | 48x48 | 4 to 6 | 6 | Adult Ice-War (rare): pale cyan scales (ice) with iron spikes and horn guards (war) |
| `juvenile.ice-war` | 40x40 | 4 to 6 | 6 | Juvenile Ice-War: same design, proportions and palette as `dragon.ice-war`, smaller, breathing idle |
| `dragon.metal-terra` | 48x48 | 4 to 6 | 6 | Adult Metal-Terra (rare): steel-grey scales and riveted plates (metal) with stone-plate studs and a tan pebble belly (terra) |
| `juvenile.metal-terra` | 40x40 | 4 to 6 | 6 | Juvenile Metal-Terra: same design, proportions and palette as `dragon.metal-terra`, smaller, breathing idle |
| `dragon.metal-electric` | 48x48 | 4 to 6 | 6 | Adult Metal-Electric (rare): steel-grey scales and riveted plates (metal) with a spark crest and zig-zag stripes (electric) |
| `juvenile.metal-electric` | 40x40 | 4 to 6 | 6 | Juvenile Metal-Electric: same design, proportions and palette as `dragon.metal-electric`, smaller, breathing idle |
| `dragon.metal-ice` | 48x48 | 4 to 6 | 6 | Adult Metal-Ice (rare): steel-grey scales and riveted plates (metal) with frost spikes and white rime (ice) |
| `juvenile.metal-ice` | 40x40 | 4 to 6 | 6 | Juvenile Metal-Ice: same design, proportions and palette as `dragon.metal-ice`, smaller, breathing idle |
| `dragon.metal-dark` | 48x48 | 4 to 6 | 6 | Adult Metal-Dark (rare): steel-grey scales and riveted plates (metal) with shadow wisps and dim glowing eyes (dark) |
| `juvenile.metal-dark` | 40x40 | 4 to 6 | 6 | Juvenile Metal-Dark: same design, proportions and palette as `dragon.metal-dark`, smaller, breathing idle |
| `dragon.dark-metal` | 48x48 | 4 to 6 | 6 | Adult Dark-Metal (rare): deep violet scales (dark) with rivet studs and plated claws (metal) |
| `juvenile.dark-metal` | 40x40 | 4 to 6 | 6 | Juvenile Dark-Metal: same design, proportions and palette as `dragon.dark-metal`, smaller, breathing idle |
| `dragon.dark-light` | 48x48 | 4 to 6 | 6 | Adult Dark-Light (rare): deep violet scales (dark) with a halo crest and gold trim (light) |
| `juvenile.dark-light` | 40x40 | 4 to 6 | 6 | Juvenile Dark-Light: same design, proportions and palette as `dragon.dark-light`, smaller, breathing idle |
| `dragon.dark-war` | 48x48 | 4 to 6 | 6 | Adult Dark-War (rare): deep violet scales (dark) with iron spikes and horn guards (war) |
| `juvenile.dark-war` | 40x40 | 4 to 6 | 6 | Juvenile Dark-War: same design, proportions and palette as `dragon.dark-war`, smaller, breathing idle |
| `dragon.light-nature` | 48x48 | 4 to 6 | 6 | Adult Light-Nature (rare): white and gold scales (light) with leaf frills and vine wraps (nature) |
| `juvenile.light-nature` | 40x40 | 4 to 6 | 6 | Juvenile Light-Nature: same design, proportions and palette as `dragon.light-nature`, smaller, breathing idle |
| `dragon.light-electric` | 48x48 | 4 to 6 | 6 | Adult Light-Electric (rare): white and gold scales (light) with a spark crest and zig-zag stripes (electric) |
| `juvenile.light-electric` | 40x40 | 4 to 6 | 6 | Juvenile Light-Electric: same design, proportions and palette as `dragon.light-electric`, smaller, breathing idle |
| `dragon.light-dark` | 48x48 | 4 to 6 | 6 | Adult Light-Dark (rare): white and gold scales (light) with shadow wisps and dim glowing eyes (dark) |
| `juvenile.light-dark` | 40x40 | 4 to 6 | 6 | Juvenile Light-Dark: same design, proportions and palette as `dragon.light-dark`, smaller, breathing idle |
| `dragon.war-terra` | 48x48 | 4 to 6 | 6 | Adult War-Terra (rare): crimson scales and iron spikes (war) with stone-plate studs and a tan pebble belly (terra) |
| `juvenile.war-terra` | 40x40 | 4 to 6 | 6 | Juvenile War-Terra: same design, proportions and palette as `dragon.war-terra`, smaller, breathing idle |
| `dragon.war-ice` | 48x48 | 4 to 6 | 6 | Adult War-Ice (rare): crimson scales and iron spikes (war) with frost spikes and white rime (ice) |
| `juvenile.war-ice` | 40x40 | 4 to 6 | 6 | Juvenile War-Ice: same design, proportions and palette as `dragon.war-ice`, smaller, breathing idle |
| `dragon.war-dark` | 48x48 | 4 to 6 | 6 | Adult War-Dark (rare): crimson scales and iron spikes (war) with shadow wisps and dim glowing eyes (dark) |
| `juvenile.war-dark` | 40x40 | 4 to 6 | 6 | Juvenile War-Dark: same design, proportions and palette as `dragon.war-dark`, smaller, breathing idle |

## Uncommons (48 species, 96 sheets)

| Key | Frame (px) | Frames | fps | Description |
|---|---|---|---|---|
| `dragon.terra-sea` | 48x48 | 4 to 6 | 6 | Adult Terra-Sea (uncommon): earth-brown scales and stone plates (terra) with fin crests and a pale foam belly (sea) |
| `juvenile.terra-sea` | 40x40 | 4 to 6 | 6 | Juvenile Terra-Sea: same design, proportions and palette as `dragon.terra-sea`, smaller, breathing idle |
| `dragon.terra-nature` | 48x48 | 4 to 6 | 6 | Adult Terra-Nature (uncommon): earth-brown scales and stone plates (terra) with leaf frills and vine wraps (nature) |
| `juvenile.terra-nature` | 40x40 | 4 to 6 | 6 | Juvenile Terra-Nature: same design, proportions and palette as `dragon.terra-nature`, smaller, breathing idle |
| `dragon.terra-ice` | 48x48 | 4 to 6 | 6 | Adult Terra-Ice (uncommon): earth-brown scales and stone plates (terra) with frost spikes and white rime (ice) |
| `juvenile.terra-ice` | 40x40 | 4 to 6 | 6 | Juvenile Terra-Ice: same design, proportions and palette as `dragon.terra-ice`, smaller, breathing idle |
| `dragon.terra-light` | 48x48 | 4 to 6 | 6 | Adult Terra-Light (uncommon): earth-brown scales and stone plates (terra) with a halo crest and gold trim (light) |
| `juvenile.terra-light` | 40x40 | 4 to 6 | 6 | Juvenile Terra-Light: same design, proportions and palette as `dragon.terra-light`, smaller, breathing idle |
| `dragon.flame-electric` | 48x48 | 4 to 6 | 6 | Adult Flame-Electric (uncommon): ember red-orange scales (flame) with a spark crest and zig-zag stripes (electric) |
| `juvenile.flame-electric` | 40x40 | 4 to 6 | 6 | Juvenile Flame-Electric: same design, proportions and palette as `dragon.flame-electric`, smaller, breathing idle |
| `dragon.flame-metal` | 48x48 | 4 to 6 | 6 | Adult Flame-Metal (uncommon): ember red-orange scales (flame) with rivet studs and plated claws (metal) |
| `juvenile.flame-metal` | 40x40 | 4 to 6 | 6 | Juvenile Flame-Metal: same design, proportions and palette as `dragon.flame-metal`, smaller, breathing idle |
| `dragon.flame-dark` | 48x48 | 4 to 6 | 6 | Adult Flame-Dark (uncommon): ember red-orange scales (flame) with shadow wisps and dim glowing eyes (dark) |
| `juvenile.flame-dark` | 40x40 | 4 to 6 | 6 | Juvenile Flame-Dark: same design, proportions and palette as `dragon.flame-dark`, smaller, breathing idle |
| `dragon.flame-light` | 48x48 | 4 to 6 | 6 | Adult Flame-Light (uncommon): ember red-orange scales (flame) with a halo crest and gold trim (light) |
| `juvenile.flame-light` | 40x40 | 4 to 6 | 6 | Juvenile Flame-Light: same design, proportions and palette as `dragon.flame-light`, smaller, breathing idle |
| `dragon.flame-war` | 48x48 | 4 to 6 | 6 | Adult Flame-War (uncommon): ember red-orange scales (flame) with iron spikes and horn guards (war) |
| `juvenile.flame-war` | 40x40 | 4 to 6 | 6 | Juvenile Flame-War: same design, proportions and palette as `dragon.flame-war`, smaller, breathing idle |
| `dragon.sea-terra` | 48x48 | 4 to 6 | 6 | Adult Sea-Terra (uncommon): blue scales (sea) with stone-plate studs and a tan pebble belly (terra) |
| `juvenile.sea-terra` | 40x40 | 4 to 6 | 6 | Juvenile Sea-Terra: same design, proportions and palette as `dragon.sea-terra`, smaller, breathing idle |
| `dragon.sea-ice` | 48x48 | 4 to 6 | 6 | Adult Sea-Ice (uncommon): blue scales (sea) with frost spikes and white rime (ice) |
| `juvenile.sea-ice` | 40x40 | 4 to 6 | 6 | Juvenile Sea-Ice: same design, proportions and palette as `dragon.sea-ice`, smaller, breathing idle |
| `dragon.sea-metal` | 48x48 | 4 to 6 | 6 | Adult Sea-Metal (uncommon): blue scales (sea) with rivet studs and plated claws (metal) |
| `juvenile.sea-metal` | 40x40 | 4 to 6 | 6 | Juvenile Sea-Metal: same design, proportions and palette as `dragon.sea-metal`, smaller, breathing idle |
| `dragon.sea-dark` | 48x48 | 4 to 6 | 6 | Adult Sea-Dark (uncommon): blue scales (sea) with shadow wisps and dim glowing eyes (dark) |
| `juvenile.sea-dark` | 40x40 | 4 to 6 | 6 | Juvenile Sea-Dark: same design, proportions and palette as `dragon.sea-dark`, smaller, breathing idle |
| `dragon.sea-light` | 48x48 | 4 to 6 | 6 | Adult Sea-Light (uncommon): blue scales (sea) with a halo crest and gold trim (light) |
| `juvenile.sea-light` | 40x40 | 4 to 6 | 6 | Juvenile Sea-Light: same design, proportions and palette as `dragon.sea-light`, smaller, breathing idle |
| `dragon.nature-terra` | 48x48 | 4 to 6 | 6 | Adult Nature-Terra (uncommon): green scales and leaf frills (nature) with stone-plate studs and a tan pebble belly (terra) |
| `juvenile.nature-terra` | 40x40 | 4 to 6 | 6 | Juvenile Nature-Terra: same design, proportions and palette as `dragon.nature-terra`, smaller, breathing idle |
| `dragon.nature-metal` | 48x48 | 4 to 6 | 6 | Adult Nature-Metal (uncommon): green scales and leaf frills (nature) with rivet studs and plated claws (metal) |
| `juvenile.nature-metal` | 40x40 | 4 to 6 | 6 | Juvenile Nature-Metal: same design, proportions and palette as `dragon.nature-metal`, smaller, breathing idle |
| `dragon.nature-dark` | 48x48 | 4 to 6 | 6 | Adult Nature-Dark (uncommon): green scales and leaf frills (nature) with shadow wisps and dim glowing eyes (dark) |
| `juvenile.nature-dark` | 40x40 | 4 to 6 | 6 | Juvenile Nature-Dark: same design, proportions and palette as `dragon.nature-dark`, smaller, breathing idle |
| `dragon.nature-war` | 48x48 | 4 to 6 | 6 | Adult Nature-War (uncommon): green scales and leaf frills (nature) with iron spikes and horn guards (war) |
| `juvenile.nature-war` | 40x40 | 4 to 6 | 6 | Juvenile Nature-War: same design, proportions and palette as `dragon.nature-war`, smaller, breathing idle |
| `dragon.electric-flame` | 48x48 | 4 to 6 | 6 | Adult Electric-Flame (uncommon): yellow scales (electric) with ember-tipped tail and horn glow (flame) |
| `juvenile.electric-flame` | 40x40 | 4 to 6 | 6 | Juvenile Electric-Flame: same design, proportions and palette as `dragon.electric-flame`, smaller, breathing idle |
| `dragon.electric-ice` | 48x48 | 4 to 6 | 6 | Adult Electric-Ice (uncommon): yellow scales (electric) with frost spikes and white rime (ice) |
| `juvenile.electric-ice` | 40x40 | 4 to 6 | 6 | Juvenile Electric-Ice: same design, proportions and palette as `dragon.electric-ice`, smaller, breathing idle |
| `dragon.electric-dark` | 48x48 | 4 to 6 | 6 | Adult Electric-Dark (uncommon): yellow scales (electric) with shadow wisps and dim glowing eyes (dark) |
| `juvenile.electric-dark` | 40x40 | 4 to 6 | 6 | Juvenile Electric-Dark: same design, proportions and palette as `dragon.electric-dark`, smaller, breathing idle |
| `dragon.electric-war` | 48x48 | 4 to 6 | 6 | Adult Electric-War (uncommon): yellow scales (electric) with iron spikes and horn guards (war) |
| `juvenile.electric-war` | 40x40 | 4 to 6 | 6 | Juvenile Electric-War: same design, proportions and palette as `dragon.electric-war`, smaller, breathing idle |
| `dragon.ice-terra` | 48x48 | 4 to 6 | 6 | Adult Ice-Terra (uncommon): pale cyan scales (ice) with stone-plate studs and a tan pebble belly (terra) |
| `juvenile.ice-terra` | 40x40 | 4 to 6 | 6 | Juvenile Ice-Terra: same design, proportions and palette as `dragon.ice-terra`, smaller, breathing idle |
| `dragon.ice-sea` | 48x48 | 4 to 6 | 6 | Adult Ice-Sea (uncommon): pale cyan scales (ice) with fin crests and a pale foam belly (sea) |
| `juvenile.ice-sea` | 40x40 | 4 to 6 | 6 | Juvenile Ice-Sea: same design, proportions and palette as `dragon.ice-sea`, smaller, breathing idle |
| `dragon.ice-electric` | 48x48 | 4 to 6 | 6 | Adult Ice-Electric (uncommon): pale cyan scales (ice) with a spark crest and zig-zag stripes (electric) |
| `juvenile.ice-electric` | 40x40 | 4 to 6 | 6 | Juvenile Ice-Electric: same design, proportions and palette as `dragon.ice-electric`, smaller, breathing idle |
| `dragon.ice-dark` | 48x48 | 4 to 6 | 6 | Adult Ice-Dark (uncommon): pale cyan scales (ice) with shadow wisps and dim glowing eyes (dark) |
| `juvenile.ice-dark` | 40x40 | 4 to 6 | 6 | Juvenile Ice-Dark: same design, proportions and palette as `dragon.ice-dark`, smaller, breathing idle |
| `dragon.ice-light` | 48x48 | 4 to 6 | 6 | Adult Ice-Light (uncommon): pale cyan scales (ice) with a halo crest and gold trim (light) |
| `juvenile.ice-light` | 40x40 | 4 to 6 | 6 | Juvenile Ice-Light: same design, proportions and palette as `dragon.ice-light`, smaller, breathing idle |
| `dragon.metal-flame` | 48x48 | 4 to 6 | 6 | Adult Metal-Flame (uncommon): steel-grey scales and riveted plates (metal) with ember-tipped tail and horn glow (flame) |
| `juvenile.metal-flame` | 40x40 | 4 to 6 | 6 | Juvenile Metal-Flame: same design, proportions and palette as `dragon.metal-flame`, smaller, breathing idle |
| `dragon.metal-sea` | 48x48 | 4 to 6 | 6 | Adult Metal-Sea (uncommon): steel-grey scales and riveted plates (metal) with fin crests and a pale foam belly (sea) |
| `juvenile.metal-sea` | 40x40 | 4 to 6 | 6 | Juvenile Metal-Sea: same design, proportions and palette as `dragon.metal-sea`, smaller, breathing idle |
| `dragon.metal-nature` | 48x48 | 4 to 6 | 6 | Adult Metal-Nature (uncommon): steel-grey scales and riveted plates (metal) with leaf frills and vine wraps (nature) |
| `juvenile.metal-nature` | 40x40 | 4 to 6 | 6 | Juvenile Metal-Nature: same design, proportions and palette as `dragon.metal-nature`, smaller, breathing idle |
| `dragon.metal-light` | 48x48 | 4 to 6 | 6 | Adult Metal-Light (uncommon): steel-grey scales and riveted plates (metal) with a halo crest and gold trim (light) |
| `juvenile.metal-light` | 40x40 | 4 to 6 | 6 | Juvenile Metal-Light: same design, proportions and palette as `dragon.metal-light`, smaller, breathing idle |
| `dragon.metal-war` | 48x48 | 4 to 6 | 6 | Adult Metal-War (uncommon): steel-grey scales and riveted plates (metal) with iron spikes and horn guards (war) |
| `juvenile.metal-war` | 40x40 | 4 to 6 | 6 | Juvenile Metal-War: same design, proportions and palette as `dragon.metal-war`, smaller, breathing idle |
| `dragon.dark-flame` | 48x48 | 4 to 6 | 6 | Adult Dark-Flame (uncommon): deep violet scales (dark) with ember-tipped tail and horn glow (flame) |
| `juvenile.dark-flame` | 40x40 | 4 to 6 | 6 | Juvenile Dark-Flame: same design, proportions and palette as `dragon.dark-flame`, smaller, breathing idle |
| `dragon.dark-sea` | 48x48 | 4 to 6 | 6 | Adult Dark-Sea (uncommon): deep violet scales (dark) with fin crests and a pale foam belly (sea) |
| `juvenile.dark-sea` | 40x40 | 4 to 6 | 6 | Juvenile Dark-Sea: same design, proportions and palette as `dragon.dark-sea`, smaller, breathing idle |
| `dragon.dark-nature` | 48x48 | 4 to 6 | 6 | Adult Dark-Nature (uncommon): deep violet scales (dark) with leaf frills and vine wraps (nature) |
| `juvenile.dark-nature` | 40x40 | 4 to 6 | 6 | Juvenile Dark-Nature: same design, proportions and palette as `dragon.dark-nature`, smaller, breathing idle |
| `dragon.dark-electric` | 48x48 | 4 to 6 | 6 | Adult Dark-Electric (uncommon): deep violet scales (dark) with a spark crest and zig-zag stripes (electric) |
| `juvenile.dark-electric` | 40x40 | 4 to 6 | 6 | Juvenile Dark-Electric: same design, proportions and palette as `dragon.dark-electric`, smaller, breathing idle |
| `dragon.dark-ice` | 48x48 | 4 to 6 | 6 | Adult Dark-Ice (uncommon): deep violet scales (dark) with frost spikes and white rime (ice) |
| `juvenile.dark-ice` | 40x40 | 4 to 6 | 6 | Juvenile Dark-Ice: same design, proportions and palette as `dragon.dark-ice`, smaller, breathing idle |
| `dragon.light-terra` | 48x48 | 4 to 6 | 6 | Adult Light-Terra (uncommon): white and gold scales (light) with stone-plate studs and a tan pebble belly (terra) |
| `juvenile.light-terra` | 40x40 | 4 to 6 | 6 | Juvenile Light-Terra: same design, proportions and palette as `dragon.light-terra`, smaller, breathing idle |
| `dragon.light-flame` | 48x48 | 4 to 6 | 6 | Adult Light-Flame (uncommon): white and gold scales (light) with ember-tipped tail and horn glow (flame) |
| `juvenile.light-flame` | 40x40 | 4 to 6 | 6 | Juvenile Light-Flame: same design, proportions and palette as `dragon.light-flame`, smaller, breathing idle |
| `dragon.light-sea` | 48x48 | 4 to 6 | 6 | Adult Light-Sea (uncommon): white and gold scales (light) with fin crests and a pale foam belly (sea) |
| `juvenile.light-sea` | 40x40 | 4 to 6 | 6 | Juvenile Light-Sea: same design, proportions and palette as `dragon.light-sea`, smaller, breathing idle |
| `dragon.light-ice` | 48x48 | 4 to 6 | 6 | Adult Light-Ice (uncommon): white and gold scales (light) with frost spikes and white rime (ice) |
| `juvenile.light-ice` | 40x40 | 4 to 6 | 6 | Juvenile Light-Ice: same design, proportions and palette as `dragon.light-ice`, smaller, breathing idle |
| `dragon.light-metal` | 48x48 | 4 to 6 | 6 | Adult Light-Metal (uncommon): white and gold scales (light) with rivet studs and plated claws (metal) |
| `juvenile.light-metal` | 40x40 | 4 to 6 | 6 | Juvenile Light-Metal: same design, proportions and palette as `dragon.light-metal`, smaller, breathing idle |
| `dragon.light-war` | 48x48 | 4 to 6 | 6 | Adult Light-War (uncommon): white and gold scales (light) with iron spikes and horn guards (war) |
| `juvenile.light-war` | 40x40 | 4 to 6 | 6 | Juvenile Light-War: same design, proportions and palette as `dragon.light-war`, smaller, breathing idle |
| `dragon.war-flame` | 48x48 | 4 to 6 | 6 | Adult War-Flame (uncommon): crimson scales and iron spikes (war) with ember-tipped tail and horn glow (flame) |
| `juvenile.war-flame` | 40x40 | 4 to 6 | 6 | Juvenile War-Flame: same design, proportions and palette as `dragon.war-flame`, smaller, breathing idle |
| `dragon.war-nature` | 48x48 | 4 to 6 | 6 | Adult War-Nature (uncommon): crimson scales and iron spikes (war) with leaf frills and vine wraps (nature) |
| `juvenile.war-nature` | 40x40 | 4 to 6 | 6 | Juvenile War-Nature: same design, proportions and palette as `dragon.war-nature`, smaller, breathing idle |
| `dragon.war-electric` | 48x48 | 4 to 6 | 6 | Adult War-Electric (uncommon): crimson scales and iron spikes (war) with a spark crest and zig-zag stripes (electric) |
| `juvenile.war-electric` | 40x40 | 4 to 6 | 6 | Juvenile War-Electric: same design, proportions and palette as `dragon.war-electric`, smaller, breathing idle |
| `dragon.war-metal` | 48x48 | 4 to 6 | 6 | Adult War-Metal (uncommon): crimson scales and iron spikes (war) with rivet studs and plated claws (metal) |
| `juvenile.war-metal` | 40x40 | 4 to 6 | 6 | Juvenile War-Metal: same design, proportions and palette as `dragon.war-metal`, smaller, breathing idle |
| `dragon.war-light` | 48x48 | 4 to 6 | 6 | Adult War-Light (uncommon): crimson scales and iron spikes (war) with a halo crest and gold trim (light) |
| `juvenile.war-light` | 40x40 | 4 to 6 | 6 | Juvenile War-Light: same design, proportions and palette as `dragon.war-light`, smaller, breathing idle |

## Legendaries (5 species, 10 sheets)

| Key | Frame (px) | Frames | fps | Description |
|---|---|---|---|---|
| `dragon.magma-sovereign` | 48x48 | 4 to 6 | 6 | Adult Magma Sovereign (legendary): earth-brown scales and stone plates (terra) with ember-tipped tail and horn glow (flame); a one-of-a-kind design, more ornate than the Epics |
| `juvenile.magma-sovereign` | 40x40 | 4 to 6 | 6 | Juvenile Magma Sovereign: same design, proportions and palette as `dragon.magma-sovereign`, smaller, breathing idle |
| `dragon.glacier-warlord` | 48x48 | 4 to 6 | 6 | Adult Glacier Warlord (legendary): pale cyan scales (ice) with iron spikes and horn guards (war); a one-of-a-kind design, more ornate than the Epics |
| `juvenile.glacier-warlord` | 40x40 | 4 to 6 | 6 | Juvenile Glacier Warlord: same design, proportions and palette as `dragon.glacier-warlord`, smaller, breathing idle |
| `dragon.radiant-aegis` | 48x48 | 4 to 6 | 6 | Adult Radiant Aegis (legendary): white and gold scales (light) with rivet studs and plated claws (metal); a one-of-a-kind design, more ornate than the Epics |
| `juvenile.radiant-aegis` | 40x40 | 4 to 6 | 6 | Juvenile Radiant Aegis: same design, proportions and palette as `dragon.radiant-aegis`, smaller, breathing idle |
| `dragon.last-light` | 48x48 | 4 to 6 | 6 | Adult Last Light (legendary): white and gold scales (light) with iron spikes and horn guards (war); a one-of-a-kind design, more ornate than the Epics |
| `juvenile.last-light` | 40x40 | 4 to 6 | 6 | Juvenile Last Light: same design, proportions and palette as `dragon.last-light`, smaller, breathing idle |
| `dragon.final-dawn` | 48x48 | 4 to 6 | 6 | Adult Final Dawn (legendary): white and gold scales (light) with stone-plate studs and a tan pebble belly (terra); a one-of-a-kind design, more ornate than the Epics |
| `juvenile.final-dawn` | 40x40 | 4 to 6 | 6 | Juvenile Final Dawn: same design, proportions and palette as `dragon.final-dawn`, smaller, breathing idle |

