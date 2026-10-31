# GDD pivot: rulings

Source of truth: `docs/dragon-island-gdd.md`. Gap & Conflict Report: `/mnt/project-files/gdd/2026-10-30-gdd-gap-and-conflict-report.md` (project Library). This file records every answer shiko gave on 2026-10-30 and every default the plans apply where the GDD is silent. Plans cite these as **A#** (answered) or **R#** (ruling, applied unless shiko objects).

## Answers from shiko (2026-10-30 08:12)

| # | Question | Answer |
| --- | --- | --- |
| A1 | Teardown of seasons / SP / Hoard / gold sell-back | (a) Delete them first in an "M0" teardown. |
| A1b | Referrals | (a) Remove; waitlist invite links stay marketing only. |
| A2 | Default preset | Flash-14. Flash-28 stays a config preset with tests. |
| A3 | Element ids | (a) Rename internal ids to Terra / Flame / Sea / Nature / Electric / Ice / Metal / Dark / Light and add War now. |
| A4 | Species names and tri-hybrids | (b) shiko supplies the names. Until then species carry generated placeholder names from their elements ("Flame-Sea") and the catalog file has a `name` column to fill. |
| A5 | Habitat build timers (GDD silent) | (a) Build: classic 10 min (Tier A) / 1 h (Tier B) / 4 h (Tier C). Upgrades: to L2 1 h, L3 4 h, L4 12 h, L5 instant. All ÷ 6 in Flash-14, ÷ 4 in Flash-28. |
| A6 | Champion's Arena (priced in the GDD, never defined) | (a) A separate ticketed queue from Day 5; exact rules proposed in the M6 plan for approval. |
| A7 | Legendary Breeding Rite and Opposite Fusion Fee | **Removed.** No breed-time fees. Legendaries join pools during their event for free (§3.2 rule 3 still applies). |
| A8 | Battle turn model | (b) The server reveals the battle seed; the client simulates turn by turn; the server re-simulates the submitted move list to settle. |
| A9 | Dragon selling and decorations | Keep selling for Gold; decorations become a **$DRIS sink** (USDe prices), not a Gold sink. Prices proposed in M7. |
| A10 | Existing contracts | (c) Redesign the contracts in M7 (Foundry, tests, no deployment). The server still talks to a mock chain until legal review. |
| A11 | KYC / 18+ | **Removed.** Anyone can play. Instead: one account per wallet and per IP, plus bot countermeasures (device/IP sign-in origins, earning caps, flagged-account holds). Specified in M7. |
| A12 | Playtesting day-based content | (a) Config `LAUNCH_AT` plus a dev/E2E-only clock offset (the existing `/e2e/clock`). |
| A13 | Hybrid arbitrage cap | (a) Flag `habitatRateCap` (null or 1.25), default null. |
| A14 | Daily Ladder payout | (c) Only the top 10 players are paid, weighted by rank (1st most, 10th least). |
| A15 | Unspent daily emission | (c) Goes to the Treasury reserve. |
| A16 | P, G and Redemption Reserve sizes | (c) Zero / unset until decided; the mock refuses payouts while P = 0. |

shiko also said the token use and reward system will be discussed again after the full gameplay is visible. **M1–M6 are built first; the M7–M9 plans are written only after that discussion.**

## Answers from shiko (2026-10-30 14:17, M2 plan approved; relayed by the coordinator session)

| # | Question | Answer |
| --- | --- | --- |
| M2 Q1 | Scripted first hybrid | (a) At PL 2 from the parents' own pool: one of the two Rares from Terra × Flame, 1-minute breed and hatch. |
| M2 Q2 | Legendary breeding windows | (a) The §8.4 banner windows. |
| M2 Q3 | Basic purchase price | (a) Its habitat's §5.2 build Gold; same PL unlock. |
| M2 Q4 | Tri-hybrids | (a) Ship Flame/Ice/Sea only. |
| M2 Q5 | Hatchery L5 | (a) A premium fifth slot: bought once at PL 15 at any Hatchery level, adding one slot on top of the level's slots. |
| M1 Q1 | GOLD badge | Waits for a threshold: 1 minute of production or 5 % of the cap, whichever is smaller. Client-only. |
| M1 Q2 | Golden Aerie limit | One per player. |
| M1 Q3 | Waitlist copy | Fix the copy that promises 14-day seasons and Season Points. |
| M1 Q4 | Waitlist War art | Goes on the M2 art list. |
| M1 Q5 | R13, R14 | Confirmed. |
| M3 Q1 | XP farming | (c) Both: no XP when two Common parents produce a Common egg, and a level limit per game day from §7.2 with banked XP (R40). |
| M3 Q2 | Build XP | (a) Not multiplied by xpMult, and at most one level per build. |
| M3 Goals | The 14 Goals | As drafted (R36). |
| M4 Q1 | Clearing and building slots (2026-10-31) | (a) Separate limits: 2 clears at once, and 2 builds or upgrades at once. |
| M4 Q2 | Speed-up token durations (2026-10-31) | (a) Real hours: a 3 h token takes 3 h off any running timer. |

