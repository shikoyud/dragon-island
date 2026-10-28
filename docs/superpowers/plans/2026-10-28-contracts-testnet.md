# Phase 3: Contracts on Robinhood Chain Testnet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `WyrmToken` (fixed-supply ERC-20) and `WyrmVault` (entry fee, deposits, EIP-712 cumulative claims, operator burn, daily payout cap, pause, Safe owner) as a Foundry project with unit, fuzz and invariant tests, plus a deploy script gated to testnet 46630.

**Architecture:** `contracts/` is a standalone Foundry project using OpenZeppelin Contracts v5. The token has no owner and no mint; the whole supply is minted once in the constructor to three recipients (launch pool, vault, team `VestingWallet`). The vault holds tokens and all money rules the spec puts on-chain; everything else (balances, spend, prizes) stays off-chain and reaches the chain only as signed cumulative claim totals and operator burns. Fees use integer basis points and floor division; remainders stay in the vault.

**Tech Stack:** Foundry (forge ≥ 1.8), Solidity `^0.8.24`, OpenZeppelin Contracts v5.x (`ERC20`, `ERC20Burnable`, `ERC20Permit`, `VestingWallet`, `Ownable2Step`, `Pausable`, `ReentrancyGuard`, `EIP712`, `ECDSA`, `SafeERC20`), forge-std.

**Spec:** `docs/superpowers/specs/2026-10-28-wyrmhaven-design.md` §13, §16 (bans: off-chain), §22. Chain reference: `docs/reference/02-robinhood-chain.md` (values must be verified against docs.robinhood.com/chain before deployment).

## Global Constraints

- Testnet only: chain ID **46630**. The deploy script reverts on any other chain unless `ALLOW_CHAIN_ID` matches. Never mainnet without the user's explicit go-ahead in chat.
- No private keys in code or committed `.env`; deployment uses `forge script --account <keystore>`. `.env*` is already git-ignored.
- Token: name `Wyrm` (placeholder), symbol `WYRM` (placeholder), 18 decimals, supply `1_000_000_000e18`, no owner, no mint, not upgradeable. Split: 50% launch, 40% vault seed, 10% team via OpenZeppelin `VestingWallet` (start = deploy time, duration 365 days, linear).
- Fees in basis points (`10_000` = 100%): deposit `200` (burn `100`, vault `100`); claim `500` (burn `250`, vault `250`); daily payout cap `200` of the vault's token balance at the first claim of each UTC day; UTC day = `block.timestamp / 1 days`.
- `block.number` is unreliable on Arbitrum Orbit: time logic uses `block.timestamp` only. No on-chain randomness.
- Every state-changing function emits an event; every revert uses a custom error.
- Security considerations to list in the PR: reentrancy (checks-effects-interactions + `nonReentrant` on token-moving functions), access control (owner vs operator vs signer), signature replay (cumulative totals + chain-bound EIP-712 domain + deadline), rounding (floor; remainder stays in vault; fees ≤ amount), operator-key compromise (burn daily limit, signer rotation, pause, cap on payouts).
- Out of scope: Uniswap v4 pool and TWAP (server computes USD prices), buyback job, Safe deployment (the Safe address is a constructor input), server indexer, mainnet.

## Review Focus

1. A voucher signed for chain A or an older vault address must not be valid on another deployment; a voucher replayed after a successful claim pays nothing and reverts. (Task 3)
2. A claim that would exceed the day's 2% cap reverts in full (no partial payout) and the same voucher succeeds the next UTC day. (Task 3)
3. Deposit or claim amounts so small that fees floor to 0 must still conserve tokens: `credited + burned + kept == amount`, no underflow, no free fee avoidance beyond rounding dust. (Tasks 2, 3, 4 invariants)
4. A compromised operator key can at most burn `burnDailyLimit` per UTC day and pause; it cannot move tokens to itself, change the signer, or raise its own limit. (Task 4)
5. `enter()` with excess ETH forwards all of it to the treasury (no stranded ETH in the vault); a second `enter()` from the same address reverts; `enter()` while paused reverts. (Task 2)

---

### Task 1: Foundry project and `WyrmToken`

**Files:**
- Create: `contracts/foundry.toml`, `contracts/.gitignore` (`out/`, `cache/`, `broadcast/`), `contracts/remappings.txt`
- Create: `contracts/src/WyrmToken.sol`
- Test: `contracts/test/WyrmToken.t.sol`

