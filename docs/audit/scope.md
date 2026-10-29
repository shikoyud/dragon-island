# Dragon Island contracts: audit scope

Prepared 2026-10-29 for the external audit of the DRIS token and vault. Static-analysis triage is in
[`self-review.md`](self-review.md). Design intent: spec §13 (`docs/superpowers/specs/2026-10-28-wyrmhaven-design.md`);
roles, deploy steps and security notes: [`contracts/README.md`](../../contracts/README.md).

## Commit

| What | Hash |
|---|---|
| Last commit touching `contracts/src` or `contracts/script` | `dd8b7bba584fa5d905f7b79bd6aa13037191da79` (style(contracts): forge fmt DrisToken after rename; whitespace only) |
| Branch `phase7-launch` HEAD | recorded when the audit tag is created (the branch is rebased and merged to `main` first, so a branch SHA written here would go stale) |

The audit tag `contracts-audit-v1` is not set yet; it is created once an auditor is picked, and only audit fixes may
change the contracts after it. The formatting fix from the self-review (O-1) landed in `dd8b7bb`; `forge fmt --check` passes.

## Build

- Foundry project in `contracts/`; `solc 0.8.24`, `evm_version = cancun`, optimizer on, 200 runs, `via_ir = false`
  (`contracts/foundry.toml`).
- Dependencies (git-ignored, pinned in the README and CI): OpenZeppelin Contracts **v5.1.0**, forge-std **v1.9.7**.
- `forge build && forge test -vv` from `contracts/`: 8 suites, all passing (forge 1.8.6). forge reports
  "48 tests passed": the 47 unit/fuzz tests count one each, and the 5 `invariant_*` functions run as one grouped
  campaign that forge counts as 1 test (all 5 listed as PASS; 64 runs, 2048 calls). That is 52 test functions in all:
  Deploy 3, Token 6, admin 9, claim 11, deposit 6, entry 8, invariant 5, review 4.

## Files in scope

nSLOC counts non-blank lines that are not `//`, `/*` or `*` comment lines. The counts match aderyn 0.1.9's nSLOC
figures for the three `src/` files (re-run at `dd8b7bb`: 19 / 190 / 33).

| File | Lines | nSLOC | Purpose |
|---|---:|---:|---|
| `contracts/src/DrisToken.sol` | 30 | 19 | ERC-20 + Burnable + Permit, fixed 1,000,000,000 supply minted once 50/40/10, no owner |
| `contracts/src/DrisVault.sol` | 264 | 190 | Entry fee, deposits, EIP-712 cumulative claims, payout cap, operator burn, pause, admin |
| `contracts/src/DrisDeployer.sol` | 51 | 33 | Single-use atomic deployer: VestingWallet, token, vault; starts vault ownership transfer to the Safe |
| `contracts/script/Deploy.s.sol` | 50 | 35 | Foundry script: chain-id guard (46630 by default), reads env, deploys `DrisDeployer` |
| **Total** | **395** | **277** | |

Inherited, unmodified OpenZeppelin v5.1.0 code (`ERC20`, `ERC20Burnable`, `ERC20Permit`, `Ownable2Step`, `Pausable`,
`ReentrancyGuard`, `EIP712`, `ECDSA`, `SafeERC20`, `VestingWallet`) is in scope only as far as how it is used.

## Chain

- Beta: **Robinhood Chain testnet, chain ID 46630** (Arbitrum Orbit L2). `Deploy.s.sol` reverts on any other chain
  unless `ALLOW_CHAIN_ID` is set.
- Mainnet: later, a separate explicitly approved step after this audit and legal review (spec §22).
- No addresses yet: nothing has been deployed.

## Roles

