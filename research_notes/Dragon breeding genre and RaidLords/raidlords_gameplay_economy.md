# RaidLords (Robinhood Chain): Gameplay Loop and Play-and-Earn Economy

Research date: 2026-10-28. Primary source is the official in-game guide at https://raidlords.com/guide/ (a single long page with anchors: #start, #troops, #spells, #heroes, #champion, #buildings, #keep, #raids, #clans, #compete, #progress, #token; also in zh/vi/pt/id/es/tr). The raidlords.com homepage is a JS app that renders only "Loading the village…" to a fetcher, so I could not read its counters. X (@RaidLords) returned HTTP 402 and DexScreener returned 403, so the X claims below come via search-engine snippets and EGamers.io write-ups and are self-reported by the team. I found no whitepaper, GitBook, FAQ, Terms of Service, privacy policy, Discord, or audit. Independent coverage is thin: mainly two EGamers.io articles (Oct 25 and Oct 28, 2026).

## 1. Core gameplay loop and how it differs from Clash of Clans

### Takeaway
RaidLords copies the Clash of Clans structure closely: Keep (town hall) up to level 12, gold, essence and shadow resources, troops, spells, heroes, 3-minute 3-star raids, trophies and leagues, clans, clan wars, a clan league, a shared clan village and siege weekends. The main additions are a persistent personal "Champion" knight (unlocked for $1 in tokens), a 30-raids-per-day cap, goblin (bot-held) villages that fill matchmaking, and a token economy built into almost every timer and store item.

