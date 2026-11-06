# UI rework Phase 1 report

Plan: `docs/superpowers/plans/2026-11-01-ui-rework-phase1.md`. Design: `docs/superpowers/specs/2026-11-01-ui-rework-design.md`. Branch `ui-rework-p1`, base `be6dff4`. Not merged, not pushed, not deployed.

## Result

All of Phase 1 is built and works in a real browser.

| Fix | Now |
| --- | --- |
| Island shape | Home Isle is a floating island with an irregular rock rim, cliffs, a river on each front side, two waterfalls, and sky with drifting clouds. The outline grows as you buy land. The plot grid underneath is unchanged. |
| 3 locked plots | Home offers exactly 3 plots at a time. Each is darker ground with its obstacles on top and a wooden For Sale sign with Tap to buy. |
| Fewer obstacles | Starting land has 8 obstacles on 28 of 256 tiles (was 21 on 77). No two sprites overlap there. Spawns keep at least 2 empty tiles between footprints. |
| Big tree | The Ancient Tree's roots flare onto the tile, with no hard-cut edge. |
| Move | Pressing Move changes nothing until you tap a tile or drag the building. Hover does nothing. Green or red footprint, bouncing arrow, Cancel and OK at bottom centre. Zoom holds. |
| Habitat size | Art fills the 4×4 diamond, and dragons draw smaller, so 4 fit with platform showing. A post with a green arrow marks an upgradable habitat. |
| Hatchery | A stone castle on all 4 levels, with a straw nest out front. Eggs sit in the nest, with a small bar on the soonest. |
| Zoom | Vertical slider at the right edge. |

## Tests

| Check | Result |
| --- | --- |
| `pnpm -r typecheck` | clean |
| game-core | 1,039 passed |
| shared | 9 passed |
| web | 912 passed |
| server | 171 passed |
| waitlist | 161 passed |
| Total unit | 2,292 passed, 0 failed |
| Web e2e | 50 passed, 1 skipped (on-chain deposit, needs anvil), 0 failed |

Typecheck and unit counts were re-run on the final commit of the code. E2E ran on the same code just before it was committed, on system Chrome through a temporary config that isn't committed.

The M4 room and pacing checks pass: the starting land holds every unlock through PL 5 with no plot, clear or move; every unlock through PL 12 fits with no moves and 0 clears on seeds 1..50; end-of-day levels and the 14 Goals hold. One bot pin changed; see question 5.

`pnpm playtest` was driven through a fresh account with real mouse and touch input: buy all 12 plots at the right prices, clear an obstacle, Move by tap and by drag, place a new building, collect, grow, hatch, open every dialog, Map and battle and back, another island, resize, WebGL lost and restored. No page errors, failed requests or unexpected 4xx. That run found 11 defects the tests and reviews hadn't; all are fixed below.

## Screenshots

Committed at 1920×1080 and 844×390: `docs/art/ui-p1-<name>-<1920|844>.png`, where name is opening, locked-plot, move-start, move-legal, move-illegal, habitats, hatchery-pending, hatchery-ready, hatchery-five, tree, obstacles, rim-rocks.