| Role (name in code) | Holder | Powers | Where |
|---|---|---|---|
| `owner` (`Ownable2Step`) | 2-of-3 Safe (`OWNER_SAFE`, must be a contract) | `setOperator`, `setSigner`, `setTreasury`, `setBurnDailyLimit`, `setEntryFee`, `pause`, `unpause` (owner only), two-step `transferOwnership`; `renounceOwnership` reverts | `DrisVault.sol` L190-230, L196-198 |
| `operator` | server hot key | `burn` vault tokens up to `burnDailyLimit` per UTC day, `setEntryFee`, `pause` | `DrisVault.sol` L76-84, L167-179, L190, L224 |
| `signer` | server voucher key | none on-chain; its EIP-712 `Claim(player, cumulative, deadline)` signatures authorise `claim` | `DrisVault.sol` L34 (storage), L29 (`CLAIM_TYPEHASH`), L136-155 |
| `treasury` | Safe (payable address) | receives all ETH sent to `enter()` | `DrisVault.sol` L109-116, L212-216 |
| player | any address | `enter`, `deposit`, `claim` (own voucher only: `msg.sender` is in the signed struct) | `DrisVault.sol` L109-155 |
| `launch` (`LAUNCH_RECIPIENT`) | launch wallet | receives 50% of supply at construction; no contract powers | `DrisToken.sol` L19-28 (mint to `launch` at L26) |
| team `VestingWallet` | beneficiary = owner Safe | 10% of supply, linear over 365 days from deploy time, no cliff | `DrisDeployer.sol` L15, L38-39 |
| `DrisDeployer` | the deploy transaction | initial vault owner; calls `setBurnDailyLimit` and starts the two-step transfer to the Safe (`transferOwnership(ownerSafe)` only sets `pendingOwner`) in its constructor, and remains `owner()` (with no callable functions) until the Safe calls `acceptOwnership()` | `DrisDeployer.sol` L24-45 |
| token holders | anyone | `burn`/`burnFrom` own tokens, `permit` | OZ `ERC20Burnable`, `ERC20Permit` |

The token itself has no privileged role: no owner, no mint after the constructor, not upgradeable.

## Invariants and properties already tested

Stateful invariants (`contracts/test/DrisVault.invariant.t.sol`, handler `test/helpers/VaultHandler.sol`;
64 runs x depth 32, `fail_on_revert = false`; the handler calls `warp` (0-2 days), `deposit`, `claim` with fresh
signed vouchers, and operator `burn` across four actors):

| Invariant | Property |
|---|---|
| `invariant_SupplyEqualsInitialMinusBurned` | `totalSupply == TOTAL_SUPPLY - ghostBurned` |
| `invariant_TokensAreConserved` | vault + launch + team + actors + burned == `TOTAL_SUPPLY` |
| `invariant_DailyCapsHold` | `paidToday <= dayCap` and `burnedToday <= burnDailyLimit` |
| `invariant_ClaimedMatchesVouchers` | `claimed[player]` equals the last cumulative the handler successfully claimed |
| `invariant_NoEthStranded` | vault ETH balance is 0 (note: the handler never calls `enter`, so this is checked by the unit tests `test_EnterExactFee` / `test_EnterForwardsExcess` rather than by fuzzing) |

Fuzz tests (512 runs):

| Test | Property |
|---|---|
| `testFuzz_ClaimSplitConserves` (`DrisVault.claim.t.sol`) | claim: vault loss == burned + net; burned and kept each <= 2.5%; net >= 95% |
| `testFuzz_DepositConserves` (`DrisVault.deposit.t.sol`) | deposit: burned + stayed == amount; burned <= 1% |

Unit tests also cover replay and binding (`test_VoucherBoundToVaultAndChain`, `test_CumulativeOnlyPaysTheDelta`),
malformed signatures, expiry, cap reset, pause rules, two-step ownership, disabled renounce, deployer atomicity and the
Safe-must-be-contract check, and that no operator call moves tokens to the operator.

## Known design choices (verified against the code)

1. **No emergency exit on the 400M vault seed.** The vault has no rescue, sweep or owner-withdraw function. The only
   token outflows are `claim` paying the voucher holder (`DrisVault.sol` L153, `safeTransfer(msg.sender, net)`) and
   burns (L123 deposit fee, L152 claim fee, L177 operator burn). No function lets the Safe transfer vault tokens
   directly (it can still reach them indirectly through key rotation; see "Owner (Safe) compromise" under 3). The 40%
   seed is minted straight to the vault's precomputed address (`DrisDeployer.sol` L36-41, `DrisToken.sol` L27). Fee
   "kept" shares stay in the vault and only ever leave through claims or operator burns (L177).
