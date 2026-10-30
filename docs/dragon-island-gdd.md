# Dragon Island: Game Design Document

Oct 30, 2026 · @shiko

Dragon Island is a breed-collect-battle game inspired by early Dragon City. It runs once for 14 or 28 days on a tradable token, $DRIS, then shuts down permanently and redeems all remaining tokens from a stablecoin reserve.

## Document overview

| Item | Value |
| --- | --- |
| Genre | Collection RPG + island builder + turn-based elemental combat |
| Elements | 10: Terra, Flame, Sea, Nature, Electric, Ice, Metal, Dark, Light, War |
| Rarities | Common, Uncommon, Rare, Epic, Legendary |
| Max dragon level | 40 |
| Lifespan | Flash-14 (14 days) or Flash-28 (28 days), then a 7-day redemption window |
| Currencies | Gold and Food (off-chain, never withdrawable), $DRIS (on-chain, tradable) |
| Status | Design complete. Pending legal review and Robinhood compliance approval |

**Provenance labels used throughout**

- **Sourced**: confirmed from DeetList, PocketGamer or Ditlep.
- **User-Supplied**: data the design owner provided (element chart, Level 40 stat benchmarks, opposite pairs).
- **Community-Derived**: player-tested consensus.
- **Design Rec**: designed for this game. Every unlabeled number is Design Rec.

Gems from the classic design no longer exist. Any remaining Gem price converts at 100 Gems = $1.00 USDe, paid in $DRIS.

## 1. Game Overview & Core Loop

The core loop turns dragons into Gold through habitats, Gold into Food through farms, and Food into stronger dragons. Timers gate every step and $DRIS skips them.

### 1.1 Design pillars

1. **Breeding as discovery.** Pairing two dragons with an uncertain outcome is the main hook.
2. **The island grows with you.** Every dragon needs a home and every home earns Gold.
3. **Elements matter.** Element matchups decide combat and housing, which rewards a varied collection.
4. **Explosive, time-boxed progression.** Level 40 in days, not months.

### 1.2 Resources

| Resource | Role | Main source | Main sink |
| --- | --- | --- | --- |
| Gold | Soft currency for building and expanding | Habitats (passive, capped) | Crops, habitats, buildings, land |
| Food | Leveling currency | Farms | Feeding dragons |
| $DRIS | Tradable hard currency | Ranked competition, capped achievements, capped smelting | Speed-ups, premium items, fees, entries, gacha |
| Time | Universal gate | — | Every breed, hatch, crop and build timer |

### 1.3 Core loop

1. **Breed**: two Level 4+ dragons in the Breeding Mountain. Free; the timer comes from the offspring.
2. **Hatch**: the egg moves to the Hatchery. Hatch time equals breed time.
3. **House**: place the dragon in a habitat matching one of its elements. It starts producing Gold.
4. **Feed**: spend Food, 4 feeds per level. Raises Gold/min and combat stats.
5. **Earn**: collect Gold before the habitat's Gold Cap stops production.
6. **Reinvest**: Gold buys crops (Food), habitats (capacity) and land.

Combat runs alongside it: pick 3 dragons, fight turn-based battles, earn Gold, Food, XP and (in ranked play) $DRIS.

### 1.4 Meta loops

- **Goals**: sequential quests that teach one mechanic at a time.
- **Dragon Book**: the collection catalog, run as a completion race with bounties.
- **Featured banners**: three Legendary banners, rotating every 4 days (Flash-14).
- **PvP ladder**: one lifetime ladder from Day 3, ending in the Grand Finals.
- **Wings**: guilds that pool Gold and $DRIS and compete in Wing Wars.

### 1.5 Lifetime phases

| Phase | Flash-14 | Flash-28 | Main loop | Main sink | Main source |
| --- | --- | --- | --- | --- | --- |
| Rush | Days 1–4 | Days 1–7 | Breed, feed, expand, Ascension | Speed-ups, premium infrastructure, Fusion Fees | Back-loaded; little emission |
| Endgame | Days 5–12 | Days 8–25 | Arena, Legendary Rites, Wing Wars | Arena Tickets, Rites, gacha | Daily Ladder, PvE, Smelting |
| Grand Finals | Days 13–14 | Days 26–28 | Finals brackets, Grand War | Finals Tickets | Grand Finals payouts |
| Settlement | Days 15–21 | Days 29–35 | Redeem $DRIS | Redemption burn | Redemption Reserve |

### 1.6 Session profile

| Metric | Rush | Endgame | Grand Finals |
| --- | --- | --- | --- |
| Session length | 20–40 min | 10–20 min | 30–60 min bursts |
| Sessions per day | 6–8 | 8–12 | 6–10 |
| Daily playtime | 2–4 h | 2–3 h | 3–5 h |
| Main activity | Breeding, feeding, expansion, Trials | Arena, Rites, Wing Wars, gacha | Finals brackets, Grand War |
| Bottleneck | Gold, then Food | Arena Energy, Legendary odds | Finals Energy |
| Return trigger | Breed and hatch timers, Gold caps | Energy full, rival pushes, Daily Ladder close | Finals Energy, bracket rank changes |

## 2. Dragon Taxonomy & Elemental Combat

Every element beats exactly 2 others and is weak to exactly 2. Only a dragon's first element sets its weaknesses, so a full element advantage beats any rarity gap.

### 2.1 Element profiles (User-Supplied)

| Element | Strong against (deals 2x) | Weak to (takes 2x) | Resists (takes 0.5x) | Immune (takes 0x) |
| --- | --- | --- | --- | --- |
| Terra | Electric, Flame | Metal, War | Electric, Flame | Terra |
| Flame | Nature, Ice | Terra, Sea | Nature, Ice | Flame |
| Sea | Flame, War | Nature, Electric | Flame, War | Sea |
| Nature | Sea, Light | Flame, Ice | Sea, Light | Nature |
| Electric | Sea, Metal | Terra, Light | Sea, Metal | Electric |
| Ice | Nature, War | Flame, Metal | Nature, War | Ice |
| Metal | Terra, Ice | Electric, Dark | Terra, Ice | Metal |
| Dark | Metal, Light | Light, War | Metal only | Dark |
| Light | Electric, Dark | Nature, Dark | Electric only | Light |
| War | Terra, Dark | Sea, Ice | Terra, Dark | War |

Rules: if X deals 2x to Y, Y deals 0.5x to X. **Dark and Light deal 2x to each other**, so each has only one resistance. Every element deals 0x to itself. Physical moves are always 1x.

### 2.2 Damage matrix

Rows are the attacking move's element; columns are the defender's primary element.

| ATK \\ DEF | Terra | Flame | Sea | Nature | Electric | Ice | Metal | Dark | Light | War |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Terra | 0 | 2 | 1 | 1 | 2 | 1 | 0.5 | 1 | 1 | 0.5 |
| Flame | 0.5 | 0 | 0.5 | 2 | 1 | 2 | 1 | 1 | 1 | 1 |
| Sea | 1 | 2 | 0 | 0.5 | 0.5 | 1 | 1 | 1 | 1 | 2 |
| Nature | 1 | 0.5 | 2 | 0 | 1 | 0.5 | 1 | 1 | 2 | 1 |
| Electric | 0.5 | 1 | 2 | 1 | 0 | 1 | 2 | 1 | 0.5 | 1 |
| Ice | 1 | 0.5 | 1 | 2 | 1 | 0 | 0.5 | 1 | 1 | 2 |
| Metal | 2 | 1 | 1 | 1 | 0.5 | 2 | 0 | 0.5 | 1 | 1 |
| Dark | 1 | 1 | 1 | 1 | 1 | 1 | 2 | 0 | 2 | 0.5 |
| Light | 1 | 1 | 1 | 0.5 | 2 | 1 | 1 | 2 | 0 | 1 |
| War | 2 | 1 | 0.5 | 1 | 1 | 0.5 | 1 | 2 | 1 | 0 |
| Physical | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 |

### 2.3 Primary-element rule

- **Defense:** only the first element is looked up (Sourced). A Flame/Sea dragon takes 2x from Sea moves; its own Sea element gives no protection.
- **Offense:** each move has one element. A dragon's elements only decide which moves it can learn, so secondary elements add reach without adding weaknesses.
- **Element order is species identity.** Flame/Sea and Sea/Flame are different dragons with opposite weaknesses.
- **Mirror immunity:** every dragon must carry a Physical move, the only way to hurt a dragon of the same primary element with a Basic.

### 2.4 Rarity scaling

