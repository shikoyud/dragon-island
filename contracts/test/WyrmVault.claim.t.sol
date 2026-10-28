// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {WyrmVault} from "../src/WyrmVault.sol";
import {VaultFixture} from "./helpers/VaultFixture.sol";

contract WyrmVaultClaimTest is VaultFixture {
    event Claimed(address indexed player, uint256 cumulative, uint256 gross, uint256 net, uint256 burned);

    uint256 internal constant SEED = 400_000_000e18;
    uint256 internal deadline;

    function setUp() public override {
        super.setUp();
        deadline = block.timestamp + 1 hours;
        assertEq(token.balanceOf(address(vault)), SEED);
    }

    function _claim(address who, uint256 cumulative) internal {
        bytes memory sig = sign(SIGNER_PK, who, cumulative, deadline);
        vm.prank(who);
        vault.claim(cumulative, deadline, sig);
    }

    function test_ClaimPaysNetAndBurns() public {
        uint256 supplyBefore = token.totalSupply();
        vm.expectEmit(true, false, false, true);
        emit Claimed(alice, 1_000e18, 1_000e18, 950e18, 25e18);
        _claim(alice, 1_000e18);
        assertEq(token.balanceOf(alice), 1_000_000e18 + 950e18);
        assertEq(token.totalSupply(), supplyBefore - 25e18);
        assertEq(token.balanceOf(address(vault)), SEED - 975e18);
        assertEq(vault.claimed(alice), 1_000e18);
        assertEq(vault.paidToday(), 1_000e18);
    }

    function test_CumulativeOnlyPaysTheDelta() public {
        _claim(alice, 1_000e18);
        bytes memory same = sign(SIGNER_PK, alice, 1_000e18, deadline);
        vm.expectRevert(WyrmVault.NothingToClaim.selector);
        vm.prank(alice);
        vault.claim(1_000e18, deadline, same);
        bytes memory lower = sign(SIGNER_PK, alice, 999e18, deadline);
        vm.expectRevert(WyrmVault.NothingToClaim.selector);
        vm.prank(alice);
        vault.claim(999e18, deadline, lower);
        _claim(alice, 1_500e18);
        assertEq(token.balanceOf(alice), 1_000_000e18 + 950e18 + 475e18);
        assertEq(vault.claimed(alice), 1_500e18);
    }

    function test_RevertBadSignatures() public {
        bytes memory wrongKey = sign(0xBEEF, alice, 1_000e18, deadline);
        vm.expectRevert(WyrmVault.InvalidSignature.selector);
        vm.prank(alice);
        vault.claim(1_000e18, deadline, wrongKey);

        bytes memory forAlice = sign(SIGNER_PK, alice, 1_000e18, deadline);
        vm.expectRevert(WyrmVault.InvalidSignature.selector);
        vm.prank(bob);
        vault.claim(1_000e18, deadline, forAlice);

        bytes memory tampered = sign(SIGNER_PK, alice, 1_000e18, deadline);
        vm.expectRevert(WyrmVault.InvalidSignature.selector);
        vm.prank(alice);
        vault.claim(2_000e18, deadline, tampered);
    }

    function test_RevertExpired() public {
        uint256 past = block.timestamp - 1;
        bytes memory sig = sign(SIGNER_PK, alice, 1_000e18, past);
        vm.expectRevert(WyrmVault.VoucherExpired.selector);
        vm.prank(alice);
        vault.claim(1_000e18, past, sig);
    }

    function test_VoucherBoundToVaultAndChain() public {
        WyrmVault other = new WyrmVault(token, owner, treasury, operator, signer, ENTRY_FEE);
        bytes memory sig = sign(SIGNER_PK, alice, 1_000e18, deadline);
        vm.expectRevert(WyrmVault.InvalidSignature.selector);
        vm.prank(alice);
        other.claim(1_000e18, deadline, sig);

        vm.chainId(1);
        vm.expectRevert(WyrmVault.InvalidSignature.selector);
        vm.prank(alice);
        vault.claim(1_000e18, deadline, sig);
    }

    function test_DailyCapRevertsInFullAndResets() public {
        uint256 cap = SEED * 200 / 10_000; // 8,000,000e18
        assertEq(vault.remainingPayoutToday(), cap);
        _claim(alice, cap);
        assertEq(vault.remainingPayoutToday(), 0);

        bytes memory sig = sign(SIGNER_PK, bob, 1, deadline);
        vm.expectRevert(abi.encodeWithSelector(WyrmVault.DailyCapExceeded.selector, 0));
        vm.prank(bob);
        vault.claim(1, deadline, sig);
        assertEq(vault.claimed(bob), 0);
        assertEq(token.balanceOf(bob), 1_000_000e18);

        vm.warp(block.timestamp + 1 days);
        deadline = block.timestamp + 1 hours;
        uint256 newCap = token.balanceOf(address(vault)) * 200 / 10_000;
        assertLt(newCap, cap);
        assertEq(vault.remainingPayoutToday(), newCap);
        _claim(bob, 1);
        assertEq(vault.claimed(bob), 1);
        assertEq(vault.dayCap(), newCap);
        assertEq(vault.paidToday(), 1);
    }

    function test_PartialOverCapRevertsWhole() public {
        uint256 cap = SEED * 200 / 10_000;
        _claim(alice, cap - 10e18);
        bytes memory sig = sign(SIGNER_PK, bob, 20e18, deadline);
        vm.expectRevert(abi.encodeWithSelector(WyrmVault.DailyCapExceeded.selector, 10e18));
        vm.prank(bob);
        vault.claim(20e18, deadline, sig);
    }

    function test_DustClaimHasNoFee() public {
        uint256 supplyBefore = token.totalSupply();
        vm.expectEmit(true, false, false, true);
        emit Claimed(alice, 1, 1, 1, 0);
        _claim(alice, 1);
        assertEq(token.totalSupply(), supplyBefore);
        assertEq(token.balanceOf(alice), 1_000_000e18 + 1);
    }

    function test_SignerRotation() public {
        (address newSigner, uint256 newPk) = makeAddrAndKey("newSigner");
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        vm.prank(alice);
        vault.setSigner(newSigner);

        vm.prank(owner);
        vault.setSigner(newSigner);
        bytes memory oldSig = sign(SIGNER_PK, alice, 1_000e18, deadline);
        vm.expectRevert(WyrmVault.InvalidSignature.selector);
        vm.prank(alice);
        vault.claim(1_000e18, deadline, oldSig);

        bytes memory newSig = sign(newPk, alice, 1_000e18, deadline);
        vm.prank(alice);
        vault.claim(1_000e18, deadline, newSig);
        assertEq(vault.claimed(alice), 1_000e18);
    }

    function test_RevertWhenPaused() public {
        vm.prank(operator);
        vault.pause();
        bytes memory sig = sign(SIGNER_PK, alice, 1_000e18, deadline);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        vm.prank(alice);
        vault.claim(1_000e18, deadline, sig);
    }

    function testFuzz_ClaimSplitConserves(uint256 gross) public {
        gross = bound(gross, 1, SEED * 200 / 10_000);
        uint256 supplyBefore = token.totalSupply();
        uint256 vaultBefore = token.balanceOf(address(vault));
        _claim(alice, gross);
        uint256 burned = supplyBefore - token.totalSupply();
        uint256 net = token.balanceOf(alice) - 1_000_000e18;
        uint256 kept = gross - burned - net;
        assertEq(vaultBefore - token.balanceOf(address(vault)), burned + net);
        assertLe(burned, gross * 250 / 10_000);
        assertLe(kept, gross * 250 / 10_000);
        assertGe(net, gross * 95 / 100);
    }
}
