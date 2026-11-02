# UI rework Phase 1 art list

The set for `docs/superpowers/plans/2026-11-01-ui-rework-phase1.md` (Task 7). Everything is in `apps/web/public/art/v1/`, with prompts, seeds and code steps in `apps/web/art/prompts.md` ("UI rework Phase 1 set"). Cost 43 generations (989 before, 946 after). Original designs: the old v1 sheets are start images for habitats, Aerie and tree, and the castle starts from a code block-out. The layout references were used for composition only. No art for the other 5 islands.

`w` and `h` are one frame's size.

| Key | Size | Frames | How made |
| --- | --- | --- | --- |
| `ground.sky` | 480x272 | 1 | PixelLab (`create_image_pixen`). Landed in Task 3. |
| `ground.cloud.0..2` | 96x40 | 1 | PixelLab, then alpha, specks and colour ramp in code. Landed in Task 3. |
| `ground.rock` | 64x64 | 1 | PixelLab, then made seamless in code. Landed in Task 3. |
| `ground.rim.0`, `.1` | 48x32 | 1 | PixelLab, then cooled to the rock's grey in code. Landed in Task 3. Drawn at `RIM_ROCK_SCALE` (0.7), whole px. |
| `ground.rim.2` | 40x32 | 1 | Same. Landed in Task 3. |
| `ground.rim.3` | 32x32 | 1 | Same. Landed in Task 3. |
| `ground.waterfall` | 32x96 | 4 @ 8 fps | **Code-drawn, not PixelLab:** both generated frames were unusable. Redrawn in the fix wave: rounded lumpy foam top, sides wandering 1-3 px between frames, mist dithered to nothing over the last third. Opaque or empty pixels only, so no pale box. |
| `island.sign` | 48x48 | 1 | PixelLab blank board; "FOR SALE" lettered in code. Landed in Task 3. |
| `obstacle.ancientTree` | 64x72 | 1 | PixelLab edit on a code start: the same tree, roots flaring onto the tile, shadow in code. |
| `building.hatchery`, `.2`, `.3`, `.4` | 80x96 | 1 | PixelLab edits on a code block-out, chained level to level. Level 1's courtyard is pasted back on 2 to 4, so the nest is pixel-identical on all four. |
| `habitat.terra`, `flame`, `sea`, `nature`, `electric`, `ice`, `metal`, `dark`, `light`, `war` | 64x64 | 4 @ 4 fps | PixelLab edit on a 1.25x start of the old sheet for frame 0; silhouette trimmed to the footprint diamond and the loop made in code (frame 0 fixed, effect pixels only). |
| `building.goldenAerie` | 64x64 | 4 @ 4 fps | Same. |
| `ui.island.upgradePost` | 24x32 | 1 | **Code-drawn, not PixelLab:** the generated plate was too wide for 24 px. |
| `ui.island.arrow` | 32x40 | 1 | PixelLab; orange brightened in code. |
| `ui.zoom.minus`, `.plus`, `.thumb` | 32x32 | 1 | **Code-drawn, not PixelLab:** plainer and cleaner than a generated frame at this size. |

## Where the art meets the code

- **Habitats and Aerie (U11):** the face is exactly the footprint diamond, rows 32 to 63 with the bottom vertex at x 31/32, y 63. `fitFootprint` draws them at scale 1. Residents draw at `habitatDragonScale(sheet width)`, about 24 px at every stage: a 48 px adult at 0.5, a 40 px juvenile at 0.625, a 32 px baby at 0.75.
- **Castle (U14):** drawn at scale 1, its bottom centre on the footprint's bottom vertex, so the walls overhang the 64-wide footprint by up to 8 px a side. The nest is about 28x14, centred at (40, 82): 14 px above the anchor. `HATCHERY_NEST` in `apps/web/src/game/layout.ts` places eggs in it at `NEST_EGG_HATCHERY_SCALE` (0.5).
- **Upgrade post:** drawn at `UPGRADE_POST.scale` (0.5), 12x16 in the world. At 1 it hid its neighbour's residents.
- **Arrow:** drawn at `ARROW_SCALE` (0.5).
- **Zoom controls:** in the `hud` set by `HUD_KEY`, for React (Task 6). No scene loads them. The post and arrow are loaded into Phaser by `artEntries`.

## Weak spots to redo if there is budget

- `habitat.sea`: the lily pad is slightly clipped.
- `habitat.electric`: plain beside the others.