Level 40 benchmarks are User-Supplied; the level curve is Design Rec. ATK is always 0.40 x HP, so rarity scales a dragon evenly without changing its role.

```latex
\text{Stat}(L) = \text{Stat}_{40} \times \left[0.20 + 0.80 \times \frac{L-1}{39}\right]
```

| Rarity | Category | HP Lv 1 | HP Lv 10 | HP Lv 20 | HP Lv 30 | HP Lv 40 | ATK Lv 1 | ATK Lv 20 | ATK Lv 40 | Power vs Common |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Legendary | 5 | 2,800 | 5,385 | 8,256 | 11,128 | 14,000 | 1,120 | 3,303 | 5,600 | 3.06x |
| Epic | 4 | 2,400 | 4,615 | 7,077 | 9,538 | 12,000 | 960 | 2,831 | 4,800 | 2.25x |
| Rare | 3 | 2,000 | 3,846 | 5,897 | 7,949 | 10,000 | 800 | 2,359 | 4,000 | 1.56x |
| Uncommon | 2 | 1,800 | 3,462 | 5,308 | 7,154 | 9,000 | 720 | 2,123 | 3,600 | 1.27x |
| Common | 1 | 1,600 | 3,077 | 4,718 | 6,359 | 8,000 | 640 | 1,887 | 3,200 | 1.00x |

**Balance finding:** dealing 2x while taking 0.5x is a 4x swing, larger than the biggest rarity gap (3.06x). A Common with a full element advantage beats a Legendary: 2.2 hits to KO it against 2.9 hits the other way. Keep any future tier below 2.0x stats, or counters stop working.

## 3. Breeding System & Genetic Algorithms

Offspring are rolled from a weighted pool built from both parents' elements. Four opposite pairs can't breed as Basics, which turns the 8 opposite Epics into a three-generation puzzle.

### 3.1 Fundamentals

| Rule | Detail |
| --- | --- |
| Eligibility | Both parents Level 4+ (Sourced) |
| Parents | Not consumed (Sourced) |
| Output | One egg per breed |
| Buildings | Breeding Mountain (PL 2); Breeding Grove doubles throughput (PL 12) |
| Timer | Set by the offspring's species, so a long timer reveals a rare result early |

### 3.2 Breeding algorithm

1. **Validity:** reject if either parent is under Level 4, or both are Basics and opposites.
2. **Pools:** U = all elements of both parents. P = both parents' primary elements.
3. **Candidates:** a species S qualifies if its primary is in P, all its elements are in U, it has at most 3 elements, it's a Basic only when a parent is a Basic, and it's a Legendary only while its event recipe is active.
4. **Floor guard:** if no Common or Uncommon qualifies, add each parent's primary Basic. This stops two rare parents cloning rares at 100%.
5. **Roll:** P(S) = W(rarity of S) / sum of W over the pool.

| Rarity | Weight W |
| --- | --- |
| Common | 1,000 |
| Uncommon | 500 |
| Rare | 200 |
| Epic | 60 |
| Legendary | 40 (event pools only) |

### 3.3 Opposite elements (User-Supplied)

| Opposite pair | Also a counter pair? |
| --- | --- |
| Flame and Ice | Yes (Flame beats Ice) |
| Nature and Electric | No |
| Terra and Dark | No |
| Sea and War | Yes (Sea beats War) |
| Metal, Light | No opposite. These are free agents and make universal bridge parents |

Only Basic x Basic opposite pairings are blocked. Example bypass: breed Flame/Terra (Rare) with Ice/Sea (Uncommon). The pool then holds Ice/Sea 31.6%, Ice/Terra 31.6%, Flame/Terra 12.7%, Flame/Sea 12.7%, and Flame/Ice, Ice/Flame and a Flame/Ice/Sea tri-hybrid at 3.8% each. That's a 7.6% chance of an opposite hybrid, about 13 attempts on average.

### 3.4 Hybrid rarity grid

Rows are primary, columns secondary. U = Uncommon (neutral pair), R = Rare (counter pair), E = Epic (opposite pair), C = Basic.

| P \\ S | Terra | Flame | Sea | Nature | Electric | Ice | Metal | Dark | Light | War |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Terra | C | R | U | U | R | U | R | E | U | R |
| Flame | R | C | R | R | U | E | U | U | U | U |
| Sea | U | R | C | R | R | U | U | U | U | E |
| Nature | U | R | R | C | E | R | U | U | R | U |
| Electric | R | U | R | E | C | U | R | U | R | U |
| Ice | U | E | U | R | U | C | R | U | U | R |
| Metal | R | U | U | U | R | R | C | R | U | U |
| Dark | E | U | U | U | U | U | R | C | R | R |
| Light | U | U | U | R | R | U | U | R | C | U |
| War | R | U | E | U | U | R | U | R | U | C |

| Rarity | Definition | Unordered pairs | Ordered species |
| --- | --- | --- | --- |
| Common | Single element | — | 10 |
| Uncommon | Neutral pair | 24 | 48 |
| Rare | Counter pair, not opposite | 17 | 34 |
| Epic | Opposite pair, plus 20–30 curated tri-hybrids | 4 | 8 + curated |
| Legendary | Event recipes, banners, rewards | — | Curated |

**Basic x Basic odds:** a neutral pair (e.g. Terra x Nature) gives a 33.3% hybrid chance; a counter pair (Terra x Flame) gives 16.7%.

**Legendary injection:** during its event, a Legendary joins any pool whose primaries and elements cover its recipe. Odds are 40 / (pool weight + 40): about 2.5% from bridge hybrids, 1.3–1.6% from Basics.

### 3.5 Breeding timers

The timer uses the highest element tier in the offspring: Tier A = Terra, Flame, Sea, Nature; Tier B = Electric, Ice, Metal; Tier C = Dark, Light, War. Hatch time equals breed time. Values are Flash-14 (classic ÷ 6); Flash-28 is classic ÷ 4.

| Rarity | Tier A | Tier B | Tier C | Classic base (Tier A / B / C) |
| --- | --- | --- | --- | --- |
| Legendary | 8 h | 8 h | 8 h | 48 h |
| Epic | 2 h | 3 h | 4 h | 12 h / 18 h / 24 h |
| Rare | 40 min | 1 h | 1 h 20 min | 4 h / 6 h / 8 h |
| Uncommon | 5 min | 10 min | 20 min | 30 min / 1 h / 2 h |
| Common | 5 sec | 2.5 min | 10 min | 30 sec / 15 min / 1 h |

The first hybrid breed is scripted: a guaranteed Uncommon with a 1-minute timer.

### 3.6 Speed-ups

Skip cost uses remaining hours H and is paid in $DRIS at the band-clamped price (Section 7.3). The curve is concave, so longer timers cost less per hour.

```latex
\text{SpeedUp}_{USDe}(H) = \$0.10 \times H^{0.68}
```

| Remaining | USDe | Typical use |
| --- | --- | --- |
| 10 min | $0.03 | Common Tier C |
| 1 h | $0.10 | Rare |
| 3 h | $0.21 | Epic |
| 8 h | $0.41 | Legendary breed or hatch |
| 24 h | $0.87 | Long build timer (Flash-28) |

## 4. Progression Systems

Stats grow linearly but Food cost grows 20% per level, so 84% of the Food to reach Level 40 is spent on Levels 30–40. The Dragon Roost caps every dragon's level and turns Gold, Player Level and (at the top tier) $DRIS into the key.

### 4.1 Feeding

- **4 feeds per level** (Sourced). Partial progress is saved.
- Food cost is the same for every rarity, so rarer dragons are more Food-efficient.
- At the Roost cap, the Feed button becomes Upgrade Roost.
- Evolution: Baby (Lv 1–3), Juvenile (Lv 4–6, can breed), Adult (Lv 7+) (Community-Derived).

```latex
\text{FoodPerFeed}(L) = \lceil 5 \times 1.2^{\,L-1} \rceil \qquad \text{TotalFood}(1 \to N) \approx 100 \times (1.2^{\,N-1} - 1)
```

| Level | Food per feed | Food for this level | Total Food from Lv 1 | Share of Lv 40 total |
| --- | --- | --- | --- | --- |
| 39 to 40 (cap) | 5,104 | 20,416 | 122,382 | 100% |
| 34 to 35 | 2,052 | 8,208 | 49,122 | 40.1% |
| 29 to 30 | 825 | 3,300 | 19,681 | 16.1% |
| 24 to 25 | 332 | 1,328 | 7,850 | 6.4% |
| 19 to 20 | 134 | 536 | 3,095 | 2.5% |
| 14 to 15 | 54 | 216 | 1,184 | 1.0% |
| 9 to 10 | 22 | 88 | 416 | 0.3% |
| 6 to 7 (Adult) | 13 | 52 | 199 | 0.2% |
| 3 to 4 (breedable) | 8 | 32 | 73 | 0.06% |

