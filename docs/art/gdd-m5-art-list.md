# Dragon Island M5 art list (GDD combat and PvE: the battle stage, move effects, battle UI, Trials, the Trial Champion)

For the art thread to generate with PixelLab. **Art work happens on its own branch from `gdd-m5`** (`gdd-m5-art`), and it commits only PNGs, `apps/web/public/art/<version>/manifest.json`, `apps/web/art/prompts.md` and `docs/art`; the web code reads the keys below and falls back until each one lands, so the game runs before the art does. Missing keys are fine: nothing here blocks a release, and the client sends no request for a key the manifest lacks. A sheet that fails to load is treated as absent (the battle draws its own look). Stage explicit paths only (`git commit -- <paths>`), never `git add -A`.

Style: the v1 set's palette and 1 px dark outline, transparent background (except backdrops, which are opaque), original designs only (do not base anything on other games). Sheets are one horizontal strip of equal frames; the manifest entry gives `w`/`h` per frame, `frames` and `fps`. Effects and sheets are played once or looped by the game as described per key. Reduced-motion players never see an effect (the battle jumps to its result), but frame 0 of a dragon sheet is what they see, so frame 0 must read well on its own. Record `top` (fully transparent rows above the art, smallest over all frames) for the dragon sheets, as the v1 manifest does.

All keys land in `apps/web/public/art/v1/` (the game's `ART_VERSION` is a code constant, `v1`): add the PNG, add the manifest entry (`w`, `h`, `frames`, `fps`, `top`), reload the game. Everything here is **new**; no existing key changes, and nothing in the v1 set is regenerated.

## Where things are on the battle stage (so a sheet agrees with the code)

The battle is a fixed portrait stage of **360 x 420** px (`BATTLE` in `apps/web/src/game/layout.ts`); the screen shows it at a whole-number zoom (1x, 2x, 3x, nearest-neighbour), so everything is drawn at its stage size and never scaled by a fraction. The controls (turn line, 2x2 moves, Swap) sit **under** the stage in React, not on it.

- **Where a dragon stands** (`BATTLE_SPOT`, bottom-centre of the sprite, its feet): the **enemy at (264, 196)**, upper right, facing left; **yours at (96, 376)**, lower left, facing right. Dragons draw at **3x** (`BATTLE_DRAGON_SCALE`): an adult 48 px sheet is 144 x 144 on the stage, a juvenile 40 px is 120, a hatchling 32 px is 96. So the enemy's adult body fills about x 192 to 336, y 52 to 196, and your adult x 24 to 168, y 232 to 376.
- **Sprite facing** (`dragonFlip`): adult and juvenile sheets face **left** and hatchling sheets face **right** in the sheet; the code flips them so the two dragons face each other. Draw the Trial Champion's sheets the same way.
- **What React draws over the stage** (a backdrop must leave room for these and must not put detail under them): the title and Exit button in the top strip **y 0 to 48**; the **enemy's HP plate at x 8 to 176, y 52 to about 102** (upper left); **your HP plate at x 184 to 352, y about 328 to 376** (lower right, 8 px in from the right edge and 44 px up from the bottom); the one-line "last move" text along the very bottom, **y about 396 to 418**. Plates are semi-transparent glass, so the backdrop shows through them: keep those four rectangles calm, mid-to-dark and low in contrast, with no bright shapes, text-like marks or fine patterns that fight white 10 to 12 px type. Floating damage text rises from just above the target's body, so the area around each dragon, about 150 x 150 px, also stays calm.
- **The two standing spots must read as ground**: the enemy's feet at y 196 and yours at y 376 are both on the floor of the scene. The code-drawn fallback puts the horizon at **y 150** (sky above, ground below); a backdrop may use its own horizon, but the ground has to cover y 170 to 420 under the platforms, and the move grid below the stage never overlaps the backdrop (the controls are React elements under the 420 px, so the stage's bottom edge is a hard crop).

## Generation budget

PixelLab has about **1,027 generations left**. One "generation" in the table below means one finished sheet or still (a key); it may take several PixelLab calls (a still is usually 1 to 3, a 4 to 6 frame sheet 2 to 5, a Trial Champion sheet up to 8 because three of them must match). Required: **53 keys**. Expected cost is about 3 calls a key, so about **160 plus about 10 extra for the Champion**. The worst case is 5 calls for each of the 50 other keys plus 8 for each of the 3 Champion sheets: **274** (279 with the optional egg at 5). 1,027 minus 279 is 748, so **stop at 745 remaining** and even the worst case is covered, unless the owner says otherwise. Count calls as you go.

