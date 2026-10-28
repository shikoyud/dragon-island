// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {WyrmVault} from "../src/WyrmVault.sol";
import {VaultFixture} from "./helpers/VaultFixture.sol";

contract WyrmVaultAdminTest is VaultFixture {
    event OperatorBurn(uint256 amount, uint256 burnedToday);

    function _unauthorized(address who) internal pure returns (bytes memory) {
        return abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, who);
    }

    function test_OperatorBurnWithinLimit() public {
        uint256 supplyBefore = token.totalSupply();
        vm.expectEmit(false, false, false, true);
        emit OperatorBurn(400_000e18, 400_000e18);
        vm.prank(operator);
        vault.burn(400_000e18);
        assertEq(token.totalSupply(), supplyBefore - 400_000e18);
        assertEq(vault.burnedToday(), 400_000e18);
        assertEq(vault.remainingBurnToday(), BURN_LIMIT - 400_000e18);
    }

    function test_BurnOverLimitRevertsAndResetsNextDay() public {
        vm.startPrank(operator);
        vault.burn(BURN_LIMIT);
        vm.expectRevert(abi.encodeWithSelector(WyrmVault.BurnLimitExceeded.selector, 0));
        vault.burn(1);
        vm.warp(block.timestamp + 1 days);
        vault.burn(1);
        vm.stopPrank();
        assertEq(vault.burnedToday(), 1);
    }

    function test_BurnPartialOverLimitReverts() public {
        vm.startPrank(operator);
        vault.burn(BURN_LIMIT - 10e18);
        vm.expectRevert(abi.encodeWithSelector(WyrmVault.BurnLimitExceeded.selector, 10e18));
        vault.burn(20e18);
        vm.stopPrank();
    }

    function test_BurnOnlyOperator() public {
        vm.expectRevert(WyrmVault.NotOperator.selector);
        vm.prank(alice);
        vault.burn(1);
        vm.expectRevert(WyrmVault.NotOperator.selector);
        vm.prank(owner);
        vault.burn(1);
        vm.expectRevert(WyrmVault.ZeroAmount.selector);
        vm.prank(operator);
        vault.burn(0);
    }

    function test_OperatorRotation() public {
        address fresh = makeAddr("freshOperator");
        vm.prank(owner);
        vault.setOperator(fresh);
        vm.expectRevert(WyrmVault.NotOperator.selector);
        vm.prank(operator);
        vault.burn(1);
        vm.prank(fresh);
        vault.burn(1);
        assertEq(vault.operator(), fresh);
    }

    function test_TwoStepOwnership() public {
        address newSafe = makeAddr("newSafe");
        vm.prank(owner);
        vault.transferOwnership(newSafe);
        assertEq(vault.owner(), owner);
        assertEq(vault.pendingOwner(), newSafe);
        vm.prank(newSafe);
        vault.acceptOwnership();
        assertEq(vault.owner(), newSafe);
        vm.expectRevert(_unauthorized(owner));
        vm.prank(owner);
        vault.setSigner(alice);
    }

    function test_SettersAreOwnerOnly() public {
        vm.startPrank(operator);
        vm.expectRevert(_unauthorized(operator));
        vault.setSigner(alice);
        vm.expectRevert(_unauthorized(operator));
        vault.setBurnDailyLimit(1);
        vm.expectRevert(_unauthorized(operator));
        vault.setTreasury(payable(alice));
        vm.expectRevert(_unauthorized(operator));
        vault.setOperator(alice);
        vm.stopPrank();

        vm.startPrank(owner);
        vm.expectRevert(WyrmVault.ZeroAddress.selector);
        vault.setSigner(address(0));
        vm.expectRevert(WyrmVault.ZeroAddress.selector);
        vault.setOperator(address(0));
        vm.expectRevert(WyrmVault.ZeroAddress.selector);
        vault.setTreasury(payable(address(0)));
        vault.setBurnDailyLimit(5);
        assertEq(vault.burnDailyLimit(), 5);
        vm.stopPrank();
    }

    function test_PauseRules() public {
        vm.prank(operator);
        vault.pause();
        assertTrue(vault.paused());
        vm.expectRevert(_unauthorized(operator));
        vm.prank(operator);
        vault.unpause();

        vm.expectRevert(Pausable.EnforcedPause.selector);
        vm.prank(operator);
        vault.burn(1);
        // setters keep working while paused
        vm.prank(owner);
        vault.setBurnDailyLimit(7);

        vm.prank(owner);
        vault.unpause();
        assertFalse(vault.paused());
        vm.expectRevert(_unauthorized(alice));
        vm.prank(alice);
        vault.unpause();
        vm.expectRevert(WyrmVault.NotOperator.selector);
        vm.prank(alice);
        vault.pause();
    }

    function test_NoTokenPathToOperator() public {
        // Nothing the operator can call moves tokens anywhere but to the zero address (burn).
        uint256 before = token.balanceOf(operator);
        vm.startPrank(operator);
        vault.burn(1e18);
        vault.setEntryFee(1);
        vault.pause();
        vm.stopPrank();
        assertEq(token.balanceOf(operator), before);
    }
}
