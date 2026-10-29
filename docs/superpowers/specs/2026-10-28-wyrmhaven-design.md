# Dragon Island — Game Design Spec

Status: for review (2026-10-28). Supersedes the earlier MVP draft.
Research basis: `reports/Dragon breeding genre and RaidLords.md`.
Working title and token ticker ($WYRM) are placeholders.

## 1. Goal and decisions

An original dragon-breeding, island-building, turn-based-battle web game on Robinhood Chain that **launches with real-money earning**, RaidLords-style.

| Decision | Choice |
|---|---|
| Launch goal | Fast launch with earning from day one |
| Earn asset | Own fixed-supply token; 50% of spend burned, 50% to reward vault |
| Earn loop | Capped gold sell-back (needs Hoard building) + 14-day season prizes |
| NFTs | None at launch (dragons are database rows) |
| Combat | 3v3 turn-based; player picks moves; the opponent's saved team is AI-controlled; plus PvE campaign |
| Stack | Web: Phaser 3 + React, Node (Fastify) + PostgreSQL, shared TypeScript rules engine |
| Sign-in | Wallet required (signed message, no gas); no guest mode |
| Store | Speed, space, cosmetics, pass **and power** (food, level-ups, breeding odds boosts) |

Originality rule: genre-generic element names are fine; dragon names, art, text, the matchup chart and all numbers are our own.

## 2. Core loop

Habitats produce gold → farms turn gold into food → food levels dragons → level-4+ dragons breed in nests → eggs hatch in the hatchery → new dragons fill habitats and battle teams → battles give gold, Season Points (SP) and trophies → eligible gold sells back for tokens via the Hoard.

## 3. Elements

Nine elements: `fire, water, earth, nature, electric, ice, metal, dark, light`.

| Attacker | ×2 against |
|---|---|
| fire | nature, ice |
| water | fire, metal |
| earth | electric, fire |
| nature | water, earth |
| electric | water, metal |
| ice | nature, electric |
| metal | ice, earth |
| dark | light |
| light | dark |

`multiplier(moveElement, defenderPrimary)`: 2 if the move's element is strong vs the defender; else 0.5 if the defender's primary element is strong vs the move's element; else 1. dark↔light is ×2 both ways (strong check first). Neutral moves are always ×1.

## 4. Rarity

| Rarity | Breed time | Hatch time | Base gold/min | Stat mult | Score |
|---|---|---|---|---|---|
| common | 2 min | 2 min | 2 | 1.0 | 0 |
| rare | 30 min | 30 min | 5 | 1.2 | 1 |
| epic | 4 h | 4 h | 12 | 1.5 | 2 |
| legendary | 12 h | 12 h | 30 | 2.0 | 3 |

The tutorial's first breed and hatch take 15 s each.

## 5. Dragons

- Species: `{ id, name, elements: 1..2 (first = primary), rarity, baseSpeed 1..100, recipeOnly: boolean }`.
- Instance: `{ id, speciesId, level 1..30, location: habitatId | 'hatchery' }`.
- Catalog rules: each element has 1 pure common; dual-element pools hold at most one species per rarity; legendaries are `recipeOnly`. Launch content target: 9 pure commons, ≥ 18 dual commons/rares, ≥ 6 epics, ≥ 2 legendaries (design team names them).
- Gold/min = base × effLevel, where effLevel = L if L ≤ 10, else 10 + floor((L − 10) / 2).
- Food to go from L to L+1: 4·L² (L 1–9), 8·L² (L 10–19), 16·L² (L 20–29). Max level 30.
- Sell dragon for gold: common 100, rare 500, epic 2,500, legendary 10,000 (this gold is not sell-back eligible). A sale that would leave fewer than 2 dragons is refused, so a player can always breed.

## 6. Breeding

Requirements: two distinct owned dragons, both level ≥ 4, a free nest.

Algorithm (seeded RNG):
1. Pick `eA` uniformly from parent A's elements, `eB` from parent B's.
2. Pool = non-recipe species whose element set equals `{eA, eB}`. If empty, pool = the two parent species.
3. If the unordered parent species pair matches a legendary recipe and both parents are level ≥ 15: 3% chance the child is that legendary (checked first).
4. Tier weights: common 70, rare 25 + 5·S, epic 5 + 2·S, legendary 1 (only reachable through the fallback pool), where S = rarity score of A + score of B. An odds boost (store) adds rare +10, epic +5 for that breed. Only tiers present in the pool count; normalise; uniform within a tier.
5. Pity: per player and unordered element pair, after 10 consecutive common results, the next result is drawn only from the pool's rare+ tiers (no effect if the pool has none). Counter resets on any rare+ result.
6. Egg goes in the nest with `readyAt = now + breedTime(child rarity)`.

The UI shows the exact odds of every pairing, including boosts and pity.

## 7. Nests, hatchery, habitats, farms

- **Nests:** 1 at start; up to 3 more from the store. A ready egg moves to the hatchery on collect.
- **Hatchery:** 3 slots; hatch timer = child rarity's hatch time. A hatched dragon goes to the first habitat (in list order) that matches one of its elements and has a free slot; otherwise it waits in the hatchery.
- **Habitats:** element-typed; a dragon may live there if any of its elements matches.

