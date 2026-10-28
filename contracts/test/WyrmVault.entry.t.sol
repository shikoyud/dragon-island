// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {WyrmVault} from "../src/WyrmVault.sol";
import {RejectingTreasury, VaultFixture} from "./helpers/VaultFixture.sol";

contract WyrmVaultEntryTest is VaultFixture {
    event Entered(address indexed player, uint256 paidWei);

    function test_EnterExactFee() public {
        vm.expectEmit(true, false, false, true);
        emit Entered(alice, ENTRY_FEE);
        vm.prank(alice);
        vault.enter{value: ENTRY_FEE}();
        assertTrue(vault.entered(alice));
        assertEq(treasury.balance, ENTRY_FEE);
        assertEq(address(vault).balance, 0);
    }

    function test_EnterForwardsExcess() public {
        vm.prank(alice);
        vault.enter{value: ENTRY_FEE + 1}();
        assertEq(treasury.balance, ENTRY_FEE + 1);
        assertEq(address(vault).balance, 0);
    }

    function test_RevertInsufficientFee() public {
        vm.expectRevert(abi.encodeWithSelector(WyrmVault.InsufficientEntryFee.selector, ENTRY_FEE - 1, ENTRY_FEE));
        vm.prank(alice);
        vault.enter{value: ENTRY_FEE - 1}();
        assertFalse(vault.entered(alice));
    }

    function test_RevertAlreadyEntered() public {
        vm.startPrank(alice);
        vault.enter{value: ENTRY_FEE}();
        vm.expectRevert(WyrmVault.AlreadyEntered.selector);
        vault.enter{value: ENTRY_FEE}();
        vm.stopPrank();
    }

    function test_RevertWhenPaused() public {
        vm.prank(owner);
        vault.pause();
        vm.expectRevert(Pausable.EnforcedPause.selector);
        vm.prank(alice);
        vault.enter{value: ENTRY_FEE}();
    }

    function test_RevertTreasuryRejectsEth() public {
        RejectingTreasury bad = new RejectingTreasury();
        vm.prank(owner);
        vault.setTreasury(payable(address(bad)));
        vm.expectRevert(WyrmVault.TreasuryTransferFailed.selector);
        vm.prank(alice);
        vault.enter{value: ENTRY_FEE}();
    }

    function test_SetEntryFeeByOperatorAndOwner() public {
        vm.prank(operator);
        vault.setEntryFee(1 ether);
        assertEq(vault.entryFeeWei(), 1 ether);
        vm.prank(owner);
        vault.setEntryFee(2 ether);
        assertEq(vault.entryFeeWei(), 2 ether);
        vm.expectRevert(WyrmVault.NotOperator.selector);
        vm.prank(alice);
        vault.setEntryFee(3 ether);
    }

    function test_ConstructorRejectsZeroAddresses() public {
        vm.expectRevert(WyrmVault.ZeroAddress.selector);
        new WyrmVault(token, owner, payable(address(0)), operator, signer, ENTRY_FEE);
        vm.expectRevert(WyrmVault.ZeroAddress.selector);
        new WyrmVault(token, owner, treasury, address(0), signer, ENTRY_FEE);
        vm.expectRevert(WyrmVault.ZeroAddress.selector);
        new WyrmVault(token, owner, treasury, operator, address(0), ENTRY_FEE);
    }
}
