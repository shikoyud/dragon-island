// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {DrisVault} from "../src/DrisVault.sol";
import {VaultFixture} from "./helpers/VaultFixture.sol";

/// @dev Findings from the Phase 3 review, pinned as tests.
contract DrisVaultReviewTest is VaultFixture {
    event PayoutDayStarted(uint256 indexed day, uint256 cap);

    function test_RenounceOwnershipIsDisabled() public {
        vm.prank(owner);
        vm.expectRevert(DrisVault.RenounceDisabled.selector);
        vault.renounceOwnership();
        assertEq(vault.owner(), owner);
    }

    function test_LoweringBurnLimitMidDayDoesNotPanic() public {
        vm.prank(operator);
        vault.burn(600_000e18);
        vm.prank(owner);
        vault.setBurnDailyLimit(500_000e18);
        assertEq(vault.remainingBurnToday(), 0);
        vm.expectRevert(abi.encodeWithSelector(DrisVault.BurnLimitExceeded.selector, 0));
        vm.prank(operator);
        vault.burn(1);
        vm.warp(block.timestamp + 1 days);
        assertEq(vault.remainingBurnToday(), 500_000e18);
    }

    function test_MalformedSignaturesAreInvalidSignature() public {
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory tooShort = hex"deadbeef";
        vm.expectRevert(DrisVault.InvalidSignature.selector);
        vm.prank(alice);
        vault.claim(1e18, deadline, tooShort);

        bytes memory good = sign(SIGNER_PK, alice, 1e18, deadline);
        // Force a high-s encoding of the same signature (malleable form) and expect rejection.
        (bytes32 r, bytes32 s, uint8 v) = _split(good);
        bytes32 highS =
            bytes32(uint256(0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141) - uint256(s));
        bytes memory malleable = abi.encodePacked(r, highS, v == 27 ? uint8(28) : uint8(27));
        vm.expectRevert(DrisVault.InvalidSignature.selector);
        vm.prank(alice);
        vault.claim(1e18, deadline, malleable);
    }

    function test_PayoutDayStartedEvent() public {
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory sig = sign(SIGNER_PK, alice, 1e18, deadline);
        uint256 cap = token.balanceOf(address(vault)) * 200 / 10_000;
        vm.expectEmit(true, false, false, true);
        emit PayoutDayStarted(block.timestamp / 1 days + 1, cap);
        vm.prank(alice);
        vault.claim(1e18, deadline, sig);
    }

    function _split(bytes memory sig) internal pure returns (bytes32 r, bytes32 s, uint8 v) {
        assembly {
            r := mload(add(sig, 32))
            s := mload(add(sig, 64))
            v := byte(0, mload(add(sig, 96)))
        }
    }
}
