> **DRAFT for review by counsel — not legal advice — not in force.**
> Factual description of the $DRIS contracts as written on branch `phase7-launch`. Nothing here is an offer,
> a promise of value, or a statement about future price. Counsel decides what, if anything, is published.

# $DRIS token and vault: factual disclosures (draft)

Source of truth is the Solidity code in `contracts/src/`; line numbers below refer to the files at the commit this
pack was written on. Design intent is in spec §13 (`docs/superpowers/specs/2026-10-28-wyrmhaven-design.md`; the
spec still uses the old working name "Wyrmhaven" / $WYRM, which is now Dragon Island / $DRIS).

## 1. Deployment status

- **No contract addresses exist yet.** Nothing has been deployed to any network. The first deployment will be to
  Robinhood Chain **testnet (chain ID 46630)**; `contracts/script/Deploy.s.sol` L17, L22-23 revert on any other chain
  unless an override is set explicitly.
- Testnet tokens have **no monetary value** and cannot be redeemed for anything.
- A mainnet deployment is a separate, later decision, after an independent audit and this legal review (spec §22).
  Any figure below may change before mainnet.
- Once deployed, the only genuine addresses will be the ones the project publishes in
  `docs/reference/02-robinhood-chain.md` and on its official site. Copycat tokens are common on this chain.

## 2. Token: `DrisToken`

| Fact | Value | Source |
|---|---|---|
| Name / symbol | "Dragon Island" / "DRIS" | `DrisToken.sol` L20 |
| Standard | ERC-20 with holder burn (`ERC20Burnable`) and EIP-2612 `permit` (OpenZeppelin v5.1.0) | `DrisToken.sol` L4-6, L11 |
| Total supply | 1,000,000,000 DRIS (18 decimals), minted once in the constructor | `DrisToken.sol` L12, L26-28 |
| Further minting | None: no mint function exists after construction | `DrisToken.sol` (whole file) |
| Owner / admin | None: the token has no owner and no privileged role | `DrisToken.sol` (whole file) |
| Upgradeability | Not upgradeable (no proxy) | `DrisToken.sol`, `DrisDeployer.sol` L39 |
| Supply can only fall | Any holder may burn its own tokens; the vault burns fees and spend batches | `DrisToken.sol` L10; `DrisVault.sol` L123, L152, L177 |

### Initial allocation (minted once at deploy)

| Share | Amount | Recipient | Source |
|---|---|---|---|
| 50% | 500,000,000 DRIS | "launch" address (`LAUNCH_RECIPIENT`), intended to fund a public liquidity pool | `DrisToken.sol` L16, L26 |
| 40% | 400,000,000 DRIS | `DrisVault` (game reward vault), minted directly to the vault's precomputed address | `DrisToken.sol` L17, L27; `DrisDeployer.sol` L36, L39-41 |
| 10% | 100,000,000 DRIS | Team `VestingWallet` | `DrisToken.sol` L18, L28 |

- The launch recipient is a wallet, not a pool: the contracts do not create or fund a liquidity pool. Creating a
  pool (spec §13 names Uniswap v4) is a separate operational step and is **not** covered by these contracts.

### Team allocation and vesting

- 100,000,000 DRIS go to an OpenZeppelin `VestingWallet` created in the same transaction
  (`DrisDeployer.sol` L38).
- Beneficiary: the project's owner Safe (`ownerSafe`), not an individual (`DrisDeployer.sol` L38).
- Schedule: linear release over **365 days** starting at the deployment block's timestamp, **no cliff**
  (`DrisDeployer.sol` L15, L38). After 365 days the full 100,000,000 DRIS are releasable.
- `[COUNSEL: whether the beneficiary Safe distributes to individuals, and whether that must be disclosed.]`

## 3. Vault: `DrisVault`

The vault is the only contract that handles player money. Game balances, spending, prizes and randomness live
off-chain on the game server; only signed withdrawal totals and burn batches reach the chain
(`DrisVault.sol` L12-16).

### Fees (all in basis points, rounded down; `net + burned + kept == amount`)

| Flow | Fee | Burned | Stays in vault | Source |
|---|---|---|---|---|
| Deposit (`deposit`) | 2% | 1% | 1% | `DrisVault.sol` L24-25, L118-125 |
| Withdrawal (`claim`) | 5% | 2.5% | 2.5% | `DrisVault.sol` L26-27, L129-155 |
| Rounding | Burned and kept shares are each rounded down; the depositor's credit or claimant's payout takes the remainder, so rounding dust goes to the player; amounts too small to bear a fee pay none | | | `DrisVault.sol` L254-263 |

### One-time entry fee

- `enter()` is a one-time ETH payment per address that the game server treats as unlocking reward features
  (`DrisVault.sol` L108-116). All ETH sent, including any excess over the fee, goes to the treasury address
  (L113); none stays in the vault.
- The fee is a wei amount (`entryFeeWei`), not a dollar amount. The operator key or the owner Safe can change it at
  any time, to any value including zero (`DrisVault.sol` L189-193). The plan is to keep it near US$1 of ETH
  (spec §13; testnet example value in `contracts/.env.example`: 0.0005 ETH).
- Spec §13 says entry ETH funds a daily buyback of DRIS into the vault. That buyback is an off-chain operational
  process, **not** enforced by the contracts.

### Payout cap

- At most **2% of the vault's DRIS balance** can be withdrawn per UTC day across all players
  (`PAYOUT_CAP_BPS = 200`, `DrisVault.sol` L28). The cap is snapshotted at the day's first claim (L234-243).