### 4.2 Dragon Roost

Without a Roost, dragons are capped at Level 7. Tier 1 is unlocked by a tutorial goal at Player Level 5. Build timers below are classic; Flash-14 divides them by 6.

| Roost tier | Level cap | Player Level | Cost | Build timer (classic) | Food to max one dragon |
| --- | --- | --- | --- | --- | --- |
| Tier 5 (Ascension) | 40 | 30 | 10,000,000 Gold + $2.00 USDe in $DRIS (100% burned) | 48 h | 122,382 |
| Tier 4 | 30 | 22 | 2,500,000 Gold | 24 h | 19,681 |
| Tier 3 | 20 | 15 | 400,000 Gold | 12 h | 3,095 |
| Tier 2 | 15 | 10 | 75,000 Gold | 4 h | 1,184 |
| Tier 1 | 10 | 5 | 5,000 Gold | 30 min | 416 |

### 4.3 Player XP

Flash-14 multiplies all XP by 12 (Flash-28 by 8), which puts PL 30 at about Day 4.

| Action | XP (classic) |
| --- | --- |
| Harvest a crop | Crop tier x 2 (2–12) |
| Feed a dragon | 1 per 10 Food (min 1 per feed) |
| Start a breed | 5 |
| Hatch an egg | C 10, U 30, R 80, E 200, L 500 |
| First-time hatch (new Dragon Book entry) | Double the hatch XP |
| Build, upgrade or expand | 1 per 20 Gold spent (min 5) |
| Win a PvE battle | 10–50 |
| Complete a Goal | 25–500 |
| Collect Gold | 0 (prevents tap-farming) |

```latex
\text{XP to next level}(PL) = \lceil 50 \times PL^{1.8} \rceil
```

| Player Level | Cumulative XP | Flash-14 target | Flash-28 target |
| --- | --- | --- | --- |
| 30 | 232,892 | Day 4 | Day 6–7 |
| 20 | 73,062 | Day 2–3 | Day 4–5 |
| 15 | 31,862 | Day 2 | Day 3 |
| 10 | 9,742 | Day 1 | Day 1–2 |
| 5 | 1,194 | Day 1 | Day 1 |

### 4.4 Unlock schedule

| PL | Infrastructure | Elements and dragons | Capacity |
| --- | --- | --- | --- |
| 1 | Terra and Flame Habitats, Farm 1, Hatchery | Terra and Flame Basics | Crop T1 (30 s) |
| 2 | Breeding Mountain, Island 1 expansion | Scripted first hybrid | — |
| 3 | Sea and Nature Habitats, Farm 2 | Sea and Nature Basics | Crop T2 |
| 4 | Farm 3, PvE Trials | — | Hatchery slot 2 |
| 5 | Dragon Roost Tier 1 | — | Crop T3 |
| 6 | Electric Habitat | Electric Basic | — |
| 7 | Farm 4 | — | — |
| 8 | Ice Habitat, Wings | Ice Basic | Crop T4 |
| 10 | Metal Habitat, Roost Tier 2 | Metal Basic (free-agent bridge parent) | — |
| 12 | Breeding Grove, Island 2 | — | Crop T5 |
| 13 | — | — | Hatchery slot 3 |
| 14 | Dark Habitat | Dark Basic | — |
| 15 | Roost Tier 3 | — | Crop T6 |
| 16 | Light Habitat | Light Basic | — |
| 18 | War Habitat, Island 3 | War Basic: all 100 non-tri species breedable | — |
| 21 | — | — | Hatchery slot 4 |
| 22 | Roost Tier 4 | — | — |
| 25 | Island 4 | — | — |
| 30 | Roost Tier 5 (Ascension) | — | — |

The PvP ladder opens by day (Day 3 in Flash-14), not by Player Level (Section 6).

## 5. Island Infrastructure & Habitats

Habitats hold dragons and cap their Gold. Each element trades production speed against cap size: Sprinters pay players who check in often, Vaults pay players who don't. Land, not a building limit, caps how many habitats a player can own.

Values below are classic. Flash-14 multiplies dragon Gold/min and habitat caps by 10 (Flash-28 by 6) and divides build timers by 6 (Section 7.2).

### 5.1 Dragon income

```latex
\text{GPM}(L) = \text{RarityMult} \times \left[\text{Base} + \text{Inc} \times \min(L-1, 9) + \tfrac{\text{Inc}}{2} \times \max(L-10, 0)\right]
```

The halving after Level 10 follows DeetList's model (Sourced). A hybrid's income profile comes from its primary element. Rarity multipliers: Common 1.0, Uncommon 1.2, Rare 1.5, Epic 2.0, Legendary 2.5.

### 5.2 The 10 habitats

| Element | Archetype | Income Base / Inc | Fill time | L1 capacity | L1 Gold Cap | L2 capacity | L2 Gold Cap | Build (Gold) | L1 to L2 (Gold) | Unlock PL |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Terra | Sprinter | 18 / +12 (Sourced) | \~1 h | 2 | 8,000 | 3 | 28,000 | 500 | 10,000 | 1 |
| Electric | Sprinter | 15 / +10 | \~1.5 h | 2 | 10,000 | 3 | 35,000 | 25,000 | 100,000 | 6 |
| Flame | Standard | 7 / +5 (Sourced) | \~3 h | 2 | 10,000 | 3 | 35,000 | 2,000 | 20,000 | 1 |
| Sea | Standard | 10 / +7 | \~3 h | 2 | 14,000 | 3 | 49,000 | 5,000 | 40,000 | 3 |
| Nature | Standard | 9 / +7 | \~4 h | 2 | 18,000 | 3 | 64,000 | 10,000 | 60,000 | 3 |
| Metal | Steady | 9 / +6 | \~6 h | 2 | 24,000 | 3 | 84,000 | 60,000 | 200,000 | 10 |
| Ice | Steady | 8 / +6 | \~6 h | 2 | 23,000 | 3 | 83,000 | 40,000 | 150,000 | 8 |
| Light | Steady | 8 / +5 | \~8 h | 2 | 27,000 | 3 | 94,000 | 200,000 | 600,000 | 16 |
| Dark | Vault | 6 / +4 | \~12 h | 2 | 32,000 | 3 | 112,000 | 150,000 | 500,000 | 14 |
| War | Vault | 7 / +4 | \~12 h | 2 | 33,000 | 3 | 115,000 | 250,000 | 750,000 | 18 |

Fill time assumes Common occupants at Lv 5 (L1) and Lv 15 (L2).

**Upgrade path:** L3 holds 4 dragons with a cap of L1 x 12.25 and costs L2 x 4 in Gold. L4 holds 5, cap L1 x 42.9, cost L2 x 16. L5 (max) holds 6, cap L1 x 150, and costs $DRIS: $1.50 (Tier A), $2.50 (Tier B), $4.00 (Tier C) USDe.

**Premium habitat:** the Golden Aerie ($5.00 USDe) accepts any element, has 3x the Gold cap and holds 6 dragons.

**Sprinter vs Vault:** two Lv 5 Commons in an L1 habitat earn about 136k Gold/day in Terra with hourly check-ins, against 66k in War. At 6-hour gaps Terra drops to 32k while War holds 66k. Each play style has a habitat that suits it.

**Hybrid arbitrage (intended):** a hybrid earns at its primary element's rate but can live in any of its elements' habitats. A Terra/War Rare in a War Vault fills about 3x faster than War Commons. If testing shows this is too strong, cap occupants at 1.25x the habitat's native rate.

### 5.3 Farms

Player Level unlocks crop types; Farm Level multiplies yield. Short crops win on Food per minute, long crops on Gold per Food. Flash-14 multiplies yields by 12 and halves grow timers.

| Tier | Crop | Unlock PL | Grow time | Gold cost | Food (Farm L1) | Food/min | Gold per Food |
| --- | --- | --- | --- | --- | --- | --- | --- |
| T6 | Warlord Pepper | 15 | 24 h | 20,000 | 2,600 | 1.8 | 7.7 |
| T5 | Frost Berries | 12 | 8 h | 8,000 | 1,000 | 2.1 | 8.0 |
| T4 | Thunder Pumpkin | 8 | 2 h | 3,000 | 360 | 3.0 | 8.3 |
| T3 | Sea Melon | 5 | 30 min | 1,000 | 120 | 4.0 | 8.3 |
| T2 | Ember Wheat | 3 | 5 min | 250 | 30 | 6.0 | 8.3 |
| T1 | Dragon Bush | 1 | 30 sec | 50 | 5 | 10.0 | 10.0 |