**Interfaces:**
- Produces: `contract WyrmToken is ERC20, ERC20Burnable, ERC20Permit` with
  - `uint256 public constant TOTAL_SUPPLY = 1_000_000_000e18`
  - `constructor(address launch, address vault, address team)` — mints 50% / 40% / 10%; reverts `ZeroAddress()` on any zero address; emits standard `Transfer` events only
  - `error ZeroAddress();`
- Produces (`foundry.toml`): `solc = "0.8.24"`, `optimizer = true`, `optimizer_runs = 200`, `evm_version = "cancun"`, `[rpc_endpoints] rh_testnet = "${RH_TESTNET_RPC}"`, `[fmt]` defaults, `fuzz.runs = 512`, `invariant.runs = 64`, `invariant.depth = 32`

- [x] **Step 1: `cd contracts && forge init --no-git --no-commit . && forge install OpenZeppelin/openzeppelin-contracts@v5.1.0 --no-git`** (keep `lib/` vendored? No: add `lib/` to `.gitignore` and record versions in `contracts/README.md` with the install command; the executor records the exact tag that resolved)
- [x] **Step 2: Write failing tests**

```solidity
function test_SupplyAndSplit() public {
    assertEq(token.totalSupply(), 1_000_000_000e18);
    assertEq(token.balanceOf(launch), 500_000_000e18);
    assertEq(token.balanceOf(vault), 400_000_000e18);
    assertEq(token.balanceOf(team), 100_000_000e18);
    assertEq(token.decimals(), 18);
}
function test_RevertZeroAddress() public { vm.expectRevert(WyrmToken.ZeroAddress.selector); new WyrmToken(address(0), vault, team); }
function test_BurnReducesSupply() public { vm.prank(launch); token.burn(1e18); assertEq(token.totalSupply(), 1_000_000_000e18 - 1e18); }
function test_NoMintFunction() public { /* selector probe: */ (bool ok,) = address(token).call(abi.encodeWithSignature("mint(address,uint256)", launch, 1)); assertFalse(ok); }
function test_PermitWorks() public { /* sign EIP-2612 permit with vm.sign for a known key, call permit, assert allowance */ }
function test_TeamVestingLinear() public { /* deploy VestingWallet(team, uint64(block.timestamp), 365 days) as `team`; warp 182.5 days; release; assert ≈ 50% ± 1e18 */ }
```

- [x] **Step 3: Run `forge test -vv`** — expect FAIL (contract missing)
- [x] **Step 4: Implement `WyrmToken.sol`**
- [x] **Step 5: Run `forge test -vv` and `forge fmt --check`** — expect PASS, formatted
- [x] **Step 6: Commit** `feat(contracts): foundry project and fixed-supply WyrmToken`

### Task 2: `WyrmVault` entry and deposits

**Files:**
- Create: `contracts/src/WyrmVault.sol`
- Test: `contracts/test/WyrmVault.entry.t.sol`, `contracts/test/WyrmVault.deposit.t.sol`, `contracts/test/helpers/VaultFixture.sol` (deploys token with the vault as the 40% recipient, a treasury EOA, owner, operator, signer key `uint256 signerPk = 0xA11CE`)

**Interfaces:**
- Produces: `contract WyrmVault is Ownable2Step, Pausable, ReentrancyGuard, EIP712`
  - Constants: `DEPOSIT_FEE_BPS = 200`, `DEPOSIT_BURN_BPS = 100`, `CLAIM_FEE_BPS = 500`, `CLAIM_BURN_BPS = 250`, `PAYOUT_CAP_BPS = 200`, `BPS = 10_000`
  - Immutables/state: `WyrmToken public immutable token`; `address payable public treasury`; `address public operator`; `address public signer`; `uint256 public entryFeeWei`; `mapping(address => bool) public entered`
  - `constructor(WyrmToken token_, address owner_, address payable treasury_, address operator_, address signer_, uint256 entryFeeWei_)` — `EIP712("WyrmVault", "1")`, `Ownable(owner_)`; reverts `ZeroAddress()`
  - `enter() external payable whenNotPaused` — `AlreadyEntered()`, `InsufficientEntryFee(uint256 sent, uint256 required)`; marks entered; forwards **all** `msg.value` to `treasury` via `call` (`TreasuryTransferFailed()`); emits `Entered(address indexed player, uint256 paidWei)`
  - `deposit(uint256 amount) external whenNotPaused nonReentrant` — `ZeroAmount()`; `safeTransferFrom(msg.sender, this, amount)`; `burned = amount * DEPOSIT_BURN_BPS / BPS`; `kept = amount * (DEPOSIT_FEE_BPS − DEPOSIT_BURN_BPS) / BPS`; `credited = amount − burned − kept`; `token.burn(burned)` if > 0; emits `Deposited(address indexed player, uint256 amount, uint256 credited, uint256 burned)`
  - `setEntryFee(uint256 weiAmount)` — operator or owner (`NotOperator()`); emits `EntryFeeSet(uint256)`
  - Errors so far: `ZeroAddress, ZeroAmount, AlreadyEntered, InsufficientEntryFee, TreasuryTransferFailed, NotOperator`

