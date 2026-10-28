# Economy & play-and-earn — summary

Full rules: spec §12–16. This page is the one-screen overview.

## Money flow
```
 player ETH ──enter() $1──▶ treasury Safe ──daily buyback──▶ vault
 player tokens ──deposit (2% fee: 1% burn, 1% vault)──▶ vault  ──▶ in-game balance
 in-game spend ──▶ 50% burn (daily batch) + 50% stays in vault
 vault ──claim (5% fee: 2.5% burn, 2.5% vault; ≤ 2% of vault/day)──▶ player
 vault inflows × 30% ──▶ season prize pool (14 days)
```

## Currencies
| Currency | Where | Earned by | Spent on |
|---|---|---|---|
| Gold | off-chain | habitats, battles (eligible); selling dragons, quests (not eligible) | farms, habitats, upgrades, plots |
| Food | off-chain | farms, store | leveling |
| $WYRM | on-chain token, off-chain balance in game | deposits, gold sell-back, season prizes, referrals | store, Hoard, pass |
| Season Points | off-chain | eligible PvP wins, PvE first clears, quests (cap 150/day) | season prize ranking |

## Earning
1. Pay the one-time $1 entry → earning unlocked.
2. Build the **Hoard** (level 5+, tokens) → sell eligible gold at 10,000 gold = $0.05, up to the Hoard's daily limit ($1…$30) or your deposit repayment, reduced once withdrawals exceed deposits (×½ above 1×, ×⅕ above 2×, paused above 3×).
3. Earn Season Points → 14-day prizes: 70% by SP thresholds, 30% top-100 placement.
4. Referrals: 5% of referred players' spend (not same IP/device).

## Why it is bounded
- Fixed supply, no mint; payouts come only from what the vault holds.
- Vault daily payout cap 2% of balance.
- Withdrawal penalties tie long-run extraction to each player's deposits.
- Entry fee + eligible-opponent rule make alt-account farming cost money.

## Known risks (see spec §22)
- USD-priced payouts in a floating token: falling price → more tokens paid out.
- Store sells power and odds boosts → spender advantage; paid odds with cash-out → gambling-law risk.
- Securities risk of the token; KYC/sanctions/tax/age gating → legal review before mainnet.
- Bot pressure (RaidLords reported ~7.8k bans in days).