| Priority | Group | Keys | Generations |
|---|---|---|---|
| 1 | Backdrops for Chapters 1 to 3 (`terra`, `flame`, `sea`) | `battle.backdrop.terra`, `.flame`, `.sea` | 3 |
| 2 | Move fx and impact fx | `fx.move.<element>` x 10, `fx.move.physical`, `fx.hit`, `fx.crit`, `fx.immune`, `fx.ko`, `fx.swap` | 16 |
| 3 | Battle UI | `ui.battle.platform`, `.hpFrame`, `.moveButton`, `.swap`, `.turn`; `ui.star`, `ui.star.empty`; `ui.tier.1` to `.3` | 10 |
| 4 | Boss | `battle.boss.marker`; `dragon.trial-champion`, `juvenile.trial-champion`, `hatchling.trial-champion` | 4 |
| 5 | Backdrops for Chapters 4 to 10 | `battle.backdrop.nature`, `.electric`, `.ice`, `.metal`, `.dark`, `.light`, `.war` | 7 |
| 5 | Trials screen | `trial.chapter.<element>` x 10, `trial.node`, `trial.node.boss`, `trial.node.locked` | 13 |
| | **Total (required)** | | **53** |
| | Trial Champion egg (optional, see below) | `egg.trial-champion` | 1 |
| | **Total with the optional key** | | **54** |

Priority order if the budget runs short: backdrops for Chapters 1 to 3, then move fx, then the battle UI, then the Boss, then the rest (Chapters 4 to 10 backdrops and the Trials screen). Every group degrades alone: a chapter without its backdrop keeps the colour fill and drawn platforms, a missing fx plays no effect (the damage text and tints still show), a missing UI piece keeps its drawn CSS look, a missing Champion sheet draws a plain War dragon of the matching stage, a missing chapter card keeps the element icon, a missing node mark draws none.

## Backdrops

Opaque, **360 x 420**, 1 frame, one per element; the Trial's chapter picks it (`trial.chapter` element: Chapter 1 `terra` Terra Wilds, 2 `flame` Flame Peaks, 3 `sea` Sea Depths, 4 `nature` Nature Grove, 5 `electric` Electric Storm, 6 `ice` Ice Wastes, 7 `metal` Metal Forge, 8 `dark` Dark Hollow, 9 `light` Light Sanctum, 10 `war` War Citadel). The Arena (PvP) and a chapter without its backdrop keep the colour fill. The art covers the whole stage; the colour fill shows only past its edges on wide screens, so make the left and right edges calm enough to sit against a flat colour.

| Key | Frame (px) | Frames | fps | Description |
|---|---|---|---|---|
| `battle.backdrop.<element>` | 360x420 | 1 | 0 | The chapter's place seen from a low three-quarter view, sky or ceiling in the upper third, a flat-ish floor from about y 170 down. Soft depth, no characters. Leave the plate rectangles, top strip and both dragon zones calm (see "Where things are on the battle stage"). Terra: sandstone cliffs, dry grass. Flame: ash slopes, lava glow far off. Sea: shallow reef cave, light shafts. Nature: dense grove, dappled light. Electric: storm plain under a violet sky, distant bolts. Ice: snow flats and ice walls. Metal: forge hall with banked furnaces. Dark: a hollow of black roots and pale spores. Light: a white-stone sanctum with high windows. War: a crimson-and-iron citadel yard with torn banners |

## Platform

| Key | Frame (px) | Frames | fps | Description |
|---|---|---|---|---|
| `ui.battle.platform` | 64x32 | 1 | 0 | The ground a dragon stands on: a flat isometric 2:1 stone slab (a 64x32 diamond top face with a thin rim), neutral grey-brown so it reads on every backdrop. Drawn at **2x (128 x 64 on the stage), centred at the dragon's feet x and 4 px above its feet y**, under the dragon. A dragon's feet land on the face's centre, about row 18 of the sheet, so keep the middle and the front half of the face flat and clear. Used for both sides, so no left-right detail. Without it the code draws a flat ellipse |