## Rulings applied by the plans (defaults, not GDD text)

| # | Ruling | Why |
| --- | --- | --- |
| R1 | **Starting state** (GDD silent on starting resources): a Terra Habitat L1 with a Lv 1 Terra Basic, a Flame Habitat L1 with a Lv 1 Flame Basic, Hatchery L1, Farm 1 (L1), one breeding pair building, 1,000 Gold, 50 Food, PL 1. | §4.4 lists Terra and Flame Habitats, Farm 1 and the Hatchery at PL 1; two Basics are needed to breed at PL 2. |
| R2 | **No save migration.** `PlayerState.version` is introduced; a stored state with another version is replaced by `newPlayer()` and logged. | No live players; the state shape changes in almost every milestone. Migrations return before closed beta. |
| R3 | **Golden Aerie cap** = 3 × the War L1 cap (33,000 classic, ×preset), since "3x the Gold cap" names no habitat. | War has the largest L1 cap; the Aerie is premium. |
| R4 | **Habitat L3/L4 caps** use the GDD multipliers on the L1 cap (×12.25, ×42.9, ×150) with floor; L1 and L2 caps are the literal table values (the table's L2 values are rounded, not exact ×3.5). | §5.2 says so for L3–L5. |
| R5 | **Food formula is exact**: FoodPerFeed(L) = ⌈5 × 1.2^(L−1)⌉ computed with integers (5·6^(L−1) / 5^(L−1)). The exact total to Lv 40 is **122,460**; the GDD's 122,382 is the closed-form approximation 100 × (1.2^39 − 1). Tests pin 122,460 and assert it is within 0.1 % of 122,382. | §4.1 gives both the formula and an approximate table. |
| R6 | **Stat rounding**: Stat(L) rounds to the nearest integer; ATK is computed from ATK₄₀ = 0.40 × HP₄₀ with the same curve (this reproduces every value in the §2.4 table, e.g. Legendary ATK Lv 20 = 3,303). | Matches the table exactly. |
| R7 | **Gold per minute is kept in twentieths** (integer `gpmX20`) so the ½ Inc after Lv 10 and the ×1.2 / ×1.5 / ×2.5 rarity multipliers stay exact; stored Gold = ⌊minutes × Σ gpmX20 / 20⌋, with minutes measured to the millisecond (⌊elapsedMs × Σ gpmX20 / 1,200,000⌋) so a collect loses under 1 Gold. | CLAUDE.md: no floats in currency math. |
| R8 | **Speed-up price** $0.10 × H^0.68 is computed once in floating point and rounded to whole micro-USD (the only float in currency code; H^0.68 has no integer form). | §3.6. |
| R9 | **Footprints and the plot grid change together in M4.** M1 keeps the current footprints (habitat 5, hatchery 4, farm 2, breeding 2 cells) on the current 12×12 home island so the existing art keeps working. | Avoids regenerating every building twice. |
| R10 | **Flash-28 crop timer ÷1.5** uses `Math.floor(ms / 1.5)` (time, not currency). | §7.2. |
| R11 | **Evolution sprites**: Baby uses the hatchling sprite, Adult the dragon sprite, Juvenile a new `juvenile.<species>` sprite when the manifest has it, else the dragon sprite. | §4.1; art arrives separately. |
| R12 | **Interim items until M7/M8**: the Store keeps timer skips and the existing Food pack; the shop's other items are removed in M0. | Playtests need food; the GDD's Supply Crates replace the pack in M7. |
| R13 | **Sprinter figure.** §5.2's 136k/day assumes about 17 hourly check-ins; 24 would be 190,080. The test pins 17 check-ins = 134,640. | The formula, caps and War's 66k all hold; only the 136k assumption was unstated. |
| R14 | **Waitlist element rename.** A waitlist SQL migration maps stored fire/water/earth to flame/sea/terra; `war` is added to its element list. | Entrants have a persisted element; without it their cards would have no colour or art. |
| R15 | **Withdrawn, see R9. A 5×5 Mountain left no free 5×5 cell at step 0, only (9,5) at steps 1–2, and nothing more until step 6 (PL 18).** Original text: Mountain and Grove take their GDD 5×5 footprint in M2; the Hatchery stays 4×4 (already the GDD size). Other footprints wait for M4 (R9). | Their art is new, so drawing it once at final size avoids regenerating it. |
| R16 | **Hatchery, Mountain and Grove upgrade timers** (GDD silent): to L2 1 h, L3 4 h, L4 12 h, $DRIS levels instant; Grove build 4 h. Classic, ÷ `timerDiv`. | Same ladder as A5 for habitats. |
| R17 | Withdrawn; replaced by M2 plan Q5. | The §5.4 table's L5 and L4 order is a question for shiko. |
| R18 | **A finished egg moves to the Hatchery on a tap**, not by itself; its building stays blocked until then. | §5.4 says only that the egg waits; a tap is the genre's collect moment and already exists. |
| R19 | **Species ids** join elements in order (`flame-sea`); placeholder names `Flame-Sea`. Legendaries keep the names the GDD gives them. | Ordered ids match §2.3; names per A4. |
| R20 | **Eggs hide their species until hatching**: the player sees the timer and the primary element's egg. | §3.1: "a long timer reveals a rare result early" only means something if the egg doesn't say. |
| R21 | **`habitatRateCap`** is a preset field in percent, `null` or 125. "Native rate" is the same rarity and level at the habitat's element. The Golden Aerie is uncapped. | A13 and §5.2; percent keeps currency math integer. |
| R22 | **Dragon Book**: a species is discovered on hatching or purchase; starters begin discovered. Silhouettes are the species' sprite with CSS `brightness(0)`. Hint text is ours. | §1.4 gives no rules; silhouettes need no extra art. |
| R23 | **A hybrid with no art draws its primary Basic's sprite** until its art lands. | Keeps the game playable while 91 species of art arrive. |
| R24 | **PvE stages and bots draw from the full catalog until M5**, with today's rarity rules, so stages 11+ meet real Rares and Epics. | M5 rewrites both from §6; not worth a stopgap. |
| R25 | **The first hybrid's 1 minute** is real time under both presets, for breed and hatch, with no building reduction. Applies whichever answer to Q1 of the M2 plan. | §3.5 states a time, not a classic value. |
| R26 | **Buying a Basic needs room**: a finished habitat that can house it (its element, or a Golden Aerie) with a free slot, otherwise `NO_HABITAT_SLOT`. | The Hatchery should not fill with bought dragons. |
| R27 | **`xpMult` applies to all XP and harvest gives crop tier × 2 XP from M2** (§4.3, §7.2). M3 keeps the rest of the XP table. | M2 is unplayable to PL 2 without it; no GDD number changes. |
| R28 | **The XP curve is a literal integer table** of ⌈50 × PL^1.8⌉. Totals are exact: 9,741, 31,864, 73,067, 232,934, each within 0.1 % of §4.3's rounded 9,742, 31,862, 73,062, 232,892. | Same treatment as R5; `Math.pow` isn't guaranteed identical across engines. |
| R29 | **`xpMult` multiplies awards, not the curve.** The roadmap's "curve × preset" is read this way. | §4.3: "Flash-14 multiplies all XP by 12", and its PL 30 Day 4 target only fits with an unmultiplied curve. |
| R30 | **First-time double XP** is on hatching only, when the species isn't yet in `discovered`. Buying a Basic adds it to the Book with no hatch XP. | §4.3 says "First-time hatch". |
| R31 | **Build XP** counts Gold spent on habitats, farms, Grove, Roost, upgrades, expansions and islands, paid when the Gold is spent. Decorations and $DRIS-priced items pay none. Obstacles keep §5.6's XP. | The 5 XP minimum on a 10 Gold decoration would be a farm; there's no Gold in a premium price. |
| R32 | **`UNLOCKS` uses §4.4 and §5.5 where they speak**, moving PvE to PL 4 and Islands 3–6 to PL 18, 25, 32, 40. Home expansions keep today's PLs until M4. PvP and decorations keep their own gates until M6 and M7. | §4.4 lists these; M4, M6 and M7 own the rest. |
| R33 | **The Roost is one building on 2 cells until M4**, with art at its final size drawn scaled down. Its tier rises when the build finishes. | R9, and R15's measured lesson about room. |
| R34 | **"Tier 1 is unlocked by a tutorial goal at PL 5"** means PL 5 is the gate and Goal 11 leads the player there. | §4.4 lists PL 5; a Goal gate could block a player who skips Goals. |
| R35 | **Ascension** spends its Gold and $2.00 when it starts, is skippable like any timer, and books its 100 % burn in M7. | §4.2, §7.4; the ledger split arrives in M7. |
| R36 | **The 14 Goals in Task 5** are ours, in §4.3's 25–500 XP range, with modest Gold rewards. | §1.4 and §4.2 name Goals but list none. |
| R37 | **Goals need a Claim tap**, are checked from state and simple counters, and count progress from the start of the game, so one already met can be claimed at once. | Keeps them pure and forgiving. |
| R38 | **The level-up screen pays nothing**: it reports new levels and what opened, and combines a jump into one screen. | §4.3 and §4.4 list no level rewards. |
| R39 | **The maximum Player Level stays 50**, with the curve through PL 49. | §7.2 says "40+"; §5.5's last gate is PL 40. |
| R40 | **If Q1 (b) or (c):** XP above the day's limit is banked and pays on the first action of the next day. Limits run per R41. | Nobody loses play; §7.2's Endgame row says only "30+". |
| R41 | **Level limits run through Endgame** from §7.2's table, replacing R40's "limits end with Rush"; banking stays; no limit from Finals on. | Without it a casual player (6 × 30 min a day) reaches PL 30 at 20 h and PL 40 at 48 h, and banked XP jumped PL 30 to PL 45 on Day 5, against §7.2's PL 32–40 across Days 6–12. |
| R42 | **Island ids are `home`, `isle2`..`isle6`, with names in `ISLANDS`.** `dawnspire` becomes `isle6`, Warlord's Crown. Its Legendary requirement goes. | §5.5 names the six and gives each only a PL gate; the old rule came from a superseded spec. |
| R43 | **An island is 32×32 tiles, and plot index = plotRow × 4 + plotCol. A building may straddle owned plots;** every tile it covers must be owned. | §5.5 says 4×4 plots of 8×8 tiles; a 5×5 on an 8×8 plot would be needlessly boxed in. |
| R44 | **"Touch" means sharing an edge,** not a corner. | Keeps holdings connected for buildings that straddle. |
| R45 | **A plot's price is by how many have been bought on that island,** not by where it is. | §5.5 lists prices in order, with no positions. |
| R46 | **Home's 12 plots open at PL 2, 2, 3, 4, … 12.** | §5.5 fits 12 plots into PL 2–12, 11 levels; the early doubling helps where room is tightest. |
| R47 | **Bridges go in order, and need only their PL and Gold; outer plots have no PL gate beyond the Bridge.** An island needn't be full first. | §5.5 lists one PL gate per island; requiring a full island would cost 285k–2B before moving on. |
| R48 | **A Bridge's 4 plots each spawn 2–4 obstacles,** like purchased plots. Only Home's start uses the fixed layout. | §5.6 calls out "starting plots" and "purchased" plots; a Bridge is a purchase. |
| R49 | **Island 2's real total is 3,020,000 Gold with its Bridge, not the table's 2.9M,** which leaves the Bridge out. Price lists govern. | Every other row includes it. The table's cumulative figures are rounded, and nothing reads them. |
| R50 | **Home's start is a fixed table, 77 of 256 tiles.** Obstacles lie to the south and east, leaving a clear block next to the buildings. | `newPlayer` has no `Rng`, and it pins room for the first sessions. |
| R51 | **"Ancient Tree / Boulder" is two kinds with one row of values.** Spawn: 2–4 uniform, weights Ancient Tree 1, Boulder 1, Large Rock 2, Tree 4, Small Rock 4, Bush 8; one per quadrant. | The GDD gives no weights; these average 3,340 Gold and 167 XP per obstacle, so clearing a whole Home plot costs about 10k Gold. Clearing is optional, so early plots stay cheap to own. |
| R52 | **`IslandMult` applies to Gold cost only.** XP is §5.6's value × `xpMult`. Drops are flat and not preset-multiplied. | §5.6's formula names only cost; §7.2 lists no drop multiplier. |
| R53 | **Clear timers divide by the preset's build divisor.** | §5's header: "divides build timers", and clearing is construction. |
| R54 | **Drops roll on completion with that action's `Rng`,** on any completion path. | One place to pay once, and the skip path already runs it. |
| R55 | **A token takes its time off any timer a `$DRIS` skip can target; the surplus is lost;** it doesn't finish anything itself. | §3.6 and §5.6 say "speed-up"; reusing the targets and finish paths adds no new rules. |
| R56 | **Plots and Bridges pay build XP (R31); clears pay §5.6's XP and no build XP.** | R31 names expansions and islands, and says obstacles keep §5.6's XP. |
| R57 | **Moves stay free, between plots and between unlocked islands.** The Hatchery stays on Home. Timers keep running. | The GDD doesn't price moves, and they already cost nothing since Phase 6b. |
| R58 | **An island always shows whole, with unowned land as fog, and the camera opens on owned land.** Zoom stays whole numbers from 1. | 32×32 is 512 px wide at zoom 1, wider than a phone; opening on owned land keeps it readable. |
| R59 | **Warlord's Crown decorations keep their PL 45 gate until M7,** when A9 reprices them. | M7 owns them; the gap is noted, and harmless until PL 45. |
| R60 | **The Map is a Phaser scene with a matching DOM list of buttons.** Positions are display only. | Reuses the island's gestures; the list keeps keyboard and screen-reader access. |
| R61 | **Habitat and Farm sprites draw at footprint width ÷ sheet width,** until art lands at final size. | The game runs before the art does, and art needs no code change. |
