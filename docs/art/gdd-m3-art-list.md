# Dragon Island M3 art list (GDD progression)

For the art thread to generate with PixelLab. It commits only PNGs, `apps/web/public/art/<version>/manifest.json` and `docs/art`; the web code reads the keys below and falls back until each one lands, so the game runs before the art does. Missing keys are fine: nothing here blocks a release, and the client sends no request for a key the manifest lacks.

Style: the v1 set's palette and 1 px dark outline, transparent background, original designs only (do not base anything on other games). Sheets are one horizontal strip of equal frames; the manifest entry gives `w`/`h` per frame, `frames` and `fps` (the loader loops any sheet with `frames > 1` and `fps > 0`; `fx.levelUp` is played once). Reduced-motion players see frame 0 of a looping sheet, so frame 0 must read well on its own.

**Projection.** Same as `docs/art/hud-art-list.md`: isometric 2:1, bottom-centre of a building sprite on its footprint diamond's bottom vertex.

**Generation budget.** One generation here means one finished sheet or still (a key below); it may take several PixelLab calls.

| Group | Keys | Generations |
|---|---|---|
| Dragon Roost, Tiers 1 to 5 | `building.roost.1` to `building.roost.5` | 5 |
| Level-up effect | `fx.levelUp` | 1 |
| Goal check mark | `ui.goal` | 1 |
| **Total (required)** | | **7** |
| Quests icon (optional, see below) | `icon.quests.16`, `icon.quests.32` | 2 |
| **Total with the optional icon** | | **9** |

Priority order if the budget runs short: the five Roost tiers (Tier 1 first, then up), then `fx.levelUp`, then `ui.goal`, then the optional icon. A Roost tier with no sheet is drawn with the next lower tier's sheet, and a Roost with none at all with the small `building.nest` sprite, so a missing one is never blank.

## Dragon Roost

`Dragon Roost` is a building where the player raises their dragons' level cap: each tier lifts the cap, and Tier 5 is the Ascension tier. Draw it as an original perch-and-nest structure; do not base it on any other game's building.

The Roost is a 4x4 footprint from M4, so its sprite is 64x64 with the bottom-centre on the footprint's bottom vertex (the diamond is 64x32 wide and the art rises above it). Draw and keep every tier at 64x64: until M4 the Roost stands on a 2-cell footprint and the game draws the sheets smaller with `ROOST_ART_SCALE` (`apps/web/src/game/islandModel.ts`), so nothing here needs a smaller size. Each tier should read as an upgrade of the one before: same silhouette base, more ornament, so a player sees the building grow. Stills (1 frame, 0 fps). Fallbacks: a missing tier uses the next lower tier's sheet, then `building.nest`. While the Roost is under construction (tier 0) the game shows `building.nest`, so there is no tier 0 sheet.

| Key | Frame (px) | Frames | fps | Description |
|---|---|---|---|---|
| `building.roost.1` | 64x64 | 1 | 0 | Dragon Roost Tier 1: a low round nest of woven branches and straw on a small stone base, with a single carved perch post and a few warm-grey feathers |
| `building.roost.2` | 64x64 | 1 | 0 | Tier 2: the same nest, deeper and wider, with a second perch post, a wooden rim and a small banner |
| `building.roost.3` | 64x64 | 1 | 0 | Tier 3: the same nest on a taller stone plinth with carved steps, a sheltering thatched canopy over half the nest, and two banners |
| `building.roost.4` | 64x64 | 1 | 0 | Tier 4: the same nest under a stone-and-timber canopy with horn-shaped crossbeams, polished trim, and a warm glow inside the nest |
| `building.roost.5` | 64x64 | 1 | 0 | Tier 5 (Ascension): the same nest, visibly ascended: the base and canopy rise on pale gold-trimmed stone, with a floating halo ring above, drifting light motes, and radiant white-gold light spilling from the nest. It must read at a glance as the highest tier, clearly richer than Tier 4 |

## Effects

| Key | Frame (px) | Frames | fps | Description |
|---|---|---|---|---|
| `fx.levelUp` | 64x64 | 8 | 12 | One-shot burst played on the island when the level-up screen opens: a ring of gold-white light rising from the ground with small star sparkles that fade out by the last frame. Frame 0 already shows the start of the ring so it reads alone under reduced motion. Optional: the game plays it once when the manifest has it and the screen alone marks the level without it |

## HUD

| Key | Frame (px) | Frames | fps | Description |
|---|---|---|---|---|
| `ui.goal` | 16x16 | 1 | 0 | Goal check mark: a bold white-gold tick on a small green round plate with a 1 px dark outline, shown when the current Goal is ready to claim. Loaded into the HUD art set with the other `ui.*` keys (as `art.hud['ui.goal']`) for the Quests panel to draw when present |
| `icon.quests.16` | 16x16 | 1 | 0 | Optional. Replaces the current built-in Quests glyph only if the art thread wants a better one: a rolled scroll with a small gold seal |
| `icon.quests.32` | 32x32 | 1 | 0 | Optional. Same design at 32x32 |

Skip both `icon.quests` sizes if the built-in glyph is kept; nothing reads them otherwise, and the HUD uses the glyph.