- [x] **Step 1: Write failing tests**
  - `enter`: exact fee → `entered` true, treasury balance += fee, event; `fee + 1 wei` → treasury receives `fee + 1`, vault ETH balance 0; `fee − 1` → `InsufficientEntryFee`; second call → `AlreadyEntered`; paused → `EnforcedPause`; treasury that rejects ETH (test contract with reverting `receive`) → `TreasuryTransferFailed`
  - `deposit(10_000e18)` → player −10_000e18, vault +9_900e18 (kept 100e18 + credited 9_800e18 stay in the vault), supply −100e18, event `(player, 10_000e18, 9_800e18, 100e18)`; `deposit(1)` → credited 1, burned 0, kept 0, supply unchanged; `deposit(0)` → `ZeroAmount`; without allowance → ERC20 insufficient-allowance revert; paused → `EnforcedPause`
  - fuzz `testFuzz_DepositConserves(uint96 amount)` (`amount > 0`): `credited + burned + kept == amount` and `burned ≤ amount / 100`
  - `setEntryFee` by operator and owner ok; by a stranger → `NotOperator`
- [x] **Step 2: Run `forge test`** — expect FAIL
- [x] **Step 3: Implement the constructor, `enter`, `deposit`, `setEntryFee` and the fee helpers in `WyrmVault.sol`** — fee math in an internal pure `_split(uint256 amount, uint256 feeBps, uint256 burnBps) returns (uint256 net, uint256 burned, uint256 kept)`
- [x] **Step 4: Run `forge test -vv` and `forge fmt --check`** — expect PASS
- [x] **Step 5: Commit** `feat(contracts): WyrmVault entry fee and deposits with burn`

### Task 3: EIP-712 cumulative claims with the daily payout cap

**Files:**
- Modify: `contracts/src/WyrmVault.sol`
- Test: `contracts/test/WyrmVault.claim.t.sol`

**Interfaces:**
- Produces:
  - `bytes32 public constant CLAIM_TYPEHASH = keccak256("Claim(address player,uint256 cumulative,uint256 deadline)")`
  - `mapping(address => uint256) public claimed` — cumulative gross total already paid per player
  - `uint256 public capDay; uint256 public dayCap; uint256 public paidToday`
  - `claim(uint256 cumulative, uint256 deadline, bytes calldata signature) external whenNotPaused nonReentrant`:
    1. `block.timestamp > deadline` → `VoucherExpired()`
    2. recover signer of `_hashTypedDataV4(keccak256(abi.encode(CLAIM_TYPEHASH, msg.sender, cumulative, deadline)))` with `ECDSA.recover`; `!= signer` → `InvalidSignature()`
    3. `gross = cumulative − claimed[msg.sender]`; `cumulative <= claimed` → `NothingToClaim()`
    4. `_rollDay()`: if `block.timestamp / 1 days != capDay` set `capDay`, `dayCap = token.balanceOf(this) * PAYOUT_CAP_BPS / BPS`, `paidToday = 0`
    5. `paidToday + gross > dayCap` → `DailyCapExceeded(uint256 remaining)`
    6. effects: `claimed[msg.sender] = cumulative; paidToday += gross`
    7. `(net, burned, kept) = _split(gross, CLAIM_FEE_BPS, CLAIM_BURN_BPS)`; `token.burn(burned)`; `safeTransfer(msg.sender, net)`; emit `Claimed(address indexed player, uint256 cumulative, uint256 gross, uint256 net, uint256 burned)`
  - `remainingPayoutToday() external view returns (uint256)` — what `_rollDay` would leave (view-only computation)
  - `setSigner(address)` — owner only; `SignerSet(address)`
  - Errors: `VoucherExpired, InvalidSignature, NothingToClaim, DailyCapExceeded`

