// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20Errors} from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {DrisVault} from "../src/DrisVault.sol";
import {VaultFixture} from "./helpers/VaultFixture.sol";

contract DrisVaultDepositTest is VaultFixture {
    event Deposited(address indexed player, uint256 amount, uint256 credited, uint256 burned);

    function _approve(address who, uint256 amount) internal {
        vm.prank(who);
        token.approve(address(vault), amount);
    }

    function test_DepositSplitsFees() public {
        _approve(alice, 10_000e18);
        uint256 vaultBefore = token.balanceOf(address(vault));
        uint256 supplyBefore = token.totalSupply();

        vm.expectEmit(true, false, false, true);
        emit Deposited(alice, 10_000e18, 9_800e18, 100e18);
        vm.prank(alice);
        vault.deposit(10_000e18);

        assertEq(token.balanceOf(alice), 1_000_000e18 - 10_000e18);
        assertEq(token.balanceOf(address(vault)), vaultBefore + 9_900e18);
        assertEq(token.totalSupply(), supplyBefore - 100e18);
    }

    function test_DepositDustHasNoFee() public {
        _approve(alice, 1);
        uint256 supplyBefore = token.totalSupply();
        vm.expectEmit(true, false, false, true);
        emit Deposited(alice, 1, 1, 0);
        vm.prank(alice);
        vault.deposit(1);
        assertEq(token.totalSupply(), supplyBefore);
    }

    function test_RevertZeroAmount() public {
        vm.expectRevert(DrisVault.ZeroAmount.selector);
        vm.prank(alice);
        vault.deposit(0);
    }

    function test_RevertWithoutAllowance() public {
        vm.expectRevert(
            abi.encodeWithSelector(IERC20Errors.ERC20InsufficientAllowance.selector, address(vault), 0, 1e18)
        );
        vm.prank(alice);
        vault.deposit(1e18);
    }

    function test_RevertWhenPaused() public {
        _approve(alice, 1e18);
        vm.prank(owner);
        vault.pause();
        vm.expectRevert(Pausable.EnforcedPause.selector);
        vm.prank(alice);
        vault.deposit(1e18);
    }

    function testFuzz_DepositConserves(uint256 amount) public {
        amount = bound(amount, 1, 1_000_000e18);
        _approve(alice, amount);
        uint256 vaultBefore = token.balanceOf(address(vault));
        uint256 supplyBefore = token.totalSupply();
        vm.prank(alice);
        vault.deposit(amount);
        uint256 burned = supplyBefore - token.totalSupply();
        uint256 stayed = token.balanceOf(address(vault)) - vaultBefore; // credited + kept
        assertEq(burned + stayed, amount);
        assertLe(burned, amount / 100);
        assertEq(token.balanceOf(alice), 1_000_000e18 - amount);
    }
}
