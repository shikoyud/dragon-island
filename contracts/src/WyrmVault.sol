// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable, Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {WyrmToken} from "./WyrmToken.sol";

/// @title WyrmVault
/// @notice The only money contract of the game (spec §13): one-time ETH entry fee, token deposits with a
///         2% fee (1% burned, 1% kept), EIP-712 cumulative withdrawal claims with a 5% fee (2.5% burned,
///         2.5% kept) under a 2%-of-balance daily payout cap, and an operator burn with a daily limit.
///         Balances, spend and prizes live off-chain on the server; only signed totals reach the chain.
/// @dev Roles: owner = 2-of-3 Safe (rotates keys, unpauses, sets limits); operator = server key (burns
///      within the daily limit, sets the ETH entry fee, may pause); signer = voucher key (never holds funds).
///      Time uses block.timestamp only: block.number is unreliable on Arbitrum Orbit chains.
contract WyrmVault is Ownable2Step, Pausable, ReentrancyGuard, EIP712 {
    using SafeERC20 for WyrmToken;

    uint256 public constant BPS = 10_000;
    uint256 public constant DEPOSIT_FEE_BPS = 200;
    uint256 public constant DEPOSIT_BURN_BPS = 100;
    uint256 public constant CLAIM_FEE_BPS = 500;
    uint256 public constant CLAIM_BURN_BPS = 250;
    uint256 public constant PAYOUT_CAP_BPS = 200;
    bytes32 public constant CLAIM_TYPEHASH = keccak256("Claim(address player,uint256 cumulative,uint256 deadline)");

    WyrmToken public immutable token;
    address payable public treasury;
    address public operator;
    address public signer;
    uint256 public entryFeeWei;
    uint256 public burnDailyLimit;

    mapping(address player => bool) public entered;

    event Entered(address indexed player, uint256 paidWei);
    event Deposited(address indexed player, uint256 amount, uint256 credited, uint256 burned);
    event EntryFeeSet(uint256 weiAmount);
    event OperatorSet(address operator);
    event SignerSet(address signer);
    event TreasurySet(address treasury);
    event BurnDailyLimitSet(uint256 limit);

    error ZeroAddress();
    error ZeroAmount();
    error AlreadyEntered();
    error InsufficientEntryFee(uint256 sent, uint256 required);
    error TreasuryTransferFailed();
    error NotOperator();

    modifier onlyOperator() {
        if (msg.sender != operator) revert NotOperator();
        _;
    }

    modifier onlyOwnerOrOperator() {
        if (msg.sender != operator && msg.sender != owner()) revert NotOperator();
        _;
    }

    constructor(
        WyrmToken token_,
        address owner_,
        address payable treasury_,
        address operator_,
        address signer_,
        uint256 entryFeeWei_
    ) Ownable(owner_) EIP712("WyrmVault", "1") {
        if (
            address(token_) == address(0) || treasury_ == address(0) || operator_ == address(0) || signer_ == address(0)
        ) {
            revert ZeroAddress();
        }
        token = token_;
        treasury = treasury_;
        operator = operator_;
        signer = signer_;
        entryFeeWei = entryFeeWei_;
    }

    // ---------------------------------------------------------------- player: entry and deposits

    /// @notice One-time entry that unlocks earning. All ETH sent (fee and any excess) goes to the treasury.
    function enter() external payable whenNotPaused {
        if (entered[msg.sender]) revert AlreadyEntered();
        if (msg.value < entryFeeWei) revert InsufficientEntryFee(msg.value, entryFeeWei);
        entered[msg.sender] = true;
        (bool ok,) = treasury.call{value: msg.value}("");
        if (!ok) revert TreasuryTransferFailed();
        emit Entered(msg.sender, msg.value);
    }

    /// @notice Deposits tokens into the game. 1% is burned, 1% stays in the vault, 98% is credited off-chain.
    function deposit(uint256 amount) external whenNotPaused nonReentrant {
        if (amount == 0) revert ZeroAmount();
        token.safeTransferFrom(msg.sender, address(this), amount);
        (uint256 credited, uint256 burned,) = _split(amount, DEPOSIT_FEE_BPS, DEPOSIT_BURN_BPS);
        if (burned > 0) token.burn(burned);
        emit Deposited(msg.sender, amount, credited, burned);
    }

    // ---------------------------------------------------------------- admin

    /// @notice The server's price job keeps the fee at roughly $1 of ETH; the owner can override.
    function setEntryFee(uint256 weiAmount) external onlyOwnerOrOperator {
        entryFeeWei = weiAmount;
        emit EntryFeeSet(weiAmount);
    }

    function setOperator(address operator_) external onlyOwner {
        if (operator_ == address(0)) revert ZeroAddress();
        operator = operator_;
        emit OperatorSet(operator_);
    }

    function setSigner(address signer_) external onlyOwner {
        if (signer_ == address(0)) revert ZeroAddress();
        signer = signer_;
        emit SignerSet(signer_);
    }

    function setTreasury(address payable treasury_) external onlyOwner {
        if (treasury_ == address(0)) revert ZeroAddress();
        treasury = treasury_;
        emit TreasurySet(treasury_);
    }

    function setBurnDailyLimit(uint256 limit) external onlyOwner {
        burnDailyLimit = limit;
        emit BurnDailyLimitSet(limit);
    }

    /// @notice Either key can halt the vault on an incident; only the Safe can resume it.
    function pause() external onlyOwnerOrOperator {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // ---------------------------------------------------------------- internals

    /// @dev Floor division; dust from rounding stays in the vault via `net + burned + kept == amount`.
    function _split(uint256 amount, uint256 feeBps, uint256 burnBps)
        internal
        pure
        returns (uint256 net, uint256 burned, uint256 kept)
    {
        burned = amount * burnBps / BPS;
        kept = amount * (feeBps - burnBps) / BPS;
        net = amount - burned - kept;
    }
}