| Farm level | Yield | Upgrade cost | Classic timer |
| --- | --- | --- | --- |
| L5 (max) | 2.00x | $2.00 USDe | Instant |
| L4 | 1.75x | 400,000 Gold | 12 h |
| L3 | 1.50x | 75,000 Gold | 4 h |
| L2 | 1.25x | 15,000 Gold | 1 h |
| L1 | 1.00x | 1,000 Gold (first farm), x3 for each additional farm | 1 min |

Farms unlock at PL 1, 3, 4 and 7, then one every 5 PL, up to 8.

### 5.4 Hatchery and breeding buildings

A finished egg waits in its breeding building until a Hatchery slot is free, and that building can't start a new breed meanwhile.

| Building | Level | Unlock PL | Cost | Effect |
| --- | --- | --- | --- | --- |
| Hatchery | L5 (max) | 15+ | $3.00 USDe | 5 egg slots |
| Hatchery | L4 | 21 | 2,000,000 Gold | 4 slots |
| Hatchery | L3 | 13 | 250,000 Gold | 3 slots |
| Hatchery | L2 | 4 | 2,000 Gold | 2 slots |
| Hatchery | L1 | 1 | Free | 1 slot |
| Breeding Mountain | L3 | 20 | 1,500,000 Gold | -20% breed time |
| Breeding Mountain | L2 | 10 | 150,000 Gold | -10% breed time |
| Breeding Mountain | L1 | 2 | Free | 1 breeding pair |
| Breeding Grove | L3 | 25 | $3.50 USDe | -20% breed time |
| Breeding Grove | L2 | 20 | 1,500,000 Gold | -10% breed time |
| Breeding Grove | L1 | 12 | 400,000 Gold | A second parallel pair |

Breed-time reductions don't apply to hatching. Footprints: habitat, Hatchery and Roost 4x4 tiles; Farm 3x3; Mountain and Grove 5x5.

### 5.5 Island archipelago

The world is 6 islands of 4x4 plots (96 plots, each 8x8 tiles). A plot must touch an owned plot on the same island. Each new island opens with a Bridge purchase that grants its 4 center plots. Players start with Island 1's center 2x2.

| Island | PL gate | Plot prices (Gold) | Bridge (Gold) | Island total | Cumulative |
| --- | --- | --- | --- | --- | --- |
| 6. Warlord's Crown | 40 | 80M to 300M | 100M | 2.15B | \~2.7B |
| 5. Shadowmere | 32 | 15M to 70M | 25M | 491M | 581M |
| 4. Ironhold | 25 | 2M to 12M | 5M | 77M | 90M |
| 3. Frostspire | 18 | 450k to 1M | 750k | 9.5M | 12.7M |
| 2. Ember Reach | 12 | 100k to 425k | 150k | 2.9M | 3.2M |
| 1. Home Isle | 1–12 | 100 to 75k | — | 285k | 285k |

**Home Isle plots:** 100, 500, 1,500, 5,000, 8,000, 12,000, 18,000, 25,000, 35,000, 45,000, 60,000, 75,000 Gold, unlocking from PL 2 to PL 12.

**Island 2 plots:** 100k, 120k, 140k, 160k, 185k, 210k, 240k, 270k, 300k, 340k, 380k, 425k.

**Island 3 plots:** 450k rising by 50k per plot to 1M.

**Island 4 plots:** 2M, 2.5M, 3M, 3.5M, 4M, 5M, 6M, 7M, 8M, 9M, 10M, 12M.

**Island 5 plots:** 15M, 18M, 22M, 26M, 30M, 35M, 40M, 45M, 50M, 55M, 60M, 70M.

**Island 6 plots:** 80M, 90M, 100M, 115M, 130M, 150M, 170M, 190M, 215M, 240M, 270M, 300M.

The design goal is a rising price in days of income: under 1% of a day for the first plots, 25–50% on Islands 2–3, and 3–30 days on Islands 5–6.

### 5.6 Obstacles

Starting plots are about 30% covered; every purchased plot spawns 2–4 obstacles. A player can clear 2 at once, and clears can be skipped with $DRIS speed-ups.

```latex
\text{ObstacleCost} = \text{BaseCost} \times \text{IslandMult} \qquad \text{IslandMult} = 1, 3, 10, 40, 150, 500
```

| Obstacle | Footprint | Base Gold | Clear timer | XP | Bonus drop |
| --- | --- | --- | --- | --- | --- |
| Ancient Tree / Boulder | 4x4 | 25,000 | 4 h | 1,250 | 10%: 3 h speed-up token |
| Large Rock | 3x3 | 5,000 | 1 h | 250 | 5%: 1 h speed-up token |
| Tree | 2x2 | 1,000 | 15 min | 50 | 5%: 15 min speed-up token |
| Small Rock | 2x2 | 500 | 5 min | 25 | 10%: 100–300 Gold |
| Bush | 1x1 | 100 | 30 sec | 5 | 10%: 10–25 Food |

### 5.7 Gold sources and sinks

Habitats supply about 90% of Gold. The rest comes from Goals (4%), PvE (3%), selling dragons (2%) and obstacles (1%).

| Sink | Week 1 equivalent (Rush) | Mid-game | Late game |
| --- | --- | --- | --- |
| Crops (Food) | 35% | 30% | 10% |
| Habitats | 27% | 30% | 25% |
| Core buildings | 15% | 20% | 15% |
| Island expansion | 15% | 15–20% | 45% |
| Obstacles | 6% | 4% | 3% |
| Basic dragon purchases | 2% | 1% | \~0% |

Costs grow faster than income (x4 per habitat level, step-curve land prices), so Gold never piles up and stays meaningful until shutdown.

## 6. Combat Modes & PvP

Battles are 3v3, turn-based and decided by element choice: a 2x Tier 3 move one-shots an equal Level 40 Common. PvE is gated by dragon HP; PvP is one lifetime ladder gated by Arena Energy, ending in the Grand Finals.

### 6.1 Battle rules

| Rule | Detail |
| --- | --- |
| Team | 3 dragons per side, one active |
| Turns | Strictly alternating. No Speed stat: the initiator (player in PvE, attacker in PvP) moves first |
| Actions | Attack with 1 of 4 moves, or Swap (uses the turn) |
| KO | Next dragon enters free; its owner chooses |
| Turn limit | 30 total turns, then the defender wins |
| Randomness | Variance and crits only. No misses or status effects |

**Move kit:** Physical (always 1x, MoveMult 0.52, Lv 1) is fixed. The other 3 slots come from the dragon's element pool: Tier 1 (0.85, Lv 1), Tier 2 (1.00, Lv 10), Tier 3 (1.62, Lv 20, can't be used two turns in a row). MoveMult ratios come from Dragon City's base move damage: Punch 338, Lava Balls 550, Flaming Arrows 650, Nuclear Hit 1050 (Sourced).

### 6.2 Damage formula

```latex
\text{Damage} = \lfloor \text{ATK} \times \text{MoveMult} \times \text{ElementMult} \times \text{Crit} \times \text{Variance} \rfloor
```

- ElementMult = matrix value for the move's element against the defender's primary element (2, 1, 0.5 or 0).
- Crit = 1.5 on a 10% roll; Variance = uniform 0.90–1.10. Together they add 5% average damage.
- **0x is absolute:** damage is 0 and no crit or variance can lift it. The UI shows IMMUNE.
- Floor the result, minimum 1 on any non-immune hit. Physical moves ignore the matrix.

| Move vs Lv 40 Common (attacker ATK 3,200) | Element | Average damage | Share of 8,000 HP |
| --- | --- | --- | --- |
| Tier 3 | 2x | 10,368 | One-shot |
| Tier 3 | 1x | 5,184 | 65% |
| Tier 2 | 2x | 6,400 | 80% |
| Tier 2 | 1x | 3,200 | 40% |
| Physical | 1x | 1,664 | 21% |
| Tier 2 | 0.5x | 1,600 | 20% |
| Any element | 0x | 0 | Immune |

A neutral 1v1 between equals takes about 2 turns; a full 3v3 runs 10–16 turns (2–3 minutes).

### 6.3 PvE: the Elemental Trials

10 chapters of 10 nodes (9 battles and a Boss), one chapter per element in unlock order. About a third of each chapter's enemies are off-element wildcards, so one counter can't sweep it.

