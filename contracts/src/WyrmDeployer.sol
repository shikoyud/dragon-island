// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {VestingWallet} from "@openzeppelin/contracts/finance/VestingWallet.sol";
import {WyrmToken} from "./WyrmToken.sol";
import {WyrmVault} from "./WyrmVault.sol";

/// @title WyrmDeployer
/// @notice Single-use deployer: creates the team VestingWallet, WyrmToken and WyrmVault in one
///         constructor, so the whole system lands atomically or not at all. The token's 40% vault
///         seed is minted to an address this contract computes from its own CREATE nonce, which no
///         external nonce drift can disturb. It wires the vault (burn limit, two-step ownership to
///         the Safe) and keeps no powers afterwards.
contract WyrmDeployer {
    uint64 public constant VESTING_DURATION = 365 days;

    VestingWallet public immutable vesting;
    WyrmToken public immutable token;
    WyrmVault public immutable vault;

    error SafeMustBeContract(address safe);
    error VaultAddressMismatch(address predicted, address actual);

    constructor(
        address ownerSafe,
        address payable treasury,
        address operator,
        address signer,
        address launch,
        uint256 entryFeeWei,
        uint256 burnDailyLimit
    ) {
        if (ownerSafe.code.length == 0) revert SafeMustBeContract(ownerSafe);

        // A contract's first CREATE uses nonce 1: vesting = 1, token = 2, vault = 3.
        address predictedVault = _createAddress(address(this), 3);

        vesting = new VestingWallet(ownerSafe, uint64(block.timestamp), VESTING_DURATION);
        token = new WyrmToken(launch, predictedVault, address(vesting));
        vault = new WyrmVault(token, address(this), treasury, operator, signer, entryFeeWei);
        if (address(vault) != predictedVault) revert VaultAddressMismatch(predictedVault, address(vault));

        vault.setBurnDailyLimit(burnDailyLimit);
        vault.transferOwnership(ownerSafe);
    }

    /// @dev RLP([sender, nonce]) hash for nonces 1..127 (single-byte RLP integers).
    function _createAddress(address sender, uint8 nonce) internal pure returns (address) {
        return address(uint160(uint256(keccak256(abi.encodePacked(hex"d694", sender, nonce)))));
    }
}