### Cited Findings
- Positioning: "build your village, raid theirs, on Robinhood Chain." The team's X profile calls it "The most advanced multiplayer strategy game on @RobinhoodCrypto." It is built by 0xOziK, who previously built Stonewatch, another Robinhood Chain game. — [EGamers.io, Oct 28 2026](https://egamers.io/raidlords-burns-15-7m-tokens-as-4800-players-fight-75000-raids-in-robinhood-chain-debut/); [EGamers.io, Oct 25 2026](https://egamers.io/raidlords-gives-every-player-a-named-knight-called-the-champion-before-its-robinhood-chain-debut/)
- Platform: it runs in the browser at raidlords.com/play. The guide refers to an on-screen joystick for phones, which implies mobile-browser support. I found no native app. — [EGamers.io, Oct 28](https://egamers.io/raidlords-burns-15-7m-tokens-as-4800-players-fight-75000-raids-in-robinhood-chain-debut/); [RaidLords guide](https://raidlords.com/guide/)
- Starting state: a Keep, 1 builder, 1,000 gold, 1,000 essence and a 24-hour shield. The Keep goes up to level 12, and each level unlocks buildings, troops, spells or heroes (Barracks and Cannon at Keep 1, Hall of Heroes at 4, Blacksmith at 8, Siege Workshop at 12). The village radius grows at Keeps 9 and 11. Keep 2 costs 1,000 gold (instant), Keep 5 costs 150,000 gold (3h) and Keep 12 costs 6,000,000 gold (3 days). — [RaidLords guide](https://raidlords.com/guide/)
- Resources:
  - Gold: building and upgrades.
  - Essence: Laboratory, walls and more.
  - Shadow: from Keep 7, for shadow troops and heroes.
  - At Keep 12 a village has 7 Gold Mines (max lv 15), 7 Essence Pumps (lv 15), 4 Gold Vaults (lv 13), 4 Essence Vats (lv 13), 3 Shadow Wells (lv 9), 1 Shadow Vat (lv 7) and 1 Royal Mint (lv 7).
  - Mines and pumps produce continuously. The guide gives no production rates.
  - Source: [RaidLords guide](https://raidlords.com/guide/)
- Troops:
  - Training is free. The first 20 troops are ready instantly, and others take seconds to minutes (Barbarian 15s, Giant 30s). Only troops that fall in a raid are lost.
  - Rosters: Barracks (Barbarian, Archer, Giant, Dragon, Black Knight and more), Shadow Barracks (Imp, Bonecrusher and more), and the War Wagon siege machine. Several Keep 13+ troops and a Fire Catapult are marked "Coming soon."
  - Spells: Thunderbolt, Heal, Fury, Venom Cloud and Quake.
  - Heroes: Barbarian Chief, Marksman, Lorekeeper and Crusader, each with two equipment pieces.
  - Source: [RaidLords guide](https://raidlords.com/guide/)
- Raids: you find a match, deploy troops, and have 3 minutes. Stars are awarded at 50% destruction, for destroying the Keep, and at 100%. Winning brings trophies and loot. — [RaidLords guide](https://raidlords.com/guide/)
- Loot rules:
  - Gold and essence: a percentage of the defender's storage that depends on Keep level (10% at Keeps 1–2, 15% at 3, 20% at 4–6, 18% at 7, 16% at 8, 14% at 9–12). The cap per raid is 200,000 at Keeps 1–6, rising to 980,000 at Keep 12.
  - Shadow: 6% of storage at Keeps 1–8 and 5% at 9–12, capped at 2,000–6,000.
  - Uncollected production: 50% of uncollected mine and pump output is lootable, and 75% from Shadow Wells.
  - A won raid adds a league bonus on top.
  - Source: [RaidLords guide](https://raidlords.com/guide/)
- PvE and Champion modes:
  - Campaign: 24 bandit villages from Keep 1 to Keep 11. Each village's loot can be taken once, with no trophies and no shield.
  - Champion Arena: wave survival, 3 free runs a day plus up to 5 paid runs at $0.10, $0.25, $0.50, $1 and $2 in tokens, up to 15 waves, with a boss every 5th wave.
  - Champion Trials: 10 solo fights against bandit knights.
  - Source: [RaidLords guide](https://raidlords.com/guide/)
- The Champion (the distinctive addition):
  - One personal knight per lord, which you name. It fights in every raid and defends the village.
  - Unlocked for $1 in tokens. It has 40 levels (4 per Keep, so the full range opens at Keep 10), 20 Valor ranks bought with tokens, and 3 stances (Guardian, Warlord, Berserker).
  - It uses a Rally Cry ability and wears Armoury gear: 24 pieces across weapon, shield, helm and charm slots, in four rarities from common to legendary.
  - Titles won in battle are displayed on the Champion.
  - Source: [RaidLords guide](https://raidlords.com/guide/); [EGamers.io, Oct 25](https://egamers.io/raidlords-gives-every-player-a-named-knight-called-the-champion-before-its-robinhood-chain-debut/)
- Clans:
  - Up to 50 lords, created for 40,000 gold. Roles are Leader, Co-leader, Elder and Member.
  - Garrison: clanmates donate troops that defend the village and can join raids.
  - Clan Wars: 5–50 members, 2 attacks each, 4h preparation and a 24h battle. If no matching clan appears within 10 minutes, a goblin clan steps in.
  - Clan War League: once per season, 8 clans, 7 wars. Medals buy items in the League Shop.
  - Clan Citadel: a shared village built with Citadel Gold.
  - Siege Weekend: district-by-district raids, 5 attacks per member.
  - Clan Boost: +10% raid loot for 24h, costs $0.75.
  - Source: [RaidLords guide](https://raidlords.com/guide/)
- Defense: defenses, traps, walls and Garrison troops act automatically while you are offline. Up to 3 base layouts can be saved. Telegram alerts come through the "RaidLords bot" (raids on you, finished upgrades, clan wars, prizes). — [RaidLords guide](https://raidlords.com/guide/)

### Inferences
- The following correspondences are my own reading, based on general knowledge of Clash of Clans; no source states them.
  - Near one-to-one renames: Keep = Town Hall, Essence = Elixir, Shadow = Dark Elixir, Clan Citadel = Clan Capital, Siege Weekend = Raid Weekend, and Books of Building/Fighting/Heroes.
  - Iron, Ember and Star Ore with a Blacksmith match CoC's Shiny, Glowy and Starry Ore.
  - Builder and Research Potions match CoC's items of the same purpose.
  - Barbarian Chief, Marksman, Lorekeeper and Crusader map to the Barbarian King, Archer Queen, Grand Warden and Royal Champion.
- RaidLords has no secret game design. The Web3 adaptation lives in the economy layer:
  - Most premium-currency (gem) uses in CoC become token sinks priced in USD.
  - Loot gold becomes partly sellable for tokens.
  - Prizes are funded from a vault.
- The Champion seems designed as the main long-term token sink and progression item: Valor ranks cost about $28 in total, gear costs tokens, paid Arena runs cost tokens, and rename and stance changes cost tokens.
- Free troop training and the 30-raids-per-day cap both limit raid-farming throughput. The cap matters most because raid loot can become sellable gold.

### Gaps
- Exact building upgrade timers, production rates and the Finish Now price formula are not published in the guide.
- I found no formal design document or roadmap beyond the "Coming soon" troops at Keep 13+ and the Fire Catapult.

## 2. Currencies and tokens: on-chain vs off-chain, supply, emissions, utility

### Takeaway
There is one on-chain token, $RAID, an ERC-20-style token on Robinhood Chain. It is deposited into a game vault and becomes an off-chain balance for instant, gas-free spending. Gold, essence, shadow, ores, Citadel Gold, medals and Books are all off-chain. Every store price is quoted in USD and paid in $RAID at the current market price. I found no published total supply, emission schedule or token distribution.

### Cited Findings
- The guide says "Tokens are the game's currency on Robinhood Chain." It never names the token or says where it trades. — [RaidLords guide](https://raidlords.com/guide/)
- The team's X account says "$RAID is live on Robinhood Chain," with the game going live Oct 26, 2026. A search snippet of a project post lists the contract as 0xd56a6c45941ee8aae31ce6a30bd049e0f7489cbd. I could not open the explorer or DexScreener page to verify it (403). — [RaidLords on X (via search)](https://x.com/raidlords); [EGamers.io, Oct 28](https://egamers.io/raidlords-burns-15-7m-tokens-as-4800-players-fight-75000-raids-in-robinhood-chain-debut/)
- What happens on-chain: deposits, withdrawals (claimed from the player's wallet), the one-time $1 entry payment in ETH, and burns. What happens off-chain: all in-game spending, which is "instant, with no wallet prompt or gas." — [RaidLords guide](https://raidlords.com/guide/)
- Off-chain resources: gold, essence, shadow, Iron/Ember/Star Ore, Citadel Gold, Siege Medals, League medals, and Books. Books are not sold and come only from Campaign 3-star wins, the Tournament top 3, the Raid Board top 10 and achievements. — [RaidLords guide](https://raidlords.com/guide/)
- Pricing is USD-denominated: all store prices are given in $ and paid in tokens. Gold sells to the game at 1,000 gold = $0.08, "paid in tokens at the current price." — [RaidLords guide](https://raidlords.com/guide/)
- Two days before launch, the homepage showed a "burned forever" counter and a "reward pool" counter, both at zero, and no token had been named. — [EGamers.io, Oct 25](https://egamers.io/raidlords-gives-every-player-a-named-knight-called-the-champion-before-its-robinhood-chain-debut/)
- Precedent from the same developer: Stonewatch uses the $SW token on Robinhood Chain. One summary says Stonewatch defines a 1,000,000,000 max supply, while BlockSpot lists 950,000,000 total, so the sources conflict. SW trades on Uniswap V4 (Robinhood) in SW/WETH and SW/USDG pools. Players deposit $SW to build and withdraw what they earn from an on-chain vault. — [BlockSpot](https://blockspot.io/coin/stonewatch-sw/); [PlayToEarn Stonewatch page](https://playtoearn.com/blockchaingame/stonewatch); [Stonewatch site](https://stonewatch.io/)

### Inferences
- The architecture is a custodial, server-authoritative ledger with on-chain entry and exit points. Only money movement touches the chain, and the game state does not. That is why spending needs no gas and no wallet pop-ups.
- Pricing in USD protects players from token volatility: the gold sale rate and store prices stay stable in dollar terms. The cost is that if $RAID's price falls, the vault must pay out more tokens per 1,000 gold sold. That creates a reflexive drain risk, partly offset because sinks also take more tokens per $ spent.
- RaidLords likely reuses Stonewatch's deposit/vault/withdraw template and possibly its token-launch approach. I could not verify this.

### Gaps
- $RAID total supply, initial distribution (team, liquidity, vault seed), launch venue and price, liquidity depth and holder count were not found. DexScreener and X were not accessible to me, and no tokenomics page exists in the guide.
- I found no emission schedule. The guide describes no inflationary emissions: rewards are paid from a vault funded by fees, spending and buybacks. Whether the team mints into the vault is unknown.

## 3. How players earn, and where reward value comes from

### Takeaway
Earning is mostly selling sellable gold back to the game for tokens at a fixed $0.08 per 1,000 gold, subject to daily limits. Other sources are prize boards, tournaments, season payouts, referrals and paid X posts. Every payout comes from a reward vault. The vault is funded by half of all in-game token spending, half of the deposit and withdrawal fees, all treasury gold purchases, the tournament rake, tokens recovered from banned accounts, and a team-reported daily ETH buyback. It is not funded by open-ended token emissions.

### Cited Findings
- Gold sale:
  - Rate: 1,000 gold sells for $0.08 in tokens.
  - Sellable gold: mined gold, goblin-village loot, Campaign loot, war loot, daily reward, league bonus, and Clan Boost gold.
  - Not sellable: gold bought with tokens, daily quest and event gold, and Arena gold.
  - The 21,000 gold from starter quests sits in a "Reward Chest."
  - Source: [RaidLords guide](https://raidlords.com/guide/)
- Daily sell limits (the core extraction control):
  - New lords can sell $1 of gold in their first 24 hours.
  - After that, the limit is the higher of your Royal Mint limit or your deposits "spread over 2 to 5 days." Deposits of $20 or less return over 2 days.
  - Penalties for withdrawing more than you deposited: the daily limit halves; above 2x it drops to one fifth; at 3x, selling pauses until you spend more of your own deposited tokens.
  - Source: [RaidLords guide](https://raidlords.com/guide/)
- Royal Mint (daily sell limit / level cost / cumulative cost): no Mint $2/day; L1 $3/day, $2, $2 total; L2 $5, $5, $7; L3 $8, $8, $15; L4 $12, $12, $27; L5 $18, $21, $48; L6 $25, $28, $76; L7 $35/day, $46, $122 total. "Upgrading the Royal Mint building raises a player's daily earnings." — [RaidLords guide](https://raidlords.com/guide/); [EGamers.io, Oct 28](https://egamers.io/raidlords-burns-15-7m-tokens-as-4800-players-fight-75000-raids-in-robinhood-chain-debut/)
- League loot bonus by league: Bronze III 2%, Silver III 5%, Gold III 8%, Gold I 12%, Crystal I 18%, Master I 21%, Champion I 26%, Titan I 29%, Legend 30%. The full ladder has 22 steps. — [RaidLords guide](https://raidlords.com/guide/)
- Seasons last 14 days. At season end, "a share of the vault is paid in tokens to ranked lords, weighted by league." Trophies above 5,000 reset to 5,000. — [RaidLords guide](https://raidlords.com/guide/)
- Competitions:
  - Weekly Tournament: $1 entry in tokens. 85% of the pot goes to the top 20% of raiders (minimum 1, maximum 10 winners). Of the remaining 15%, half is burned and half goes to the vault. The top 3 also earn Books.
  - Raid Board: free, a new round every 3 days. The top 10 share a vault prize (minimum 10 stars).
  - Champion Arena board: the top 10 share a daily vault prize at 00:00 UTC (minimum 3 waves).
  - Source: [RaidLords guide](https://raidlords.com/guide/)
- Other earning: daily rewards, starter quests, daily and weekly quests and events, achievements, and a 30-tier Season Pass (premium $0.75 doubles the free track and adds shields). Referrals pay "5% of the deposited tokens your friends spend in-game, paid in tokens, for as long as they play." Posting on X pays $0.50 per approved post, up to 2 per week. — [RaidLords guide](https://raidlords.com/guide/)
- Launch incentives:
  - $3,000 waitlist pool: $2,000 to the top 100 on the waitlist leaderboard and $1,000 to 100 random raiders outside it, claimed in tokens at 48h and 72h after launch.
  - Launch races, open only to lords who spent $5+ beyond the entry: most stars in 48h pays $100 down to $10 across the top 10; highest trophies pays $50 down to $5; the first 100 to reach Keep 5 get $1 each and the "Pioneer" title.
  - A creator program offers $3,000 and 200 whitelist spots.
  - Source: [RaidLords guide](https://raidlords.com/guide/); [EGamers.io, Oct 25](https://egamers.io/raidlords-gives-every-player-a-named-knight-called-the-champion-before-its-robinhood-chain-debut/)
- Vault funding:
  - Half of each token spent in-game goes to the vault and half is burned.
  - Treasury gold purchases go entirely to the vault.
  - The deposit fee (2%) and withdrawal fee (5%) are each split half burn, half vault.
  - Source: [RaidLords guide](https://raidlords.com/guide/)
- A team post says a buyback program buys at least 0.5 ETH of $RAID every day and sends it all to the reward vault. This comes from a search snippet; I did not read the post directly. — [RaidLords on X (via search)](https://x.com/raidlords)
- Marketing tagline for newcomers: "Start with $1 and let your village work for you." — [EGamers.io, Oct 28](https://egamers.io/raidlords-burns-15-7m-tokens-as-4800-players-fight-75000-raids-in-robinhood-chain-debut/)

### Inferences
- The model is closer to deposit-backed earning with a cap than to classic play-to-earn. For an ordinary player, the sell limit is either a small fixed Mint allowance ($2–$35/day) or a function of their own deposits returned over 2–5 days. Penalties start as soon as withdrawals exceed deposits. Net extraction is therefore capped per account, and payouts beyond what you put in are throttled hard.
- The Royal Mint works like a capacity investment. A maxed Mint costs $122 cumulative for a $35/day sell limit, which pays back in roughly 3.5 days if the limit is filled every day. Filling it needs 437,500 sellable gold per day at $0.08 per 1,000. That makes gold production and raid loot the real bottleneck, and the 30-raids-per-day cap limits the raid side.
- Buyback funding is not explained. It plausibly comes from the $1 ETH entry fees (about $4,800 if 4,800+ lords paid) or from team revenue. This is speculation.
- Paying vault prizes in tokens while pricing them in USD means vault solvency depends on $RAID's price and on the inflow of new deposits. The daily vault payout limit (see section 4) acts as a circuit breaker.

### Gaps
- Vault size, daily payout limit value, season payout share, and Raid Board and Arena prize amounts were not published in what I could read.
- Whether "deposits spread over 2 to 5 days" means returning your own principal or an additional allowance is somewhat ambiguous in the guide.
- I found no independent data on real player earnings for RaidLords. For Stonewatch, see section 8.

## 4. Sinks: what burns or consumes tokens and resources

### Takeaway
Sinks are heavy and broad. Every token spend is 50% burned, deposits and withdrawals carry fees, and nearly every convenience, cosmetic and progression item costs tokens: builders, shields, potions, Mint levels, Champion Valor and gear, Arena runs, Season Pass, Clan Boost, cosmetics and renames. Early on-chain data reported by the team shows burns exceeding withdrawals.

### Cited Findings
- Burn split:
  - 50% of every token spent in-game is burned and 50% goes to the vault.
  - Deposit fee 2% and withdrawal fee 5%, each split half burn, half vault.
  - Tournament house share (15%): half burned, half to the vault.
  - Minimum withdrawal is 100 tokens, with no waiting period. You claim in one wallet transaction. If the vault's daily payout limit is reached, the claim waits until 00:00 UTC the next day.
  - Source: [RaidLords guide](https://raidlords.com/guide/)
- Store prices in USD, paid in tokens:
  - Builders 2–5: $0.30, $1.50, $3, $6.
  - Shields: 1 day $0.15, 2 days $0.23, 1 week $0.38.
  - Builder Potion $0.04, Research Potion $0.03, Builder Rush $0.60.
  - Ores: 1,000 Iron $0.08, 5 Star $0.12, 50 Ember $0.09.
  - Season Pass premium $0.75, Clan Boost $0.75, 1,000 Citadel Gold $0.06.
  - Cosmetics: island themes $0.45, hero skins $0.38, cosmetics $0.23, rename $0.15.
  - Source: [RaidLords guide](https://raidlords.com/guide/)
- Champion sinks:
  - Unlock $1.
  - Valor rank 1 costs $0.15, each rank costs about 20% more, rank 20 costs $4.79, and all 20 ranks total $28.01.
  - Stance switches cost $0.23 after the first free pick. Renames cost $0.15 after the first.
  - Gear: 2 Common pieces are free and the rest cost tokens. Selling a piece returns 20% of its total cost.
  - Paid Arena runs cost $0.10–$2.
  - Source: [RaidLords guide](https://raidlords.com/guide/)
- Other sinks: Finish Now on upgrades and research (the first building finish is free), Royal Mint levels ($122 cumulative), the $1 Tournament entry, decorations and Champion looks. — [RaidLords guide](https://raidlords.com/guide/)
- Resource sinks that are not tokens: gold, essence and shadow go into upgrades and research, 40,000 gold creates a clan, and ore goes into Blacksmith hero-equipment upgrades. — [RaidLords guide](https://raidlords.com/guide/)
- Early on-chain stats, self-reported, timeframe not stated: 15.7M tokens burned and 10.5M withdrawn to player wallets, so burns exceeded withdrawals by about 5.2M. — [EGamers.io, Oct 28](https://egamers.io/raidlords-burns-15-7m-tokens-as-4800-players-fight-75000-raids-in-robinhood-chain-debut/)

### Inferences
- Because 50% of spend is burned and only 50% recycles to the vault, at most half of what players spend can come back as rewards, before counting the 5% withdrawal fee. Without new deposits or buybacks, the vault is structurally net-negative for the player base as a whole, which is what keeps it solvent.
- Burns exceeding withdrawals in the first days is expected, since launch spending surges. It is not yet evidence of long-run balance.
- Most sinks are convenience and power sinks (builders, potions, Valor, gear), not purely cosmetic. This keeps sink demand high but makes the game more pay-to-win in PvP.

### Gaps
- No time-series data on burn versus withdrawal after the first days.
- The Finish Now pricing formula is unpublished.

## 5. NFTs, asset ownership, trading and marketplace

### Takeaway
I found no evidence that any RaidLords asset (buildings, troops, heroes, Champion, gear, land/islands or cards) is an NFT. Assets live in the off-chain game database. There is no player-to-player trading or marketplace; the only exchange is selling gold to the game for tokens.

### Cited Findings
- The guide does not mention NFTs or any player-to-player trading. Gold can only be sold to the game at the fixed rate. — [RaidLords guide](https://raidlords.com/guide/)
- Neither EGamers article says whether Champions, cards or items are NFTs. The waitlist "RaidLord card" is an image you share, copy or download. — [EGamers.io, Oct 25](https://egamers.io/raidlords-gives-every-player-a-named-knight-called-the-champion-before-its-robinhood-chain-debut/); [RaidLords waitlist](https://raidlords.com/waitlist)
- Comparable Robinhood Chain games do use marketplaces:
  - Stonewatch item trades carry a 10% commission that is burned.
  - Hood Siege burns half of box sales and marketplace fees.
  - Play Kindra moves its token only through player-to-player trades of premium gear and cosmetics, with a 2% listing fee plus 10% tax.
  - Source: [PlayToEarn.com, Oct 7 2026](https://playtoearn.com/news/robinhood-chain-has-real-games-here-are-the-top-5-october-2026)

### Inferences
- Skipping NFTs and a marketplace is a deliberate simplification. It removes speculative asset-price risk and gives the game full control of supply, since nothing can be dumped on a secondary market. The trade-off is that there is no ownership or collectible story, a weak point for a dragon-breeding game whose appeal depends on owning bred creatures.

### Gaps
- No roadmap mention of future NFTs or trading was found.

## 6. Onboarding: wallet, fees, gas, getting ETH

### Takeaway
A wallet is required: any Robinhood Chain (EVM) wallet, with a gas-free signed-message login. There is a one-time $1 entry paid in ETH, verified on chain in about a minute. After that, all gameplay spending is off-chain and gas-free. Only the deposit, withdrawal claim and entry fee are on-chain transactions. I found no guest play, embedded wallet, account abstraction or bridge guidance.

### Cited Findings
- "Connect a wallet on Robinhood Chain and sign a free message (no gas)." The one-time $1 entry is paid in ETH, and the game verifies it on chain in about a minute. — [RaidLords guide](https://raidlords.com/guide/)
- Deposits take one wallet transfer. Tokens can also be bought with ETH from your wallet at the market price on the deposit screen. Withdrawals are claimed with one transaction from your own wallet. — [RaidLords guide](https://raidlords.com/guide/)
- Wallets: "Any wallet that supports Robinhood Chain (EVM) works." Signing in "never moves your funds." The waitlist required a wallet signature plus X-account linking and social tasks. — [RaidLords waitlist](https://raidlords.com/waitlist)
- Launch gating: for the first 24 hours only waitlist members and their invitees could enter, then the Realm opened to everyone. Stonewatch veterans received a starter pack. — [RaidLords guide](https://raidlords.com/guide/); [RaidLords waitlist](https://raidlords.com/waitlist)
- Robinhood Chain public mainnet launched July 1, 2026. — [EGamers.io, Oct 25](https://egamers.io/raidlords-gives-every-player-a-named-knight-called-the-champion-before-its-robinhood-chain-debut/); [PlayToEarn.com](https://playtoearn.com/news/robinhood-chain-has-real-games-here-are-the-top-5-october-2026)

### Inferences
- The in-game "buy tokens with ETH" path on the deposit screen spares new players a separate DEX trip. Players still need ETH on Robinhood Chain first.
- The $1 ETH entry is both an anti-Sybil cost and a revenue source. Prize stars count only for raids on goblin villages or on lords who paid the entry.

### Gaps
- No information found on bridging or on-ramping ETH to Robinhood Chain, faucets, gas sponsorship (paymaster) for deposits and withdrawals, embedded or social-login wallets, or a list of specific wallets. Another researcher's chain-level notes may cover this.
- No guest or free-trial mode is documented; the entry fee is required to play.

## 7. Fairness: anti-bot, anti-multi-account, matchmaking, shields

### Takeaway
Fairness relies on rules and server-side enforcement, not on-chain proofs:
- A $1 paid entry, IP-based referral checks, and prize stars that only count from raids on paid or goblin villages, each village once per day.
- Bans that confiscate everything earned in-game (banned accounts can withdraw only their own deposits).
- Keep- and trophy-banded matchmaking with goblin fill-ins, 12–16h damage-scaled shields, and a 30-raids-per-day cap.
The team reports mass bans in its first days.

### Cited Findings
- Rules: bots, scripts, macros and automated play are prohibited, and "every lord must be played by hand." Account farms are banned, as are faking payments and attacking the game. Banned accounts can withdraw only the tokens they deposited themselves, and lose everything earned in-game. — [RaidLords guide](https://raidlords.com/guide/)
- Prize-star rules: stars count only from raids on goblin-held villages or on lords who paid the entry. Revenge, Campaign, Trials, friendly challenges and Clan Wars don't count, and each village counts once per day (UTC). — [RaidLords guide](https://raidlords.com/guide/)
- Referral anti-Sybil: "Friends on your own internet connection earn you nothing." Launch races require spending $5+ beyond the entry. — [RaidLords guide](https://raidlords.com/guide/)
- Matchmaking: opponents are drawn from one Keep below to one Keep above yours and near your trophy count. Champion Valor and gear count as trophies. Clanmates never appear. Goblin-held villages fill in when few lords are online. — [RaidLords guide](https://raidlords.com/guide/)
- Raid limits and shields:
  - Up to 30 raids per day (UTC) on other lords.
  - Raided villages get 12–16h shields depending on damage.
  - Shields can also be bought with tokens ($0.15 for 1 day up to $0.38 for 1 week).
  - Revenge: a free counterattack on anyone who raided you within 24h, once per raid, with no prize stars.
  - Source: [RaidLords guide](https://raidlords.com/guide/)
- Team-reported enforcement: "since launch" it has banned 7,779 bot and farm accounts, including 2,521 caught playing with scripts, and recovered 2,601,050 $RAID earned by those accounts back to the reward pool. The post date is not visible. — [RaidLords on X (via search)](https://x.com/raidlords)
- Stonewatch precedent: the developer published an on-chain audit of wallets. 2,361 player wallets were up $18,569 net and 3,603 trader wallets up $15,353 net, while 75 wallets flagged as bots were down $66,723. — [EGamers.io, Oct 25](https://egamers.io/raidlords-gives-every-player-a-named-knight-called-the-champion-before-its-robinhood-chain-debut/)

### Inferences
- The 7,779 banned accounts exceed the 4,800+ "lords" figure. Either the lords count excludes banned accounts, or bot and farm sign-ups outnumbered real players at launch. Both figures are self-reported and the timeframes are unclear. Either way, Sybil farming pressure on a play-and-earn launch is very high.
- Counting Champion Valor and gear as trophies in matchmaking stops whales from sandbagging low trophy counts with a strong Champion. It also means token spending raises your matchmaking difficulty.
- Goblin villages keep raid targets available at low population. Goblin raids also earn prize stars and sellable gold, so goblin loot amounts are a key tuning lever for vault outflow.

### Gaps
- Detection methods (device fingerprinting, CAPTCHA, behavioral analysis), KYC and the appeal process are not documented.

## 8. Roadmap, phase, community, audits, legal

### Takeaway
RaidLords is live on Robinhood Chain mainnet. The token is live, and the game opened on Oct 26, 2026 after a waitlist phase. Early self-reported stats: 4,800+ lords, 75,000+ raids, 158 clans. I found no audit, no Terms of Service or legal disclaimers, no geo-restrictions or KYC, and no formal roadmap or named team beyond the pseudonymous developer 0xOziK.

### Cited Findings
- Timeline:
  - Oct 25, 2026: still in the waitlist phase, with no launch date and the site marked "coming soon."
  - Team post: the game was due to go live before 16:30 UTC.
  - X: "$RAID is live on Robinhood Chain" with the game live Oct 26.
  - Source: [EGamers.io, Oct 25](https://egamers.io/raidlords-gives-every-player-a-named-knight-called-the-champion-before-its-robinhood-chain-debut/); [EGamers.io, Oct 28](https://egamers.io/raidlords-burns-15-7m-tokens-as-4800-players-fight-75000-raids-in-robinhood-chain-debut/); [RaidLords on X (via search)](https://x.com/raidlords)
- Debut stats reported Oct 28, self-reported with no timeframe: 4,800+ lords, 75,000+ raids, 1,300+ Champion Arena runs, 158 clans, 15.7M tokens burned and 10.5M withdrawn. — [EGamers.io, Oct 28](https://egamers.io/raidlords-burns-15-7m-tokens-as-4800-players-fight-75000-raids-in-robinhood-chain-debut/)
- Developer: 0xOziK, previously Stonewatch. Stonewatch went live on Robinhood Chain around Sept 24, 2026 with the $SW token, which began trading on 28 Sep 2026 per one aggregator. — [EGamers.io, Oct 25](https://egamers.io/raidlords-gives-every-player-a-named-knight-called-the-champion-before-its-robinhood-chain-debut/); [BlockSpot](https://blockspot.io/coin/stonewatch-sw/)
- The guide has no formal roadmap or whitepaper. Future items listed: troops marked "Coming soon" at Keep 13+ and the Fire Catapult. — [RaidLords guide](https://raidlords.com/guide/)
- Ecosystem context: other Robinhood Chain games in Oct 2026 include Computers RH, Hood Siege, Farm Valley, Stonewatch, Play Kindra and Hollowfall, many using burn-plus-reward-pool token models. — [PlayToEarn.com, Oct 7](https://playtoearn.com/news/robinhood-chain-has-real-games-here-are-the-top-5-october-2026); [Crypto Briefing](https://cryptobriefing.com/robinhood-chain-hollowfall-play2earn-ore-token/)

### Inferences: assessment of what is sustainable and what is risky
- Sustainable or well designed:
  1. Rewards are paid from a fee- and spend-funded vault, not from emissions. The 50% burn on all spend and the 2%/5% deposit/withdraw fees make the system net-deflationary for players in aggregate.
  2. Per-account sell limits are tied to deposits and to the Mint, with escalating penalties once withdrawals pass 1x, 2x and 3x deposits. This directly caps extraction by farmers.
  3. The vault has a daily payout limit that queues claims to the next day.
  4. Prize stars require raiding paid or goblin villages, each once a day, which kills alt-farming of your own accounts.
  5. Bans confiscate in-game earnings and recycle them into the vault.
  6. Keeping game state off-chain gives gas-free UX and tunability, and the classic CoC loop is already proven.
  7. USD-quoted prices keep the in-game experience stable for players.
- Risky:
  1. Custodial trust: balances, game state and payout limits are all controlled by a pseudonymous solo developer's server, with no audit or terms found.
  2. Reflexive token risk: USD-pegged payouts in a floating token mean a price drop forces larger token payouts from the vault. Solvency then depends on continued new deposits and the buyback.
  3. Heavy Sybil and bot pressure: 7,779 banned accounts in days.
  4. Pay-to-win: Valor, gear and builders are bought with tokens, though Valor and gear raise matchmaking trophies.
  5. Earnings are modest and capped (the Mint maxes at $35/day), so "earn" appeal may fade once launch prizes end.
  6. No NFTs means no asset ownership or exit value beyond tokens.
  7. The economy relies on new-player inflows (entry fees, deposits, referral-driven spend) similar to other deposit-to-earn designs. I found no independent data on long-run retention.
  8. Early burn > withdrawal figures cover only the launch window.

### Gaps
- No audit, Terms of Service, privacy policy, geo-restrictions, KYC policy or regulatory disclaimer was found on the guide or waitlist pages. The homepage could not be rendered.
- Team size, funding and any Robinhood partnership are unknown. Discord was not found. X follower count was not accessible.
- No independent analytics (DAU, token price, liquidity, holder count) were accessible.
