# Dragon Island GDD pivot: roadmap

Spec: `docs/dragon-island-gdd.md`. Rulings: `docs/superpowers/specs/2026-10-30-gdd-rulings.md`. Each milestone gets its own plan written with the writing-plans skill right before it starts, approved by shiko, then executed subagent-driven on the PC (Remote Control). Each milestone ends playable, with tests green, `pnpm playtest` run, screenshots taken and a report in the project Library.

| Milestone | GDD | Plan | Status |
| --- | --- | --- | --- |
| M0 Teardown | overrides, A1, A1b | `2026-10-30-gdd-m1-core-loop.md` Part A | planned |
| M1 Core loop | §1, §4.1, §5.1–5.3, §7.2 | `2026-10-30-gdd-m1-core-loop.md` Part B | planned |
| M2 Breeding | §3, §5.4 | next | |
| M3 Progression | §4.2–4.4 | | |
| M4 Island | §5.5–5.6 | | |
| M5 Combat and PvE | §2, §6.1–6.3 | | |
| M6 PvP | §6.4–6.5 | | |
| M7 Economy and $DRIS | §7 | after the token discussion | |
| M8 Monetization | §8 | after the token discussion | |
| M9 Social and retention | §10 | after the token discussion | |

## What each milestone will contain

**M2 Breeding (§3, §5.4).** `breeding.ts` rewritten to the §3.2 algorithm (U/P pools, candidate rule, floor guard, weights 1000/500/200/60/40, Basic×Basic opposites blocked, Legendary injection during events, no pity); catalog generated from the §3.4 grid with ordered elements (10 Basics, 48 Uncommon, 34 Rare, 8 Epic, tri-hybrids and Legendaries as data rows with a `name` column for shiko, A4); Breeding Mountain and Grove tables (§5.4) replace nests; Hatchery slot table; egg waits in its building when the Hatchery is full and blocks it; scripted first hybrid (§3.5); timers from the M1 table; Dragon Book with silhouettes and breeding hints; breeding screen with the outcome list and odds; hybrid arbitrage flag test (A13); `habitatRateCap`.

**M3 Progression (§4.2–4.4).** Dragon Roost building and tiers (caps already in M1 data), Ascension $2.00 burn; XP curve ⌈50 × PL^1.8⌉ × preset, the §4.3 source table (double hatch XP on a first-time Dragon Book entry, build XP per 20 Gold, collect 0); the §4.4 unlock schedule as one data table consulted by every gate; Goals (sequential tutorial quests, §1.4) replacing the old tutorial timers.

**M4 Island (§5.5–5.6).** Six named islands of 4×4 plots (8×8 tiles), adjacency, Bridges granting the centre 2×2, plot price lists, PL gates; GDD footprints (habitat/Hatchery/Roost 4×4, Farm 3×3, Mountain/Grove 5×5) with regenerated building art; obstacle table (§5.6) with spawn on purchase, bonus drops and a speed-up token inventory; new map screen; Ember Reach … Warlord's Crown art.

**M5 Combat and PvE (§2, §6.1–6.3).** Alternating-turn 3v3 state machine with Swap and KO replacement; move kit (Physical 0.52, Tier 1/2/3 with the Tier 3 cooldown); damage formula with crit and absolute 0×; client-side simulation on a revealed seed with server settlement (A8); Elemental Trials (10 chapters, bosses, wildcards, fatigue HP and regen, stars, replays, rewards, heal-all); battle screen per the UI direction.

**M6 PvP (§6.4–6.5).** Trophy formula, defender −50 %, Bastion, Arena Energy and refills, league table with Gold/Food rewards and permanent floors, Team Power and Roost-tier matchmaking with widening and Ghost teams, refresh cost, first-5-wins chest, the §6.4 defence AI, ladder opening by game day, Ladder Lock, Grand Finals brackets with Finals Points/Energy/Tickets, league rewards, the Finals Legendary; Champion's Arena rules proposed for approval (A6).

**M7 Economy and $DRIS (§7)** — after the token discussion. `TokenLayer` interface with a mock chain; price oracle interface with a mock TWAP feed, band clamp, 30 s quotes, breaker state machine, rate limits and G; sink split ledger (70/20/10 and overrides); emission pool P with sources, daily schedule, top-10 Daily Ladder (A14), unspent → Treasury (A15); exit-burn withdrawals; Redemption Reserve mock, R display and shutdown flow; Supply Crates; decorations priced in USDe (A9); Smelting; one account per wallet and per IP plus bot controls (A11); contract redesign in Foundry (A10); KPI admin view.

**M8 Monetization (§8)** — after the token discussion. Chests, rates, pity, featured banners, HMAC provably fair pull log, daily cap, Soulbound flag, Terminal Pass and Pass Points, sales sunset, the $DRIS confirmation sheet with quote countdown and "Shop paused".

**M9 Social and retention (§10)** — after the token discussion. Wings (roster, Vault, Totem, Timer Help, gifts, Wing Points, Wing Wars, Coffer mock, prize distribution, anti-abuse), Countdown Calendar, rivals, notification inbox with a push stub.

## Art (parallel thread, standing permission)

Each milestone plan ends with an art list for the PixelLab thread. M1's list: War habitat, War Basic dragon (adult, hatchling, egg), War element icon, ten juvenile sprites, Golden Aerie (re-skin of the Nexus), six crop sprites and sway loops. Art lands as a manifest update on `main`; the game falls back to drawn placeholders until then.
