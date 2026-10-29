# Dragon Island contracts: static-analysis self-review

Date 2026-10-29. Code at `3f97d3d` (last change to `contracts/src` / `contracts/script`), branch HEAD `51e2dac`.
Scope and roles: [`scope.md`](scope.md). No contract code was changed for this review.

## Tools and commands

All run in WSL from `contracts/` after
`forge install OpenZeppelin/openzeppelin-contracts@v5.1.0 --no-git` and `forge install foundry-rs/forge-std@v1.9.7 --no-git`.

| Tool | Version | Command | Result |
|---|---|---|---|
| forge | 1.8.6 (`6bad0a6`), solc 0.8.24 | `forge build`, `forge test -vv` | 8 suites, **48 passed**, 0 failed, 0 skipped (52 test functions: forge counts the 5 invariants as one grouped test, all 5 PASS) |
| forge fmt | 1.8.6 | `forge fmt --check` | **fails** on `src/DrisToken.sol` L19 (see O-1) |
| slither | 0.11.6 | `slither . --filter-paths "lib\|test"` and again with `--foundry-compile-all` (includes `script/`) | 102 detectors, 13 results, identical in both runs (none in `script/`) |
| aderyn | 0.1.9 (crates.io; old, current releases have more detectors) | `aderyn . -x lib/,test/ -o <scratch>/report.md` | 63 detectors, 1 High + 9 Low issue types (32 instances). It printed the full report, then panicked on an unrelated version-string parse; the report is complete. aderyn always excludes `script/`, so the script was covered by slither and forge lint only. |
| forge lint | 1.8.6 (bundled) | `forge lint src script` | 15 warnings, mostly duplicates of slither/aderyn (supplementary pass) |

Raw reports were not committed; every finding is listed below.