- [x] **Step 1: Write failing tests** (fixture seeds the vault with `400_000_000e18`; helper `sign(pk, player, cumulative, deadline)` builds the digest with the vault's `eip712Domain()` and `vm.sign`)
  - valid voucher `cumulative 1_000e18` → player +950e18, supply −25e18, `claimed == 1_000e18`, `paidToday == 1_000e18`, event
  - same voucher again → `NothingToClaim`; voucher with `cumulative 1_500e18` → pays gross 500e18 (net 475e18)
  - voucher signed by another key → `InvalidSignature`; voucher for `player` submitted by `other` → `InvalidSignature` (msg.sender is in the digest); `deadline = block.timestamp − 1` → `VoucherExpired`
  - domain binding: deploy a second vault; a voucher valid on the first → `InvalidSignature` on the second; `vm.chainId(1)` then the same voucher → `InvalidSignature`
  - cap: balance `400_000_000e18` → `dayCap 8_000_000e18`; `claim(8_000_000e18)` ok; then `claim(8_000_000e18 + 1)` → `DailyCapExceeded(0)` and the player's balance/`claimed` unchanged; `vm.warp(+1 days)` → same voucher succeeds with `dayCap` recomputed from the lower balance
  - `claim(1)` (gross 1 wei) → net 1, burned 0, kept 0
  - after `setSigner(newSigner)` old-key vouchers → `InvalidSignature`; stranger calling `setSigner` → `OwnableUnauthorizedAccount`
  - paused → `EnforcedPause`
  - fuzz `testFuzz_ClaimSplitConserves(uint96 gross)`: `net + burned + kept == gross`
- [x] **Step 2: Run `forge test`** — expect FAIL
- [x] **Step 3: Implement `claim`, `_rollDay`, `remainingPayoutToday`, `setSigner`**
- [x] **Step 4: Run `forge test -vv` and `forge fmt --check`** — expect PASS
- [x] **Step 5: Commit** `feat(contracts): EIP-712 cumulative claims with 2% daily payout cap`

### Task 4: Operator burn, rotation, pause, and invariants

**Files:**
- Modify: `contracts/src/WyrmVault.sol`
- Test: `contracts/test/WyrmVault.admin.t.sol`, `contracts/test/WyrmVault.invariant.t.sol`, `contracts/test/helpers/VaultHandler.sol`

**Interfaces:**
- Produces:
  - `uint256 public burnDailyLimit; uint256 public burnDay; uint256 public burnedToday`
  - `burn(uint256 amount) external onlyOperator whenNotPaused` — rolls `burnDay`; `burnedToday + amount > burnDailyLimit` → `BurnLimitExceeded(uint256 remaining)`; `token.burn(amount)`; emits `OperatorBurn(uint256 amount, uint256 burnedToday)`
  - `setOperator(address)`, `setTreasury(address payable)`, `setBurnDailyLimit(uint256)` — owner only; events `OperatorSet`, `TreasurySet`, `BurnDailyLimitSet`
  - `pause()` — owner **or** operator (so the server can halt on an incident); `unpause()` — owner only
  - `modifier onlyOperator` → `NotOperator()`; `modifier onlyOwnerOrOperator`
  - Errors: `BurnLimitExceeded`

- [ ] **Step 1: Write failing tests**
  - admin: `burn` by operator within limit burns and emits; over limit → `BurnLimitExceeded(remaining)`; next UTC day resets; stranger → `NotOperator`; owner (not operator) → `NotOperator`
  - rotation: `setOperator(new)` by owner; old operator `burn` → `NotOperator`; `Ownable2Step`: `transferOwnership(newSafe)` then `acceptOwnership` from `newSafe`; stranger on any setter → `OwnableUnauthorizedAccount`
  - pause: operator `pause()` ok, operator `unpause()` → `OwnableUnauthorizedAccount`; owner `unpause()` ok; while paused `enter`/`deposit`/`claim`/`burn` revert `EnforcedPause`, setters still work
  - operator cannot: `setSigner`, `setBurnDailyLimit`, `setTreasury`, or receive tokens (no function moves tokens to the operator)
  - invariants (handler: 4 actors deposit random amounts, claim with freshly signed cumulative vouchers that increase by random steps, operator burns, time warps 0–2 days between calls; owner never acts):
    - `token.totalSupply() == TOTAL_SUPPLY − ghostBurned`
    - `token.balanceOf(vault) + Σ actor balances + launchBalance + teamBalance + ghostBurned == TOTAL_SUPPLY`
    - `paidToday <= dayCap`; `burnedToday <= burnDailyLimit`
    - for every actor `claimed[actor] == ghostCumulative[actor]` and never decreases
- [ ] **Step 2: Run `forge test`** — expect FAIL
- [ ] **Step 3: Implement burn, setters, pause rules, modifiers; write the handler**
- [ ] **Step 4: Run `forge test -vv` and `forge fmt --check`** — expect PASS (invariants green over 64 runs × depth 32)
- [ ] **Step 5: Commit** `feat(contracts): operator burn limit, key rotation, pause, invariant tests`

### Task 5: Deploy script, local dry run, documentation

**Files:**
- Create: `contracts/script/Deploy.s.sol`, `contracts/.env.example`, `contracts/README.md`
- Modify: `docs/reference/02-robinhood-chain.md` (add "Deployed addresses (testnet)" section left as TBD until the user deploys)

**Interfaces:**
- Produces: `script Deploy` reading env `OWNER_SAFE`, `TREASURY`, `OPERATOR`, `SIGNER`, `LAUNCH_RECIPIENT`, `ENTRY_FEE_WEI`, `BURN_DAILY_LIMIT`, optional `ALLOW_CHAIN_ID` (default `46630`): reverts `WrongChain(uint256)` if `block.chainid != ALLOW_CHAIN_ID`; deploys `VestingWallet(teamBeneficiary = OWNER_SAFE, start = now, 365 days)`, precomputes the vault address with `vm.computeCreateAddress`, deploys `WyrmToken(launch, predictedVault, vesting)`, then `WyrmVault(token, OWNER_SAFE, TREASURY, OPERATOR, SIGNER, ENTRY_FEE_WEI)`, asserts `address(vault) == predictedVault` and `token.balanceOf(vault) == 400_000_000e18`, calls `vault.setBurnDailyLimit(BURN_DAILY_LIMIT)` (deployer is the initial owner for setup, then `transferOwnership(OWNER_SAFE)`; the Safe must `acceptOwnership`), and logs all addresses.
- README: install, test, format, the deploy command (`forge script script/Deploy.s.sol --rpc-url rh_testnet --account <keystore> --broadcast --verify` with Blockscout verifier flags), the post-deploy checklist (Safe accepts ownership, publish addresses, verify source), and the security considerations list from Global Constraints.

- [ ] **Step 1: Write the failing test** `contracts/test/Deploy.t.sol`: run the script's `run()` under `vm.chainId(46630)` with env set via `vm.setEnv` → token/vault/vesting deployed, vault holds 40%, vesting holds 10%, launch 50%, `vault.owner()` is the deployer with `pendingOwner() == OWNER_SAFE`, `burnDailyLimit` set; under `vm.chainId(4663)` without `ALLOW_CHAIN_ID` → `WrongChain(4663)`
- [ ] **Step 2: Run `forge test`** — expect FAIL
- [ ] **Step 3: Implement `Deploy.s.sol`, `.env.example`, README, docs section**
- [ ] **Step 4: Run `forge test -vv`, `forge fmt --check`, and a local dry run: `anvil --chain-id 46630 &` then `forge script script/Deploy.s.sol --rpc-url http://127.0.0.1:8545 --private-key <anvil key 0> --broadcast`** — expect PASS and logged addresses; stop anvil; `broadcast/` is git-ignored
- [ ] **Step 5: Commit** `feat(contracts): testnet deploy script, dry run and docs`

---

**After this plan:** the user deploys to testnet 46630 with a funded keystore (faucet ETH), records the addresses in `docs/reference/02-robinhood-chain.md`, and verifies source on the official explorer. Phase 4 (server) consumes the ABIs from `contracts/out/` and the `Entered`/`Deposited`/`Claimed` events.