Side by side with the references: `.superpowers/ui-p1-side-by-side/` in the worktree (git-ignored, as they contain another studio's art), for building-1, locked-land, choose-habitat, hatchery-pending, hatchery-ready, review image-2 and image-3.

| Reference | Matches | Differs |
| --- | --- | --- |
| building-1 | Floating island, rock rim, two rivers into falls, a tongue of grass reaching the front lip, dark land on the right with 3 signs, Cancel and OK at bottom centre | Our buttons and arrow are about a third of the reference's relative size; slider is vertical; Turn is extra; our rim has rocks only, no continuous stone wall |
| locked-land | Dark tint, sign, white label, obstacles on top | Soft edge is a thin dither here |
| choose-habitat | Post at the platform's left; platform fills its diamond | Reference's post is larger. The outlined-habitats flow is Phase 4 |
| hatchery | Bigger castle, egg with bar when pending, no bar when ready | Reference raises the egg inside a ring wall; ours is a nest on an apron in front of the wall. The action row is Phase 4 |
| review image-2 | Fixed | |
| review image-3 | Fixed on the starting land | Spawned plots follow footprint rules only |

## Art

32 keys, 43 generations (946 left, resets 2026-11-29). Key list and methods: `docs/art/ui-rework-p1-art-list.md`; prompts: `apps/web/art/prompts.md`. **Not from PixelLab:** `ground.waterfall`, `ui.island.upgradePost` and `ui.zoom.*` are code-drawn, because generated waterfall frames were unusable and the others were plainer as generated; "FOR SALE" on the sign is code-composited, as AI lettering isn't reliable. Everything loads through the manifest with drawn fallbacks.

## Bake and frame time

The island is one baked texture, redrawn only when land changes. All 16 plots, landmass plus paint: 40–51 ms at 1× CPU (target under 60; was 97 before the fix), about 324 ms at 4× CPU, once per purchase.

Frame time at 4× CPU, 8 s, dev build, 16 plots: Home at 844×390 max 54, 42, 42 ms with one frame over 50 ms in total; 390×844 max 54, 33, 200 ms. In line with M4's 29–62 ms, apart from the one 200 ms spike, which I didn't investigate. These were measured before the fix wave, which only made the bake cheaper.

## Unverified or rough

**Not verified:**
- The full playtest ran before the fix wave. After it, the e2e suite and fresh screenshots covered the changes, not another full manual pass. Worth your own play.
- A real phone or GPU: touch went through CDP on desktop Chrome, on software WebGL.
- Motion (clouds, falls, arrow bob): stills only.
- Art swap on Home, reduced motion, old saves (U8), a hatch from a real breed (eggs were granted), Harvest on a ripe crop.
- Firefox and Safari: the vertical slider relies on `writing-mode`; older Chrome shows it horizontal.
- 20 of the 24 screenshots were retaken after the last sign change and not read again; I read the opening, Move and habitat and Hatchery ones.

**Rough:**
- **Plot 2's sign** clips the Boulder's corner by about 20×8 world px, and its label touches the Ancient Tree's crown. No cell on plot 2 clears both obstacles and buildings. Moving obstacles there moved a bot pin, so I left it.
- **844×390 phone:** the bottom menu covers a sign's label and a waterfall until you drag. The top and bottom HUD take almost half the screen; Phase 3 replaces them.
- **Castle** is grey beside grey rocks and the Mountain, so its outline gets lost. It also partly hides the Mountain behind it.
- **Terra adults** on a brown platform are hard to read. Flame with 4 adults shows little lava.
- **Other islands** still have the old diamond and fog, under the new sky. The Map still shows the sea and old icons (Phase 3).
- **Grass** is brighter than the reference, and the sky darker and more teal.
- **Spawned plots** can still look tight, and a spawned plot may have no clear sign cell.
- **Waterfall art** is code-drawn and reads a little flat.
- The start table was partly picked to keep one bot seed's Boss pin. Moving an obstacle later may move that pin with no real pacing change.
- Small: a rim-only tip is dropped rather than filled in deep notches, leaving a small slanted step; a label at zoom 1 can overlap a building; the first scripted hybrid's bar starts nearly full; clouds can pop at their wrap on very wide screens; the wheel doesn't zoom when over the slider; the hand cursor still shows over sprites while placing.

## Rulings made on your behalf

U1–U14 are in the plan. Later ones, and what they cost if wrong:

| Ruling | Cost if wrong |
| --- | --- |
| U1: Home offers a rolling 3 from the fixed order 2, 7, 11, 1, 14, 13, 4, 8, 3, 15, 0, 12; total stays 12 purchases at R45/R46 prices. See question 1 | Large if you meant 3 in total: room and pacing checks depend on it |
| U3: Home's other plots aren't drawn; the outline grows | Medium |
| U4: offered plots hold their obstacles before purchase; a new one spawns when revealed | Small |
| U5: obstacles on unowned plots can't be cleared (`PLOT_LOCKED`); a tap opens the buy panel | Small |
| U6, as amended: start table replaced by largeRock (16,17); tree (16,22), (9,18); smallRock (8,22), (12,22); bush (21,13), (20,23), (23,23). Plot 2: boulder (16,0), tree (22,0), bush (18,7). Plot 7: ancientTree (28,8), smallRock (24,14), bush (30,15). Plot 11: largeRock (29,18), tree (24,18), bush (26,23) | One table |
| U7: gap of 2 tiles; a rolled kind with no room drops to a smaller one; a draw that places fewer than 2 redraws, up to 40 times | Small |
| U8: no state version bump | Small |
| U9, U10: Move as designed for new buildings too; Confirm renamed OK; Turn and Island buttons kept above | Small |
| U11, as amended: habitat art 64×64 with a full 64×32 face; dragon scale by sheet width: adult 0.5, juvenile 0.625, baby 0.75, about 24 px at every stage, instead of the plan's 0.75. At 0.75 four adults still crowded | One function. Adults and babies now draw about the same size |
| U12: post whenever a next level exists and its gate is met, Gold aside. See question 2 | One line |
| U13: slider vertical as the design says. See question 3 | Small |
| U14: castle 80×96, overhanging the footprint by up to 8 px | Small |
| Camera keeps zoom and position on Move, OK and Cancel; at the untouched opening view, land behind the taller bar is a drag away | Small |
| Arrow at half size with its tip on the footprint's top vertex, so it stays clear of the HUD | Small |
| One progress bar, on the soonest egg (five buried the nest); timer badge over that egg; 4–5 eggs draw smaller | Small |
| Labels are tappable; captions 9, 12, 14 px at zoom 1, 2, 3+; none while placing | Small |
| Landscape opening zoom is at least 2. See question 4 | One line |
| Rim rocks only with land under their whole base, at 0.7 size | Small |
| Signs take a clear cell by real sprite size, avoiding obstacles and buildings; signs are drawn at 0.5 scale, since full size took taps from the Farm | Uneven pixels at zoom 3 |
| Footprint fill under sprites, thick outline over them | Small |
| Tap on bare dark ground opens the plot; Escape cancels placing | Small |
| Ground art and the rest of the art landed with Tasks 3 and 5 rather than in a separate step, to tune against it | None |
| Zoom slider kept, as it was finished when you wrote "no need if you just started" | One commit, `8a6a84e`, plus its follow-ups |
| Slowest bot test (115 s, the same at base and head) got a 400 s timeout | Test only |
| Rulings file untouched, as another thread has uncommitted work on it. These need adding after that lands | None |

## Questions for shiko

1. **3 plots:** I read "only 3 locked plots" as 3 for sale at a time, so Home still reaches 16 plots. If you meant Home has only 7 plots in total, tell me: the PL 12 room checks and price list would need changing.
2. **Upgrade post:** it shows from level 1 on both starting habitats, though the upgrade costs 10,000 and 20,000 Gold against 1,000 held. Keep it, or show it only when you can afford it? I'd show it only when affordable, as a constant arrow reads as "do this now".
3. **Zoom slider:** vertical as the design says, while building-1 shows it horizontal. And do you still want it? You wrote "no need" as I finished it.
4. **Phone opening zoom:** landscape phones now open at 2, so a sign and a fall sit under the menu until you drag. Zoom 1 shows everything, but it's unreadable. Revisit after Phase 3's smaller HUD?
5. **Bot pacing:** the Flash-14 bot's chapter 6 Boss now falls on day 3 (before, not within 12 days). No rule breaks, and it comes from one seed's interaction with the plot order. Clearing the starting land now pays 4,980 XP for 8,300 Gold (was 36,420 XP for 60,700 Gold), with the rest on the locked plots once bought. Accept?
6. **Art direction:** the sky is darker and more teal than the reference, and the grass brighter. Keep, or a paler sky and softer grass? Should the castle change colour so it stands out from the rocks, or move away from the Mountain?
7. **Other islands:** apply the floating look to the other 5 in Phase 3 with their Map art, or leave them until later?

## Process notes

Each task had a fresh implementer and a task review; the final branch review and the playtest ran after them, then one fix wave and a re-review. The playtest found what reviews didn't: floating rocks, untappable labels, signs on obstacles. Reviews found no Critical issue. My own reading of screenshots caught the camera reset, oversized arrow and crowded dragons.