| Chapter | Theme | Unlock PL | Enemy levels | Enemy rarities | Counters |
| --- | --- | --- | --- | --- | --- |
| 10 | War Citadel | 28 | 33–40 | Epic; Legendary Boss | Sea, Ice |
| 9 | Light Sanctum | 23 | 28–34 | Epic | Nature, Dark |
| 8 | Dark Hollow | 19 | 23–29 | Rare, Epic | Light, War |
| 7 | Metal Forge | 16 | 19–24 | Rare | Electric, Dark |
| 6 | Ice Wastes | 13 | 15–20 | Uncommon, Rare | Flame, Metal |
| 5 | Electric Storm | 10 | 12–16 | Uncommon, Rare | Terra, Light |
| 4 | Nature Grove | 8 | 9–13 | Common, Uncommon | Flame, Ice |
| 3 | Sea Depths | 6 | 6–10 | Common, Uncommon | Nature, Electric |
| 2 | Flame Peaks | 5 | 3–7 | Common | Terra, Sea |
| 1 | Terra Wilds | 4 | 1–4 | Common | Metal, War |

**Gate: dragon fatigue.** HP carries over between PvE battles. KO'd dragons return at 1 HP and need 25% to fight. Regeneration is 6% of max HP per minute in Flash-14 (about 17 minutes to full) and 4% in Flash-28. A full heal-all costs $0.05 USDe.

**Node rewards** (first clear; Boss x3): Gold = 1,000 x ch², Food = 50 x ch², XP = 20 x ch. Chapter 1–7 Bosses also give 2–5 speed-up tokens and eggs (Uncommon at Ch 5, Rare at Ch 7). Chapter 8–10 first and 3-star clears pay $DRIS from the High-tier PvE source (Section 7). The Chapter 10 Boss gives the Trial Champion Legendary.

**Stars:** 1 = win, 2 = no KOs, 3 = no KOs in 8 turns or fewer. Three stars on a whole chapter gives one Dragon Chest pull. Replays pay 50% Gold and Food, no XP, 5 per node per day.

### 6.4 PvP: the Lifetime Ladder

Asynchronous: players attack saved defense teams that the AI plays. All dragons enter at full HP, and defenders get Bastion (+10% HP) to offset the attacker moving first.

**Defense AI:** never use a 0x move when another exists; 80% of the time pick the highest expected damage (respecting the Tier 3 cooldown), otherwise a random non-immune move; swap only if every active move is 0.5x or worse and a benched dragon has a 2x move.

| League | Trophies | Win Gold (classic) | Win Food (classic) |
| --- | --- | --- | --- |
| Champion | 4,000+ | 200,000 | 15,000 |
| Diamond | 2,800–3,999 | 100,000 | 7,500 |
| Platinum | 1,800–2,799 | 40,000 | 3,000 |
| Gold | 1,000–1,799 | 15,000 | 1,200 |
| Silver | 400–999 | 5,000 | 400 |
| Bronze | 0–399 | 1,000 | 100 |

League wins pay Gold and Food only. $DRIS comes from the Daily Ladder (top 10% by trophies gained that day) and the Grand Finals. Once reached, a league's minimum is a permanent floor.

**Matchmaking:** three opponent cards showing each team's elements and levels. Candidates must be within 100 trophies, 1 Roost tier and 15% Team Power (sum of the square root of HP x ATK, divided by 10). The trophy window widens by 50 per step up to 400; an AI Ghost team fills any gap. One refresh is free per energy point, then 500 Gold x league tier.

```latex
D = \operatorname{clamp}\!\left(\frac{T_{opp} - T_{self}}{200}, -1, 1\right) \qquad \text{Win} = +\operatorname{round}(20 + 10D) \qquad \text{Loss} = -\operatorname{round}(20 - 10D)
```

Defenders receive the opposite of 50% of the attacker's change. Wingmates are never matched against each other.

| Arena Energy | Flash-14 | Flash-28 |
| --- | --- | --- |
| Max | 3 | 3 |
| Regeneration | +1 per hour | +1 per 90 min |
| Natural daily maximum | \~24 battles | \~16 battles |
| Refills (all 3, escalating, 3 per day) | $0.25, $0.50, $1.00 USDe | Same |

The first 5 wins each day fill a chest of Food and Gold, with a 10% chance of +1 Arena Energy.

### 6.5 Ladder Lock and Grand Finals

| Phase | Flash-14 | Flash-28 | Rule |
| --- | --- | --- | --- |
| Ladder | Days 3–12 | Days 4–25 | One continuous ladder, no resets |
| Ladder Lock | End of Day 12 | End of Day 25 | League placement is fixed |
| Grand Finals | Days 13–14 | Days 26–28 | Entry needs a $3.00 USDe Finals Ticket |
| Finals Lock | End of Day 14 | End of Day 28 | Final ranks set payouts |

Gold league and above qualify. Each league (Gold, Platinum, Diamond, Champion) runs its own 48-hour bracket from 0 Finals Points, using the trophy formula. Finals Energy is 3 max, +1 every 30 minutes. Payouts come from the PvP Grand Finals source (30% of P) plus the ticket-funded Finals pool: Champion 50%, Diamond 25%, Platinum 15%, Gold 10%, then by rank.

| League at Ladder Lock | Gold (Flash scale) | Items |
| --- | --- | --- |
| Champion | 10B | Finals Legendary + exclusive aura; Finals eligibility |
| Diamond | 4B | Finals Legendary; Finals eligibility |
| Platinum | 1.5B | 2 Epic eggs; Finals eligibility |
| Gold | 400M | Epic egg; Finals eligibility |
| Silver | 100M | 2 Dragon Chest pulls |
| Bronze | 25M | 5 speed-up tokens |

The **Finals Legendary** is a unique, Soulbound, non-smeltable species delivered at Ladder Lock, so it can be used in the Grand Finals.

## 7. Economy Design & Tokenomics

By Day 5, players have burned about 29% of the lifetime emission pool P while only 15% has been emitted, so supply is smaller than on Day 1. Sinks run early, emissions arrive late, and a stablecoin Redemption Reserve gives every remaining $DRIS a defined value at shutdown.

### 7.1 Currency architecture

| Currency | Layer | Tradable | Earned from | At shutdown |
| --- | --- | --- | --- | --- |
| Gold | Off-chain | No | Habitats | Deleted |
| Food | Off-chain | No | Farms | Deleted |
| $DRIS | On-chain | Yes | Ranked competition, capped achievements, capped smelting | Redeemed from the Redemption Reserve |

**One-way valve:** $DRIS can buy Gold, Food, time and items. Gold, Food and passive production can never become $DRIS, because bot farms would mint unlimited supply.

### 7.2 Flash soft economy

Production is multiplied and timers divided; Gold and Food costs from Sections 3–5 stay the same.

| Parameter | Flash-14 | Flash-28 |
| --- | --- | --- |
| Dragon Gold/min and habitat caps | x10 | x6 |
| Crop yield | x12 | x8 |
| Crop grow timers | ÷2 | ÷1.5 |
| Breed, hatch and build timers | ÷6 | ÷4 |
| Player XP | x12 | x8 |
| PvE heal rate | 6%/min | 4%/min |
| Arena Energy | +1 per hour | +1 per 90 min |

| Day (Flash-14) | Day (Flash-28) | Phase | Player Level | Roost cap | Milestone |
| --- | --- | --- | --- | --- | --- |
| 1 | 1–2 | Rush | 1 to 12 | 15 | Island 1, Tier A and B elements, first Rare |
| 2 | 3 | Rush | 12 to 18 | 20 | All 10 elements, first opposite Epic |
| 3 | 4–5 | Rush | 18 to 25 | 30 | PvP ladder opens |
| 4 | 6–7 | Rush | 25 to 30 | 40 | Ascension |
| 5 | 8 | Endgame | 30+ | 40 | First Lv 40 dragon; Champion's Arena opens |
| 6–12 | 9–25 | Endgame | 32 to 40 | 40 | Full Lv 40 team, Legendary Rites, Wing Wars |
| 13–14 | 26–28 | Grand Finals | 40+ | 40 | Final ladder lock and payouts |
| 15–21 | 29–35 | Settlement | — | — | Redemption window |

Validation (Flash-14): Day 1 Gold is about 750k, Day 4 about 15M. One Lv 40 dragon needs 122k Food against about 360k Food/day from 6 farms, so a Lv 40 team arrives by Day 5–6. The full archipelago (2.7B Gold) stays out of reach, which keeps Gold meaningful.

### 7.3 Pricing and oracle security

