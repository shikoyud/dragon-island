# Wyrmhaven contracts

Foundry project for the two on-chain pieces of Wyrmhaven (spec §13):

- **`WyrmToken`**: ERC-20, fixed supply 1,000,000,000 WYRM, no owner, no mint, not upgradeable. Burnable by holders, EIP-2612 permit. Minted once: 50% launch, 40% vault seed, 10% team (`VestingWallet`, 12 months linear).
- **`WyrmDeployer`**: single-use contract whose constructor deploys the vesting wallet, token and vault in one transaction, so the 40% vault seed can never be minted to an address that fails to deploy.
- **`WyrmVault`**: one-time ETH entry fee (forwarded to the treasury), token deposits (2% fee: 1% burned, 1% kept), EIP-712 cumulative withdrawal claims (5% fee: 2.5% burned, 2.5% kept) under a 2%-of-balance daily payout cap, operator burn with a daily limit, pause, two-step Safe ownership.

Everything else in the game (balances, spend, prizes, randomness) is off-chain on the server; only signed cumulative totals and burn batches reach the chain.

## Setup

```bash
forge install OpenZeppelin/openzeppelin-contracts@v5.1.0 --no-git
forge install foundry-rs/forge-std@v1.9.7 --no-git
```

`lib/` is git-ignored; the pinned tags above are the record. (Plain `git clone --branch <tag>` into `lib/` works too.)

## Test and format

```bash
forge test -vv
forge fmt --check
```

Suites: token, vault entry, deposit, claim, admin, review findings, invariants (64 runs × depth 32), deployer and deploy script.

## Deploy to Robinhood Chain testnet (chain ID 46630)

1. Verify RPC, explorer and faucet against docs.robinhood.com/chain (third-party values change; look-alike explorers exist).
2. `cp .env.example .env` and fill in the role addresses. `OWNER_SAFE` must be a deployed contract (the Safe); the deployer refuses an EOA. Import the deployer key into a Foundry keystore: `cast wallet import deployer --interactive`.
3. Dry run locally: `anvil --chain-id 46630` in one terminal, then
   `forge script script/Deploy.s.sol --rpc-url http://127.0.0.1:8545 --private-key <anvil key 0> --broadcast`.
4. Deploy: `source .env && forge script script/Deploy.s.sol --rpc-url rh_testnet --account deployer --broadcast --verify --verifier blockscout --verifier-url https://explorer.testnet.chain.robinhood.com/api/`
5. Post-deploy checklist:
   - The Safe calls `vault.acceptOwnership()` (the deployer contract only starts the transfer and holds no powers afterwards). **No server key goes live before this step.**
   - Record the token, vault and vesting addresses in `docs/reference/02-robinhood-chain.md` and publish them (copycat tokens are common).
   - Confirm source verification on the official explorer.
   - Fund the server's operator and signer keys; the signer never needs tokens.

The script reverts on any chain other than 46630 unless `ALLOW_CHAIN_ID` is set. Mainnet deployment is a separate, explicitly approved step after audit and legal review (spec §22).

## Roles

| Role | Who | Can |
|---|---|---|
| owner | 2-of-3 Safe | rotate operator/signer/treasury, set burn limit, unpause, transfer ownership (two-step) |
| operator | server key | `burn` within the daily limit, set the ETH entry fee, `pause` |
| signer | server key | sign claim vouchers off-chain; holds no funds, has no on-chain powers |

## Rules the server must follow (Phase 4)

- **Voucher sizing**: a single claim can never exceed `remainingPayoutToday()` (2% of the vault balance at the day's first claim); a voucher larger than the day's cap can never be paid, since the cap only shrinks as the vault drains. The server signs cumulative totals that fit the remaining cap, caps amounts per player per day, and re-credits a player when a voucher expires unused. `PayoutDayStarted(day, cap)` is emitted at each day's first claim.
- **Short deadlines** on vouchers: a banned player can still redeem an already-issued voucher until it expires.
- **Signature errors** all surface as `InvalidSignature`; the client never sees raw ECDSA errors.

## Security considerations

- **Reentrancy**: `deposit` and `claim` are `nonReentrant` and follow checks-effects-interactions; `enter` forwards ETH after setting `entered`.
- **Access control**: three separated roles (above). No function moves tokens to the operator or owner; the only token outflows are `claim` (to the voucher's player) and burns.
- **Signature replay**: vouchers carry a cumulative total, so each total pays once (`claimed[player]`); the EIP-712 domain binds chain id and vault address; `deadline` bounds voucher lifetime; `msg.sender` is part of the signed struct, so a voucher cannot be submitted by someone else.
- **Rounding**: all fees use floor division in basis points; `net + burned + kept == amount` always, dust stays in the vault; amounts below 1/`BPS` pay no fee.
- **Operator-key compromise**: bounded to `burnDailyLimit` per UTC day plus pausing; the Safe rotates the key. **Signer-key compromise**: payouts are capped at 2% of the vault balance per UTC day and the Safe can pause and rotate the signer.
- **Time**: `block.timestamp` only (`block.number` is approximate on Arbitrum Orbit); day keys are 1-based so day 0 never collides with the zero sentinel.
- **Treasury**: a treasury that rejects ETH makes `enter` revert rather than strand ETH in the vault.
- **Ownership**: `renounceOwnership` is disabled; an ownerless vault could never be unpaused or have a leaked signer rotated.
- **Deployment**: atomic via `WyrmDeployer`; a partial deploy cannot strand the vault seed, and nonce drift between simulation and broadcast cannot change the vault address.
- **Daily caps**: lowering `burnDailyLimit` below the day's burned total simply blocks further burns that day (no arithmetic panic). The payout cap is first come, first served across players; the server's per-player sizing (above) keeps one claim from using the whole day.
- **Signer-key compromise** drains at most 2% of the vault per UTC day until the operator pauses or the Safe rotates the signer; monitoring on `Claimed` volume is part of the server plan.