Verdicts: **fixed** (changed in code), **false positive** (the detector's premise does not hold here), **accepted**
(true observation, deliberate or harmless), **open — needs fix task** (real issue; fix is a separate task with
`forge test` + `forge fmt --check`). Severity is the tool's own label.

## Summary

| Verdict | slither | aderyn | forge lint | manual | Total |
|---|---:|---:|---:|---:|---:|
| fixed | 0 | 0 | 0 | 0 | 0 |
| false positive | 3 | 4 | 8 | 0 | 15 |
| accepted | 10 | 6 | 7 | 3 | 26 |
| open — needs fix task | 0 | 0 | 0 | 1 | 1 |

(Counted per row below: 13 slither results, 10 aderyn issue types (32 instances), 15 forge lint warnings and 4 manual
notes, 42 rows in all. Many forge lint rows duplicate slither or aderyn rows and carry the same verdict.)

No tool finding is a vulnerability. The one open item is a formatting failure that breaks `forge fmt --check` (and the
CI contracts job) but does not change behaviour.

## Open items

| ID | Source | Location | Severity | Description |
|---|---|---|---|---|
| O-1 | `forge fmt --check` | `src/DrisToken.sol` L19-20 | Low (tooling / CI) | The constructor line is 124 chars, over `line_length = 120`, since the rename to "Dragon Island" (`3f97d3d`). `forge fmt --check` exits 1, so the CI `contracts` job's "Format check" step fails before tests run. Fix: run `forge fmt` (it only re-wraps the constructor header and the `ZeroAddress` check into a block), then `forge test`. Whitespace-only, but it changes a source file, so land it before the `contracts-audit-v1` tag. |

## slither 0.11.6 (13 results)

| # | Detector | Location | Severity | Verdict | Reason |
|---|---|---|---|---|---|
| S-1 | unused-return | `DrisVault.claim`, L139 `ECDSA.tryRecover` | Medium | false positive | Both used values are checked (L140: `err != NoError \|\| recovered != signer` reverts `InvalidSignature`). The ignored third value is only the error argument (bad length / bad `s`), which the contract deliberately does not surface. OZ 5.1 `tryRecover` already rejects high-`s` and zero-address recoveries. |
| S-2 | reentrancy-events | `DrisVault.burn`, L177-178 | Low | false positive | The external call is `token.burn` on the immutable `DrisToken` (OZ ERC20, no hooks). `burnedToday` is updated before the call (L176). The token cannot call back. |
| S-3 | reentrancy-events | `DrisVault.enter`, L113-115 | Low | accepted | ETH goes to `treasury`, an owner-set Safe. `entered[msg.sender]` is set before the call (L112), so re-entering `enter` for the same sender reverts `AlreadyEntered`. A re-entering treasury could only enter itself (paying itself), which would emit its `Entered` event before the outer one. Event order is harmless: the indexer keys on player. |
| S-4 | timestamp | `DrisVault.claim`, L137 `block.timestamp > deadline` | Low | accepted | Voucher expiry needs wall-clock time. The Arbitrum sequencer's timestamp tolerance (seconds) is negligible against voucher lifetimes; `block.number` is not usable on Orbit. |
| S-5 | timestamp | `DrisVault.remainingPayoutToday`, L159 | Low | accepted | View only; day key from `block.timestamp / 1 days`. Same reasoning as S-6. |
| S-6 | timestamp | `DrisVault._rollDay`, L237 | Low | accepted | Day-bucket choice for the payout cap. Sequencer skew can at most shift a claim near 00:00 UTC into the adjacent day; the cap per day still holds (`invariant_DailyCapsHold`). |
| S-7 | timestamp | `DrisVault.burn`, L170 | Low | accepted | Same as S-6 for the operator burn limit. |
| S-8 | timestamp | `DrisVault.remainingBurnToday`, L183 | Low | accepted | View only; same as S-6. |
| S-9 | timestamp | `DrisDeployer` constructor, L41 `address(vault) != predictedVault` | Low | false positive | Address comparison, not a time comparison; slither taints it because `block.timestamp` is passed to the `VestingWallet` start in the same constructor (L38). |
| S-10 | low-level-calls | `DrisVault.enter`, L113 `treasury.call{value: msg.value}("")` | Informational | accepted | Needed to forward ETH to a Safe (a contract with a fallback; `transfer`'s 2300 gas would fail). Return value checked; reverts `TreasuryTransferFailed`. |
| S-11 | unindexed-event-address | `OperatorSet`, L58 | Informational | accepted | Rare admin event with one field; consumers filter by event signature. Indexing would not change security. Optional cosmetic change for a future version. |
| S-12 | unindexed-event-address | `SignerSet`, L59 | Informational | accepted | As S-11. |
| S-13 | unindexed-event-address | `TreasurySet`, L60 | Informational | accepted | As S-11. |

## aderyn 0.1.9 (10 issue types, 32 instances)

| # | Detector | Location | Severity | Verdict | Reason |
|---|---|---|---|---|---|
| A-H1 | Contract locks Ether without a withdraw function | `DrisVault` (L20; payable `enter` L109) | High | false positive | `enter` forwards the entire `msg.value` to the treasury in the same call (L113) or reverts. The vault has no `receive`/`fallback`, so ordinary transfers revert. Covered by `test_EnterExactFee` and `test_EnterForwardsExcess` (vault balance 0) and `test_RevertTreasuryRejectsEth`. Only forced ETH (`selfdestruct` beneficiary) could arrive and stay; that is a gift with no effect on accounting. |
| A-L1 | Centralization risk for trusted owners (7) | `DrisVault` L20, L196, L200, L206, L212, L218, L228 | Low | accepted | By design: owner is a 2-of-3 Safe. No function lets the owner transfer vault tokens directly (no rescue/withdraw; see scope.md design choice 1). A compromised Safe could still reach them indirectly: `setSigner` (L206) to its own key and drain up to 2% per UTC day via vouchers, or `setOperator` (L200) + `setBurnDailyLimit(max)` (L218) and burn the whole seed. Mitigation is the 2-of-3 threshold plus event monitoring; no timelock. Details in scope.md design choice 3, "Owner (Safe) compromise". `renounceOwnership` is disabled on purpose (L196). |
| A-L2 | Wide pragma `^0.8.24` (3) | `DrisDeployer` L2, `DrisToken` L2, `DrisVault` L2 | Low | accepted | `foundry.toml` pins `solc = "0.8.24"`; the audited and deployed bytecode comes from that compiler. Pinning the pragma too would be cosmetic. |
| A-L3 | `public` function not used internally | `DrisVault.renounceOwnership`, L196 | Low | false positive | It overrides OZ `Ownable.renounceOwnership`, which is `public`; an override cannot narrow visibility to `external`. |
| A-L4 | Repeated literals (3) | `DrisToken` L21-23 (`* 50 / 100`, `40`, `10`) | Low | accepted | Constructor-only split, documented in NatSpec; `test_SupplyAndSplit` checks it sums to `TOTAL_SUPPLY`. |
| A-L5 | Event missing `indexed` fields (10) | `DrisVault` L52-61 | Low | accepted | Player events already index `player`; the rest are admin/daily events with one or two fields. Gas/indexing style, no security effect. |
| A-L6 | `nonReentrant` not first modifier (2) | `deposit` L119, `claim` L136 | Low | false positive | The modifier before it is `whenNotPaused`, which reads one storage slot and makes no external call, so there is nothing to re-enter. |
| A-L7 | PUSH0 not supported by all chains (3) | pragmas L2 | Low | accepted | `evm_version = "cancun"` is pinned on purpose. Robinhood Chain is an Arbitrum Orbit chain; ArbOS 20+ supports Shanghai/Cancun opcodes. The anvil and testnet dry runs in the deploy plan confirm it on 46630 before any value is at stake. |
| A-L8 | Modifier used only once | `onlyOperator`, L76 | Low | accepted | Readability; keeps the role check uniform with `onlyOwnerOrOperator`. |
| A-L9 | Large literal multiple of 10000 | `BPS = 10_000`, L23 | Low | false positive | `10_000` basis points is the clearest form; `1e4` would be less readable. Style only. |

## forge lint 1.8.6 (15 warnings, supplementary)

| # | Lint | Location | Verdict | Reason |
|---|---|---|---|---|
| F-1 | unsafe-typecast | `DrisDeployer.sol` L38 `uint64(block.timestamp)` | false positive | A timestamp fits `uint64` for ~584 billion years; `VestingWallet` takes `uint64`. |
| F-2 | arbitrary-send-eth | `DrisVault.sol` L113 | false positive | The destination is `treasury`, settable only by the owner Safe (L212-216), not by the caller. |
| F-3 | reentrancy-no-eth | `DrisVault.sol` L123 (`token.burn` in `deposit`) | false positive | `deposit` is `nonReentrant`, holds no state to corrupt, and the token is the trusted immutable `DrisToken` with no hooks. |
| F-4 | non-reentrant-not-first | L119 | false positive | Duplicate of A-L6. |
| F-5 | non-reentrant-not-first | L136 | false positive | Duplicate of A-L6. |
| F-6 | reentrancy-events | L115 (`enter`) | accepted | Duplicate of S-3. |
| F-7 | reentrancy-events | L124 (`deposit`) | false positive | External calls are to `DrisToken` only; no callback possible; function is `nonReentrant`. |
| F-8 | reentrancy-events | L154 (`claim`) | false positive | As F-7; `claimed` and `paidToday` are written before the calls (L149-150). |
| F-9 | reentrancy-events | L241 (`_rollDay`) | accepted | The preceding call is `token.balanceOf` (a view on `DrisToken`); no re-entry possible. Accepted rather than FP because the lint is technically correct about ordering. |
| F-10 | reentrancy-events | L178 (`burn`) | false positive | Duplicate of S-2. |
| F-11 | block-timestamp | L137 | accepted | Duplicate of S-4. |
| F-12 | block-timestamp | L159 | accepted | Duplicate of S-5. |
| F-13 | block-timestamp | L170 | accepted | Duplicate of S-7. |
| F-14 | block-timestamp | L183 | accepted | Duplicate of S-8. |
| F-15 | block-timestamp | L237 | accepted | Duplicate of S-6. |

## Manual review notes

Read with the tools' output, not found by them.

| # | Topic | Location | Verdict | Notes |
|---|---|---|---|---|
| M-1 | `forge fmt --check` fails | `DrisToken.sol` L19 | open — needs fix task | See O-1. |
| M-2 | Operator can set any entry fee | `setEntryFee`, L190-193 | accepted | A compromised operator can set the fee to 0 (free entry, which only unlocks off-chain earning) or to a prohibitive value (blocks new entries). No funds at risk; the Safe can reset it and rotate the operator. Listed under compromise bounds in scope.md. |
| M-3 | Vault ownerless-in-practice until `acceptOwnership` | `DrisDeployer` L44, README post-deploy step | accepted | Between deploy and the Safe's `acceptOwnership()`, `owner()` is `DrisDeployer`, which has no functions: no unpause or key rotation is possible, though the operator can still pause. The README checklist keeps server keys offline until acceptance. |
| M-4 | Invariant handler does not call `enter`, `pause` or admin setters | `test/helpers/VaultHandler.sol` | accepted | `invariant_NoEthStranded` is therefore trivially true in the fuzz run; ETH forwarding is covered by unit tests instead. Worth extending the handler with `enter` and `pause/unpause` in a later test task; no contract change needed. |

Also checked and found correct: EIP-712 domain (`"DrisVault"`, `"1"`) binds chain id and vault address and
`msg.sender` is in the signed struct (L138); the cumulative model pays each total at most once (L141-149); state is
written before external calls in `claim` (L149-150) and `enter` (L112); `_split` cannot underflow because
`burnBps <= feeBps <= BPS` are constants (L255-263); lowering `burnDailyLimit` below `burnedToday` saturates instead
of panicking (L174, L184); the deployer's predicted vault address uses the correct RLP prefix for nonce 3 and is
re-checked after creation (L36, L41).