All token prices are set in USD-equivalent (USDe) and converted at a band-clamped 5-minute TWAP. Each quote locks for 30 seconds and executes at exactly that price.

```latex
P_{sink} = \min(\text{TWAP}_{5m},\ 1.10 \times \text{TWAP}_{60m}) \qquad P_{source} = \max(\text{TWAP}_{5m},\ 0.90 \times \text{TWAP}_{60m})
```

TokenCost = USDe price ÷ P\_sink. TokenPayout = USDe reward ÷ P\_source. Pricing follows the market in real time within ±10% of the 1-hour anchor, and every manipulation direction is priced against the attacker.

**Flash Pump/Dump Circuit Breaker** (reads spot price, both TWAPs, pool liquidity and an independent oracle if one exists, every block):

| Level | Trigger (any one) | Action | Resume |
| --- | --- | --- | --- |
| Black: Lockdown | Liquidity drops >30% in one block; oracle and 5-min TWAP disagree >10% for 2+ min; or 3 Red trips in an hour | Full $DRIS freeze | 1 hour of stability or manual sign-off |
| Red: Shop Freeze | >15% move in 60 s, or 5-min TWAP >25% from 60-min TWAP | Freeze all sinks and sources for 10 min; refund pending quotes | 10 min elapsed and 5 stable minutes (within 3%) |
| Yellow: Fallback | Spot >5% from 5-min TWAP in one block, or 5-min TWAP moves >8% in 60 s | Price at 60-min TWAP; pause USD-pegged payouts | 3 minutes with spot within 3% of 5-min TWAP |
| Green: Normal | — | Band-clamped 5-min TWAP | — |

Hardening: contracts never read pool reserves directly, so a single-transaction flash loan can't affect pricing. Rate limits are $25 USDe of sinks and $10 USDe of payouts per account per 5 minutes, plus a global payout cap G per 5 minutes. **Invariant:** holding the price 10% off for 5 minutes must cost more than 0.10 x G, so G shrinks automatically when liquidity falls.

### 7.4 Sinks

Default split: 70% burned, 20% to the Prize Pool, 10% to the Treasury. Treasury $DRIS is never sold.

| Sink | USDe | Split |
| --- | --- | --- |
| Ascension (Roost Tier 5, once) | $2.00 | 100% burn |
| Legendary Breeding Rite (per attempt; about $10 per Legendary) | $0.25 | 100% burn |
| Opposite Fusion Fee (per attempt) | $0.05 | 100% burn |
| Champion's Arena Ticket (5 battles) | $1.00 | 60% burn, 40% Arena pool |
| Grand Finals Ticket | $3.00 | 60% burn, 40% Finals pool |
| Habitat L5 (Tier A / B / C) | $1.50 / $2.50 / $4.00 | 70 / 20 / 10 |
| Golden Aerie | $5.00 | 70 / 20 / 10 |
| Hatchery 5th slot | $3.00 | 70 / 20 / 10 |
| Farm L5 | $2.00 | 70 / 20 / 10 |
| Breeding Grove L3 | $3.50 | 70 / 20 / 10 |
| Speed-ups | $0.10 x H^0.68 | 70 / 20 / 10 |
| Arena Energy refills (3 per day) | $0.25, $0.50, $1.00 | 70 / 20 / 10 |
| Supply Crates (Gold or Food) | $0.50–$5.00 | 70 / 20 / 10 |
| PvE heal-all | $0.05 | 100% burn |
| Gacha and Terminal Pass | Section 8 | 70 / 20 / 10 |

**Exit friction:** rewards are spendable immediately with no lock. Withdrawing $DRIS to a wallet burns 20% on Days 1–7, 10% on Days 8–12, 5% during Finals and 0% at Settlement (Flash-14 days).

### 7.5 Sources: the lifetime emission pool P

P is fixed, published on-chain at launch and can't be increased.

| Source | Share of P | Mechanics |
| --- | --- | --- |
| PvP Grand Finals | 30% | Paid at Finals Lock by bracket and rank; Finals Ticket required |
| PvP Daily Ladder | 20% | Top 10% by trophies gained each day |
| High-tier PvE | 15% | One-time first and 3-star clears of Trials Ch 8–10; daily Token Trials capped at 3 |
| Dragon Smelting | 10% | Epic $0.10, Legendary $1.00 (at P\_source); max 3 per day; paused at Yellow or above |
| Event bounties | 10% | First-to-breed races, collection bounties |
| Treasury reserve | 10% | Released only by the starvation valve; burned if unused |
| Champion's Arena top-up | 5% | Added to the ticket-funded Arena pool |

Smelting always nets out as a burn: a bred Legendary costs about $10 in Rite fees and smelts for $1.00 (10% recovery). Gacha, Pass and Finals Legendaries are Soulbound and can't be smelted.

### 7.6 Redemption Reserve and shutdown

The Redemption Reserve (RR) is an on-chain stablecoin escrow, publicly visible. It's funded by a project deposit at launch and 50% of any primary-sale proceeds from $DRIS the project sells.

```latex
R = \frac{RR_{stablecoin}}{\text{Circulating}_{\$DRIS} + \text{Wing Prize Pool}}
```

Every burn raises R, so holders gain directly when other players spend. The market price should converge toward R as shutdown approaches. The projected R is shown live in the UI.

| Step | When (Flash-14) | Action |
| --- | --- | --- |
| 1. Announcement | Day 0 | End date, P, the RR deposit, the R formula (including the Wing Prize Pool) and breaker rules published on-chain and in-game |
| 2. Finals Lock | End of Day 14 | Gameplay stops; Grand Finals payouts credited |
| 3. Treasury split | Day 15 | 40% of Treasury $DRIS to the Wing War Prize Pool (auto-split by Wing Coffers); 60% plus all unused reserve burned; unspent Coffer balances returned to depositors |
| 4. Snapshot | Day 15, after step 3 | Circulating supply fixed; R is final |
| 5. Redemption window | Days 15–21 | Holders redeem at R; redeemed tokens are burned |
| 6. Close | After the window | Extended once, then the rule published on Day 0 applies to any remainder |
| 7. Data deletion | After Close | Gold, Food, dragons and islands deleted |

### 7.7 Emission and burn schedule (Flash-14, % of P)

| Day | Phase | Emission | Target burn | Cumulative net | Main burn drivers |
| --- | --- | --- | --- | --- | --- |
| 1 | Rush | 2% | 4% | -2% | Speed-ups, premium habitats |
| 2 | Rush | 2% | 5% | -5% | Fusion Fees, Hatchery slot 5 |
| 3 | Rush | 3% | 6% | -8% | Speed-ups, Golden Aerie |
| 4 | Rush | 3% | 7% | -12% | Ascension |
| 5 | Endgame | 5% | 7% | -14% | Champion's Arena, Rites |
| 6–10 | Endgame | 5%/day | 5.5%/day | -16.5% | Arena Tickets, Rites, refills |
| 11–12 | Endgame | 6.5%/day | 6%/day | -15.5% | Ladder pushes |
| 13–14 | Grand Finals | 6% + 40% Finals payouts | 10% | +20.5% | Finals Tickets, last Rites |
| 15 | Settlement | Wing Prize Pool (from Treasury, not P) | 60% of Treasury + reserve | — | Treasury burn |
| 15–21 | Settlement | 0% | All redeemed supply | to 0 | Redemption |

Finals payouts do raise supply, but they're immediately redeemable at a published R, so they lower R by a known amount. Publish the expected R impact before Finals start. Flash-28 keeps the same shape stretched about 2x.

Estimated share of lifetime burn: Champion's Arena about 25%, Legendary Rites 18%, Finals Tickets 10%, Ascension 8%, Fusion Fees 4%, and speed-ups, premium items, refills and exit burns about 35%.

### 7.8 Inflation controls

| Lever | Trigger | Action |
| --- | --- | --- |
| Emission throttle | 48 h burn ÷ emission < 0.8 | Cut next day's emission 25%; burn the withheld amount |
| Hard throttle | 48 h ratio < 0.6 | Cut emission 50%; Arena burn share 80% for 24 h |
| Price circuit breaker | See 7.3 | Fallback, freeze or lockdown |
| Starvation valve | Burn ÷ emission > 2.5 for 3 days | Release Treasury reserve into PvE rewards |
| Sybil control | Always | Only KYC'd accounts earn $DRIS; one per person; daily earning caps |
| Bot detection | Always | Hold flagged accounts' rewards for review |

### 7.9 Economy health KPIs