| Habitat level | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|
| Gold cap | 500 | 2,500 | 10,000 | 40,000 | 120,000 |
| Slots | 3 | 4 | 5 | 6 | 7 |
| Upgrade cost to next (gold) | 1,000 | 5,000 | 20,000 | 80,000 | — |

  - New habitat cost: 500 × 2^n gold, n = number of habitats of that element already owned, starters included (first earth habitat 500, second fire habitat 1,000).
  - A dragon can be moved to any matching habitat with a free slot; both habitats are collected first.
  - Max habitats = 2 + floor(playerLevel / 5).
  - Income: whole minutes since `lastCollectedAt` (never negative), × sum of resident gold/min, capped. Collect sets `lastCollectedAt = max(lastCollectedAt, now)`.
- **Farms:** 2 plots at start; plot n+1 costs 500 × 2^(n−2) gold, max 6 plots.

| Crop | Grow time | Cost (gold) | Food |
|---|---|---|---|
| Sprout | 1 min | 20 | 10 |
| Bushel | 30 min | 200 | 150 |
| Harvest | 4 h | 1,000 | 900 |
| Bounty | 12 h | 2,500 | 3,000 |

## 8. Player level

- XP: breed or hatch result common 10, rare 30, epic 100, legendary 300; 1 XP per 10 food fed; PvP win 20; PvE first clear 15.
- XP to next level = 50 · L². Max level 50.
- Unlocks: Hoard at 5, PvE at 5, PvP at 8.

## 9. Starting state

1,000 gold, 100 food, 0 tokens; 1 fire habitat and 1 water habitat (level 1); one level-1 pure fire common and one level-1 pure water common; 1 nest; 3 hatchery slots; 2 farm plots.

## 10. Combat

- 3v3, turn-based, deterministic given a seed.
- Stats: HP = floor((100 + 20·L) × mult); ATK = floor((10 + 3·L) × mult); SPD = baseSpeed + L.
- Moves: one per element of the dragon (power 1.0); pure dragons also get neutral **Strike** (power 0.8).
- Damage = max(1, floor(ATK × power × multiplier × roll)), roll uniform in [0.9, 1.1] from the battle RNG.
- Round order: all living dragons by SPD descending; ties → attacker side first, then slot order.
- Attacker: player chooses move + target each turn. Defender AI: highest-multiplier move; target = lowest current HP among targets giving that multiplier; ties → lowest slot.
- Win when all three opponents are KO'd. After 30 rounds the defender wins.
- Client submits `{ battleId, moves[] }`; the server replays with the battle seed and decides the result.

## 11. PvP and PvE

- **Defence team:** each player saves one team of 3.
- **Matchmaking:** offer 3 opponents within ±100 trophies and ±5 player levels; fill with generated bot teams when fewer exist.
- **Trophies:** win +30, loss −15 (min 0); defence win +5, defence loss −10.
- **Leagues (trophies):** Bronze 0–399, Silver 400–799, Gold 800–1,199, Platinum 1,200–1,599, Diamond 1,600–1,999, Champion 2,000+. PvP win gold = 100 × league index (Bronze 0, Silver 100 … Champion 500).
- **Caps:** 20 PvP attacks per day. No resources are stolen.
- **PvE:** 30 stages of fixed bot teams; first clear gives gold, food, XP and SP; replays limited to 10 per day for reduced gold.

## 12. Season Points and seasons

- A season lasts 14 days. At reset, trophies above 1,000 become 1,000 + floor((t − 1,000) / 2).
- SP sources (earning unlocked only): PvP win vs an eligible opponent +10 (eligible = bot or a player with earning unlocked; each opponent counts once per day); PvE first clear +5; 3 daily quests +20 total. Daily SP cap 150.
- Prize pool = 30% of the vault's net inflows during the season (vault share of spend + vault share of deposit/withdraw fees + buybacks + forfeited balances).
  - 70% threshold pot: SP tiers 200 / 500 / 1,000 / 2,000 get 10% / 20% / 30% / 40%, split equally among players who reached each tier (highest tier only).
  - 30% placement pot: top 100 by SP, weight (101 − rank).
- Prizes are credited to in-game token balances when the season closes.

## 13. Token and vault economy

- **Token:** ERC-20, fixed supply 1,000,000,000, no owner, no mint, not upgradeable. Split: 50% fair launch (Uniswap v4 pool), 40% vault seed, 10% team (12-month vesting).
- **Entry:** one-time `enter()` paying ETH worth $1 unlocks earning (sell-back, SP, prizes). The ETH goes to the treasury Safe and funds a daily token buyback into the vault.
- **Deposit:** `deposit(amount)`, 2% fee (1% burn, 1% vault). Credits the in-game balance.
- **Withdraw:** server signs an EIP-712 cumulative total; player calls `claim`; 5% fee (2.5% burn, 2.5% vault).
- **Spend:** store prices are in USD and converted at a 30-minute TWAP from the pool. 50% of every spend is burned (daily batch), 50% stays in the vault.
- **Vault payout cap:** at most 2% of the vault balance per UTC day; claims over the cap revert and retry the next day.
- **Governance:** owner = 2-of-3 Safe; a separate operator key (rotatable by the Safe) may burn up to a daily limit and signs vouchers; pausable; verified source; official addresses published.