2. **2%/day payout cap.** `PAYOUT_CAP_BPS = 200` (L28). At the first claim of each UTC day `_rollDay` snapshots
   `dayCap = balance * 2%` (L235-243) and emits `PayoutDayStarted`; `claim` reverts in full with
   `DailyCapExceeded` when `gross > dayCap - paidToday` (L145-147). Deposits later that day do not raise the cap.
   The cap is first come, first served across players; the server sizes vouchers to fit `remainingPayoutToday()`
   (L158-161) and keeps voucher deadlines short.
3. **Signer and operator compromise bounds.**
   - Signer key: it can sign arbitrary cumulative totals for any address, but a voucher only pays out when that same
     address submits it (`msg.sender` is in the signed struct, L138), and payouts are limited to the day's cap (2% of
     the vault per UTC day, L146-147). An attacker therefore signs for addresses it controls. It can also grief
     honest players by using up the day's cap. Response: operator or Safe `pause` (L224), Safe `setSigner` (L206-210),
     only the Safe can `unpause` (L228).
   - Operator key: can burn up to `burnDailyLimit` vault tokens per UTC day (L167-179; the limit is owner-set, L218),
     can set `entryFeeWei` to any value including 0 or a prohibitive amount (L190-193), and can pause. It cannot move
     tokens to any address (only burn) and cannot unpause. Response: Safe `setOperator` (L200-204),
     `setEntryFee`, `setBurnDailyLimit`.
   - Treasury: set by the Safe only; a treasury that rejects ETH makes `enter` revert (L113-114).
   - Owner (Safe) compromise: no function transfers vault tokens to the owner, but a compromised Safe has two
     indirect paths. (a) `setSigner` (L206-210) to a key it controls, then sign vouchers for addresses it controls and
     drain up to the 2%/UTC-day cap. (b) `setOperator` (L200-204) to a key it controls plus `setBurnDailyLimit` to
     `type(uint256).max` (L218-221), then `burn` the whole vault balance in one call (L167-179). It can also redirect
     entry ETH via `setTreasury` (L212-216). Mitigation: the owner is a 2-of-3 Safe, so one leaked signer key is not
     enough; there is no timelock, and all these setters emit events (`SignerSet`, `OperatorSet`,
     `BurnDailyLimitSet`, `TreasurySet`) for monitoring.

Other deliberate choices an auditor should know:

- **Separate signer and operator keys.** Spec §13 says the operator "signs vouchers"; the code deliberately splits
  that into a `signer` with no on-chain powers (stricter than the spec).
- **Ownership pending after deploy.** `DrisDeployer` only starts the two-step transfer; until the Safe calls
  `acceptOwnership()` the vault owner is the deployer contract, which has no functions, so nothing owner-only
  (`unpause`, key rotation) is possible in that window. The operator can still pause. README post-deploy checklist:
  no server key goes live before acceptance.
- **Time is `block.timestamp` only** (Arbitrum `block.number` is approximate); day keys are 1-based
  (`_dayKey`, L246-248).
- **Fees round down** in basis points; `net + burned + kept == amount` (`_split`, L255-263); amounts below 1/`BPS`
  pay no fee.
- **`renounceOwnership` disabled** (L196-198).
- **Entry ETH**: the whole `msg.value`, including any excess over the fee, goes to the treasury (L113).
- **Cancun EVM target** (`PUSH0`, `MCOPY` available): Arbitrum Orbit chains on ArbOS 20+ support it; the testnet
  dry run in the deploy plan confirms it on 46630.

## Out of scope

- Off-chain server (`apps/server`): balances, spend, prizes, voucher sizing and signing, the burn batch job, indexer,
  key custody. Its rules for the vault are in `contracts/README.md` ("Rules the server must follow").
- Game rules engine (`packages/game-core`), shared types (`packages/shared`), web client (`apps/web`), waitlist
  (`apps/waitlist`), deploy bundle (`deploy/`).
- Tests and helpers in `contracts/test` (reviewed as evidence, not as audit targets).
- OpenZeppelin and forge-std library code itself.
- The Uniswap v4 launch pool, TWAP pricing and the treasury buyback (spec §13): operational, not in these contracts.
- The Safe and its signers.