| KPI | Healthy | Red flag |
| --- | --- | --- |
| Cumulative burn ÷ emission | 1.0 or more from Day 3 to Day 12 | Below 0.8 on any 48 h window |
| Market price vs projected R | At least 0.8 x R | Above 3 x R (bubble) |
| Rush burn per paying DAU | $1.50–$4.00 per day | Below $0.75 or above $8 |
| Top 1% share of emissions | 35% or less | Above 50% |
| Breaker trips | 2 Yellow or fewer per day, no Red | Any Black, or more than 1 Red per day |
| Exit-burn withdrawals | Under 15% of payouts | Above 30% |
| Smelt volume | Under 10% of P | Hitting the cap every day |

## 8. Monetization & Gacha

All purchases are one-time and priced in USDe at P\_sink. A gacha Legendary costs about $22 on average (hard pity at 40 pulls), about twice a bred one but days faster. The $9.99 Terminal Pass carries about $99 of in-game value and pays no $DRIS.

### 8.1 Principles

1. Gacha never pays out $DRIS.
2. Gacha, Pass and Finals dragons are Soulbound: no trading, no Smelting, so prizes have no cash-out value.
3. The Terminal Pass gives zero $DRIS: no pay-to-earn.
4. Odds are published with a pull history log and provably fair RNG.
5. 18+ KYC and a $100 USDe daily gacha cap per account.
6. Sales close before shutdown (8.6).

### 8.2 Chest lineup

| Chest | 1 pull | 10 pulls | Contents | Pity |
| --- | --- | --- | --- | --- |
| Element Chest | $1.50 | $13.50 | One egg containing the element the player picks | Shared with Dragon Chest |
| Dragon Chest | $1.00 | $9.00 | One egg (Uncommon to Legendary) plus bonus Food | Epic and Legendary |
| Supply Chest | $0.25 | $2.25 | Resources, speed-ups, small egg chance | None |
| Free Supply Chest | Free every 8 h | — | Supply Chest table | None |

**Supply Chest:** Gold bundle 40%, Food bundle 35%, 1 h speed-up 15%, Uncommon egg 8%, Rare egg 2%. Bundle sizes scale with Player Level.

**Dragon and Element Chest rates:**

