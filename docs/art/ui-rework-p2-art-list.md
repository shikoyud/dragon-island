# UI rework art list (Phases 2 to 4)

For `docs/superpowers/plans/2026-11-02-ui-rework-phase2.md` and the design's Art list items 2 to 4. Every piece already has a drawn CSS fallback; art replaces it when the key is in `apps/web/public/art/v1/manifest.json`. Files go in `apps/web/public/art/v1/`, prompts and seeds in `apps/web/art/prompts.md` under a "UI rework Phase 2 set" heading, as in Phase 1.

Rules for every piece:
- Wyrmhaven pixel style: 1 px dark outline (`#141627`), flat fills, no anti-aliasing, transparent background outside the shape.
- Exact sizes below. The game draws them at integer scale only (2× on phones, 3× on big screens for 16 px pieces), so a pixel must stay a pixel.
- **9-slice** pieces: the corners (the inset in px from each edge) are drawn as-is, the edges and centre stretch. Keep edges and centre a plain repeating pattern within the inset rules, and keep corners within the inset.
- No text in any image. Titles, numbers and letters are drawn by the game.
- Layout references are for composition only: no copying their art.

## Phase 2: UI kit (needed first)

| Key | Size | 9-slice inset (t r b l) | What |
| --- | --- | --- | --- |
| `ui.kit.frame` | 48×48 | 12 12 12 12 | Dialog frame: thick light-grey stone/steel rim (about 5 px) with a bevel (light top-left, dark bottom-right), cream `#f3ead2` inside. Rounded corners. |
| `ui.kit.plank` | 48×20 | 6 8 7 8 | Wooden board for titles: warm brown with 2 grain lines, lighter top row, darker bottom edge. |
| `ui.kit.badge` | 16×16 | 5 5 5 5 | Dark slate rounded rectangle for counts ("2/4"). |
| `ui.kit.close` | 16×16 | — | Round red button, orange rim, white X. |
| `ui.kit.back` | 16×16 | — | Orange rounded square, white left arrow. |
| `ui.kit.help` | 16×16 | — | Round blue button, white "?" is allowed here (a glyph, not text). |
| `ui.kit.pill.blue`, `.yellow`, `.green`, `.purple`, `.grey`, `.red` | 32×16 | 5 6 6 6 | Pill button face per colour: 2 px lighter row on top, 3 px darker edge at the bottom, rounded ends. Same shape for all six. |
| `ui.kit.round` | 32×32 | — | Round action button: white rounded square, thick orange ring. Icon goes on top. |
| `ui.kit.lock` | 12×12 | — | Small dark grey circle with a white padlock (lock badge). |
| `ui.kit.card` | 48×64 | 16 10 10 10 | Shop/storage card: rounded light card, top 16 rows a soft green scale pattern header. |
| `ui.kit.resource` | 48×16 | 4 6 4 6 | Resource pill: dark field. |
| `ui.kit.plus` | 16×16 | — | Green square button with white plus. |
| `ui.kit.scroll.track` | 12×16 | 4 0 4 0 | Wooden scrollbar track (vertical, tiles top to bottom). |
| `ui.kit.scroll.thumb` | 12×24 | 6 0 6 0 | Chunky darker wood thumb. |
| `ui.kit.bubble` | 24×24 | 8 8 8 8 | White speech bubble body, dark outline. |
| `ui.kit.bubble.tail` | 12×8 | — | Its tail pointing down. |
| `ui.kit.bar` | 32×12 | 4 5 4 5 | Progress bar trough, dark rounded. Fill is drawn by the game. |
| `ui.kit.ribbon.<element>` (×10: terra, flame, sea, nature, electric, ice, metal, dark, light, war) | 12×20 | — | Hanging banner with a notched bottom in the element colour (see `apps/web/src/styles/tokens.css` `--el-*`) and a tiny element symbol. |
| `ui.kit.shield.<rarity>` (×5: common, uncommon, rare, epic, legendary) | 20×24 | — | Heraldic shield, blank centre (the game draws the letter). Grey-blue, green, blue, purple, gold. |
| `ui.kit.new` | 24×24 | — | Pink eight-point burst for "New" (no lettering). |

## Phase 3: main HUD

| Key | Size | What |
| --- | --- | --- |
| `ui.hud.levelStar` | 32×32 | Blue star badge for the level number. |
| `ui.hud.avatarFrame` | 48×48 | Square avatar frame, rounded, steel rim. |
| `icon.book.32`, `icon.search.32`, `icon.goals.32`, `icon.storage.32`, `icon.shop.32` | 32×32 | HUD icons (settings, battle and currency icons already exist). Style image: an existing `icon.*.32`. |
| `map.island.home`, `.isle2` … `.isle6` | 128×96 | Each island as a small floating island in the sky (rocky underside, its own colour theme: home green; the others follow `packages/game-core/src/island.ts` names). |
| `map.chain` | 32×32 | Chain and padlock over a locked island. |

