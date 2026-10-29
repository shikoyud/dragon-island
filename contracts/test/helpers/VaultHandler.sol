// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {DrisToken} from "../../src/DrisToken.sol";
import {DrisVault} from "../../src/DrisVault.sol";

/// @dev Invariant handler: actors deposit and claim, the operator burns, time moves forward.
///      Ghost variables mirror what the contracts should have done.
contract VaultHandler is Test {
    DrisToken public token;
    DrisVault public vault;
    address public operator;
    uint256 internal signerPk;

    address[] public actors;
    mapping(address => uint256) public ghostCumulative;
    uint256 public ghostBurned;
    uint256 public ghostDeposited;

    constructor(DrisToken token_, DrisVault vault_, address operator_, uint256 signerPk_, address[] memory actors_) {
        token = token_;
        vault = vault_;
        operator = operator_;
        signerPk = signerPk_;
        actors = actors_;
    }

    function _actor(uint256 seed) internal view returns (address) {
        return actors[seed % actors.length];
    }

    function warp(uint256 seconds_) external {
        vm.warp(block.timestamp + bound(seconds_, 0, 2 days));
    }

    function deposit(uint256 seed, uint256 amount) external {
        address who = _actor(seed);
        amount = bound(amount, 1, token.balanceOf(who));
        if (amount == 0) return;
        uint256 supplyBefore = token.totalSupply();
        vm.startPrank(who);
        token.approve(address(vault), amount);
        vault.deposit(amount);
        vm.stopPrank();
        ghostBurned += supplyBefore - token.totalSupply();
        ghostDeposited += amount;
    }

    function claim(uint256 seed, uint256 step) external {
        address who = _actor(seed);
        step = bound(step, 1, 2_000_000e18);
        uint256 cumulative = ghostCumulative[who] + step;
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory sig = _sign(who, cumulative, deadline);
        uint256 supplyBefore = token.totalSupply();
        vm.prank(who);
        try vault.claim(cumulative, deadline, sig) {
            ghostCumulative[who] = cumulative;
            ghostBurned += supplyBefore - token.totalSupply();
        } catch {}
    }

    function burn(uint256 amount) external {
        amount = bound(amount, 1, 2_000_000e18);
        uint256 supplyBefore = token.totalSupply();
        vm.prank(operator);
        try vault.burn(amount) {
            ghostBurned += supplyBefore - token.totalSupply();
        } catch {}
    }

    function actorCount() external view returns (uint256) {
        return actors.length;
    }

    function _sign(address player, uint256 cumulative, uint256 deadline) internal view returns (bytes memory) {
        (, string memory name, string memory version, uint256 chainId, address verifying,,) = vault.eip712Domain();
        bytes32 domain = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256(bytes(name)),
                keccak256(bytes(version)),
                chainId,
                verifying
            )
        );
        bytes32 structHash = keccak256(abi.encode(vault.CLAIM_TYPEHASH(), player, cumulative, deadline));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerPk, keccak256(abi.encodePacked(hex"1901", domain, structHash)));
        return abi.encodePacked(r, s, v);
    }
}