| Rarity | Base rate | Effective rate with pity |
| --- | --- | --- |
| Legendary | 2% | \~4.05% (50% chance it's the Featured Legendary) |
| Epic | 11% | \~14% |
| Rare | 32% | \~30% |
| Uncommon | 55% | \~52% |
| Common | 0% | 0% |

The shop publishes the effective rates.

### 8.3 Pity system

Counters are per account, shared by Dragon and Element Chests, and last the whole game.

| Mechanic | Rule |
| --- | --- |
| 10-pull guarantee | Every 10-pull includes at least one Epic or better |
| Epic pity | After 10 pulls with no Epic or Legendary, the next is Epic or better |
| Legendary soft pity | From pull 30 without a Legendary, the rate rises 6% per pull (8%, 14%, 20% ... 62%) |
| Legendary hard pity | Pull 40 is a guaranteed Legendary |
| Featured guarantee | If a Legendary isn't Featured, the next Legendary is |
| Visibility | The UI always shows how many pulls remain to a guaranteed Legendary |

| Cost per Legendary | Value |
| --- | --- |
| Expected pulls | \~24.7 |
| Expected cost (10-pull pricing) | \~$22 |
| Worst case | $36 |
| Worst case for the Featured Legendary | $72 |
| Bred Legendary, for comparison | \~$10 in Rite fees plus 5–6 days of breeding |

A $9/day spender hits hard pity within 4 days; a $3/day spender gets a guaranteed Legendary by about Day 12.

### 8.4 Featured banners and fairness

| Flash-14 days | Flash-28 days | Featured Legendary | Banner |
| --- | --- | --- | --- |
| 1–4 | 1–7 | Magma Sovereign \[Terra, Flame\] | Rush |
| 5–8 | 8–15 | Glacier Warlord \[Ice, War\] | Endgame I |
| 9–12 | 16–24 | Radiant Aegis \[Light, Metal\] | Endgame II |

Rotations are announced on Day 0. Each Featured Legendary counters the previous banner's meta.

**Provably fair RNG:** before each pull the server publishes a hash of its seed. The result is an HMAC of the server seed and the player's seed plus pull number. Seeds are revealed when a banner ends, so anyone can verify every pull.

**Breaker behavior:** Normal prices at P\_sink; Yellow prices at the 60-minute TWAP fallback; Red and Black close the Shrine and refund pending quotes. Pity counters are never touched.

### 8.5 The Terminal Pass

A one-time purchase for the whole game, never renewing. 50 tiers at 1,000 Pass Points each. Buying late instantly unlocks every Premium reward for tiers already reached.

| Purchase window (Flash-14) | Flash-28 | Terminal Pass | Terminal Pass+ (+15 tiers) |
| --- | --- | --- | --- |
| Days 1–4 | Days 1–8 | $9.99 | $24.99 |
| Days 5–8 | Days 9–16 | $7.99 | $19.99 |
| Days 9–10 | Days 17–20 | $4.99 | $12.99 |
| Day 11+ | Day 21+ | Sales closed | Sales closed |

The price falls because a later pass has fewer days of use left.

**Pass Points:** 3 daily quests at 600 each, 200 for a daily login, about 20 one-time milestones worth 1,000–3,000 each, and 50 per new Dragon Book entry. Active players finish Tier 50 around Day 11–12 (Flash-14) or Day 22–24 (Flash-28, with daily points halved).

| Tier | Free track | Premium track |
| --- | --- | --- |
| 1 | 500k Gold | 10M Gold + 50k Food |
| 3 | 10k Food | Hatchery 5th slot |
| 5 | Free Supply Chest | 5 Dragon Chest pulls (count toward pity) |
| 8 | 2 speed-up tokens | Golden Aerie |
| 10 | Uncommon egg | Terminal Flame island theme |
| 12 | 2M Gold | 40M Gold + 200k Food |
| 15 | Rare egg | 3 Element Chests |
| 18 | 3 speed-up tokens | 10 x 8 h speed-ups |
| 20 | 50k Food | Epic egg (pick an opposite hybrid) |
| 25 | 3 Free Supply Chests | Early-access Legendary egg: Last Light \[Light, War\], Pass-exclusive |
| 28 | 10M Gold | Farm L5 + Breeding Grove L3 |
| 30 | Rare egg | 150M Gold + 500k Food |
| 35 | 5 speed-up tokens | 10 Dragon Chest pulls |
| 40 | Epic egg | Eclipse dragon skin |
| 45 | 25M Gold | 6 Arena Energy refills |
| 50 | Finalist badge | Terminal Champion frame and aura + a Featured-pool Legendary egg |

Premium value is about $99 USDe: 15 chest pulls ($15), 3 Element Chests ($4.50), infrastructure ($13.50), speed-ups and refills (about $7), 2 Legendaries (about $44) and Gold and Food (about $15). The Pass never includes Ascension, Arena Tickets or Finals entry, so mandatory burns are never bundled away.

### 8.6 Revenue mix and sales sunset

| Revenue line | Target share of spend |
| --- | --- |
| Gacha | 40% |
| Speed-ups | 20% |
| Mandatory fees | 15% |
| Terminal Pass | 15% |
| Premium infrastructure | 10% |

Targets (Flash-14): 25–35% payer conversion, $25–$40 lifetime ARPPU, top 1% of spenders at 30% of revenue or less, 15–25 gacha pulls per payer, under 15% of gacha payers reaching hard pity.

| Item | Flash-14 sales close | Flash-28 sales close |
| --- | --- | --- |
| Terminal Pass | End of Day 10 | End of Day 20 |
| Gacha (all chests) | End of Day 12 | End of Day 25 |
| Premium infrastructure | End of Day 12 | End of Day 25 |
| Speed-ups and refills | Through Finals | Through Finals |
| Grand Finals Tickets | Days 13–14 | Days 26–28 |

## 9. Live-Ops & Event Architecture

This section was skipped by request. The live schedule is defined elsewhere:

- Banner rotations: 8.4
- PvP ladder, Ladder Lock and Grand Finals: 6.5
- Sales sunset: 8.6
- Day-by-day retention hooks: 10.2
- Wing War rounds: 10.3
- Emission and burn schedule: 7.7

## 10. Social Systems & Retention

The retention target is 35–45% of players still active at the Grand Finals. Three systems carry it: a back-loaded login calendar with 62% of its value in the second half, rival notifications, and a Wing prize share that requires 9 or more active days. Every countdown and scarcity message is real, notifications are opt-in by category, and no retention reward pays $DRIS.

### 10.1 Retention targets

| Checkpoint | Flash-14 | Flash-28 | Driver |
| --- | --- | --- | --- |
| Finals | 35–45% | 30–40% | Grand Finals, Wing prize eligibility, login finale |
| D10 / D20 | 40% | 38% | Wing War II, Legendary login reward, last Pass sales |
| D5 / D8 | 45–50% | 45–50% | Ascension, Lv 40, Champion's Arena |
| D3 | 55–60% | 60% | First opposite Epic, PvP opens, login escalation |
| D1 | 70–75% | 70–75% | Rush speed: first hybrid in under 15 min |

### 10.2 Retention hooks

**Countdown Calendar:** 12 steps in Flash-14 (24 in Flash-28), one per day logged in. Consecutive days add 10% per day to reward amounts, up to +100%. One free missed day (two in Flash-28) keeps the streak; a miss without it resets only the multiplier, never calendar progress. Late joiners claim 2 steps per day until caught up.

| Step | Reward | Share of value |
| --- | --- | --- |
| 12 | Terminal Crown frame + Final Dawn Legendary egg \[Light, Terra\] | 30% |
| 11 | Last Ember skin | 8% |
| 10 | 5 Arena Energy refills | 6% |
| 9 | 3 Element Chests | 7% |
| 8 | 80M Gold + 400k Food | 6% |
| 7 | Featured Legendary egg (Soulbound) | 18% |
| 6 | 3 Dragon Chest pulls | 6% |
| 5 | Epic egg (pick an opposite hybrid) | 7% |
| 4 | 20M Gold + 100k Food | 4% |
| 3 | Rare egg (pick the element) | 4% |
| 2 | 3 speed-up tokens | 2% |
| 1 | 2M Gold + 20k Food | 2% |

Step 12 lands the day before Finals, so the reward can still be used.

**Push notifications:** at most 6 per day, quiet hours 23:00–08:00 local (except the Finals-start alert), every category toggleable, no false urgency.

| Category | Trigger | Priority |
| --- | --- | --- |
| Terminal countdown | Days 7, 10 and 12, then Finals start | Critical |
| Timer | Legendary or Epic egg ready, Gold cap reached, Arena Energy full | High |
| Rivalry | A rival passes you, your defense loses, you drop a rank | High |
| Guild | Roll Call under 80%, a Wing War round closing, a help request | High |
| Daily Ladder close | 2 h before the daily payout | High |
| Loss aversion | A habitat capped for 30+ min, energy full for 1 h | Medium |
| Banner or event | A banner rotates in 6 h, a sale is closing | Medium |

**Rivals:** each player gets 3 rivals of similar Team Power, reassigned every 3 days. Rival pushes convert best because each points to a single action: battle.

**Scheduled scarcity:** banners every 4 days that never return, Daily Ladder payouts every 24 hours, 3 Wing War rounds, the streak multiplier, the real sales sunset, and an always-visible countdown to Finals and shutdown.

| Day (Flash-14) | Main hook | Secondary hook |
| --- | --- | --- |
| 1 | Rush speed, first hybrid, Island 1 | Pass at its best price |
| 2 | All 10 elements, first opposite Epic | Join a Wing |
| 3 | PvP opens, rivals assigned | Login: Rare egg |
| 4 | Ascension | Banner rotation warning |
| 5 | Lv 40, Champion's Arena, Wing War I | Login: Epic egg; Wing roster lock |
| 6 | Legendary Rites | Endgame banner I |
| 7 | Login: Legendary egg | Midpoint countdown |
| 8 | Wing War I results | Pass price drops |
| 9 | Wing War II | Endgame banner II |
| 10 | Last day to buy the Pass | Login: Arena refills |
| 11 | Ladder pushes | Login: exclusive skin |
| 12 | Gacha sunset, login finale | Finals Tickets on sale |
| 13–14 | Grand Finals and Grand War | Final payouts |

### 10.3 Wings (guilds)

| Property | Detail |
| --- | --- |
| Size | Up to 25: Leader, 2 Officers, Members |
| Unlock | PL 8 (Day 1–2) |
| Open Wings | Players without a Wing by Day 3 are auto-placed in one of similar power |
| Roster lock | From Day 5, no switching; leaving forfeits the prize share. Open slots can still be filled |
| Inactivity | Officers can remove a member after 48 h offline |

**Pooling (off-chain):** members donate Gold and Food to the Wing Vault to level the Wing Totem, worth +3% Gold/min and +3% crop yield per level (+15% at L5, about 2B pooled Gold). Timer Help cuts 1% of a teammate's remaining breed, hatch or build time, up to 10 helps per timer and 20 given per player per day. Each member can gift one Uncommon or Rare egg per day from their own breeds.

**Wing Coffer (on-chain, no withdrawals):**

- Any member can deposit $DRIS; each deposit is recorded on-chain.
- Spending is whitelisted to Champion's Arena and Grand Finals Tickets for members. Officers assign sponsored tickets.
- Buying 10+ tickets at once costs 10% less; the burn share stays 60%.
- Wing War prizes flow into the Coffer and are auto-split by contract.
- Unspent balances return to depositors pro-rata at Finals Lock.

**Wing Points:** 1 per trophy gained on the Daily Ladder, 25 per Champion's Arena win, 50 per Trials Ch 8–10 first clear, 200 per bred Legendary, 500 to the Wing for a Roll Call day (80%+ of members active), and 1 per Timer Help given (max 20 per day).

| Round | Flash-14 | Flash-28 | Format | Weight |
| --- | --- | --- | --- | --- |
| Grand War | Days 13–14 | Days 26–28 | Top 64 Wings; Finals WP count double | 40% |
| Wing War II | Days 9–12 | Days 15–25 | Re-seeded divisions with promotion and relegation | 35% |
| Wing War I | Days 5–8 | Days 8–14 | Divisional leaderboard | 25% |

Divisions hold about 50 Wings grouped by average Team Power, so small Wings compete with similar ones.

### 10.4 Treasury distribution (Wing prize)

At shutdown, 40% of Treasury $DRIS (10% of all lifetime spend plus unused reserve) goes to the Wing Prize Pool and 60% is burned. The Treasury is never sold on the market; winners redeem their share at R like any holder.

| Final rank | Share of Wing Prize Pool |
| --- | --- |
| 1 | 20% |
| 2 | 12% |
| 3 | 8% |
| 4–10 | 20%, split equally |
| 11–64 | 25%, split equally |
| Division winners outside the top 64 | 15%, split equally |

Within a Wing, 60% is split by Wing Point contribution and 40% equally among eligible members. Eligibility requires 9 of 14 active days (18 of 28 in Flash-28) and at least 500 lifetime WP. Ineligible shares go to eligible members.

### 10.5 Anti-abuse

| Threat | Countermeasure |
| --- | --- |
| Multi-accounting | One KYC'd account per person; only KYC'd members count for prizes |
| Win-trading inside a Wing | Wingmates never matched in ranked play |
| Win-trading between Wings | Detect repeated pairings and suspicious losses; void flagged WP |
| Late mercenary joining | Roster lock from Day 5; WP counts from the join day; the 9-day rule still applies |
| Coffer theft | Whitelisted spending, no withdrawals, automatic splits |
| WP feeding by one player | Capped WP sources; the 40% equal split rewards broad participation |

## Pre-launch requirements and sign-off

The design is complete and internally consistent with the terminal $DRIS economy. Two approvals must clear before engineering commits to the economy layer.

- [ ] **Legal review** of the token, gacha, prize pools, Wing Treasury distribution and Redemption Reserve (securities, gambling, money-transmission and consumer-protection rules).
- [ ] **Robinhood listing and compliance approval** for $DRIS.

**Open design decisions to confirm during development:**

- [ ] Size of the Redemption Reserve deposit and the rule for unredeemed remainder (published on Day 0).
- [ ] Lifetime emission pool P and the global payout cap G, sized to expected pool liquidity.
- [ ] Flash-14 or Flash-28 as the launch lifespan.
- [ ] The 20–30 curated tri-hybrid species and the event Legendary recipes.
- [ ] Hybrid arbitrage strength after playtesting (5.2).

**Data sources:** element matchups, opposite pairs and Level 40 stat benchmarks were supplied by the design owner. Dragon income values, the primary-element rule and base move damage come from [DeetList](https://deetlist.com/dragoncity/) and [PocketGamer](https://www.pocketgamer.com/dragon-city/element-weakness-chart). Rarity tier names come from [Ditlep](https://www.ditlep.com/). All other values were designed for this game.