## Phase 4: action and bubble icons

All 32×32, drawn inside `ui.kit.round` (leave 4 px clear at the edges): `icon.getEgg`, `icon.collect`, `icon.upgrade` (green up arrow), `icon.info` (speech bubble with "?"), `icon.move` (four yellow arrows), `icon.hatch`, `icon.growFood`, `icon.speedUp`, `icon.rebreed`, `icon.clear` (shovel), plus `.32` suffix as for the other icons. Bubble icons 24×24: `icon.bubble.gold`, `icon.bubble.food`, `icon.bubble.xp`.

## Manifest entries

One entry per key, as the existing ones: `{ "file": "ui-kit-frame.png", "w": 48, "h": 48, "frames": 1, "fps": 0 }`. File names are the key with dots turned into dashes.

## Phase 5: dialogs and screens

| Key | Size | 9-slice inset (t r b l) | What |
| --- | --- | --- | --- |
| `shop.category.dragons`, `.habitats`, `.buildings`, `.farms`, `.store`, `.decorations` | 96×64 | — | Shop home card art, one scene each: a dragon egg pile, a habitat platform, a small building, a field of crops, a treasure chest with speed-up hourglasses, a garden statue. |
| `ui.expand.gold`, `ui.expand.dris`, `ui.expand.island` | 64×64 | — | Expand cards: a plot marker with outward green arrows on sand plus gold bars; the same with a purple $DRIS crystal; a small floating island. |
| `bg.parchment` | 64×64 | 16 16 16 16 | Parchment board with torn edges (Farm crop board, Quests). |
| `bg.wood` | 64×32 | — | Seamless horizontal wood planks (Shop/Storage footers, filter panel); tiles in x. |
| `bg.breeding` | 480×272 | — | Breeding scene backdrop: a mountain meadow with a heart-shaped rock arch in the middle, empty left and right for the two parent lists. |
| `fx.newBurst` | 48×48 | — | Pink eight-point burst, larger than `ui.kit.new`, for the new-dragon screen (no lettering). |
| `fx.glow` | 96×96 | — | Soft radial light rays, pale gold, transparent edges (behind a new dragon). |
| `ui.book.frame` | 64×48 | 16 16 16 16 | Open book frame: leather cover edge, two cream pages with a spine in the centre column. |
| `ui.book.ribbon` | 24×48 | — | Bookmark ribbon tab hanging left of the book (tinted per tab by the game, so draw it white/grey). |
| `ui.quest.card` | 64×112 | 20 12 16 12 | Tall quest card: stone frame, dark arch window for the boss art, a ribbon band across the top 20 rows. |
| `ui.battle.vs` | 48×48 | — | Our own VS emblem: crossed swords on a round shield, no letters. |
| `ui.xpStar` | 24×24 | — | Blue star badge for XP rewards (game writes "XP" next to it, not on it). |
| `icon.health.32`, `icon.damage.32`, `icon.speed.32` | 32×32 | — | Stat icons: red cross, orange burst, blue wing. |
| `icon.storage.32` already exists from Phase 3; `icon.sell.32`, `icon.store.32` is the market stall (keep). Add `icon.sell.32` | 32×32 | — | Sell: a gold coin with a small arrow. |

## How made (Phases 2 to 4, delivered 2026-11-02)

All 65 keys delivered; contact sheet `docs/art/ui-rework-p2-art-preview.png`. 60 PixelLab generations (946 → 886). Prompts, seeds and the code clean-up are in `apps/web/art/prompts.md` under "UI rework Phase 2 set".

| Group | How |
| --- | --- |
| 9-slice kit (frame, plank, badge, card, resource, scroll track and thumb, bubble, bar, pills) | `create_image_pixen`, then remapped in code to the exact size: generated corners at the listed inset, edges and centre one repeating column/row |
| Fixed kit (close, back, help, plus, round, new) | `create_image_pixen` at the exact size, alpha hardened |
| Ribbons ×10, shields ×5, pills ×6 | one generated base each, recoloured in code (ribbons from `--el-*`, glyph drawn on) |
| Lock badge, move icon | drawn in code |
| HUD (level star, avatar frame, book, search, goals, storage, chain, six floating islands) | `create_image_pixen` at the exact size; avatar centre cleared in code |
| `icon.shop.32` | manifest points at the existing `icon-store-32.png` |
| Action and bubble icons | `create_image_pixen`; getEgg, info, speedUp and clear drawn at 24 px and centred on 32 so they keep the 4 px margin. collect, upgrade, hatch, growFood and rebreed were drawn at 32 and keep a 3 to 8 px margin |