- A withdrawal above the remaining cap reverts in full and can be retried the next UTC day (L145-147). The cap is
  first come, first served.
- The game server additionally limits each player to 10% of the day's remaining cap
  (`apps/server/src/services/withdraw.ts` L16, L101-107) and gives each withdrawal voucher a 1-hour lifetime (L13).

### No emergency exit for the 400M vault seed

- The vault has **no** rescue, sweep, or owner-withdraw function. Tokens leave the vault only (a) through `claim`,
  to the address a valid signer-issued voucher was signed for: the voucher binds the claimant's own address
  (`msg.sender` is part of the signed data, `DrisVault.sol` L138), so only that address can submit it and receive the
  payout (`DrisVault.sol` L136-155, payout L153), or
  (b) by burning (L123, L152, L177).
- **Project keys can still move or destroy vault tokens indirectly** (also recorded in `docs/audit/scope.md`,
  design choice 3, "Owner (Safe) compromise"):
  - The signer is a project-held server key. It can sign a voucher for any address, including one the project
    controls; the contract checks only the signature, the cumulative total and the deadline (L136-143). Such
    payouts are bounded only by the 2%-of-balance per UTC day cap (L145-147).
  - The owner Safe can `setSigner` to a key it controls (L206-210) and do the same.
  - The owner Safe can `setOperator` to a key it controls (L200-204) and `setBurnDailyLimit` to any value
    (L218-221), then `burn` up to the whole vault balance (L167-179).
  - The owner Safe can redirect entry-fee ETH with `setTreasury` (L212-216).
- Mitigations are operational, not contractual: the owner is a Safe (planned 2-of-3 signers, so one leaked signer
  key is not enough), the server keys are separate and rotatable, there is **no timelock**, and every key and limit
  change emits an event (`OperatorSet`, `SignerSet`, `TreasurySet`, `BurnDailyLimitSet`, L58-61) that anyone can
  monitor.
- If the game shuts down, tokens in the vault stay there unless paid out through vouchers or burned.
  `[COUNSEL: disclosure wording for project key powers and wind-down.]`

### Operator burn

- The operator key burns the burn share of in-game spending (spec §13: 50% of spend, batched daily;
  `apps/server/src/jobs/burnBatch.ts` L42), up to a daily limit set by the owner Safe
  (`DrisVault.sol` L163-179, L218-221). Testnet example value: 1,000,000 DRIS per UTC day
  (`contracts/.env.example`). The other 50% of spend stays in the vault.

### Pause

- The operator or the owner Safe can pause `enter`, `deposit`, `claim` and `burn` (`DrisVault.sol` L109, L119,
  L136, L167, L223-226). Only the owner Safe can unpause (L228-230). While paused, players cannot withdraw.

## 4. Roles (roles, not names)

| Role | Held by | Powers | Source |
|---|---|---|---|
| Owner | A Safe multisig (planned: 2-of-3 signers; signer identities are held by project personnel, `[COUNSEL: whether to disclose signer identities or affiliations]`) | Rotate operator, signer, treasury; set burn limit and entry fee; pause and unpause; two-step ownership transfer. Cannot renounce ownership. No direct withdraw function, but can reach vault tokens indirectly by rotating the signer (payouts up to 2%/day) or the operator and burn limit (burns); see §3. | `DrisVault.sol` L190-230, L196-198 |
| Operator | Game server key | Burn up to the daily limit; set the entry fee; pause. Cannot unpause or move tokens to any address. | `DrisVault.sol` L76-84, L167-179, L190, L224 |
| Signer | Game server key | Sends no transactions itself. Its signatures authorise withdrawals to the address named in the voucher, which can be any address, within the 2%/day cap. | `DrisVault.sol` L29, L136-155 |
| Treasury | Planned: the Safe | Receives all entry-fee ETH | `DrisVault.sol` L113, L212-216 |
| Launch recipient | Project wallet (may be the Safe) | Receives 50% of supply; no contract powers | `DrisToken.sol` L26 |
| Players | Any address | `enter`, `deposit`, `claim` (own vouchers only) | `DrisVault.sol` L109-155 |

- The Safe's 2-of-3 threshold is an operational setting of the Safe, not something the DRIS contracts enforce;
  `DrisDeployer.sol` L33 only checks that the owner is a contract.
- The deployer contract hands vault ownership to the Safe in two steps; the Safe must accept
  (`DrisDeployer.sol` L44, `Ownable2Step`; `contracts/README.md` post-deploy checklist).

## 5. What the contracts do not do

- They do not record in-game balances, spending, prizes, referral credits or sell-back amounts: those are
  server-side records. A player's withdrawable amount is whatever the server signs.
- They do not set or support any token price, and the project does not commit to buy tokens at any price.
- They do not run the liquidity pool, the buyback, or KYC/sanctions screening.

## 6. Rewards are not guaranteed

- Game rewards (gold sell-back, season prizes, referral credits) are paid in DRIS from the vault, only while the vault
  holds tokens, only within the daily cap, and only under the game's rules, which may change.
- Rewards are priced in US dollars but paid in DRIS at a market price; when the price falls, the same dollar reward
  needs more tokens and the vault drains faster (spec §22). The vault can run low or empty.
- DRIS may have no market, and its price can fall to zero. Testnet DRIS has no value at all.

## 7. Audit

- An independent audit has not yet happened. Scope: `docs/audit/scope.md`; self-review: `docs/audit/self-review.md`.