## 14. Gold sell-back and the Hoard

- Only gold from habitats and battles is **eligible**; gold from selling dragons or quests is not. Spending uses ineligible gold first.
- Rate: 10,000 eligible gold = $0.05 (config).
- **Hoard building required to sell at all.** Unlocks at player level 5; built and upgraded with tokens (counts as spend).

| Hoard level | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
|---|---|---|---|---|---|---|---|
| Cost (USD in tokens) | 2 | 4 | 8 | 15 | 25 | 40 | 60 |
| Daily sell limit (USD) | 1 | 2 | 4 | 7 | 12 | 20 | 30 |

- Daily limit = max(Hoard limit, deposit repayment), where deposit repayment = min(lifetime deposits / 3, lifetime deposits − lifetime sold).
- Penalty ratio R = lifetime withdrawn USD / lifetime deposited USD: R > 1 halves the limit; R > 2 cuts it to one fifth; R > 3 pauses selling. With zero deposits, R counts as above 3 once anything has been withdrawn, and 0 otherwise.
- The daily counter resets at 00:00 UTC.

## 15. Store (prices in USD, paid in tokens)

| Item | Price |
|---|---|
| Timer skip (breed/hatch/farm) | $0.10 per started 30 min remaining |
| Extra nest (2nd / 3rd / 4th) | $2 / $4 / $8 |
| Food pack, 1,000 food | $0.50 |
| Instant level-up | $0.0005 × that level's food cost (min $0.05) |
| Breeding odds boost (one breed) | $0.50 |
| Season pass | $5 |
| Hoard levels | see §14 |
| Cosmetics | later content |

Gold is never sold.

## 16. Referrals and anti-abuse

- Referrer earns 5% of a referred player's token spend, paid from the vault's share; nothing if the IP or device fingerprint matches.
- Banned accounts forfeit earned balances and prizes but may withdraw their own deposits.
- Daily caps (PvP 20, SP 150, sell limit); server rate limits; one action at a time per player (row lock); idempotency key on each action.

## 17. Provably fair randomness

- Each season has a secret S; publish keccak256(S) at season start.
- Action seed = HMAC-SHA256(S, playerId ‖ actionNonce); battle seed likewise with the battle id.
- Reveal S at season end; players can download their action log and re-verify every breed and battle.

## 18. Architecture

```
packages/game-core   pure rules + battle sim (no I/O, time and RNG injected)
packages/shared      API types and zod schemas
apps/server          Fastify, PostgreSQL, SIWE auth, /actions, jobs, indexer, voucher signer
apps/web             Phaser 3 scenes + React UI, Reown AppKit + wagmi/viem
contracts            Foundry: WyrmToken, WyrmVault
```

- Every action: `POST /actions` → lock player row → `applyAction(state, action, now, rng)` → persist state + append to action log.
- Jobs: daily burn batch, ETH buyback, season close (prizes, reveal S), deposit/entry event indexer, TWAP price cache.
- Phase 6 adds the Telegram bot (ready eggs, full habitats).

## 19. Error handling

- game-core returns typed errors (`INSUFFICIENT_GOLD`, `NOT_FOUND`, `LEVEL_TOO_LOW`, ...) and never throws for player mistakes.
- The server maps them to HTTP 4xx with the error code; repeated idempotency keys return the original result.
- Chain failures (RPC down, claim over the daily cap) are shown as retryable; balances only change after indexed confirmations.

## 20. Testing

- game-core: unit tests for every rule above; replay determinism (same seed and actions → identical state).
- Battles: golden-replay tests; the AI never makes an illegal move.
- Contracts: unit + fuzz + invariant tests (fees always sum correctly, a voucher can't be replayed, the daily cap holds).
- Server: integration tests against Postgres; concurrent-action tests.
- Web: Playwright smoke tests for sign-in, breed, battle, deposit and withdraw on testnet.

## 21. Build phases (one plan each)

1. game-core: economy rules (§3–9, 14 limit calculator, 15 item effects)
2. game-core: battles, matchmaking and trophy math (§10–11)
3. Contracts on testnet 46630 (§13)
4. Server (§12 SP accounting, 16–19)
5. Web client
6. Live layer: seasons, prizes, referrals, Telegram, admin
7. Launch: closed testnet beta → audit → legal review → mainnet token + pool → open

## 22. Launch requirements and risks

- **Legal review before mainnet:** token sale and trading (securities), paid odds boosts with cash-out (gambling/loot-box laws), KYC and sanctions, tax, and age gating.
- Independent contract audit; Safe multisig; verified source; a published list of official addresses (copycat tokens are common on this chain).
- Payouts priced in USD but paid in a floating token drain the vault faster when the price falls; the 2% daily cap and the prize pool's share of inflows bound this.
- Buying power in PvP favours spenders; SP caps and threshold-weighted prizes limit how far money converts to prizes.