## Move effects and impact effects

One-shots: the game plays the sheet once on the target and removes it. Each is centred on the target's body (its feet y minus half its drawn height), over the dragon (the damage text floats above). A one-frame still is allowed and fades out over 0.4 s. Frame 0 is the start of the effect, the last frame near-empty.

| Key | Frame (px) | Frames | fps | Description |
|---|---|---|---|---|
| `fx.move.<element>` | 64x64 | 6 | 14 | One per element (`terra flame sea nature electric ice metal dark light war`, 10 keys): the element's strike landing, bursting outward from the frame centre in about 0.4 s (rock shards, flame burst, water crash, leaves and thorns, forked lightning, ice shards, steel slash sparks, shadow tendrils, a flare of light, a red war-cry shockwave). Drawn at **2x for Tier 1, 2.5x for Tier 2, 3.5x for Tier 3** by scale alone, so it must still read at 224 px: no hairlines, a strong silhouette |
| `fx.move.physical` | 64x64 | 6 | 14 | The Physical move (Strike): a plain white-and-grey slash and dust puff. Drawn at 2x |
| `fx.hit` | 64x64 | 4 | 14 | A neutral impact star, white with a yellow core; plays with every damaging hit on top of the move effect. Drawn at 2x |
| `fx.crit` | 64x64 | 4 | 14 | A larger, spiky gold-and-white burst for a critical hit; plays on top of `fx.hit`. Drawn at 2x |
| `fx.immune` | 64x64 | 4 | 14 | A blocked hit: a pale blue-grey ring rippling off a small shield flash, no damage look. Plays instead of `fx.hit` when the target is immune. Drawn at 2x |
| `fx.ko` | 64x64 | 6 | 14 | A dragon falls: a soft puff of smoke with a few drifting stars. Plays on the target of the knock-out blow while the dragon fades. Drawn at 2x |
| `fx.swap` | 64x64 | 5 | 14 | A dragon leaves the field: a swirl of small light motes. Plays centred on the swapping side's body (its feet y minus half its drawn height) as the old dragon slides off. Drawn at 2x |

## Battle UI

Pieces of the battle screen's React controls, drawn from art when the manifest has them (a CSS look otherwise). The nine-sliced pieces keep the 2 px border they already have, so the layout never moves: **corners are 2 px and the edges and centre stretch** (CSS `border-image` with `stretch`, so nothing repeats): keep the edges and centre flat, with no pattern that a stretch would smear.

