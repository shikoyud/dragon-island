# Dragon Island HUD, ground and animation art list

For the art thread to generate with PixelLab. It commits only PNGs, `apps/web/public/art/<version>/manifest.json` and `docs/art`; the web code reads the keys below and falls back (first frame, or a drawn placeholder) until each one lands, so the game runs before the art does.

Style: the v1 set's palette and 1 px dark outline, transparent background, original designs only (do not base anything on other games). Sheets are one horizontal strip of equal frames; the manifest entry gives `w`/`h` per frame, `frames` and `fps` (the loader loops any sheet with `frames > 1` and `fps > 0`). Reduced-motion players see frame 0, so frame 0 must read well on its own.

**Projection.** The island is isometric 2:1: one grid cell is a 16x8 diamond. A building with an n x n footprint stands on an `16n x 8n` diamond and its sprite's bottom-centre is that diamond's bottom vertex. Ground tiles are drawn with their diamond's top vertex at the cell's position.

## Ground (island scene)

| Key | Frame (px) | Frames | fps | Description |
|---|---|---|---|---|
| `ground.grass.0` | 16x8 | 1 | 0 | Grass diamond, base shade; must tile seamlessly with its neighbours on all four edges |
| `ground.grass.1` | 16x8 | 1 | 0 | Grass diamond variant: a few lighter blades |
| `ground.grass.2` | 16x8 | 1 | 0 | Grass diamond variant: a tiny flower or pebble |
| `ground.cliff.sw` | 8x16 | 1 | 0 | Cliff face under one cell of the south-west edge: an 8 px wide strip whose top edge slopes down 4 px left to right (the diamond's lower-left side), grass lip, earth strata; repeats along the edge |
| `ground.cliff.se` | 8x16 | 1 | 0 | Same under one cell of the south-east edge (top edge slopes up 4 px left to right), lit side, lighter earth |
| `ground.water` | 32x16 | 4 | 6 | Sea around the island, gentle wave shimmer loop; a rectangle that repeats seamlessly in both directions |
| `ground.fog` | 16x8 | 1 | 0 | Locked land: soft white-grey cloud diamond that hides the ground; tiles seamlessly |
| `island.sign` | 32x32 | 1 | 0 | Expansion sign on the next strip (exists in v1; redraw in iso three-quarter view if it looks flat) |

## HUD frames and controls

| Key | Frame (px) | Frames | fps | Description |
|---|---|---|---|---|
| `ui.button.round` | 48x48 | 1 | 0 | Round button plate for the bottom bar and right column: stone rim, dark centre for an icon |
| `ui.button.round.active` | 48x48 | 1 | 0 | Same plate, gold rim and lit centre (Build while placing, open panel) |
| `ui.pill` | 24x16 | 1 | 0 | 9-slice resource pill: rounded dark bar with a 1 px gold edge (slices at 8 px) |
| `ui.avatarFrame` | 48x48 | 1 | 0 | Player badge frame: round shield with a level plate at the bottom |
| `ui.xpBar` | 24x8 | 1 | 0 | 9-slice XP bar track (fill is drawn in code) |
| `ui.panel` | 24x24 | 1 | 0 | 9-slice dialog frame (exists in v1; keep slices at 8 px) |
| `ui.close` | 16x16 | 1 | 0 | Close button: red round plate with a white X |
| `ui.tab` | 24x16 | 1 | 0 | 9-slice tab for panels with sections (Battle: Campaign / Arena) |

## Icons (each at 16x16 and 32x32: keys `icon.<name>.16` and `icon.<name>.32`)

| Name | Description |
|---|---|
| `food` | Meat on the bone |
| `gold` | Stack of gold coins |
| `dris` | $DRIS token: violet gem coin with a dragon-eye mark |
| `xp` | Blue star |
| `timer` | Small hourglass |
| `build` | Hammer and trowel |
| `map` | Rolled parchment map |
| `season` | Banner with a laurel |
| `leaderboard` | Trophy cup |
| `referral` | Two hands clasping |
| `settings` | Cog |
| `dragons` | Dragon head in profile |
| `breed` | Two eggs side by side with a heart |
| `battle` | Crossed swords |
| `hoard` | Open treasure chest |
| `store` | Market awning |

## Island map

| Key | Frame (px) | Frames | fps | Description |
|---|---|---|---|---|
| `map.backdrop` | 320x180 | 1 | 0 | Sea chart backdrop for the island map dialog: deep water, faint compass rose |
| `map.home` | 32x32 | 1 | 0 | Home island icon (exists in v1) |
| `map.isle2` | 32x32 | 1 | 0 | Second island icon (exists in v1) |
| `map.isle3` | 32x32 | 1 | 0 | Third island icon (exists in v1) |
| `map.isle4` | 32x32 | 1 | 0 | Fourth island icon (exists in v1) |
| `map.isle5` | 32x32 | 1 | 0 | Fifth island icon (exists in v1) |
| `map.dawnspire` | 32x32 | 1 | 0 | Dawnspire icon (exists in v1) |

## Animations (replace the v1 stills under the same keys)

| Key | Frame (px) | Frames | fps | Description |
|---|---|---|---|---|
| `dragon.<speciesId>` | 48x48 | 4 to 6 | 6 | Breathing idle, south view (facing the camera), feet on the bottom-centre; one sheet per species |
| `hatchling.<element>` | 32x32 | 4 to 6 | 6 | Hatchling breathing idle, same rules |
| `egg.<element>` | 32x32 | 4 | 4 | Egg wobble loop (rests upright on frame 0) |
| `habitat.<element>` | 80x64 | 4 | 4 | Element loop on the platform (embers flicker, water ripples, sparks, frost glints, ...); platform itself does not move |
| `crop.<crop>` | 16x16 | 4 | 0 | Growth stages (exist in v1). Optional sway: a second sheet `crop.<crop>.sway`, 16x16, 4 frames, 4 fps, for the ripe stage |
| `fx.construction` | 32x32 | 4 | 8 | Hammer and dust puff loop, drawn over any building under construction |
| `fx.hatch` | 48x48 | 6 | 12 | Shell-burst flash, played once where an egg hatches |

`<speciesId>` covers every species in the launch catalog (`LAUNCH_CATALOG.species`); `<element>` is fire, water, earth, nature, electric, ice, metal, dark, light; `<crop>` is sprout, bushel, harvest, bounty.
