# Core Economy and Breeding Loop of the Dragon-Breeding Genre (Dragon City as primary reference)

> Research notes, compiled 2026-10-28. Source-access caveat: every dragoncity.fandom.com page (including its API) returned HTTP 402 to the fetch tool. BreezeWiki/antifandom mirrors served bot checks, and web.archive.org was blocked. Wiki data therefore comes from (a) the official Socialpoint Help Center and the official news site, which are the most authoritative; (b) the fan data sites ditlep.com and deetlist.com, which derive their figures from game config; (c) older community guides (2014 to 2015), flagged as such; and (d) search-result snippets of fandom pages, flagged as "snippet only". Several numbers are from older versions of the game and are marked that way. Dragon City launched on Facebook in May 2012 and on mobile in 2013. The Facebook version closed on 2020-02-10 ([Wikipedia](https://en.wikipedia.org/wiki/Dragon_City)).

## Q1. Breeding: how offspring are determined, element rules, rarity/odds, level requirements, timers, special structures, and whether odds are shown

### Takeaway
Current Dragon City breeding has two steps. First, one element is taken from each parent. Second, the offspring is drawn from the pool of dragons that carry that element pair. Within the pool, rarity is weighted: higher-rarity or "Empowered" parents (plus an external tower boost) raise the odds of the pool's top two rarities. The game shows only a qualitative green bar, not percentages. A separate deterministic layer, "Soulmate" pairings (added December 2024), gives specific pairs a specific unique offspring, sometimes behind a parent-level gate such as level 30. Breeding is effectively a gacha draw paid for with time. The game monetizes that time (gem speed-ups) and the odds modifiers (Empower).

### Cited Findings
**Official rules (current game)**
- Breeding gives several possible offspring, and the result depends on the parents' elements. The game picks one element from each parent, then chooses the offspring from a pool of dragons that have those two elements. Parents with more elements produce more possible element pairs, so the pool is larger. — [Dragon City Help Center: How does breeding work?](https://socialpoint.helpshift.com/hc/en/7-dragon-city/faq/4220-how-does-breeding-work/)
- Four things affect the outcome: the parents' elements, their rarity, their Empower level, and an external breeding boost from "Phaun's Guardian Tower". In the FAQ's words, other variables "such as dragon level or specific dragons" do **not** affect outcomes. — [Help Center: What affects my breeding outcome?](https://socialpoint.helpshift.com/hc/en/7-dragon-city/faq/4222-what-affects-my-breeding-outcome/)
- Higher-rarity or Empowered parents raise the chance of the **two highest rarities** in the offspring pool. The UI shows this as a **green bar** when the two parents are selected. No exact percentages are given. — [Help Center: How can I boost my breeding chances?](https://socialpoint.helpshift.com/hc/en/7-dragon-city/faq/4221-how-can-i-boost-my-breeding-chances/)
- Some single-element pairings are not allowed ("Not all 1-element dragons are compatible with other 1-element dragons"). A small number of dragons cannot be bred at all, for example licensed collaboration dragons such as The Walking Dead dragons. — [Help Center: Why can't I breed two specific dragons together?](https://socialpoint.helpshift.com/hc/en/7-dragon-city/faq/642-why-can-t-i-breed-two-specific-dragons-together/)
- Breeding venues listed by the Help Center are the Breeding Mountain, Ultra Breeding Tree, Breeding Sanctuary and Breeding Dome. A "Breeding Event Island" also exists; its results are stated to be "based on chance". — [Help Center: Game Guides section](https://socialpoint.helpshift.com/hc/en/7-dragon-city/section/101-game-guides-1668600106/)
- **Soulmate breeding (Dec 16, 2024 update):** specific pairs produce unique offspring that standard breeding cannot yield. The update made "200+ more dragons" breedable. When a Soulmate pair is selected, the Breeding Cave shows a heart icon and a "Unique" banner naming the egg. Some pairs need both parents at a set level, for example level 30. If the requirement is unmet, the egg icon is greyed out with a "locked" badge. The pairing screen lists the other possible outcomes with each one's rarity and whether the player already owns it. Each dragon's portrait shows how it can be obtained (Shop, Breeding, Rescue), and breedable dragons have a dedicated breeding button. — [Dragon City official news: Breeding Update](https://www.dragoncitygame.com/news/breeding-update); [Help Center: regular vs Soulmate breeding](https://socialpoint.helpshift.com/hc/en/7-dragon-city/faq/4764-what-is-the-difference-between-regular-breeding-and-soulmate-breeding/)
- The game describes rarities with seven tiers: Common, Rare, Very Rare, Epic, Legendary, Heroic and Mythical. Heroic was added 2016-04-15 and Mythical around 2018. There are 22 elements, and a dragon can have up to four. — [Wikipedia: Dragon City](https://en.wikipedia.org/wiki/Dragon_City)
- Breeding requires two dragons of at least **level 4**. The result is a hybrid, "with a chance" that its species and elements change. — [Wikipedia: Dragon City](https://en.wikipedia.org/wiki/Dragon_City)

**Fan data-site model of the odds (derived from game config, unofficial)**
- The Ditlep breeding calculator builds the candidate pool from GameConfig using four inputs: parent elements, **breeding power thresholds**, Empower, and **breeding perks**. Inputs also include Sanctuary level and optional "ancient" parents. A "Soulmate Journey" mode plans a route to a target dragon. — [Ditlep Breeding Calculator](https://www.ditlep.com/breeding/calculator)
- Ditlep's odds structure: results are grouped into **buckets**. Empty buckets are removed and the remaining weights are normalized to 100%. Sanctuary odds are exact per bucket, but they are exact per dragon only when a bucket has one candidate, because the per-dragon split within a bucket is not in config. Soulmate chances are direct config values and are **not** changed by perks or Empower. Each result shows an overall %, a bucket %, the number of candidates in its bucket, the required parent level and the required breeding power. — [Ditlep Breeding Calculator](https://www.ditlep.com/breeding/calculator)
- Deetlist marks common dragons such as Flame as breedable from two Flame-element parents "(part of the Breeding Reborn update)". This points to a past overhaul in which basic dragons became breedable. Its date was not verified. — [Deetlist: Flame Dragon](https://deetlist.com/dragoncity/dragon/Flame)

**Older system (2013 to 2014 guides, before the Empower and Soulmate overhauls)**
- In 2014, opposing elements could not breed directly and had to be bridged through hybrids. The opposing pairs were Ice vs Flame, Nature vs Electric, Metal vs Terra, Dark vs Light, and War vs Sea. Parent input order did not matter. — [Gamelytic breeding guide (dated 2014-05-25)](https://gamelytic.com/dragon-city-complete-dragon-breeding-guide/)
- Also in 2014, there were "level-exclusive" breeds that needed **both** parents at level 10, 15 or 20. Players were advised to use lower-level parents for non-exclusive targets, because higher levels added the exclusive results to the pool and diluted the odds. Breeding time depended on the **result** egg's rarity, so rarer results took longer. — [Gamelytic breeding guide (2014)](https://gamelytic.com/dragon-city-complete-dragon-breeding-guide/)
- 2014 community odds estimates (not official): about 1% per attempt for a specific Legendary; 5 to 10% for Pure; 15 to 25% for Deus Vault "unique" dragons (which needed paid research first, otherwise 0%). A "Rarity Booster" doubled the base rate. The same guide also says "roughly 30%" elsewhere, which is internally inconsistent. — [Gamelytic breeding guide (2014)](https://gamelytic.com/dragon-city-complete-dragon-breeding-guide/)
- An older fan-wiki tutorial estimated a stable chance of about 6% of a Legend from Pure x Pure (snippet only, about 2013). — [Dragon City Wiki: Tutorial/Breeding Legends (search snippet)](https://dragoncity.fandom.com/wiki/Tutorial/Breeding_Legends)
- Breeding Sanctuary in 2014: leveling the sanctuary unlocked more breedable "temple" dragons over 5 levels, with 3 to 4 new dragons per level. — [Gamelytic breeding guide (2014)](https://gamelytic.com/dragon-city-complete-dragon-breeding-guide/)
- A 2025-era design essay calls Dragon City's breeding "a gacha disguised as gameplay". It cites about 1% for a specific Legendary and 15 to 25% for Unique, and says pity is engineered through monetized parental Empower. **No sources are given for these numbers**, and they match the 2014 Gamelytic estimates. — [DEV Community: The Social Games Playbook](https://dev.to/truongpx396/the-social-games-playbook-2i51)

**Timers**
- Common Flame Dragon: breed time 30 s, hatch time 30 s, hatch XP 50, buy price 100 gold, sell price 100 gold. — [Deetlist: Flame Dragon](https://deetlist.com/dragoncity/dragon/Flame)

### Inferences
- The two-step "element pair → rarity-weighted pool" model works as a template. It makes multi-element parents valuable as **keys** to more pools. It also lets designers add new dragons by inserting them into existing pools, with no new recipe needed. This supports the endless new-creature cadence that the genre depends on.
- The genre layers **probabilistic breeding** (exploration, gacha feel) under **deterministic recipes** (Soulmate pairs). The deterministic layer reduces frustration and gives players goals they can plan toward. Level-gating Soulmates (for example level 30 on both parents) turns food into the gate for targeted breeding.
- The game deliberately does not show percentages; it shows a green bar and the list of possible outcomes. Dragon card packs, by contrast, publish per-item probabilities (see Q7). The likely reason is that breeding is framed as gameplay rather than a paid loot box. Our design should plan for disclosure rules either way.
- Under the old rule "breeding time = result's rarity", the timer itself leaked the outcome. A long timer told the player they had hit a rare egg. That doubles as a reward signal and a speed-up temptation.
- Empower acts as a monetized, persistent odds modifier: a "pity" lever spent on parents. The Guardian Tower acts as an account-wide odds buff. Both are odds sinks that sit outside the RNG itself.

### Gaps
- Current breeding and hatch timers by rarity (Rare, Very Rare, Epic, Legendary, Heroic, Mythical) could not be verified. Fandom was blocked, and deetlist's Legendary page was an unfilled template.
- No official numbers were found for the current bucket weights, the size of the Empower boost, the Guardian Tower boost, the Ultra Breeding Tree's time reduction, or what the Breeding Dome does.
- It is unclear whether the 2014 opposite-element list still applies in full after the "Breeding Reborn" and Soulmate overhauls. The official FAQ says only that some 1-element pairs are incompatible.
- There is a conflict on dragon level. The Help Center says level does not affect outcomes, but Soulmate pairs and Ditlep's "required parent level" show that level gates **eligibility** for specific results. Both can be true: level gates access, rarity and Empower weight the odds.

## Q2. Hatching: hatchery capacity, hatch timers, egg storage, premium speed-ups

### Takeaway
Bred or bought eggs go to a Hatchery whose slots are the parallelism bottleneck. Upgrading the slots is an early gem purchase. In older data, upgrades cost about 15/30/60 gems for 2/3/4 eggs, with a 5-egg maximum. Hatch timers scale with rarity and can be skipped with gems or ads.

### Cited Findings
- Players start with one hatchery and one breeding ground. An extra breeding ground unlocks later. Upgrading the hatchery lets more than one egg hatch at once, and a 2024 guide recommends it as an early priority. Eggs come from breeding, from rewards and from the shop. — [BlueStacks Dragon City tips (2024-01-22)](https://www.bluestacks.com/blog/game-guides/dragon-city/drc-tips-tricks-en.html)
- Gems can skip hatching or breeding timers, and one guide advises spending them that way rather than on random items. A daily "Dragon TV" reward requires watching a set number of 30-second ads. — [BlueStacks Dragon City tips (2024)](https://www.bluestacks.com/blog/game-guides/dragon-city/drc-tips-tricks-en.html)
- Old hatchery upgrade prices (snippet only): 15 gems for 2 eggs, 30 for 3, 60 for 4. Another old page describes a level-5 maximum (5 eggs) at 120 gems, possibly an event price. Upgrading does not affect eggs already incubating. — [SuperCheats hatching guide (search snippet; page returned 403)](https://www.supercheats.com/guides/dragon-city/hatching); [Dragon City Wiki File:Hatchery_3 (search snippet)](https://dragoncity.fandom.com/wiki/File:Hatchery_3.png)
- In 2014, the Gamelytic food guide advised players to spend gems on hatchery upgrades or the Ultra Breeding Tree instead of food. — [Gamelytic farm and food guide](https://gamelytic.com/dragon-city-complete-farm-and-food-guide/)
- Example timers: a Common takes 30 s to breed and 30 s to hatch and gives 50 hatch XP. — [Deetlist: Flame Dragon](https://deetlist.com/dragoncity/dragon/Flame)
- Genre comparison: in DragonVale, bred eggs must incubate in a nursery before they can go into a habitat. — [Wikipedia: DragonVale](https://en.wikipedia.org/wiki/DragonVale)
- Rewarded-video ads let players skip waiting timers and boost production. — [GameRefinery: rewarded video placements (search snippet)](https://www.gamerefinery.com/rewarded-video-ad-placements-interesting-implementations-from-across-the-market/)

### Inferences
- The loop has two serial queues: breed slot(s) then hatch slot(s). Each queue is its own throttle and its own monetization point (slot purchase and timer skip). Cheap first slot upgrades (about 15 gems) suit a starter gem grant, so the player's first premium purchase feels effortless.
- Very short timers for commons (30 s) make the first breed→hatch cycle happen within the tutorial. Rarity-scaled timers then naturally create return appointments later.

### Gaps
- Current hatchery slot count, upgrade costs and maximum level were not verified.
- The hatch-timer table by rarity and the gem-per-minute skip formula were not found.
- How eggs are stored when the hatchery is full (an egg inventory or the Storage building) is unconfirmed. A "Storage" FAQ exists but was not fetched ([Help Center section](https://socialpoint.helpshift.com/hc/en/7-dragon-city/section/101-game-guides-1668600106/)).

## Q3. Habitats: element typing, capacity, gold caps, upgrade costs, placement rules

### Takeaway
Habitats are element-locked containers. A dragon must share the habitat's element. Time dragons and a few special habitats are exceptions. Each habitat has a dragon capacity and a **gold storage cap**, and both grow with upgrades. Prices rise with each additional habitat of the same element and with later-unlocked elements. The number of habitats is capped by player level. Upgrades now use element-specific Habitat Tokens and/or gems instead of gold alone.

### Cited Findings
- There are 19 Element Habitats: Flame, Terra, Sea, Electric, Ice, Light, Dark, War, Metal, Pure, Primal, Legend, Wind, Beauty, Soul, Dream, Happy, Chaos and Magic. A dragon must have the habitat's element to be placed in it; the FAQ draws no primary vs secondary distinction. Time-element dragons can go in any habitat. Special habitats: **Kindergarten** (any dragon, kept in baby form); **Rainbow** (any dragon, "much larger occupancy"); **Divine Orbs Habitat** (any dragon, granted with the Divine Pass, produces Dragon Orbs while the pass is active). — [Help Center: Types of Habitats](https://socialpoint.helpshift.com/hc/en/7-dragon-city/faq/4226-what-are-the-different-types-of-habitats/)
- Each extra habitat of the same element costs more, and elements unlocked later have more expensive habitats. No formula is published. — [Help Center: How do Habitat prices work?](https://socialpoint.helpshift.com/hc/en/7-dragon-city/faq/1212-how-do-habitat-prices-work/)
- The number of habitats a player can build rises with player level. — [Help Center: How many Habitats can I build?](https://socialpoint.helpshift.com/hc/en/7-dragon-city/faq/632-how-many-habitats-can-i-build/)
- Habitats are bought with gold and upgraded with Habitat Tokens and/or gems. Tokens must match the habitat type. There are 16 token types: Terra, Flame, Sea, Nature, Electric, Ice, Metal, Dark, Light, War, Pure, Legend, Wind, Kindergarten, Divine and Rainbow. — [Help Center: Habitat Tokens](https://socialpoint.helpshift.com/hc/en/7-dragon-city/faq/1622-what-are-habitat-tokens-for/); [Help Center section summary](https://socialpoint.helpshift.com/hc/en/7-dragon-city/section/101-game-guides-1668600106/)
- Elemental tokens for habitat upgrades come from Arena (PvP) rewards, and one guide describes farming them as slow. — [BlueStacks tips (2024)](https://www.bluestacks.com/blog/game-guides/dragon-city/drc-tips-tricks-en.html)
- **Old habitat table (undated community guide, pre-token era; format: base → upgraded):** see the table below. — [Dragon City Game Guide (weebly): Habitat guide](https://dragoncitygameguide.weebly.com/habitat-guide.html)

| Habitat | Base price (gold) | Upgrade price (gold) | XP (base → upgraded) | Dragons (base → upgraded) | Gold cap (base → upgraded) | Build time (base → upgraded) |
|---|---|---|---|---|---|---|
| Terra | 100 | 25,000 | 100 → 2,500 | 2 → 4 | 500 → 10,000 | 10 s → 30 s |
| Flame | 150 | 50,000 | 230 → 25,000 | 2 → 4 | 5,000 → 20,000 | 10 s → 2 h |
| Sea | 500 | 100,000 | 500 → 75,000 | 1 → 3 | 7,500 → 30,000 | 10 s → 2 h |
| Nature | 1,500 | 125,000 | 1,500 → 125,000 | 2 → 4 | 10,000 → 40,000 | 2 min → 2 h |
| Electric | 30,000 | 250,000 | 20,000 → 250,000 | 2 → 4 | 12,000 → 50,000 | 4 h → 8 h |
| Ice | 75,000 | 1,000,000 | 50,000 → 500,000 | 1 → 3 | 15,000 → 60,000 | instant with 3 friends → 12 h |
| Metal | 100,000 | 2,000,000 | 100,000 → 1,000,000 | 2 → 4 | 17,000 → 70,000 | instant with 4 friends → 18 h |
| Dark | 500,000 | 3,000,000 | 250,000 → 1,500,000 | 2 → 4 | 20,000 → 80,000 | 15 h → 30 h |
| Light | 16,000,000 | 24,000,000 | 2,000,000 → 3,000,000 | 2 → 3 | 40,000 → 120,000 | 12 h → 24 h |
| War | 22,000,000 | 30,000,000 | 2,750,000 → 3,750,000 | 2 → 3 | 60,000 → 180,000 | 18 h → 36 h |
| Legendary | 40,000,000 | (none listed) | 5,000,000 | 1 | 350,000 | 30 h |

- Modern habitats have more upgrade levels (snippet only). The Terra habitat's gold cap goes from 500 at level 1 to 92K at level 7, and Flame's from 5K to 102K. Terra level 2 holds 10K gold and 2 dragons and takes 30 s to upgrade. — [Dragon City Wiki: Habitat/Upgrades (search snippet)](https://dragoncity.fandom.com/wiki/Habitat/Upgrades)
- An upgraded habitat holds double the dragons. Advice from 2015 was to upgrade only once the habitat is full and a suitable dragon is about to be bred. — [Pocket Gamer: A guide to upgrading (2015-05-07)](https://www.pocketgamer.com/dragon-city/a-guide-to-upgrading-part-one)
- There is a deliberate trade-off between dragon income and habitat cap. Terra dragons earn more per minute but their habitats hold less gold; Ice and Sea dragons earn more slowly but their habitats hold more. — [Deetlist beginners guide](https://deetlist.com/dragoncity/pages/beginners-guide); a 2013-era Gamezebo guide gives the same contrast for Terra vs Sea (500 vs 7,500 cap) ([Gamezebo, search snippet](https://www.gamezebo.com/?p=303255))

### Inferences
- Element-locked habitats turn every new element into a gold sink (a new habitat type) and a space sink (island tiles). Escalating same-element prices stop players from stacking only the best earner.
- The first habitat's tiny gold cap (500 in old data) makes the habitat fill within minutes. That teaches the "collect" tap and creates very short early return loops. Caps grow with upgrades, which stretches the return interval as the player matures, from minutes to hours to overnight.
- Moving upgrades from gold to element tokens earned in PvP or events (a later change) ties economy progression to combat engagement and stops whales or idlers from out-scaling capacity with gold alone.
- Build times of hours to days on later habitats show that construction is itself a timer sink that can be skipped with gems. Friend-gated instant builds (old Ice and Metal) show the Facebook-era social gate.

### Gaps
- Current per-level capacity, gold cap and token cost tables for all 7+ upgrade levels were not retrieved (fandom blocked).
- The habitat-count limit per player level and the same-element price escalation formula are unpublished or were not found.
- Whether placement accepts any of a dragon's elements or only its primary element: the official FAQ says only "same element". Community lore suggests any element but was not verified.

## Q4. Gold income: scaling with dragon level and rarity, collection, caps

### Takeaway
Each dragon produces gold per minute into its habitat until the habitat's cap is hit, and the player must tap to collect. Income is linear in level: for the common Flame dragon, 7 gold/min base plus 5 per level, with the per-level increase halved after level 10. Income differs by dragon and rarity, and higher rarity generally earns more. Global multipliers include elemental crystals (+20% gold) and temporary tower boosts.

### Cited Findings
- Flame Dragon (Common) earnings: starting income 7 gold, +5 gold per level-up, and the increases are "halved after level 10". — [Deetlist: Flame Dragon](https://deetlist.com/dragoncity/dragon/Flame)
- Gold figures at level 7 from an older guide: Earth (Terra) dragon 90 gold/min, Fire dragon 37 gold/min. — [Gamezebo walkthrough (search snippet; page returned 403)](https://www.gamezebo.com/?p=303255)
- Higher rarity generally means higher gold income, and each dragon has its own income formula. — [Deetlist beginners guide](https://deetlist.com/dragoncity/pages/beginners-guide)
- Food levels up dragons, which raises their strength (by rarity) and their gold production. — [Wikipedia: Dragon City](https://en.wikipedia.org/wiki/Dragon_City)
- Elemental Crystals are bought with gold and placed on islands, and they increase gold production by 20%. — [Help Center: Game Guides section (Elemental Crystals FAQ summary)](https://socialpoint.helpshift.com/hc/en/7-dragon-city/section/101-game-guides-1668600106/)
- Dragon Towers on floating islands are unlocked by sending 4+ dragons on an adventure that requires certain elemental affinities. A tower's dragon grants an ability; for example, Midarian's Tower boosts gold production for 4 hours. — [BlueStacks tips (2024)](https://www.bluestacks.com/blog/game-guides/dragon-city/drc-tips-tricks-en.html)
- Collection strategy from an older guide: put low-revenue dragons in the smallest-capacity habitat and collect from every habitat before logging off, so little income overflows. — [Gamezebo (search snippet)](https://www.gamezebo.com/?p=303255)
- Genre comparison (DragonVale): higher-level dragons earn more per minute. At level 10, a Gift dragon earns 77 DragonCash/min and a Moon dragon 256/min. Some buildings boost earnings for certain dragons, and gemstone dragons earn gems instead of cash. — [Wikipedia: DragonVale](https://en.wikipedia.org/wiki/DragonVale)

### Inferences
- The Flame formula, gpm(L) = 7 + 5×(L−1) for L ≤ 10, gives exactly 37 at level 7. That **matches** the old Gamezebo Fire figure, so the linear formula has been stable for over a decade. Beyond level 10 with halved increments (+2.5/level), level 20 would be about 52 + 25 = 77 gpm. This extrapolation is not verified.
- Level 10 is a designed knee. Food cost per level rises sharply after level 10 (see Q5), while the gold gained per level halves. Leveling past 10 is therefore economically poor and is justified by combat power, the Dragon Roost gate and Soulmate level gates. This separates the "economy dragon" from the "battle dragon" decision.
- Income is uncapped per dragon but capped per habitat, which converts passive income into an **appointment mechanic**. Players do better by logging in before caps fill, and caps scale with upgrades so the interval grows over time.
- Global multipliers (crystals, towers) give mid-game players a second sink (crystal purchases) and a reason to engage with exploration content.

### Gaps
- Base income and per-level increment by rarity tier (for example a typical Legendary or Heroic) were not retrieved; deetlist's per-level table values were blank.
- Whether offline accrual is capped by anything other than habitat storage is unknown.

## Q5. Food: farms, crops, grow times, food cost to level, max levels, level gates

### Takeaway
Food is grown from gold on farms, so it is a gold→food conversion that also grants player XP, and it is spent to level dragons. A level-up takes four feedings, and the cost rises in step bands with knees at 10/20/30/40/50. Reaching level 4 costs 140 food in total, level 10 costs 1,280, level 40 about 6.28M, and level 70 about 113M. Max level is gated first by the Dragon Roost (up to 40), then by dragon "stars" (45/50/55/60/70).

### Cited Findings
- Farm buildings (older data): Food Farm (unlocks at level 1, costs 100 gold, 100 XP); Big Food Farm (level 8, 25,000 gold, 25,000 XP); Huge Food Farm (level 18, 500,000 gold, 250,000 XP). — [Gamelytic farm and food guide](https://gamelytic.com/dragon-city-complete-farm-and-food-guide/)
- Crop table from Gamelytic (older data; "Food/hour" assumes continuous replanting): — [Gamelytic farm and food guide](https://gamelytic.com/dragon-city-complete-farm-and-food-guide/)

| Tier (farm) | Grow time | Gold cost | Food | XP | Food/hour | Gold per food |
|---|---|---|---|---|---|---|
| T1 (Food Farm) | 30 s | 50 | 10 | 25 | 1,200 | 5 |
| T2 (Food Farm) | 5 min | 250 | 50 | 250 | 600 | 5 |
| T3 (Food Farm) | 30 min | 1,000 | 150 | 1,000 | 300 | 6.6 |
| T4 (Big) | 2 h | 5,000 | 400 | 5,000 | 200 | 12.5 |
| T5 (Big) | 6 h | 15,000 | 1,000 | 15,000 | 166 | 15 |
| T6 (Big) | 12 h | 75,000 | 3,000 | 75,000 | 250 | 25 |
| T7 (Huge) | 24 h | 500,000 | 10,000 | 250,000 | 416 | 50 |
| T8 (Huge) | 36 h | 1,000,000 | 20,000 | 500,000 | 555 | 50 |
| T9 (Huge) | 48 h | 5,000,000 | 100,000 | 2,500,000 | 2,083 | 50 |

- Other food sources: friend gifts (1,000 food/day "at the time of writing"), quest rewards, the daily login bonus, and the gem shop. — [Gamelytic farm and food guide](https://gamelytic.com/dragon-city-complete-farm-and-food-guide/). League battles award gems and food. — [Wikipedia: Dragon City](https://en.wikipedia.org/wiki/Dragon_City)
- Cheap crops yield more food per minute but must be replanted every 30 s. Expensive crops take longer and can be collected later. — [Deetlist beginners guide](https://deetlist.com/dragoncity/pages/beginners-guide)
- **Food cost per level (current, fan-compiled).** Each level-up is 4 "power ups", and the level cost equals 4 × the single power-up. Selected rows: — [Deetlist: Food costs](https://deetlist.com/dragoncity/pages/food-costs)
  - Single power-up for L2–L10: 5, 10, 20, 30, 35, 45, 50, 60, 65, so level costs run 20 to 260 food.
  - Cumulative food from level 1: **L4 = 140**; L10 = 1,280; L15 = 7,480; L20 = 21,820; L30 = 565,660; L40 = 6,277,660; L50 = 30,872,860; L60 = 69,848,860; L70 = 112,760,568.
  - Band structure of the single power-up cost: L11–20 rises by about 80 per level (145 → 880); L21–30 by about 2,310 (3,190 → 24,000); L31–40 by 21,600 (45,600 → 240,000); L41–50 by 68,160 (308,160 → 921,600); L51–60 by 9,600 (to 1,017,600); L61–70 by about 10,035 (to 1,117,952).
  - Deetlist's calculator FAQ says 1→70 takes "116.32 Million food", which disagrees with its own table total of 112,760,568. It also says food values "havent changed for a long time". — [Deetlist food calculator](https://deetlist.com/dragoncity/pages/food-calculator)
- Max level: below 40, the cap depends on Dragon Roost level, and a maxed Roost unlocks level 40. Above 40, stars set the cap: 1★ = 45, 2★ = 50, 3★ = 55, 4★ = 60, 5★ = 70. — [Deetlist: Food costs](https://deetlist.com/dragoncity/pages/food-costs)
- The Dragon Roost has 6 levels. Each upgrade costs gold and requires a minimum number of dragons at max level, and some levels require owning Empowered dragons. Each Roost upgrade raises the max dragon level. — [Help Center: Level up the Dragon Roost](https://socialpoint.helpshift.com/hc/en/7-dragon-city/faq/4227-how-do-i-level-up-the-dragon-roost/); [Help Center: Increase max dragon level](https://socialpoint.helpshift.com/hc/en/7-dragon-city/faq/4228-how-do-i-increase-the-maximum-level-of-my-dragons/)
- Breeding gate: both parents must be at least level 4. — [Wikipedia: Dragon City](https://en.wikipedia.org/wiki/Dragon_City); [Gamelytic breeding guide](https://gamelytic.com/dragon-city-complete-dragon-breeding-guide/). Soulmate gates can be level 30 on both parents. — [Dragon City news: Breeding Update](https://www.dragoncitygame.com/news/breeding-update)
- Genre comparison: DragonVale raises dragons with treats from treat farms, race-track winnings and quests. — [Wikipedia: DragonVale](https://en.wikipedia.org/wiki/DragonVale)

### Inferences
- **The level-4 gate is nearly free.** At 140 food, about 14 harvests of the 30-second crop or about 700 gold, it teaches the feeding verb within minutes and ties the first breed to the farm. Our design can copy this pattern: a gate that teaches rather than blocks.
- Short crops have the best food/hour and gold/food ratios but need constant replanting. Long crops are 3 to 10 times worse per gold but fit offline schedules. The "efficiency for presence" trade-off rewards active players without blocking casual ones and acts as a **gold sink that grows with player maturity**, since later players use expensive long crops. The T9 crop is an outlier, with high food/hour at the maximum gold/food.
- Crop XP roughly equals gold spent (1:1 for tiers 2 to 6), and habitat XP also tracks price. In effect, **player XP is a meter of gold spent**, so the economy's main gold sink also drives account progression.
- Food cost compounds sharply in bands (L20 → L30 is ×26, L30 → L40 is ×11). Combined with Roost and star gates, this makes high levels a long-term goal, and food the main mid- to late-game constraint, alongside the monetized star/Empower systems.
- Rough payback estimate for an economy dragon (Flame, best ratio of 5 gold/food): 1→10 costs about 6,400 gold for +45 gpm, a payback of about 2.4 h. 10→20 costs about 102,700 gold for an estimated +25 gpm, a payback of about 68 h, and about 10× longer if the food comes from 50 gold/food crops. This supports the level-10 knee in Q4. These are estimates and ignore cap overflow.

### Gaps
- The current farm and crop table, including any newer farm tiers, crop names, timers and costs, is unverified (Gamelytic's data is old and undated).
- Whether food cost per level varies by rarity is unknown; deetlist shows a single table.
- Food storage cap: no source found, and food appears to be uncapped.
- The Roost-level → max-dragon-level mapping (for example which Roost level unlocks 15/20/25/30) and the dragon counts required were not found.
- How stars are obtained (rank-up coins / orbs) is only partly known; see Q7.

## Q6. Island and player progression: XP sources, expansions, unlocks, storage, bonus buildings

### Takeaway
Player level (maximum 200) comes mostly from spending: building, planting and hatching all grant XP. It unlocks elements, buildings and habitat slots. Island space is a separate gate. Expansions on the current island cost gold or gems and must all be bought before the next island appears. New islands cost **gems only**, which makes space the major premium gate. Systems unlocked mid-game (Dragon Mastery at 7, Prestige at 18, Ancient World at 27) add new sinks and currencies.

### Cited Findings
- Max player level is 200. Dragon Mastery unlocks at level 7 and the Ancient World at level 27. Prestige Tiers require level 18 or at least one purchase. — [Help Center: Game Guides section summary](https://socialpoint.helpshift.com/hc/en/7-dragon-city/section/101-game-guides-1668600106/)
- Islands: each expansion area has a "FOR SALE" sign and is paid with gold or gems, with occasional discounts. All expansions on the current island must be bought before a new island appears. **New islands are bought with gems only.** The FAQ lists 14 islands: Lush, Lava, Ivory, Desert, Skull, Rainbow, Ice, Gothic, Rune, Futuristic, Moon, Tempest, Jurassic and Chronos. — [Help Center: Expand or purchase islands](https://socialpoint.helpshift.com/hc/en/7-dragon-city/faq/625-how-do-i-expand-or-purchase-new-islands/)
- A fan guide says 9 islands can be unlocked without paying. The first two need gold to clear land plus a set number of Facebook friends, and later expansions require gems. Player level unlocks elements and buildings early on, and it also sets League and event matchmaking. — [Deetlist beginners guide](https://deetlist.com/dragoncity/pages/beginners-guide)
- Each building upgrade needs a certain player level. — [Pocket Gamer (2015)](https://www.pocketgamer.com/dragon-city/a-guide-to-upgrading-part-one)
- XP sources with figures: building habitats (for example Terra 100 XP, Nature 1,500 XP, Electric 20,000 XP) ([weebly habitat guide](https://dragoncitygameguide.weebly.com/habitat-guide.html)); farms and crops (25 to 2,500,000 XP per harvest) ([Gamelytic](https://gamelytic.com/dragon-city-complete-farm-and-food-guide/)); hatching (Common = 50 XP) ([Deetlist Flame](https://deetlist.com/dragoncity/dragon/Flame)).
- Ancient World (unlocks at level 27): gold is exchanged for crystals, which are mined and used to summon and evolve Ancient Dragons. These dragons generate platinum, cannot fight, and cannot leave the Ancient World. — [Wikipedia: Dragon City](https://en.wikipedia.org/wiki/Dragon_City)
- Bonus buildings: Elemental Crystals (+20% gold), Dragon Towers (timed buffs such as +gold for 4 h), Phaun's Guardian Tower (breeding boost), and the Dragon Roost (dragon level cap). — [Help Center section](https://socialpoint.helpshift.com/hc/en/7-dragon-city/section/101-game-guides-1668600106/); [BlueStacks](https://www.bluestacks.com/blog/game-guides/dragon-city/drc-tips-tricks-en.html); [Help Center: What affects breeding outcome](https://socialpoint.helpshift.com/hc/en/7-dragon-city/faq/4222-what-affects-my-breeding-outcome/)
- Storage exists as a feature ("Where is my Storage?" and "What is my Storage for?" FAQs) for holding items or dragons off-island. — [Help Center section](https://socialpoint.helpshift.com/hc/en/7-dragon-city/section/101-game-guides-1668600106/)

### Inferences
- There are three independent space and capacity gates: habitats allowed by player level, tiles available from island expansions, and habitat capacity from tokens or gems. Each gate is fed by a different resource (XP/gold, gold→gems, PvP tokens/gems), so no single currency removes all three.
- Because XP ≈ gold spent, the player level tracks economic throughput. Level-gated habitat counts then create a positive feedback loop: spend → level → more habitats → more income. That loop is bounded by island space, which eventually needs gems.
- Facebook-era friend gates were the social growth lever, and gem-only islands are the mobile-era replacement.
- The Ancient World is a separate economy that **sinks gold** (gold → crystals) into a closed sub-collection with its own currency (platinum). This is a classic late-game sink for surplus gold.

### Gaps
- The XP-per-level curve, the building unlock list by level, expansion prices and island gem prices were not found.
- The details of Storage capacity are unknown.

## Q7. Currencies and sinks

### Takeaway
There are three core currencies. **Gold** is the soft currency: earned by dragons, sunk into habitats, farms/crops, expansions, crystals, Roost and research. **Food** is the leveling currency: made from gold on farms, sunk into dragon levels. **Gems** are premium: sunk into timer skips, hatchery slots, islands, habitat upgrades, energy refills and pack/offer purchases. They are surrounded by many system-specific secondary currencies that gate late progression and events.

### Cited Findings
- Gold buys and upgrades buildings and habitats, and farms turn gold into food for leveling. — [Wikipedia: Dragon City](https://en.wikipedia.org/wiki/Dragon_City); [Gamelytic](https://gamelytic.com/dragon-city-complete-farm-and-food-guide/)
- Gems: the fastest source is Gem Packs (IAP). Other sources include events and missions ([BlueStacks](https://www.bluestacks.com/blog/game-guides/dragon-city/drc-tips-tricks-en.html)) and League battles ([Wikipedia](https://en.wikipedia.org/wiki/Dragon_City)). Gem sinks include habitat upgrades, Friendly Alliance Battle energy refills ([Help Center section](https://socialpoint.helpshift.com/hc/en/7-dragon-city/section/101-game-guides-1668600106/)), new islands ([Help Center: Islands](https://socialpoint.helpshift.com/hc/en/7-dragon-city/faq/625-how-do-i-expand-or-purchase-new-islands/)), breeding and hatching skips and unlocking caged map dragons ([BlueStacks](https://www.bluestacks.com/blog/game-guides/dragon-city/drc-tips-tricks-en.html)), and hatchery upgrades ([SuperCheats snippet](https://www.supercheats.com/guides/dragon-city/hatching)). An optional gem-spend confirmation setting exists. — [Help Center section](https://socialpoint.helpshift.com/hc/en/7-dragon-city/section/101-game-guides-1668600106/)
- Secondary currencies and items named in official FAQs: Habitat Tokens (16 types), Rank Up Coins, Dragon Orbs (including Legendary orbs, affected by the Mythical rarity), Elemental Crystals, Keys (Missing Dragon Rescue), Spins (Dragon Trails), Pet Food (event-only, expires), Prestige Points, stickers (Sticker Album), and Dragon Card Packs. — [Help Center: Game Guides section](https://socialpoint.helpshift.com/hc/en/7-dragon-city/section/101-game-guides-1668600106/). Ancient World adds crystals and platinum. — [Wikipedia](https://en.wikipedia.org/wiki/Dragon_City)
- **Probability disclosure:** the Help Center publishes Dragon Card Pack probabilities, for example 9.09% per listed dragon in a Mystery Card Pack. — [Help Center section (Dragon Card Pack Probabilities FAQ)](https://socialpoint.helpshift.com/hc/en/7-dragon-city/section/101-game-guides-1668600106/). Breeding probabilities are not published; the breeding screen shows only a green bar (see Q1).
- Monetization framing: paid resources speed up breeding, hatching and construction and raise the chance of limited dragons. Ads let players skip timers and boost production. — [GameRefinery (search snippet)](https://www.gamerefinery.com/rewarded-video-ad-placements-interesting-implementations-from-across-the-market/). The design essay names "Heroic Race" as the PvP/leaderboard event built to extract whale spend, and Empower as monetized pity (no data cited). — [DEV: Social Games Playbook](https://dev.to/truongpx396/the-social-games-playbook-2i51)
- Genre comparison: DragonVale (Backflip Studios, iOS 2011-09-14, now DECA Games) reports over 45M downloads and over $200M revenue. Gems speed up most waits and are earned via friends, colosseum, race track, quests and "gemstone" dragons, besides IAP. — [Wikipedia: DragonVale](https://en.wikipedia.org/wiki/DragonVale)

### Inferences
- The faucet → converter → sink chain is: dragons → **gold** → farms → **food** → dragon levels → more gold (until the L10 knee) and breeding eligibility (L4, L30 Soulmate). Gold also leaks into space (habitats, expansions) and into XP. Gems short-circuit time at every step (breed, hatch, build, grow) and space (islands, slots).
- Secondary currencies fall into three groups. Token-gated currencies (habitat tokens, rank-up coins) tie economy progression to combat and events. Collection-gated currencies (orbs, stickers, card packs) are the gacha surfaces. Event-scoped currencies (pet food, keys, spins) expire and create urgency.
- For an original design, a lean version would be: one soft currency, one leveling resource made from the soft currency, one premium currency, plus one or two token types that bridge combat and housing.

### Gaps
- Gem prices for specific actions (skip cost per minute, island prices, current hatchery prices) were not found.
- The Rank Up Coin and star-upgrade costs were not retrieved.

## Q8. Early-game loop and first-session flow

### Takeaway
No authoritative step-by-step tutorial script was found. The early loop can still be reconstructed from the economy: everything in the first cycle uses 10- to 30-second timers. The player builds a habitat and farm, plants the 30 s crop, feeds a starter dragon to level 4 for 140 food, breeds it (30 s), hatches it (30 s), places the new dragon in a habitat, and collects gold from a habitat with a very low cap. Each core verb is taught with near-zero wait, and the 4-hour+ timers only appear after the loop is learned.

### Cited Findings
- Players start with one hatchery and one breeding ground, and an extra breeding ground unlocks later. — [BlueStacks tips (2024)](https://www.bluestacks.com/blog/game-guides/dragon-city/drc-tips-tricks-en.html)
- Starter-level costs and timers (old data): Terra habitat costs 100 gold, builds in 10 s, holds 500 gold; Flame habitat costs 150 gold, builds in 10 s ([weebly](https://dragoncitygameguide.weebly.com/habitat-guide.html)); Food Farm costs 100 gold at level 1, and the 30 s crop costs 50 gold for 10 food ([Gamelytic](https://gamelytic.com/dragon-city-complete-farm-and-food-guide/)); a Common dragon breeds in 30 s and hatches in 30 s for 50 XP ([Deetlist](https://deetlist.com/dragoncity/dragon/Flame)); level 4 costs 140 food in total ([Deetlist food costs](https://deetlist.com/dragoncity/pages/food-costs)).
- The design essay gives an example 60-second loop: "tap dragon → coin bounces up → tap shop → buy food". — [DEV: Social Games Playbook](https://dev.to/truongpx396/the-social-games-playbook-2i51)
- A 2015 guide gives a rough trigger for upgrading farms: most dragons at level 4 or higher and more than five dragons. — [Pocket Gamer (2015)](https://www.pocketgamer.com/dragon-city/a-guide-to-upgrading-part-one)

### Inferences
- **Satisfaction drivers:** (1) instant feedback, since 10 to 30 s timers let the first build, grow, feed, breed and hatch cycle finish in a few minutes; (2) a new creature appears within the first session, which is the genre's core fantasy; (3) the habitat fills fast because of its small cap, so the collect tap is rewarding right away; (4) choosing pairs and seeing the list of possible results, with rarity and ownership markers, creates curiosity and collection pull; (5) starter gems spent on a cheap hatchery or breeding speed-up give a taste of acceleration.
- Pacing then stretches on purpose. Later habitats take 2 to 36 h to build, crops last 2 to 48 h, and rarer eggs take longer. This converts session-one engagement into appointment-driven day-2+ retention.

### Gaps
- The actual current tutorial script (step order, starter dragons, starter gem grant) was not found from a reliable source. Recommend a hands-on playthrough or a video capture of a fresh install.
- No retention or KPI data specific to Dragon City's onboarding was found.

## Q9. How the systems interlock (core loop, gates, sinks) and what fan data sites reveal about the data schema

### Takeaway
The core loop is: **Earn gold (habitats) → Convert gold to food (farms) → Feed dragons (level gates: L4 breed, L10 income knee, L30 Soulmate, Roost/star caps) → Breed (element-pair pool, rarity-weighted RNG plus deterministic Soulmates) → Hatch (slot-limited) → House (element-locked habitats, limited by level and island space) → More gold and collection progress.** Gates sit at queue slots (breed and hatch), space (islands are gems only), capacity (tokens), level caps (Roost, stars) and odds (Empower, tower). Fan databases show that each dragon record carries elements, rarity, timers, economy parameters, combat kit and obtainability metadata.

### Cited Findings
- Dragon record fields exposed by Deetlist: name, rarity, primary element (plus up to 4 elements), description, breedable flag and combo, breed time, hatch time, hatch XP, buy price, sell price, release date, dragon ID, category, base moves (damage and element type), trainable moves (damage, type, training time of 12 h to 2 days), strengths and weaknesses, earnings (starting income, per-level increment, halving rule, per-level table), plus summon time and orb source for non-breedables. — [Deetlist: Flame](https://deetlist.com/dragoncity/dragon/Flame); [Deetlist: Legendary](https://deetlist.com/dragoncity/dragon/Legendary)
- Breeding result fields exposed by Ditlep: probability label, overall %, bucket %, number of candidates per bucket, availability explanation, source label, required parent level and required breeding power. The inputs model parents, Sanctuary level, breeding perk, Empower and ancient parents. — [Ditlep Breeding Calculator](https://www.ditlep.com/breeding/calculator)
- Ditlep site sections show other systems layered on the core loop: events, Perk Optimizer, rankings by rarity (Common, Rare, Very Rare, Epic, Legendary, Heroic, Mythical), Trading Hub, Wizard Hollow, Arena Session, Collectible Quests, Alliance Chest. — [Ditlep home](https://www.ditlep.com/)
- The game's long-arc goal is collection completion, with 1,000+ dragons across rarity tiers (essay claim, unsourced). — [DEV: Social Games Playbook](https://dev.to/truongpx396/the-social-games-playbook-2i51). Deetlist's beginners guide states "2222" dragons to collect; this figure looks odd and is unverified. — [Deetlist beginners guide](https://deetlist.com/dragoncity/pages/beginners-guide)

### Inferences
- **Suggested minimal data schema for our game, derived from these fields:**
  - Dragon: `id`, `elements[1..4]` (ordered; the first sets the weakness), `rarity`, `category`, `breedable`, `breed_time_s`, `hatch_time_s`, `hatch_xp`, `buy_price`, `sell_price`, `income_base`, `income_per_level`, `income_knee_level`, `max_level_rules`, `moves[]`, `obtain_sources[]`, `release_date`.
  - Breeding rule: `element_pair → bucket[]`; each bucket has a `weight`, a `min_breeding_power`, a `min_parent_level` and `candidates[]`.
  - Soulmate rule: `(parentA, parentB) → offspring`, with `chance` and `min_level`.
  - Modifiers: rarity-derived breeding power, Empower level, global tower boost.
- **Where the gates sit (to mirror or vary):**
  - Time: breed and hatch timers, build timers, crop timers.
  - Parallelism: breed slots, hatch slots.
  - Space: habitat count by level, island tiles, gem-only islands.
  - Capacity: habitat dragon slots and gold caps upgraded with tokens.
  - Power: the food curve, Roost and star caps.
  - Odds: rarity weighting, Empower, tower.
- **Where the sinks sit:** gold (habitats, farms, expansions, crystals, Roost, Ancient World conversion); food (levels); gems (time, space, slots, upgrades); tokens (habitat capacity).
- **Design rationale summary:** each system both consumes the previous system's output and gates the next. Gold is useless without food and habitats, food is useless without breeding and combat goals, and new dragons are useless without space. That interlock lets a single premium currency relieve pressure at any point while the free path remains complete but slow.

### Gaps
- No GDC talk or Deconstructor of Fun teardown specific to Dragon City's economy was found within the search budget. Design rationale here is inferred from mechanics and two secondary essays.
- Ditlep's dragon database pages (as opposed to its calculator) were not inspected for extra fields such as stats, perks or "breeding power" values.