| Key | Frame (px) | Frames | fps | Description |
|---|---|---|---|---|
| `ui.battle.hpFrame` | 16x16 | 1 | 0 | The HP plate (the glass panel with the dragon's name, HP bar and bench pips). Nine-slice: a 2 px outer slice holding a 1 px dark outline and a 1 px inner highlight inside it (both must fit within the 2 px corner slice), a flat dark blue-grey centre with about 70 % opacity so the backdrop shows. Text and the HP bar sit on the centre, so keep it plain |
| `ui.battle.moveButton` | 16x16 | 1 | 0 | A move button (2x2 grid under the stage). Nine-slice, same rule: a raised 2 px bevel, flat centre in a warm mid-dark tone that white 11 px text reads on. Disabled buttons are dimmed by the game |
| `ui.battle.swap` | 16x16 | 1 | 0 | The Swap button, same rule, in a cooler tone than the move buttons so it reads as a different action |
| `ui.battle.turn` | 96x16 | 1 | 0 | The turn banner behind "Turn n / 12" and the star goal. **Stretched whole** (`center / 100% 100%`, not sliced) to the line's width (about 330 x 16), a bit over 3x horizontally, so it must be a flat bar with no detail worth keeping: a plain band with a 1 px outline and at most a soft vertical gradient |
| `ui.star` | 12x12 | 1 | 0 | A filled gold star for Trial results and node stars |
| `ui.star.empty` | 12x12 | 1 | 0 | The same star, empty: a dark outline and a dim blue-grey fill |
| `ui.tier.1`, `ui.tier.2`, `ui.tier.3` | 12x12 | 1 | 0 | Move tier pips shown before "Tier 1/2/3" on a move button: one, two and three small gems or flames in a row. Tell them apart by shape and count, not by colour alone |

## Boss and the Trial Champion

| Key | Frame (px) | Frames | fps | Description |
|---|---|---|---|---|
| `battle.boss.marker` | 16x16 | 1 | 0 | A small gold crown with a red gem, shown before the word "Boss" in the enemy's HP plate when the Boss is up. Original design, 1 px outline, readable at 16 px |
| `dragon.trial-champion` | 48x48 | 4 | 6 | The Trial Champion, adult (Lv 7 and up). **Original design, War/Metal, a Legendary**: a heavily armoured war-drake with a dark crimson hide, riveted steel plates over the shoulders, chest and tail, a horned visored steel helm, a crest of crimson spines and a dull amber glow in the chest seam; the tail ends in a spiked steel club. Faces **left**. Idle loop (breathing, the crest and glow shifting); frame 0 stands on its own. Record `top` |
| `juvenile.trial-champion` | 40x40 | 4 | 6 | Juvenile (Lv 4 to 6), the same design younger: smaller plates, a bare crimson head with small horn buds, a shorter tail. Faces **left**. Make it as an edit of the adult sheet, not from scratch, so the two read as one dragon |
| `hatchling.trial-champion` | 32x32 | 4 | 6 | Hatchling (Lv 1 to 3), the form seen when the Boss is beaten: the Champion arrives as a hatchling waiting in the Hatchery, so this is the Champion's first appearance. A round crimson hatchling with two tiny steel studs and a spark in the eye. Faces **right** (hatchling sheets face right). Replaces the War hatchling for that species |
| `egg.trial-champion` | 32x32 | 4 | 4 | **Optional.** The Champion's egg: dark crimson shell with riveted steel bands and an amber seam. No screen shows it today (the Champion is given as a hatchling and cannot be bred), so it is only read if a future path produces one; draw it last, or skip it |

Until its sheets land the Champion draws the War Basic's sheet of the same stage (`dragon.war`, `juvenile.war`, `hatchling.war`), as any species without art of its own.

## Trials screen

| Key | Frame (px) | Frames | fps | Description |
|---|---|---|---|---|
| `trial.chapter.<element>` | 64x64 | 1 | 0 | The chapter's card on the chapter list, one per element (`terra flame sea nature electric ice metal dark light war`, 10 keys): a small framed vignette of the chapter's place (the same scene as its backdrop) with the element's colour in the frame. Shown at **32 x 32** with nearest-neighbour scaling, so draw it on a 2 px grain (every drawn pixel a 2x2 block) so it halves cleanly |
| `trial.node` | 16x16 | 1 | 0 | An open node's mark, shown before "Node n": a small shield or banner in neutral steel |
| `trial.node.boss` | 16x16 | 1 | 0 | The Boss node's mark: the same shape with a crown and a red gem. An unlocked Boss node only; a locked Boss shows the locked mark |
| `trial.node.locked` | 16x16 | 1 | 0 | A locked node's mark: the same shape in dim grey with a padlock |

Chapter cards, node marks, stars, tier pips and the crown are plain `img` elements and do not need a Phaser texture.

## What the code reads, and how it falls back

| Key | Read by | When absent |
|---|---|---|
| `battle.backdrop.<element>` | `BattleScene.drawBackdrop`, chosen by the Trial's chapter element | the colour fill (`backdropFill`) |
| `ui.battle.platform` | `BattleScene`, one image per side | the drawn ellipse |
| `fx.move.<element\|physical>`, `fx.hit`, `fx.crit`, `fx.immune`, `fx.ko`, `fx.swap` | `BattleScene.burst`, per attack and swap event | no effect; text and tints still play |
| `ui.battle.hpFrame`, `.moveButton`, `.swap`, `.turn` | `hudSkin` (CSS variables and `skin-battle-*` classes) | the drawn CSS look |
| `ui.star`, `ui.star.empty`, `ui.tier.<n>`, `battle.boss.marker`, `trial.chapter.<element>`, `trial.node`, `.boss`, `.locked` | React (`Stars`, `ArtMark`, `TrialsPanel`, `BattlePanel`, `BattleResult`) | the glyphs and words they replace |
| `dragon.trial-champion`, `juvenile.trial-champion`, `hatchling.trial-champion`, `egg.trial-champion` | `dragonLook`, `hatchlingLook`, `eggLook` | the War Basic's sheet of the matching stage |
