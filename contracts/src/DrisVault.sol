// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable, Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {DrisToken} from "./DrisToken.sol";

/// @title DrisVault
/// @notice The only money contract of the game (spec §13): one-time ETH entry fee, token deposits with a
///         2% fee (1% burned, 1% kept), EIP-712 cumulative withdrawal claims with a 5% fee (2.5% burned,
///         2.5% kept) under a 2%-of-balance daily payout cap, and an operator burn with a daily limit.
///         Balances, spend and prizes live off-chain on the server; only signed totals reach the chain.
/// @dev Roles: owner = 2-of-3 Safe (rotates keys, unpauses, sets limits); operator = server key (burns
///      within the daily limit, sets the ETH entry fee, may pause); signer = voucher key (never holds funds).
///      Time uses block.timestamp only: block.number is unreliable on Arbitrum Orbit chains.
contract DrisVault is Ownable2Step, Pausable, ReentrancyGuard, EIP712 {
    using SafeERC20 for DrisToken;

    uint256 public constant BPS = 10_000;
    uint256 public constant DEPOSIT_FEE_BPS = 200;
    uint256 public constant DEPOSIT_BURN_BPS = 100;
    uint256 public constant CLAIM_FEE_BPS = 500;
    uint256 public constant CLAIM_BURN_BPS = 250;
    uint256 public constant PAYOUT_CAP_BPS = 200;
    bytes32 public constant CLAIM_TYPEHASH = keccak256("Claim(address player,uint256 cumulative,uint256 deadline)");

    DrisToken public immutable token;
    address payable public treasury;
    address public operator;
    address public signer;
    uint256 public entryFeeWei;
    uint256 public burnDailyLimit;

    mapping(address player => bool) public entered;
    /// @dev Cumulative gross total already paid out per player; vouchers carry the new total.
    mapping(address player => uint256) public claimed;

    /// @dev Payout cap for the current UTC day, snapshotted from the balance at the day's first claim.
    ///      `capDay` is stored 1-based (`utcDay + 1`) so the zero value never matches a real day.
    uint256 public capDay;
    uint256 public dayCap;
    uint256 public paidToday;

    /// @dev Operator burn tracking for the current UTC day (same 1-based key as `capDay`).
    uint256 public burnDay;
    uint256 public burnedToday;

    event Entered(address indexed player, uint256 paidWei);
    event Deposited(address indexed player, uint256 amount, uint256 credited, uint256 burned);
    event Claimed(address indexed player, uint256 cumulative, uint256 gross, uint256 net, uint256 burned);
    event OperatorBurn(uint256 amount, uint256 burnedToday);
    event PayoutDayStarted(uint256 indexed day, uint256 cap);
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
    error VoucherExpired();
    error InvalidSignature();
    error NothingToClaim();
    error DailyCapExceeded(uint256 remaining);
    error BurnLimitExceeded(uint256 remaining);
    error RenounceDisabled();

    modifier onlyOperator() {
        if (msg.sender != operator) revert NotOperator();
        _;
    }

    modifier onlyOwnerOrOperator() {
        if (msg.sender != operator && msg.sender != owner()) revert NotOperator();
        _;
    }

    constructor(
        DrisToken token_,
        address owner_,
        address payable treasury_,
        address operator_,
        address signer_,
        uint256 entryFeeWei_
    ) Ownable(owner_) EIP712("DrisVault", "1") {
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

    // ---------------------------------------------------------------- player: claims

    /// @notice Withdraws `cumulative - claimed[msg.sender]` gross, authorised by the server's EIP-712 voucher.
    ///         5% fee: 2.5% burned, 2.5% stays. At most 2% of the vault's balance leaves per UTC day;
    ///         a claim over the cap reverts in full and can be retried the next day.
    ///      The server must size vouchers to fit `remainingPayoutToday()`: a single voucher larger than
    ///      the day's cap can never be paid, since the cap only shrinks as the vault drains.
    /// @dev Replay-safe by construction: a voucher's cumulative total can only be paid once, and the
    ///      domain binds chain id and vault address. `deadline` limits how long a stale voucher lives.
    function claim(uint256 cumulative, uint256 deadline, bytes calldata signature) external whenNotPaused nonReentrant {
        if (block.timestamp > deadline) revert VoucherExpired();
        bytes32 digest = _hashTypedDataV4(keccak256(abi.encode(CLAIM_TYPEHASH, msg.sender, cumulative, deadline)));
        (address recovered, ECDSA.RecoverError err,) = ECDSA.tryRecover(digest, signature);
        if (err != ECDSA.RecoverError.NoError || recovered != signer) revert InvalidSignature();
        uint256 already = claimed[msg.sender];
        if (cumulative <= already) revert NothingToClaim();
        uint256 gross = cumulative - already;

        _rollDay();
        uint256 remaining = dayCap - paidToday;
        if (gross > remaining) revert DailyCapExceeded(remaining);

        claimed[msg.sender] = cumulative;
        paidToday += gross;
        (uint256 net, uint256 burned,) = _split(gross, CLAIM_FEE_BPS, CLAIM_BURN_BPS);
        if (burned > 0) token.burn(burned);
        token.safeTransfer(msg.sender, net);
        emit Claimed(msg.sender, cumulative, gross, net, burned);
    }

    /// @notice Gross amount that can still be claimed today (what the next claim would see).
    function remainingPayoutToday() external view returns (uint256) {
        if (_dayKey() != capDay) return token.balanceOf(address(this)) * PAYOUT_CAP_BPS / BPS;
        return dayCap - paidToday;
    }

    // ---------------------------------------------------------------- operator: spend burn batch

    /// @notice Burns the burn share of off-chain spend (spec §13: 50% of spend, batched daily).
    ///         Bounded per UTC day so a compromised operator key can destroy at most `burnDailyLimit`.
    function burn(uint256 amount) external onlyOperator whenNotPaused {
        if (amount == 0) revert ZeroAmount();
        uint256 today = _dayKey();
        if (today != burnDay) {
            burnDay = today;
            burnedToday = 0;
        }
        uint256 remaining = _saturatingSub(burnDailyLimit, burnedToday);
        if (amount > remaining) revert BurnLimitExceeded(remaining);
        burnedToday += amount;
        token.burn(amount);
        emit OperatorBurn(amount, burnedToday);
    }

    /// @notice Operator burn allowance left today.
    function remainingBurnToday() external view returns (uint256) {
        if (_dayKey() != burnDay) return burnDailyLimit;
        return _saturatingSub(burnDailyLimit, burnedToday);
    }

    // ---------------------------------------------------------------- admin

    /// @notice The server's price job keeps the fee at roughly $1 of ETH; the owner can override.
    function setEntryFee(uint256 weiAmount) external onlyOwnerOrOperator {
        entryFeeWei = weiAmount;
        emit EntryFeeSet(weiAmount);
    }

    /// @notice Disabled: an ownerless vault could never be unpaused or have its signer rotated.
    function renounceOwnership() public view override onlyOwner {
        revert RenounceDisabled();
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

    /// @dev Starts a new payout day on the first claim after 00:00 UTC.
    function _rollDay() internal {
        uint256 today = _dayKey();
        if (today != capDay) {
            capDay = today;
            dayCap = token.balanceOf(address(this)) * PAYOUT_CAP_BPS / BPS;
            paidToday = 0;
            emit PayoutDayStarted(today, dayCap);
        }
    }

    /// @dev 1-based UTC day index (block.timestamp only; block.number is unreliable on Orbit chains).
    function _dayKey() internal view returns (uint256) {
        return block.timestamp / 1 days + 1;
    }

    function _saturatingSub(uint256 a, uint256 b) internal pure returns (uint256) {
        return a > b ? a - b : 0;
    }

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
