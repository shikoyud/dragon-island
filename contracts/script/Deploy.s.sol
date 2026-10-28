// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {VestingWallet} from "@openzeppelin/contracts/finance/VestingWallet.sol";
import {WyrmToken} from "../src/WyrmToken.sol";
import {WyrmVault} from "../src/WyrmVault.sol";

/// @notice Deploys VestingWallet (team), WyrmToken and WyrmVault, then hands the vault to the Safe.
/// @dev Testnet only by default: reverts unless `block.chainid == ALLOW_CHAIN_ID` (default 46630).
///      The deployer stays owner only long enough to set the burn limit, then starts the two-step
///      transfer; the Safe must call `acceptOwnership()`.
///
///      Env: OWNER_SAFE, TREASURY, OPERATOR, SIGNER, LAUNCH_RECIPIENT, ENTRY_FEE_WEI, BURN_DAILY_LIMIT,
///           optional ALLOW_CHAIN_ID.
contract Deploy is Script {
    uint256 public constant TESTNET_CHAIN_ID = 46630;
    uint64 public constant VESTING_DURATION = 365 days;

    error WrongChain(uint256 chainId);

    function run() external returns (WyrmToken token, WyrmVault vault, VestingWallet vesting) {
        uint256 allowed = vm.envOr("ALLOW_CHAIN_ID", TESTNET_CHAIN_ID);
        if (block.chainid != allowed) revert WrongChain(block.chainid);

        address ownerSafe = vm.envAddress("OWNER_SAFE");
        address payable treasury = payable(vm.envAddress("TREASURY"));
        address operator = vm.envAddress("OPERATOR");
        address signer = vm.envAddress("SIGNER");
        address launch = vm.envAddress("LAUNCH_RECIPIENT");
        uint256 entryFeeWei = vm.envUint("ENTRY_FEE_WEI");
        uint256 burnDailyLimit = vm.envUint("BURN_DAILY_LIMIT");

        vm.startBroadcast();
        // The token needs the vault address before the vault exists. Deploy order: vesting (nonce n),
        // token (n+1), vault (n+2), all created by the broadcast sender (a keystore account under
        // `forge script`, Foundry's default sender under `forge test`).
        (, address deployer,) = vm.readCallers();
        address predictedVault = vm.computeCreateAddress(deployer, vm.getNonce(deployer) + 2);
        vesting = new VestingWallet(ownerSafe, uint64(block.timestamp), VESTING_DURATION);
        token = new WyrmToken(launch, predictedVault, address(vesting));
        vault = new WyrmVault(token, deployer, treasury, operator, signer, entryFeeWei);
        require(address(vault) == predictedVault, "vault address mismatch");
        require(token.balanceOf(address(vault)) == token.TOTAL_SUPPLY() * 40 / 100, "vault seed mismatch");
        vault.setBurnDailyLimit(burnDailyLimit);
        vault.transferOwnership(ownerSafe);
        vm.stopBroadcast();

        console.log("chain id        ", block.chainid);
        console.log("WyrmToken       ", address(token));
        console.log("WyrmVault       ", address(vault));
        console.log("Team vesting    ", address(vesting));
        console.log("Pending owner   ", ownerSafe);
        console.log("Next step: the Safe calls vault.acceptOwnership()");
    }
}
