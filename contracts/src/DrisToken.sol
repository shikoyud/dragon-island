// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";

/// @title DrisToken
/// @notice Fixed-supply game token: 1,000,000,000 minted once, no owner, no mint, not upgradeable.
///         Holders may burn their own balance (the vault burns fees and spend batches this way).
contract DrisToken is ERC20, ERC20Burnable, ERC20Permit {
    uint256 public constant TOTAL_SUPPLY = 1_000_000_000e18;

    error ZeroAddress();

    /// @param launch  receives 50% (fair-launch pool funding)
    /// @param vault   receives 40% (DrisVault reward seed)
    /// @param team    receives 10% (a VestingWallet, 12-month linear)
    constructor(address launch, address vault, address team) ERC20("Dragon Island", "DRIS") ERC20Permit("Dragon Island") {
        if (launch == address(0) || vault == address(0) || team == address(0)) revert ZeroAddress();
        _mint(launch, TOTAL_SUPPLY * 50 / 100);
        _mint(vault, TOTAL_SUPPLY * 40 / 100);
        _mint(team, TOTAL_SUPPLY * 10 / 100);
    }
}
