// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {VestingWallet} from "@openzeppelin/contracts/finance/VestingWallet.sol";
import {WyrmDeployer} from "../src/WyrmDeployer.sol";
import {WyrmToken} from "../src/WyrmToken.sol";
import {WyrmVault} from "../src/WyrmVault.sol";

/// @notice Deploys the whole system in one transaction via WyrmDeployer and hands the vault to the Safe.
/// @dev Testnet only by default: reverts unless `block.chainid == ALLOW_CHAIN_ID` (default 46630).
///      After this runs, the Safe must call `vault.acceptOwnership()`.
///
///      Env: OWNER_SAFE (must be a contract), TREASURY, OPERATOR, SIGNER, LAUNCH_RECIPIENT,
///           ENTRY_FEE_WEI, BURN_DAILY_LIMIT, optional ALLOW_CHAIN_ID.
contract Deploy is Script {
    uint256 public constant TESTNET_CHAIN_ID = 46630;

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
        WyrmDeployer deployer =
            new WyrmDeployer(ownerSafe, treasury, operator, signer, launch, entryFeeWei, burnDailyLimit);
        vm.stopBroadcast();

        token = deployer.token();
        vault = deployer.vault();
        vesting = deployer.vesting();

        console.log("chain id        ", block.chainid);
        console.log("WyrmDeployer    ", address(deployer));
        console.log("WyrmToken       ", address(token));
        console.log("WyrmVault       ", address(vault));
        console.log("Team vesting    ", address(vesting));
        console.log("Pending owner   ", ownerSafe);
        console.log("Next step: the Safe calls vault.acceptOwnership()");
    }
}
