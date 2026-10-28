// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {VestingWallet} from "@openzeppelin/contracts/finance/VestingWallet.sol";
import {Deploy} from "../script/Deploy.s.sol";
import {WyrmDeployer} from "../src/WyrmDeployer.sol";
import {WyrmToken} from "../src/WyrmToken.sol";
import {WyrmVault} from "../src/WyrmVault.sol";

/// @dev One sequential test: `vm.setEnv` is process-global, so parallel tests would race on ALLOW_CHAIN_ID.
contract DeployTest is Test {
    address internal ownerSafe = makeAddr("ownerSafe");
    address internal treasury = makeAddr("treasury");
    address internal operator = makeAddr("operator");
    address internal signer = makeAddr("signer");
    address internal launch = makeAddr("launch");

    function setUp() public {
        vm.etch(ownerSafe, hex"00"); // the Safe must be a contract
        vm.setEnv("OWNER_SAFE", vm.toString(ownerSafe));
        vm.setEnv("TREASURY", vm.toString(treasury));
        vm.setEnv("OPERATOR", vm.toString(operator));
        vm.setEnv("SIGNER", vm.toString(signer));
        vm.setEnv("LAUNCH_RECIPIENT", vm.toString(launch));
        vm.setEnv("ENTRY_FEE_WEI", "500000000000000");
        vm.setEnv("BURN_DAILY_LIMIT", "1000000000000000000000000");
    }

    function test_DeployScript() public {
        // 1. Testnet deployment: one atomic transaction wires everything and hands the vault to the Safe.
        vm.setEnv("ALLOW_CHAIN_ID", "46630");
        vm.chainId(46630);
        (WyrmToken token, WyrmVault vault, VestingWallet vesting) = new Deploy().run();

        assertEq(token.balanceOf(address(vault)), 400_000_000e18);
        assertEq(token.balanceOf(address(vesting)), 100_000_000e18);
        assertEq(token.balanceOf(launch), 500_000_000e18);
        assertEq(vesting.owner(), ownerSafe);
        assertEq(vesting.duration(), 365 days);

        assertEq(vault.pendingOwner(), ownerSafe);
        assertEq(vault.treasury(), treasury);
        assertEq(vault.operator(), operator);
        assertEq(vault.signer(), signer);
        assertEq(vault.entryFeeWei(), 0.0005 ether);
        assertEq(vault.burnDailyLimit(), 1_000_000e18);
        assertEq(address(vault.token()), address(token));

        vm.prank(ownerSafe);
        vault.acceptOwnership();
        assertEq(vault.owner(), ownerSafe);

        // 2. Any other chain is refused by default (mainnet 4663 included).
        vm.chainId(4663);
        Deploy refused = new Deploy();
        vm.expectRevert(abi.encodeWithSelector(Deploy.WrongChain.selector, 4663));
        refused.run();

        // 3. An explicit override allows a local anvil dry run.
        vm.setEnv("ALLOW_CHAIN_ID", "31337");
        vm.chainId(31337);
        (WyrmToken local,,) = new Deploy().run();
        assertEq(local.totalSupply(), 1_000_000_000e18);
    }

    function test_DeployerRequiresASafeContract() public {
        address eoa = makeAddr("eoaSafe");
        vm.expectRevert(abi.encodeWithSelector(WyrmDeployer.SafeMustBeContract.selector, eoa));
        new WyrmDeployer(eoa, payable(treasury), operator, signer, launch, 0.0005 ether, 1e24);
    }

    function test_DeployerIsAtomicAndOwnsNothingAfter() public {
        WyrmDeployer d = new WyrmDeployer(ownerSafe, payable(treasury), operator, signer, launch, 0.0005 ether, 1e24);
        assertEq(d.token().balanceOf(address(d.vault())), 400_000_000e18);
        assertEq(d.vault().owner(), address(d));
        assertEq(d.vault().pendingOwner(), ownerSafe);
        assertEq(d.token().balanceOf(address(d)), 0);
        // The deployer contract has no functions that act on the vault after construction.
        (bool ok,) = address(d).call(abi.encodeWithSignature("setSigner(address)", address(this)));
        assertFalse(ok);
    }
}
